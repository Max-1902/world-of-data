import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse } from '../test/helpers'
import { INDICATORS, INDICATOR_BY_ID, MATRIX_IDS, PRESETS, parseWorldBank, INDICATOR_GROUPS, cleanCountryName, owidToRows, emberToRows } from './countryIndicators'
import type { OwidChartData } from './owid'
import type { PowerGenerationEntry } from './powerGeneration'

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
    expect(out.map(r => r.iso3)).toEqual(['USA', 'CHN'])
    expect(out[1]).toEqual({ iso3: 'CHN', name: 'China', value: 7, year: '2020' })
  })
  it('drops the fragile-states aggregate under its current code FCV, not only the old FCS (regression: it ranked 5th on military spending, 2026-10-16)', () => {
    const out = parseWorldBank([{}, [row('UA', 'UKR', 39.6), row('F1', 'FCV', 6.8, '2025', 'Fragility, Conflict, and Violence (FCV) situations'), row('F2', 'FCS', 6)]])
    expect(out.map(r => r.iso3)).toEqual(['UKR'])
  })
  it('drops values older than the minimum year, because mrnev ignores the request date range', () => {
    const out = parseWorldBank([{}, [row('US', 'USA', 1, '1995'), row('FR', 'FRA', 2, '2009'), row('DE', 'DEU', 3, '2010'), row('JP', 'JPN', 4, '2023')]])
    expect(out.map(r => r.iso3)).toEqual(['DEU', 'JPN'])
    expect(parseWorldBank([{}, [row('US', 'USA', 1, '1995')]], 1990)).toHaveLength(1)
  })
  it('keeps the first row per country and skips rows missing codes', () => {
    const out = parseWorldBank([{}, [row('US', 'USA', 1), row('US', 'USA', 2), { country: {}, countryiso3code: '', value: 3 }, row('ZZ', '', 4), { country: {}, value: 5 }]])
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

  it('retries a blocked response (CORS shows up as a network error) on a different URL for the same data', async () => {
    vi.useFakeTimers()
    let n = 0
    const fetchMock = mockFetch(() => {
      if (n++ === 0) throw new TypeError('Failed to fetch')
      return jsonResponse([{}, [row('US', 'USA', 5)]])
    })
    const { fetchIndicatorAll } = await load()
    const p = fetchIndicatorAll('C.O')
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toHaveLength(1)
    const [first, second] = fetchMock.mock.calls.map(c => new URL(String(c[0])))
    expect(second.href).not.toBe(first.href)
    expect(second.pathname).toBe(first.pathname)
    expect(Object.fromEntries(second.searchParams)).toEqual(Object.fromEntries(first.searchParams))
    vi.useRealTimers()
  })

  it('walks through a third URL variant when two in a row are blocked, then gives up', async () => {
    vi.useFakeTimers()
    let n = 0
    const fetchMock = mockFetch(() => {
      if (n++ < 2) throw new TypeError('Failed to fetch')
      return jsonResponse([{}, [row('US', 'USA', 5)]])
    })
    const { fetchIndicatorAll } = await load()
    const p = fetchIndicatorAll('B.B')
    await vi.advanceTimersByTimeAsync(3000)
    expect(await p).toHaveLength(1)
    const urls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(new Set(urls).size).toBe(3)

    const blocked = mockFetch(() => { throw new TypeError('Failed to fetch') })
    const q = (await load()).fetchIndicatorAll('B.C').catch(e => e)
    await vi.advanceTimersByTimeAsync(3000)
    expect(await q).toBeInstanceOf(TypeError)
    expect(blocked).toHaveBeenCalledTimes(3)
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

describe('source adapters', () => {
  const owidData = (values: OwidChartData['values']): OwidChartData => ({ slug: 's', label: 'L', topic: 'violence', unit: 'deaths', values, fetchedAt: 0 })
  it('turns OWID rows into country rows, dropping aggregates, odd codes and pre-2010 values', () => {
    const out = owidToRows(owidData([
      { entity: 'Ukraine', code: 'UKR', year: 2023, value: 80_000 },
      { entity: 'World', code: 'OWID_WRL', year: 2023, value: 1e6 },
      { entity: 'Kosovo', code: 'OWID_KOS', year: 2023, value: 5 },
      { entity: 'Asia', code: '', year: 2023, value: 9 },
      { entity: 'Old', code: 'OLD', year: 2005, value: 1 },
      { entity: 'Korea, Rep.', code: 'KOR', year: 2020, value: 3 },
    ]))
    expect(out.map(r => r.iso3)).toEqual(['UKR', 'KOR'])
    expect(out[0]).toEqual({ iso3: 'UKR', name: 'Ukraine', value: 80_000, year: '2023' })
    expect(out[1].name).toBe('South Korea')
  })

  const power = (code: string, year: number, bySource: Partial<PowerGenerationEntry['bySource']>): PowerGenerationEntry => {
    const full = { coal: 0, gas: 0, oil: 0, nuclear: 0, hydro: 0, wind: 0, solar: 0, bioenergy: 0, other: 0, ...bySource }
    const total = Object.values(full).reduce((a, b) => a + b, 0)
    return { country: `P-${code}`, code, year, totalTwh: total, bySource: full, lowCarbonPct: (1 - (full.coal + full.gas + full.oil) / total) * 100, rank: 1 }
  }
  it('derives each Ember measure from the generation mix', () => {
    const entries = [power('DEU', 2023, { coal: 20, wind: 30, solar: 10, gas: 40 }), power('OLD', 2005, { coal: 1 }), power('OWID_WRL', 2023, { coal: 5 })]
    expect(emberToRows(entries, 'total').map(r => [r.iso3, r.value])).toEqual([['DEU', 100]])
    expect(emberToRows(entries, 'coal')[0].value).toBeCloseTo(20)
    expect(emberToRows(entries, 'windsolar')[0].value).toBeCloseTo(40)
    expect(emberToRows(entries, 'lowcarbon')[0].value).toBeCloseTo(40)
    expect(() => emberToRows(entries, 'nope')).toThrow(/Unknown Ember/)
  })

  it('tags every indicator with its source and uses a matching id scheme', () => {
    for (const i of INDICATORS) {
      if (i.source === 'Our World in Data') expect(i.id.startsWith('owid:')).toBe(true)
      else if (i.source === 'Ember') expect(i.id.startsWith('ember:')).toBe(true)
      else expect(i.id).toMatch(/^[A-Z0-9.]+$/)
    }
    expect(new Set(INDICATORS.map(i => i.source))).toEqual(new Set(['World Bank', 'Our World in Data', 'Ember']))
  })
})

describe('fetchIndicatorAll dispatch', () => {
  beforeEach(() => { vi.resetModules() })

  it('routes owid: ids through the OWID service and fails clearly when it returns nothing', async () => {
    vi.doMock('./owid', () => ({ fetchOwidChart: vi.fn(async (slug: string) => slug === 'good'
      ? { slug, label: 'L', topic: 'violence', unit: 'x', fetchedAt: 0, values: [{ entity: 'France', code: 'FRA', year: 2022, value: 4 }] }
      : null) }))
    const mod = await import('./countryIndicators')
    expect(await mod.fetchIndicatorAll('owid:good')).toEqual([{ iso3: 'FRA', name: 'France', value: 4, year: '2022' }])
    await expect(mod.fetchIndicatorAll('owid:bad')).rejects.toThrow(/Our World in Data/)
    vi.doUnmock('./owid')
  })

  it('routes ember: ids through the power-generation service', async () => {
    vi.doMock('./powerGeneration', async importOriginal => ({
      ...(await importOriginal<typeof import('./powerGeneration')>()),
      fetchPowerGenerationRanking: vi.fn(async () => [{ country: 'Norway', code: 'NOR', year: 2023, totalTwh: 100, bySource: { coal: 0, gas: 1, oil: 0, nuclear: 0, hydro: 90, wind: 9, solar: 0, bioenergy: 0, other: 0 }, lowCarbonPct: 99, rank: 1 }]),
    }))
    const mod = await import('./countryIndicators')
    expect(await mod.fetchIndicatorAll('ember:lowcarbon')).toEqual([{ iso3: 'NOR', name: 'Norway', value: 99, year: '2023' }])
    vi.doUnmock('./powerGeneration')
  })
})
