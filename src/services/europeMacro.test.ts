import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse, textResponse } from '../test/helpers'

async function load() {
  vi.resetModules()
  return import('./europeMacro')
}

/** Minimal Eurostat JSON-stat: dims [freq, unit, geo, time] with 2 geos × 3 periods. */
const jsonStat = (geos: string[], times: string[], values: Record<string, number | null>) => ({
  version: '2.0', class: 'dataset', id: ['freq', 'unit', 'geo', 'time'], size: [1, 1, geos.length, times.length], value: values,
  dimension: {
    freq: { category: { index: { M: 0 } } }, unit: { category: { index: { RCH_A: 0 } } },
    geo: { category: { index: Object.fromEntries(geos.map((g, i) => [g, i])) } },
    time: { category: { index: Object.fromEntries(times.map((t, i) => [t, i])) } },
  },
})

const sdmx = (obs: [string, number | null][]) => ({
  dataSets: [{ series: { '0:0:0': { observations: Object.fromEntries(obs.map(([, v], i) => [String(i), [v, 0]])) } } }],
  structure: { dimensions: { observation: [{ values: obs.map(([t]) => ({ id: t })) }] } },
})

describe('parsers', () => {
  it('JSON-stat: splits by geo, maps time, skips nulls', async () => {
    const { parseJsonStat } = await load()
    const r = parseJsonStat(jsonStat(['EA21', 'DE'], ['2026-07', '2026-08', '2026-09'], { 0: 2.1, 1: 2.0, 2: null, 3: 2.5, 5: 2.7 }))
    expect(r.EA21.map(p => [p.period, p.value])).toEqual([['2026-07', 2.1], ['2026-08', 2.0]])
    expect(r.DE.map(p => [p.period, p.value])).toEqual([['2026-07', 2.5], ['2026-09', 2.7]])
  })
  it('JSON-stat: tolerates malformed input', async () => {
    const { parseJsonStat } = await load()
    expect(parseJsonStat(null)).toEqual({})
    expect(parseJsonStat({ id: ['geo'], size: [1] })).toEqual({})
    expect(parseJsonStat({ error: { status: 400 } })).toEqual({})
  })
  it('SDMX-JSON: reads the first series', async () => {
    const { parseSdmxJson } = await load()
    expect(parseSdmxJson(sdmx([['2026-06-17', 2.25], ['2026-09-16', 2.5], ['2026-10-01', null]])).map(p => p.value)).toEqual([2.25, 2.5])
    expect(parseSdmxJson({})).toEqual([])
  })
  it('BIS CSV: honours quoted commas', async () => {
    const { parseBisCsv, csvLine } = await load()
    expect(csvLine('a,"b, c",d')).toEqual(['a', 'b, c', 'd'])
    const csv = 'FREQ,REF_AREA,TITLE,TIME_PERIOD,OBS_VALUE\nM,PL,"Rate, official",2026-07,4.0\nM,PL,"x",2026-08,3.75\nM,PL,"x",2026-09,\n'
    expect(parseBisCsv(csv).map(p => [p.period, p.value])).toEqual([['2026-07', 4], ['2026-08', 3.75]])
    expect(parseBisCsv('nonsense')).toEqual([])
  })
  it('periods map to mid-period UTC times', async () => {
    const { periodTime } = await load()
    expect(new Date(periodTime('2026-Q2')).toISOString().slice(0, 10)).toBe('2026-05-15')
    expect(new Date(periodTime('2026-08')).toISOString().slice(0, 10)).toBe('2026-08-15')
    expect(new Date(periodTime('2025')).toISOString().slice(0, 10)).toBe('2025-07-01')
  })
  it('ECB change-date rates become a month-end step series', async () => {
    const { stepMonthly, periodTime } = await load()
    const steps = stepMonthly([{ period: '2026-06-17', t: periodTime('2026-06-17'), value: 2.25 }, { period: '2026-09-16', t: periodTime('2026-09-16'), value: 2.5 }], Date.UTC(2026, 9, 7))
    expect(steps.map(p => [p.period, p.value])).toEqual([['2026-06', 2.25], ['2026-07', 2.25], ['2026-08', 2.25], ['2026-09', 2.5], ['2026-10', 2.5]])
  })
})

describe('country facts', () => {
  it('euro membership, Eurostat geo codes and coverage', async () => {
    const m = await load()
    expect(m.isEuroMember('BG')).toBe(true)
    expect(m.isEuroMember('PL')).toBe(false)
    expect(Object.keys(m.EURO_ADOPTION)).toHaveLength(21)
    expect(m.estatGeo('GR')).toBe('EL')
    expect(m.isEurope('NO')).toBe(true)
    expect(m.isEurope('US')).toBe(false)
    // every non-euro European country here has a currency for the exchange-rate box
    for (const c of m.EUROPE) if (!m.isEuroMember(c)) expect(m.CURRENCY[c]).toBeTruthy()
  })
})

describe('fetchEuropeData', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('loads Eurostat with the euro-area comparator, ECB rates for members and uses EL for Greece', async () => {
    const urls: string[] = []
    mockFetch(url => {
      urls.push(url)
      if (url.includes('eurostat')) return jsonResponse(jsonStat(['EL', 'EA21'], ['2026-08'], { 0: 3.1, 1: 2.0 }))
      if (url.includes('KR.DFR')) return jsonResponse(sdmx([['2026-06-17', 2.25]]))
      if (url.includes('ecb')) return jsonResponse(sdmx([['2026-08', 3.4]]))
      throw new Error(`unexpected ${url}`)
    })
    const { fetchEuropeData } = await load()
    const d = await fetchEuropeData('GR')
    expect(d.euroMember).toBe(true)
    expect(urls.filter(u => u.includes('eurostat')).every(u => u.includes('geo=EL'))).toBe(true)
    expect(urls.some(u => u.includes('stats.bis.org'))).toBe(false)
    expect(d.series.hicp?.points[0].value).toBe(3.1)
    expect(d.series.hicp?.ea?.[0].value).toBe(2.0)
    expect(d.series.policy?.label).toMatch(/ECB deposit facility/)
    expect(d.series.policy?.points.length).toBeGreaterThan(0)
    expect(d.errors).toBe(0)
  })

  it('uses BIS for a non-euro policy rate and the national currency for FX', async () => {
    const urls: string[] = []
    mockFetch(url => {
      urls.push(url)
      if (url.includes('stats.bis.org')) return textResponse('TIME_PERIOD,OBS_VALUE\n2026-08,3.75\n')
      if (url.includes('ecb')) return jsonResponse(sdmx([['2026-08', 4.2]]))
      return jsonResponse(jsonStat(['PL', 'EA21'], ['2026-08'], { 0: 3.0 }))
    })
    const { fetchEuropeData } = await load()
    const d = await fetchEuropeData('PL')
    expect(d.euroMember).toBe(false)
    expect(d.series.policy).toMatchObject({ source: 'BIS', points: [{ period: '2026-08', value: 3.75 }] })
    expect(urls.some(u => u.includes('EXR/M.PLN.EUR'))).toBe(true)
    expect(urls.some(u => u.includes('MIR/'))).toBe(false)
  })

  it('records per-series failures without rejecting, and does not cache them', async () => {
    const f = mockFetch(url => (url.includes('une_rt_m') ? new Response('', { status: 503 }) : url.includes('ecb') ? new Response('', { status: 404 }) : jsonResponse(jsonStat(['DE'], ['2026-08'], { 0: 1 }))))
    const { fetchEuropeData } = await load()
    const d = await fetchEuropeData('DE')
    expect(d.series.unemployment?.error).toMatch('503')
    expect(d.series.yield10?.points).toEqual([])          // 404: no data, not an error
    expect(d.series.yield10?.error).toBeUndefined()
    expect(d.errors).toBe(1)
    const calls = f.mock.calls.length
    await fetchEuropeData('DE')
    expect(f.mock.calls.length).toBeGreaterThan(calls)
  })

  it('treats a Eurostat error body as "not published" and survives a network failure', async () => {
    mockFetch(url => {
      if (url.includes('eurostat')) return jsonResponse({ error: [{ status: 400, label: 'no data' }] })
      throw new TypeError('Failed to fetch')
    })
    const { fetchEuropeData } = await load()
    const d = await fetchEuropeData('NO')
    expect(d.series.hicp?.points).toEqual([])
    expect(d.series.hicp?.error).toBeUndefined()
    expect(d.series.policy?.error).toMatch('Failed to fetch')
  })
})
