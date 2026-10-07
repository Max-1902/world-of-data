import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse } from '../test/helpers'
import { INDICATORS, INDICATOR_BY_ID, MATRIX_IDS, PRESETS, parseWorldBank, INDICATOR_GROUPS, cleanCountryName } from './countryIndicators'

const row = (iso2: string, iso3: string, value: unknown, date = '2022', name = `N-${iso2}`) =>
  ({ country: { id: iso2, value: name }, countryiso3code: iso3, value, date })

describe('catalogue', () => {
  it('has unique ids, valid groups and scales, and working formatters', () => {
    expect(new Set(INDICATORS.map(i => i.id)).size).toBe(INDICATORS.length)
    for (const i of INDICATORS) {
      expect(INDICATOR_GROUPS).toContain(i.group)
      expect(['linear', 'log', 'symlog']).toContain(i.scale)
      expect(i.short.length).toBeGreaterThan(0)
      expect(typeof i.format(1234.5)).toBe('string')
    }
  })
  it('only references known indicators from the presets and the matrix set', () => {
    for (const p of PRESETS) { expect(INDICATOR_BY_ID.has(p.x)).toBe(true); expect(INDICATOR_BY_ID.has(p.y)).toBe(true); expect(p.x).not.toBe(p.y) }
    for (const id of MATRIX_IDS) expect(INDICATOR_BY_ID.has(id)).toBe(true)
  })
  it('formats values readably', () => {
    const gdp = INDICATOR_BY_ID.get('NY.GDP.PCAP.CD')!, pop = INDICATOR_BY_ID.get('SP.POP.TOTL')!, fdi = INDICATOR_BY_ID.get('BX.KLT.DINV.CD.WD')!
    expect(gdp.format(48250)).toBe('$48K')
    expect(gdp.format(820)).toBe('$820')
    expect(pop.format(1_412_000_000)).toBe('1.4B')
    expect(fdi.format(-3_200_000_000)).toBe('−$3.2B')
    expect(INDICATOR_BY_ID.get('SP.DYN.LE00.IN')!.format(72.345)).toBe('72.3')
  })
})

describe('cleanCountryName', () => {
  it('shortens formal World Bank names and leaves everything else alone', () => {
    expect(cleanCountryName('Iran, Islamic Rep.')).toBe('Iran')
    expect(cleanCountryName('Korea, Rep.')).toBe('South Korea')
    expect(cleanCountryName('Russian Federation')).toBe('Russia')
    expect(cleanCountryName('Hong Kong SAR, China')).toBe('Hong Kong')
    expect(cleanCountryName('Germany')).toBe('Germany')
  })
  it('is applied while parsing', () => {
    expect(parseWorldBank([{}, [row('IR', 'IRN', 1, '2022', 'Iran, Islamic Rep.')]])[0].name).toBe('Iran')
  })
})

describe('parseWorldBank', () => {
  it('keeps real countries with numeric values and drops aggregates, nulls and bad values', () => {
    const out = parseWorldBank([{ page: 1 }, [
      row('US', 'USA', 100), row('1W', 'WLD', 999), row('FR', 'FRA', null), row('DE', 'DEU', 'n/a'), row('JP', 'JPN', NaN),
      row('CN', 'CHN', 7, '2020', 'China'),
    ]])
    expect(out.map(r => r.iso2)).toEqual(['US', 'CN'])
    expect(out[1]).toEqual({ iso2: 'CN', iso3: 'CHN', name: 'China', value: 7, year: '2020' })
  })
  it('drops values older than the minimum year, because mrnev ignores the request date range', () => {
    const out = parseWorldBank([{}, [row('US', 'USA', 1, '1995'), row('FR', 'FRA', 2, '2009'), row('DE', 'DEU', 3, '2010'), row('JP', 'JPN', 4, '2023')]])
    expect(out.map(r => r.iso2)).toEqual(['DE', 'JP'])
    expect(parseWorldBank([{}, [row('US', 'USA', 1, '1995')]], 1990)).toHaveLength(1)
  })
  it('keeps the first row per country and skips rows missing codes', () => {
    const out = parseWorldBank([{}, [row('US', 'USA', 1), row('US', 'USA', 2), { country: {}, countryiso3code: 'XXX', value: 3 }, row('', 'ZZZ', 4)]])
    expect(out).toHaveLength(1)
    expect(out[0].value).toBe(1)
  })
  it('throws on an unexpected envelope', () => {
    expect(() => parseWorldBank({})).toThrow(/Unexpected/)
    expect(() => parseWorldBank([{}, null])).toThrow(/Unexpected/)
    expect(() => parseWorldBank(null)).toThrow(/Unexpected/)
  })
})

describe('fetchIndicatorAll', () => {
  beforeEach(() => { vi.resetModules() })
  async function load() { return import('./countryIndicators') }

  it('requests the latest value for all countries, caches, and shares concurrent calls', async () => {
    const fetchMock = mockFetch(() => jsonResponse([{}, [row('US', 'USA', 5)]]))
    const { fetchIndicatorAll } = await load()
    const [a, b] = await Promise.all([fetchIndicatorAll('NY.GDP.PCAP.CD'), fetchIndicatorAll('NY.GDP.PCAP.CD')])
    await fetchIndicatorAll('NY.GDP.PCAP.CD')
    expect(a).toEqual(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/country/all/indicator/NY.GDP.PCAP.CD')
    expect(url).toContain('mrnev=1')
    expect(url).not.toContain('MRV=1')
    expect(url).toContain('per_page=20000')
  })

  it('fetches each indicator separately', async () => {
    const fetchMock = mockFetch(() => jsonResponse([{}, [row('US', 'USA', 5)]]))
    const { fetchIndicatorAll } = await load()
    await fetchIndicatorAll('A.B'); await fetchIndicatorAll('C.D')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries once on a transient failure and then succeeds', async () => {
    vi.useFakeTimers()
    let n = 0
    const fetchMock = mockFetch(() => n++ === 0 ? new Response('busy', { status: 429 }) : jsonResponse([{}, [row('US', 'USA', 5)]]))
    const { fetchIndicatorAll } = await load()
    const p = fetchIndicatorAll('R.R')
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('retries once after a timeout or a network error', async () => {
    vi.useFakeTimers()
    let n = 0
    const fetchMock = mockFetch(() => {
      if (n++ === 0) throw new DOMException('The operation timed out.', 'TimeoutError')
      return jsonResponse([{}, [row('US', 'USA', 5)]])
    })
    const { fetchIndicatorAll } = await load()
    const p = fetchIndicatorAll('T.O')
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('gives up after one retry, and never retries a client error or a malformed body', async () => {
    vi.useFakeTimers()
    const always500 = mockFetch(() => new Response('x', { status: 500 }))
    const { fetchIndicatorAll } = await load()
    const p = fetchIndicatorAll('X.Y').catch(e => e)
    await vi.advanceTimersByTimeAsync(1000)
    expect(String(await p)).toMatch(/HTTP 500/)
    expect(always500).toHaveBeenCalledTimes(2)
    vi.useRealTimers()

    const notFound = mockFetch(() => new Response('x', { status: 404 }))
    await expect((await load()).fetchIndicatorAll('A.A')).rejects.toThrow(/HTTP 404/)
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failure', async () => {
    let fail = true
    const fetchMock = mockFetch(() => fail ? new Response('x', { status: 404 }) : jsonResponse([{}, [row('US', 'USA', 5)]]))
    const { fetchIndicatorAll } = await load()
    await expect(fetchIndicatorAll('X.Y')).rejects.toThrow(/HTTP 404/)
    fail = false
    expect(await fetchIndicatorAll('X.Y')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    mockFetch(() => jsonResponse({ message: 'bad' }))
    const fresh = await load()
    await expect(fresh.fetchIndicatorAll('Z.Z')).rejects.toThrow(/Unexpected/)
  })
})
