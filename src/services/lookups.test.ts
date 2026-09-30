/** Pure lookup/aggregation helpers layered over the static datasets. */
import { describe, it, expect } from 'vitest'
import { OIL_GAS_DATA, getMaxValue, getRegionTotals, formatValue, type OilGasMetric } from './oilgas'
import { getTradeProfile, TRADE_PROFILES } from './tradeStats'
import { getResourceProfile, resourceCapabilitySummary, RESOURCE_PROFILES } from './resources'
import { SANCTIONED_COUNTRIES, SANCTIONS_BY_ISO2 } from './sanctions'

const METRICS: OilGasMetric[] = ['oilReserves', 'gasReserves', 'oilProduction', 'gasProduction']

describe('oil & gas helpers', () => {
  it.each(METRICS)('getMaxValue(%s) equals the largest entry', (m) => {
    expect(getMaxValue(m)).toBe(Math.max(...OIL_GAS_DATA.map(c => c[m])))
  })

  it.each(METRICS)('region totals for %s add up to the global total', (m) => {
    const sum = getRegionTotals(m).reduce((s, r) => s + r.total, 0)
    expect(sum).toBeCloseTo(OIL_GAS_DATA.reduce((t, c) => t + c[m], 0), 6)
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
  it('returns null for blank input instead of an arbitrary profile', () => {
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
})
