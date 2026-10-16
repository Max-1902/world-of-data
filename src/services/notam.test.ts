import { describe, it, expect } from 'vitest'
import { analyzeAirspace, localSolarHour, FIR_REGIONS, MIN_GLOBAL_FLIGHTS } from './notam'

// 09:00 UTC: local daytime for Tehran (lng 53.7 → ~12:35 solar)
const NOW = Date.UTC(2026, 9, 15, 9, 0)
const tehran = FIR_REGIONS.find(f => f.icao === 'OIIX')!
const at = (n: number, lat: number, lng: number) => Array.from({ length: n }, () => ({ latitude: lat, longitude: lng }))
/** A healthy global feed: enough aircraft parked in the South Pacific, outside every FIR box. */
const background = at(MIN_GLOBAL_FLIGHTS, -60, -150)
const forTehran = (n: number, now = NOW) => {
  const { alerts, statuses } = analyzeAirspace([...background, ...at(n, 32, 53)], now)
  return { alert: alerts.find(a => a.icao === 'OIIX'), status: statuses.find(s => s.icao === 'OIIX')! }
}

describe('analyzeAirspace: coverage artefacts are not airspace events', () => {
  it('an empty flight feed is "no data" for every FIR, with no alerts (regression: it read as 29 closures)', () => {
    const { alerts, statuses, feedOk } = analyzeAirspace([], NOW)
    expect(feedOk).toBe(false)
    expect(alerts).toEqual([])
    expect(statuses.every(s => s.status === 'no_data')).toBe(true)
  })

  it('a partial feed is also "no data"', () => {
    const { alerts, statuses } = analyzeAirspace(at(MIN_GLOBAL_FLIGHTS - 1, -60, -150), NOW)
    expect(alerts).toEqual([])
    expect(statuses.every(s => s.status === 'no_data')).toBe(true)
  })

  it('raises no alert at local night, whatever the count', () => {
    const night = Date.UTC(2026, 9, 15, 23, 0) // Tehran ~02:35 solar
    const { alert, status } = forTehran(0, night)
    expect(alert).toBeUndefined()
    expect(status.status).toBe('not_assessed')
    expect(status.reason).toMatch(/night/)
  })

  it('never raises a CRITICAL alert or says "closed" while no FIR has verified receiver coverage', () => {
    expect(FIR_REGIONS.some(f => f.coverageVerified)).toBe(false)
    for (let h = 0; h < 24; h++) {
      const { alerts, statuses } = analyzeAirspace(background, Date.UTC(2026, 9, 15, h))
      expect(alerts.every(a => a.severity !== 'critical')).toBe(true)
      expect(alerts.every(a => !/closed|closure/i.test(a.message))).toBe(true)
      expect(alerts.every(a => /unverified/i.test(a.message))).toBe(true)
      expect(statuses.every(s => s.reason.length > 0)).toBe(true)
    }
  })

  it('every alert is for a FIR assessed in local daytime', () => {
    for (let h = 0; h < 24; h++) {
      const now = Date.UTC(2026, 9, 15, h)
      for (const a of analyzeAirspace(background, now).alerts) {
        expect(localSolarHour(now, a.lng)).toBeGreaterThanOrEqual(6)
      }
    }
  })
})

describe('analyzeAirspace: thresholds', () => {
  it('reports a status for every FIR', () => {
    const { statuses } = analyzeAirspace(background, NOW)
    expect(statuses.map(s => s.icao)).toEqual(FIR_REGIONS.map(f => f.icao))
  })

  it('is normal, with no alert, when traffic is at the reference', () => {
    const { alert, status } = forTehran(tehran.baseline)
    expect(status.status).toBe('normal')
    expect(status.liveCount).toBe(tehran.baseline)
    expect(alert).toBeUndefined()
  })

  it('is normal at a 47% drop and low from a 50% drop', () => {
    // reference 30: 16 planes = 47% drop, 15 planes = 50% drop
    expect(forTehran(16).status.status).toBe('normal')
    const { alert, status } = forTehran(15)
    expect(status.status).toBe('low')
    expect(alert).toMatchObject({ severity: 'info', type: 'LOW_TRAFFIC', dropPct: 50, liveCount: 15, baseline: 30 })
  })

  it('is very low, as a warning, from an 85% drop', () => {
    // reference 30: 5 planes = 83% drop (low); 4 planes = 87% drop (very low)
    expect(forTehran(5).status.status).toBe('low')
    const { alert, status } = forTehran(4)
    expect(status.status).toBe('very_low')
    expect(alert).toMatchObject({ severity: 'warning', type: 'VERY_LOW_TRAFFIC', dropPct: 87 })
  })

  it('treats traffic above the reference as normal (negative drop)', () => {
    const { alert, status } = forTehran(200)
    expect(status.status).toBe('normal')
    expect(alert).toBeUndefined()
  })

  it('stamps alerts with the provided time and a deterministic id', () => {
    const { alert } = forTehran(0)
    expect(alert!.detectedAt).toBe(NOW)
    expect(alert!.id).toBe(`OIIX-${NOW}`)
  })

  it('only counts aircraft inside the FIR bounding box (inclusive) and ignores null positions', () => {
    const edge = [
      ...background,
      { latitude: tehran.minLat, longitude: tehran.minLng },
      { latitude: tehran.maxLat, longitude: tehran.maxLng },
      { latitude: tehran.maxLat + 0.01, longitude: tehran.maxLng },
      { latitude: null, longitude: 50 },
      { latitude: 30, longitude: null },
    ]
    const { statuses } = analyzeAirspace(edge, NOW)
    expect(statuses.find(s => s.icao === 'OIIX')!.liveCount).toBe(2)
  })

  it('sorts alerts by severity, then by larger drop', () => {
    const rank = { critical: 0, warning: 1, info: 2 }
    const { alerts } = analyzeAirspace([...background, ...at(15, 32, 53)], NOW)
    expect(alerts.length).toBeGreaterThan(1)
    for (let i = 1; i < alerts.length; i++) {
      const [a, b] = [alerts[i - 1], alerts[i]]
      expect(rank[a.severity]).toBeLessThanOrEqual(rank[b.severity])
      if (a.severity === b.severity) expect(a.dropPct).toBeGreaterThanOrEqual(b.dropPct)
    }
  })

  it('a zero or tiny reference is "not assessed", never an alert', () => {
    const tiny = FIR_REGIONS.filter(f => f.baseline < 3)
    expect(tiny.length).toBeGreaterThan(0)
    const { alerts, statuses } = analyzeAirspace(background, NOW)
    for (const f of tiny) {
      expect(statuses.find(s => s.icao === f.icao)!.status).toBe('not_assessed')
      expect(alerts.find(a => a.icao === f.icao)).toBeUndefined()
    }
  })
})

describe('localSolarHour', () => {
  it('shifts UTC by one hour per 15° and wraps', () => {
    expect(localSolarHour(Date.UTC(2026, 0, 1, 12), 0)).toBe(12)
    expect(localSolarHour(Date.UTC(2026, 0, 1, 12), 90)).toBe(18)
    expect(localSolarHour(Date.UTC(2026, 0, 1, 2), -45)).toBe(23)
  })
})

describe('FIR_REGIONS data', () => {
  it('has unique ICAO codes and well-formed, non-inverted bounding boxes', () => {
    expect(new Set(FIR_REGIONS.map(f => f.icao)).size).toBe(FIR_REGIONS.length)
    for (const f of FIR_REGIONS) {
      expect(f.icao, f.name).toMatch(/^[A-Z]{4}$/)
      expect(f.minLat, f.name).toBeLessThan(f.maxLat)
      expect(f.minLng, f.name).toBeLessThan(f.maxLng)
      expect(f.baseline, f.name).toBeGreaterThanOrEqual(0) // 0 = airspace already closed (e.g. Kyiv)
    }
  })
  it('places each marker inside its own bounding box', () => {
    for (const f of FIR_REGIONS) {
      expect(f.lat, f.name).toBeGreaterThanOrEqual(f.minLat)
      expect(f.lat, f.name).toBeLessThanOrEqual(f.maxLat)
      expect(f.lng, f.name).toBeGreaterThanOrEqual(f.minLng)
      expect(f.lng, f.name).toBeLessThanOrEqual(f.maxLng)
    }
  })
})
