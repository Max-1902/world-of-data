import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse } from '../test/helpers'

async function load() {
  vi.resetModules()
  return import('./countryLookup')
}

const row = (id: string, date: string, value: number | null, name = `Name of ${id}`) => ({ indicator: { id, value: name }, country: { id: 'DE', value: 'Germany' }, countryiso3code: 'DEU', date, value })

describe('catalogue', () => {
  it('has unique ids and the World Bank country profile as its first four categories', async () => {
    const m = await load()
    const ids = m.ALL_SERIES.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(m.CATEGORIES.filter(c => c.profile).map(c => c.title)).toEqual(['Social', 'Economic', 'Environment', 'Institutions'])
    // the 24 indicators of the World Bank DataBank country profile
    expect(m.CATEGORIES.filter(c => c.profile).flatMap(c => c.series.map(s => s.id))).toHaveLength(24)
  })
  it('only uses sources the API can batch (2 = WDI, 3 = WGI, 63 = HCI)', async () => {
    const m = await load()
    expect(new Set(m.ALL_SERIES.map(s => s.source))).toEqual(new Set([2, 3, 63]))
    for (const b of m.batches()) expect(b.ids.length).toBeLessThanOrEqual(30)
  })
})

describe('formatValue / formatSlope / changeMode', () => {
  it('formats by unit kind', async () => {
    const { formatValue, formatSlope, changeMode } = await load()
    expect(formatValue('usd', 5.05e12)).toBe('$5.05T')
    expect(formatValue('count', 83_491_249)).toBe('83.49M')
    expect(formatValue('pct', 3.71)).toBe('3.7%')
    expect(formatValue('growth', -0.03)).toBe('−0.0%')
    expect(formatValue('growth', 2.2)).toBe('+2.2%')
    expect(formatValue('index', 0.751)).toBe('0.75')
    expect(formatValue('num', -334072)).toBe('−334.1K')
    expect(formatSlope('pct', 0.25)).toBe('+0.25 pp/yr')
    expect(formatSlope('usd', -1.5e9)).toBe('−$1.5B/yr')
    expect(changeMode('usd')).toBe('log')
    expect(changeMode('pct')).toBe('diff')
  })
})

describe('fetchCountryList', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('keeps economies and drops aggregates', async () => {
    mockFetch(() => jsonResponse([{ page: 1 }, [
      { id: 'DEU', iso2Code: 'DE', name: 'Germany', region: { value: 'Europe & Central Asia ' }, incomeLevel: { value: 'High income' }, capitalCity: 'Berlin' },
      { id: 'EMU', iso2Code: 'XC', name: 'Euro area', region: { value: 'Aggregates' }, incomeLevel: { value: 'Aggregates' }, capitalCity: '' },
      { id: 'BRA', iso2Code: 'BR', name: 'Brazil', region: { value: 'Latin America & Caribbean' }, incomeLevel: { value: 'Upper middle income' }, capitalCity: 'Brasilia' },
    ]]))
    const { fetchCountryList } = await load()
    const list = await fetchCountryList()
    expect(list.map(c => c.iso2)).toEqual(['BR', 'DE'])
    expect(list[1]).toMatchObject({ iso3: 'DEU', region: 'Europe & Central Asia', capital: 'Berlin' })
  })
  it('throws on HTTP errors and empty payloads, and retries next time', async () => {
    const f = mockFetch(() => new Response('', { status: 503 }))
    const { fetchCountryList } = await load()
    await expect(fetchCountryList()).rejects.toThrow('503')
    f.mockImplementation(async () => jsonResponse([{}, []]))
    await expect(fetchCountryList()).rejects.toThrow('no countries')
  })
})

describe('fetchCountryDataset', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('batches by source, requests history from 1960, merges and sorts points, skips nulls', async () => {
    const urls: string[] = []
    mockFetch(url => {
      urls.push(url)
      if (url.includes('NY.GDP.MKTP.CD')) return jsonResponse([{ lastupdated: '2026-07-13' }, [row('NY.GDP.MKTP.CD', '2025', 5.05e12, 'GDP (current US$)'), row('NY.GDP.MKTP.CD', '2024', 4.69e12, 'GDP (current US$)'), row('NY.GDP.MKTP.CD', '2023', null)]])
      if (url.includes('source=63')) return jsonResponse([{}, [row('HD.HCI.OVRL', '2020', 0.751)]])
      return jsonResponse([{}, []])
    })
    const { fetchCountryDataset, batches, FIRST_YEAR } = await load()
    const d = await fetchCountryDataset('DE')
    expect(urls).toHaveLength(batches().length)
    expect(urls.every(u => u.includes(`date=${FIRST_YEAR}:`))).toBe(true)
    expect(FIRST_YEAR).toBe(1960)
    expect(urls.some(u => u.includes('source=3'))).toBe(true)
    expect(d.name).toBe('Germany')
    expect(d.series['NY.GDP.MKTP.CD']).toEqual({ name: 'GDP (current US$)', points: [{ x: 2024, y: 4.69e12 }, { x: 2025, y: 5.05e12 }] })
    expect(d.series['HD.HCI.OVRL'].points).toEqual([{ x: 2020, y: 0.751 }])
    expect(d.failedBatches).toBe(0)
    expect(d.lastUpdated).toEqual(['2026-07-13'])
  })

  it('ignores indicators outside the catalogue and malformed rows', async () => {
    mockFetch(() => jsonResponse([{}, [row('NOT.IN.CATALOGUE', '2020', 1), { indicator: { id: 'SP.POP.TOTL' }, date: 'abc', value: 5 }, { foo: 1 }, row('SP.POP.TOTL', '2020', 83e6)]]))
    const { fetchCountryDataset } = await load()
    const d = await fetchCountryDataset('DE')
    expect(d.series['NOT.IN.CATALOGUE']).toBeUndefined()
    expect(d.series['SP.POP.TOTL'].points).toEqual([{ x: 2020, y: 83e6 }])
  })

  it('counts failed batches instead of failing outright, and does not cache a partial result', async () => {
    let n = 0
    const f = mockFetch(() => (n++ === 0 ? new Response('', { status: 500 }) : jsonResponse([{}, [row('SP.POP.TOTL', '2020', 1)]])))
    const { fetchCountryDataset, batches } = await load()
    const d = await fetchCountryDataset('DE')
    expect(d.failedBatches).toBe(1)
    expect(d.totalBatches).toBe(batches().length)
    const calls = f.mock.calls.length
    await fetchCountryDataset('DE')
    expect(f.mock.calls.length).toBeGreaterThan(calls)
  })

  it('treats a World Bank error message body as a failed batch', async () => {
    mockFetch(() => jsonResponse([{ message: [{ id: '120', key: 'Invalid value', value: 'The provided parameter value is not valid' }] }]))
    const { fetchCountryDataset } = await load()
    await expect(fetchCountryDataset('DE')).rejects.toThrow('unreachable')
  })

  it('rejects when every batch fails (network down), and caches a full success', async () => {
    const f = mockFetch(() => { throw new TypeError('Failed to fetch') })
    const { fetchCountryDataset } = await load()
    await expect(fetchCountryDataset('DE')).rejects.toThrow('unreachable')
    f.mockImplementation(async () => jsonResponse([{}, []]))
    await fetchCountryDataset('FR')
    const calls = f.mock.calls.length
    await fetchCountryDataset('FR')
    expect(f.mock.calls.length).toBe(calls)
  })
})
