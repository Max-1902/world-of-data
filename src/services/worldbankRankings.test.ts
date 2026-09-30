import { describe, it, expect, vi } from 'vitest'
import { mockFetch, jsonResponse } from '../test/helpers'

// Both ranking services cache at module level — reload per test.
async function loadPersonnel() { vi.resetModules(); return import('./militaryPersonnel') }
async function loadInfra() { vi.resetModules(); return import('./infraIndicators') }

const row = (iso2: string, iso3: string, country: string, value: number | null, date = '2022') =>
  ({ country: { id: iso2, value: country }, countryiso3code: iso3, value, date })

describe('fetchMilitaryPersonnelRanking', () => {
  it('ranks countries by personnel, descending, starting at 1', async () => {
    mockFetch(() => jsonResponse([{ page: 1 }, [row('FR', 'FRA', 'France', 200_000), row('CN', 'CHN', 'China', 2_000_000), row('DE', 'DEU', 'Germany', 180_000)]]))
    const list = await (await loadPersonnel()).fetchMilitaryPersonnelRanking()
    expect(list.map(e => [e.rank, e.iso2, e.personnel])).toEqual([[1, 'CN', 2_000_000], [2, 'FR', 200_000], [3, 'DE', 180_000]])
    expect(list[0]).toMatchObject({ iso3: 'CHN', country: 'China', year: '2022' })
  })

  it('drops null values, aggregates (World, regions) and rows with no iso3 code', async () => {
    mockFetch(() => jsonResponse([{}, [
      row('1W', 'WLD', 'World', 30_000_000), row('EU', 'EUU', 'European Union', 1_000_000),
      row('XX', '', 'No code', 5), row('FR', 'FRA', 'France', null), row('DE', 'DEU', 'Germany', 180_000),
    ]]))
    const list = await (await loadPersonnel()).fetchMilitaryPersonnelRanking()
    expect(list.map(e => e.iso2)).toEqual(['DE'])
  })

  it('rejects on HTTP errors and unexpected shapes, and recovers on the next call', async () => {
    const { fetchMilitaryPersonnelRanking } = await loadPersonnel()
    mockFetch(() => jsonResponse({}, { status: 500 }))
    await expect(fetchMilitaryPersonnelRanking()).rejects.toThrow('World Bank API error 500')
    mockFetch(() => jsonResponse({ message: 'weird' }))
    await expect(fetchMilitaryPersonnelRanking()).rejects.toThrow('Unexpected World Bank response shape')
    mockFetch(() => jsonResponse([{}, [row('DE', 'DEU', 'Germany', 1)]]))
    expect(await fetchMilitaryPersonnelRanking()).toHaveLength(1)
  })

  it('shares one in-flight request and then serves from cache', async () => {
    const fetchMock = mockFetch(() => jsonResponse([{}, [row('DE', 'DEU', 'Germany', 1)]]))
    const { fetchMilitaryPersonnelRanking } = await loadPersonnel()
    await Promise.all([fetchMilitaryPersonnelRanking(), fetchMilitaryPersonnelRanking()])
    await fetchMilitaryPersonnelRanking()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('formatPersonnel', () => {
  it.each([[2_500_000, '2.50M'], [150_000, '150K'], [999, '999'], [0, '0']])('%s -> %s', async (n, out) => {
    expect((await loadPersonnel()).formatPersonnel(n)).toBe(out)
  })
})

describe('fetchInfraIndicatorRanking', () => {
  it('ranks by electricity access and attaches the other indicators per country', async () => {
    mockFetch(url => {
      if (url.includes('EG.ELC.ACCS.ZS')) return jsonResponse([{}, [row('DE', 'DEU', 'Germany', 100), row('TD', 'TCD', 'Chad', 11.4), row('FR', 'FRA', 'France', 99.9)]])
      if (url.includes('IT.CEL.SETS.P2')) return jsonResponse([{}, [row('DE', 'DEU', 'Germany', 120.5)]])
      return jsonResponse([{}, []])
    })
    const list = await (await loadInfra()).fetchInfraIndicatorRanking()
    expect(list.map(e => [e.rank, e.iso2])).toEqual([[1, 'DE'], [2, 'FR'], [3, 'TD']])
    expect(list[0].electricityAccessPct).toBe(100)
    expect(list[0].indicators.find(i => i.id === 'IT.CEL.SETS.P2')).toMatchObject({ value: 120.5, year: '2022' })
    expect(list[2].indicators.map(i => i.id)).toEqual(['EG.ELC.ACCS.ZS'])
  })

  it('tolerates individual indicator failures', async () => {
    mockFetch(url => url.includes('EG.ELC.ACCS.ZS')
      ? jsonResponse([{}, [row('DE', 'DEU', 'Germany', 100)]])
      : jsonResponse({}, { status: 500 }))
    const list = await (await loadInfra()).fetchInfraIndicatorRanking()
    expect(list).toHaveLength(1)
  })

  it('returns an empty ranking when the rank indicator itself fails', async () => {
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await (await loadInfra()).fetchInfraIndicatorRanking()).toEqual([])
  })
})

describe('formatInfraValue', () => {
  it.each([
    ['IS.AIR.PSGR', 2_500_000, '2.5M'],
    ['IS.AIR.PSGR', 45_000, '45K'],
    ['IS.AIR.PSGR', 900, '900'],
    ['IS.RRS.TOTL.KM', 12_345.6, /12.?346 km/],
    ['IT.CEL.SETS.P2', 120.55, '120.5 /100'],
    ['EG.ELC.ACCS.ZS', 99.94, '99.9%'],
    ['SH.H2O.BASW.ZS', 50, '50.0%'],
  ] as const)('%s %s', async (id, v, out) => {
    const { formatInfraValue } = await loadInfra()
    const result = formatInfraValue(id, v)
    if (out instanceof RegExp) expect(result).toMatch(out)
    else expect(result).toBe(out)
  })
})
