import { describe, it, expect } from 'vitest'
import { analyzeAirspace, FIR_REGIONS } from './notam'

const NOW = 1_700_000_000_000
const tehran = FIR_REGIONS.find(f => f.icao === 'OIIX')!
const planes = (n: number, lat = 32, lng = 53) => Array.from({ length: n }, () => ({ latitude: lat, longitude: lng }))
const forTehran = (n: number) => {
  const { alerts, statuses } = analyzeAirspace(planes(n), NOW)
  return { alert: alerts.find(a => a.icao === 'OIIX'), status: statuses.find(s => s.icao === 'OIIX')! }
}

describe('analyzeAirspace', () => {
  it('reports a status for every FIR', () => {
    const { statuses } = analyzeAirspace([], NOW)
    expect(statuses.map(s => s.icao)).toEqual(FIR_REGIONS.map(f => f.icao))
  })

  it('is normal, with no alert, when traffic is at baseline', () => {
    const { alert, status } = forTehran(tehran.baseline)
    expect(status.status).toBe('normal')
    expect(status.liveCount).toBe(tehran.baseline)
    expect(alert).toBeUndefined()
  })

  it('is normal at a 49% drop and restricted from a 50% drop', () => {
    // baseline 30: 16 planes = 47% drop, 15 planes = 50% drop
    expect(forTehran(16).status.status).toBe('normal')
    const { alert, status } = forTehran(15)
    expect(status.status).toBe('restricted')
    expect(alert).toMatchObject({ severity: 'warning', type: 'RESTRICTION', dropPct: 50, liveCount: 15, baseline: 30 })
  })

  it('is closed with a critical alert from an 85% drop', () => {
    // baseline 30: 5 planes = 83% drop (restricted); 4 planes = 87% drop (closed)
    expect(forTehran(5).status.status).toBe('restricted')
    const { alert, status } = forTehran(4)
    expect(status.status).toBe('closed')
    expect(alert).toMatchObject({ severity: 'critical', type: 'CLOSURE', dropPct: 87 })
    expect(alert!.message).toContain('effectively closed')
  })

  it('treats a drop of exactly 85% as closed (threshold is inclusive)', () => {
    // find a FIR whose baseline makes 85% an integer number of missing aircraft
    const fir = FIR_REGIONS.find(f => f.baseline >= 20 && (f.baseline * 0.15) % 1 === 0)!
    expect(fir, 'need a FIR with a 20-multiple baseline for this test').toBeTruthy()
    const count = fir.baseline * 0.15
    const flights = Array.from({ length: count }, () => ({ latitude: fir.lat, longitude: fir.lng }))
    const { statuses, alerts } = analyzeAirspace(flights, NOW)
    // other FIRs' bounding boxes may overlap; only the target FIR's outcome matters
    expect(statuses.find(s => s.icao === fir.icao)!.status).toBe('closed')
    expect(alerts.find(a => a.icao === fir.icao)).toMatchObject({ dropPct: 85, severity: 'critical' })
  })

  it('says "0 aircraft detected" for a completely empty FIR', () => {
    const { alert } = forTehran(0)
    expect(alert).toMatchObject({ dropPct: 100, severity: 'critical' })
    expect(alert!.message).toContain('0 aircraft detected')
  })

  it('treats traffic above baseline as normal (negative drop)', () => {
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
      { latitude: tehran.minLat, longitude: tehran.minLng },
      { latitude: tehran.maxLat, longitude: tehran.maxLng },
      { latitude: tehran.maxLat + 0.01, longitude: tehran.maxLng },
      { latitude: null, longitude: 50 },
      { latitude: 30, longitude: null },
    ]
    const { statuses } = analyzeAirspace(edge, NOW)
    expect(statuses.find(s => s.icao === 'OIIX')!.liveCount).toBe(2)
  })

  it('sorts alerts critical-first, then by larger drop', () => {
    const { alerts } = analyzeAirspace([], NOW) // empty sky: every FIR with a baseline is closed
    expect(alerts.length).toBeGreaterThan(0)
    for (let i = 1; i < alerts.length; i++) {
      const [a, b] = [alerts[i - 1], alerts[i]]
      if (a.severity === b.severity) expect(a.dropPct).toBeGreaterThanOrEqual(b.dropPct)
      else expect(a.severity).toBe('critical')
    }
  })

  it('a zero-baseline FIR is always normal (no division by zero, no alert)', () => {
    const zero = FIR_REGIONS.filter(f => f.baseline === 0)
    const { alerts, statuses } = analyzeAirspace([], NOW)
    for (const f of zero) {
      expect(statuses.find(s => s.icao === f.icao)!.status).toBe('normal')
      expect(alerts.find(a => a.icao === f.icao)).toBeUndefined()
    }
  })

  it('never alerts for FIRs with a tiny baseline (<3), as too noisy', () => {
    const tiny = FIR_REGIONS.filter(f => f.baseline < 3).map(f => f.icao)
    const { alerts } = analyzeAirspace([], NOW)
    for (const icao of tiny) expect(alerts.find(a => a.icao === icao)).toBeUndefined()
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
