import { describe, it, expect, vi } from 'vitest'
import { resolveISO2, formatEconValue, groupIndicators, type EconIndicator, type IndicatorId } from './worldbank'
import { mockFetch, jsonResponse } from '../test/helpers'

describe('resolveISO2', () => {
  it.each([
    ['Germany', 'DE'], ['germany', 'DE'], ['  Germany  ', 'DE'],
    ['United States', 'US'], ['USA', 'US'], ['United Kingdom', 'GB'],
    ['France', 'FR'], ['Japan', 'JP'],
  ])('resolves %j -> %s', (name, iso) => {
    expect(resolveISO2(name)).toBe(iso)
  })

  it('passes through an already-ISO2 code', () => {
    expect(resolveISO2('ZZ')).toBe('ZZ')
  })

  it('returns null for names it cannot place', () => {
    expect(resolveISO2('Atlantis')).toBeNull()
  })

  it('returns null for blank input instead of matching an arbitrary country', () => {
    expect(resolveISO2('')).toBeNull()
    expect(resolveISO2('   ')).toBeNull()
  })
})

describe('formatEconValue', () => {
  const f = (id: string, v: number) => formatEconValue(id as IndicatorId, v)

  it('formats currency with T/B/M/K suffixes', () => {
    expect(f('NY.GDP.MKTP.CD', 2.5e12)).toBe('$2.50T')
    expect(f('NY.GDP.MKTP.CD', 3.4e9)).toBe('$3.4B')
    expect(f('NY.GDP.MKTP.CD', 7e6)).toBe('$7M')
    expect(f('NY.GDP.PCAP.CD', 45_000)).toBe('$45K')
    expect(f('NY.GDP.PCAP.CD', 950)).toBe('$950')
  })

  it('formats negatives by magnitude (e.g. current-account deficit)', () => {
    expect(f('BN.CAB.XOKA.CD', -1.2e9)).toBe('$-1.2B')
  })

  it('formats population/personnel counts', () => {
    expect(f('SP.POP.TOTL', 1.4e9)).toBe('1.40B')
    expect(f('SP.POP.TOTL', 83_200_000)).toBe('83.2M')
    expect(f('MS.MIL.TOTL.P1', 150_000)).toBe('150K')
    expect(f('MS.MIL.TOTL.P1', 500)).toBe('500')
  })

  it('formats percentages', () => {
    expect(f('SL.UEM.TOTL.ZS', 5.234)).toBe('5.2%')
    expect(f('NY.GDP.MKTP.KD.ZG', -2)).toBe('-2.0%')
    expect(f('FP.CPI.TOTL.ZG', 3.06)).toBe('3.1%')
  })

  it('formats other values with sensible precision', () => {
    expect(f('SP.DYN.LE00.IN', 81.26)).toBe('81.3')
    expect(f('EG.USE.PCAP.KG.OE', 4321.9)).toBe('4322')
  })
})

describe('groupIndicators', () => {
  const ind = (id: string): EconIndicator => ({ id: id as IndicatorId, label: id, value: 1, year: '2023' })

  it('sorts indicators into sections and drops empty sections', () => {
    const groups = groupIndicators([ind('NY.GDP.MKTP.CD'), ind('SP.POP.TOTL'), ind('NE.EXP.GNFS.CD'), ind('MS.MIL.XPND.GD.ZS')])
    expect(Object.keys(groups)).toEqual(['ECONOMY', 'DEMOGRAPHICS', 'TRADE', 'SECURITY & ENERGY'])
    expect(groups.ECONOMY.map(i => i.id)).toEqual(['NY.GDP.MKTP.CD'])
    expect(groups['SECURITY & ENERGY'].map(i => i.id)).toEqual(['MS.MIL.XPND.GD.ZS'])
  })

  it('omits empty groups entirely', () => {
    expect(Object.keys(groupIndicators([ind('SP.POP.TOTL')]))).toEqual(['DEMOGRAPHICS'])
    expect(groupIndicators([])).toEqual({})
  })

  it('places every indicator in exactly one group', () => {
    const ids = ['NY.GDP.MKTP.CD', 'SP.POP.TOTL', 'NE.EXP.GNFS.CD', 'EG.USE.PCAP.KG.OE', 'SI.POV.GINI']
    const groups = groupIndicators(ids.map(ind))
    expect(Object.values(groups).flat()).toHaveLength(ids.length)
  })
})

describe('fetchCountryEcon', () => {
  const wbBody = (value: number | null, date = '2023') => [{ page: 1 }, [{ value: null, date: '2024' }, { value, date }]]

  async function load() { vi.resetModules(); return import('./worldbank') }

  it('returns null for unresolvable countries without hitting the network', async () => {
    const fetchMock = mockFetch()
    const { fetchCountryEcon } = await load()
    expect(await fetchCountryEcon('Atlantis')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('picks the most recent non-null value per indicator and ignores failed indicators', async () => {
    mockFetch(url => url.includes('NY.GDP.MKTP.CD') ? jsonResponse(wbBody(4.2e12, '2022'))
      : url.includes('SP.POP.TOTL') ? jsonResponse({}, { status: 500 })
      : jsonResponse([{ page: 1 }, null]))
    const { fetchCountryEcon } = await load()
    const data = await fetchCountryEcon('Germany')
    expect(data).not.toBeNull()
    const gdp = data!.indicators.find(i => i.id === 'NY.GDP.MKTP.CD')
    expect(gdp).toMatchObject({ value: 4.2e12, year: '2022' })
    expect(data!.indicators.find(i => i.id === 'SP.POP.TOTL')).toBeUndefined()
  })

  it('caches per country so repeat lookups are free', async () => {
    const fetchMock = mockFetch(() => jsonResponse(wbBody(1)))
    const { fetchCountryEcon } = await load()
    await fetchCountryEcon('Germany')
    const calls = fetchMock.mock.calls.length
    await fetchCountryEcon('Germany')
    expect(fetchMock.mock.calls.length).toBe(calls)
  })
})
