/** Pure lookup/aggregation helpers layered over the static datasets. */
import { describe, it, expect } from 'vitest'
import { OIL_GAS_DATA, getMaxValue, getTopCountries, getActiveCountries, getRegionTotals, formatValue, getGlobalTotal, type OilGasMetric } from './oilgas'
import { EARTHCAM_CAMERAS, getCamerasForCountry, getNearestCamera } from './earthcam'
import { getTradeProfile, TRADE_PROFILES } from './tradeStats'
import { getResourceProfile, resourceCapabilitySummary, RESOURCE_PROFILES } from './resources'
import { SANCTIONED_COUNTRIES, SANCTIONS_BY_ISO2, SANCTION_COLORS, buildSanctionMatchExpression } from './sanctions'

const METRICS: OilGasMetric[] = ['oilReserves', 'gasReserves', 'oilProduction', 'gasProduction']

describe('oil & gas helpers', () => {
  it.each(METRICS)('getMaxValue(%s) equals the largest entry', (m) => {
    expect(getMaxValue(m)).toBe(Math.max(...OIL_GAS_DATA.map(c => c[m])))
  })

  it.each(METRICS)('getTopCountries(%s) is sorted descending and honours n', (m) => {
    const top = getTopCountries(m, 5)
    expect(top).toHaveLength(5)
    for (let i = 1; i < top.length; i++) expect(top[i - 1][m]).toBeGreaterThanOrEqual(top[i][m])
    expect(top[0][m]).toBe(getMaxValue(m))
  })

  it('getTopCountries does not mutate the source dataset order', () => {
    const before = OIL_GAS_DATA.map(c => c.iso2).join()
    getTopCountries('oilReserves', 10)
    expect(OIL_GAS_DATA.map(c => c.iso2).join()).toBe(before)
  })

  it.each(METRICS)('getActiveCountries(%s) excludes zeros and is sorted descending', (m) => {
    const active = getActiveCountries(m)
    expect(active.length).toBeGreaterThan(0)
    for (const c of active) expect(c[m]).toBeGreaterThan(0)
    for (let i = 1; i < active.length; i++) expect(active[i - 1][m]).toBeGreaterThanOrEqual(active[i][m])
  })

  it.each(METRICS)('region totals for %s add up to the global total', (m) => {
    const sum = getRegionTotals(m).reduce((s, r) => s + r.total, 0)
    expect(sum).toBeCloseTo(getGlobalTotal(m), 6)
  })

  it('region totals are sorted descending', () => {
    const totals = getRegionTotals('oilProduction').map(r => r.total)
    expect([...totals].sort((a, b) => b - a)).toEqual(totals)
  })

  it.each([
    [0, 'oilReserves', '—'],
    [258.6, 'oilReserves', '258.6 Gbbl'],
    [0.5, 'oilReserves', '500 Mbbl'],
    [9.4, 'gasReserves', '9.4 Tcm'],
    [0.25, 'gasReserves', '250 Gcm'],
    [10.5, 'oilProduction', '10.5 Mbbl/d'],
    [0.3, 'oilProduction', '300 kbbl/d'],
    [117, 'gasProduction', '117 Gm³/yr'],
    [0.5, 'gasProduction', '500 Mm³/yr'],
  ] as const)('formatValue(%s, %s) = %s', (v, m, out) => {
    expect(formatValue(v, m)).toBe(out)
  })
})

describe('camera helpers', () => {
  it('getCamerasForCountry is case-insensitive and exact', () => {
    const it1 = getCamerasForCountry('italy')
    expect(it1.length).toBeGreaterThan(0)
    expect(it1.every(c => c.country === 'Italy')).toBe(true)
    expect(getCamerasForCountry('ITALY')).toEqual(it1)
    expect(getCamerasForCountry('Ital')).toEqual([])
    expect(getCamerasForCountry('Atlantis')).toEqual([])
  })

  it('getNearestCamera returns a camera at the exact coordinates when one exists', () => {
    const cam = EARTHCAM_CAMERAS[0]
    expect(getNearestCamera(cam.lat, cam.lng)!.id).toBe(cam.id)
  })

  it('getNearestCamera picks the closer of two cities', () => {
    const rome = EARTHCAM_CAMERAS.find(c => c.city === 'Rome')!
    const sydney = EARTHCAM_CAMERAS.find(c => c.city === 'Sydney')!
    expect(getNearestCamera(rome.lat + 0.5, rome.lng + 0.5)!.city).toBe('Rome')
    expect(getNearestCamera(sydney.lat - 0.5, sydney.lng - 0.5)!.city).toBe('Sydney')
  })
})

describe('trade profile lookup', () => {
  it('finds profiles by name (any case), alias and ISO2 code', () => {
    expect(getTradeProfile('United States')!.iso2).toBe('US')
    expect(getTradeProfile('united states')!.iso2).toBe('US')
    expect(getTradeProfile('USA')!.iso2).toBe('US')
    expect(getTradeProfile('DE')!.iso2).toBe('DE')
  })
  it('returns null for unknown countries', () => {
    expect(getTradeProfile('Atlantis')).toBeNull()
  })
  it('every profile is reachable via its ISO2 code', () => {
    for (const p of TRADE_PROFILES) expect(getTradeProfile(p.iso2)?.iso2, p.name).toBe(p.iso2)
  })
  // KNOWN BUG (same root cause as resolveISO2 in worldbank.ts): the partial-match fallback treats
  // '' / very short input as a substring of every name, so blank input returns the first match
  // (the United States). Remove `.fails` once getTradeProfile guards against it.
  it.fails('returns null for blank input instead of an arbitrary profile', () => {
    expect(getTradeProfile('')).toBeNull()
    expect(getTradeProfile('   ')).toBeNull()
  })
})

describe('resource profile lookup', () => {
  it('finds by ISO2 case-insensitively', () => {
    expect(getResourceProfile('cn')!.name).toBe('China')
    expect(getResourceProfile('CN')!.name).toBe('China')
  })
  it('returns null for countries without a static profile', () => {
    expect(getResourceProfile('ZZ')).toBeNull()
    expect(getResourceProfile('')).toBeNull()
  })
  it('capability summary reports the real profile count', () => {
    expect(resourceCapabilitySummary()).toContain(`${RESOURCE_PROFILES.length} major producer countries`)
  })
})

describe('sanctions helpers', () => {
  it('SANCTIONS_BY_ISO2 indexes every country', () => {
    expect(Object.keys(SANCTIONS_BY_ISO2)).toHaveLength(SANCTIONED_COUNTRIES.length)
    for (const c of SANCTIONED_COUNTRIES) expect(SANCTIONS_BY_ISO2[c.iso2]).toBe(c)
  })

  it('builds a Mapbox match expression of iso2/colour pairs terminated by a fallback', () => {
    const expr = buildSanctionMatchExpression()
    expect(expr).toHaveLength(SANCTIONED_COUNTRIES.length * 2 + 1)
    expect(expr[expr.length - 1]).toBe('transparent')
    SANCTIONED_COUNTRIES.forEach((c, i) => {
      expect(expr[i * 2]).toBe(c.iso2)
      expect(expr[i * 2 + 1]).toBe(SANCTION_COLORS[c.severity])
    })
  })
})
