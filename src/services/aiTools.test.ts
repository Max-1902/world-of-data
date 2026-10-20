import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockFetch, jsonResponse, quietConsole } from '../test/helpers'
import type { CrisisEvent, Flight } from '../types'

const NOW = Date.UTC(2026, 9, 16, 12)

function ev(over: Partial<CrisisEvent> = {}): CrisisEvent {
  return { id: `e${Math.random()}`, title: 'Clash near town', type: 'conflict', severity: 'high', latitude: 0, longitude: 0, country: 'Sudan', date: '2026-10-15', description: '', source: 'ACLED', ...over }
}

async function load() {
  vi.resetModules()
  return import('./aiTools')
}

/** World Bank per-country rows for one indicator: [meta, rows]. */
function wbRows(series: Record<string, [number, number][]>, id = 'NY.GDP.MKTP.KD.ZG') {
  return [{ page: 1, lastupdated: '2026-07-01' }, Object.entries(series).flatMap(([iso2, pts]) =>
    pts.map(([year, value]) => ({ indicator: { id, value: 'GDP growth (annual %)' }, country: { id: iso2, value: iso2 }, date: String(year), value })))]
}

beforeEach(() => { quietConsole() })

describe('parseToolCalls', () => {
  it('reads [DATA:…] lines with pipe-separated args, ignoring prose and unknown tools', async () => {
    const { parseToolCalls } = await load()
    const calls = parseToolCalls('Let me check.\n[DATA:conflict|Sudan]\n  [DATA:series|Germany,France|GDP growth|2000]  \n[DATA:launch_missiles|x]\ninline [DATA:news] stays prose')
    expect(calls.map(c => [c.tool, c.args])).toEqual([['conflict', ['Sudan']], ['series', ['Germany,France', 'GDP growth', '2000']]])
  })

  it('accepts argument-less calls and collapses duplicates (case-insensitive)', async () => {
    const { parseToolCalls } = await load()
    expect(parseToolCalls('[DATA:quakes]\n[DATA:conflict|sudan]\n[DATA:conflict|Sudan]').map(c => c.tool)).toEqual(['quakes', 'conflict'])
  })

  it("maps a model-native tool-call block onto a tool when it names one (the default free model's habit)", async () => {
    const { parseToolCalls } = await load()
    const calls = parseToolCalls("<|tool_call_start|>[news(query='Sudan ceasefire')]<|tool_call_end|>\n<|tool_call_start|>[COUNTRY(name='Sudan')]<|tool_call_end|>")
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ tool: 'news', args: ['Sudan ceasefire'] })
  })
})

describe('runTool — data already on the dashboard', () => {
  it('summarises one country’s live ACLED events with a daily chart, never counting the baseline', async () => {
    const { runTool } = await load()
    const crises = [ev({ fatalities: 4 }), ev({ severity: 'critical', date: '2026-10-14' }), ev({ country: 'Chad' }), ev({ id: 'baseline-1', source: 'Baseline' })]
    const r = await runTool({ tool: 'conflict', args: ['Sudan'], raw: '[DATA:conflict|Sudan]' }, 'R1', { crises, flights: [], trajectories: [], now: NOW })
    expect(r.ok).toBe(true)
    expect(r.text).toContain('Sudan: 2 live events, 4 reported fatalities')
    expect(r.chart?.kind).toBe('line')
    const pts = r.chart!.kind === 'line' ? r.chart!.series[0].points : []
    expect(pts).toHaveLength(14)
    expect(pts.reduce((s, p) => s + p.v, 0)).toBe(2)
  })

  it('ranks countries when no country is given', async () => {
    const { runTool } = await load()
    const r = await runTool({ tool: 'conflict', args: [], raw: '' }, 'R1', { crises: [ev(), ev(), ev({ country: 'Chad' })], flights: [], trajectories: [] })
    expect(r.chart).toMatchObject({ kind: 'rank', items: [{ label: 'Sudan', value: 2 }, { label: 'Chad', value: 1 }] })
  })

  it('reports an unmeasured feed as NOT AVAILABLE, never as zero', async () => {
    const { runTool } = await load()
    const onlyBaseline = await runTool({ tool: 'conflict', args: ['Sudan'], raw: '' }, 'R1', { crises: [ev({ id: 'baseline-x', source: 'Baseline' })], flights: [], trajectories: [] })
    expect(onlyBaseline.ok).toBe(false)
    expect(onlyBaseline.text).toMatch(/^NOT AVAILABLE: .*not measured.*not as zero/)
    const layerOff = await runTool({ tool: 'flights', args: [], raw: '' }, 'R2', { crises: [], flights: [{ origin_country: 'France' } as Flight], trajectories: [], flightsLayer: false })
    expect(layerOff.ok).toBe(false)
  })

  it('rejects unknown countries and disputed areas instead of guessing', async () => {
    const { runTool } = await load()
    const a = await runTool({ tool: 'profile', args: ['Atlantis'], raw: '' }, 'R1', { crises: [], flights: [], trajectories: [] })
    expect(a.text).toContain('unknown country "Atlantis"')
    const b = await runTool({ tool: 'military', args: ['South China Sea'], raw: '' }, 'R2', { crises: [], flights: [], trajectories: [] })
    expect(b.text).toContain('disputed area')
  })
})

describe('runTool — fetched sources', () => {
  it('series: one World Bank request for several countries, a line per country, and a trend test', async () => {
    const { runTool } = await load()
    const years = Array.from({ length: 20 }, (_, i) => 2004 + i)
    const fetch = mockFetch(() => jsonResponse(wbRows({ DE: years.map((y, i) => [y, i * 0.2]), FR: years.map(y => [y, 1]) })))
    const r = await runTool({ tool: 'series', args: ['Germany,France', 'gdp growth', '2004'], raw: '' }, 'R1', { crises: [], flights: [], trajectories: [] })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(fetch.mock.calls[0][0])).toMatch(/country\/DE;FR\/indicator\/NY\.GDP\.MKTP\.KD\.ZG\?source=2&.*date=2004:/)
    expect(r.ok).toBe(true)
    expect(r.chart).toMatchObject({ kind: 'line', xKind: 'year' })
    expect(r.chart!.kind === 'line' && r.chart!.series.map(s => s.label)).toEqual(['Germany', 'France'])
    expect(r.text).toMatch(/Germany: 2004 0\.0%, .*\| trend 2009–2023: \w+ \(Sen slope 0\.2\/yr, p=/)
  })

  it('series: an indicator the catalogue does not have is an error that points to [DATA:catalog]', async () => {
    const { runTool } = await load()
    mockFetch()
    const r = await runTool({ tool: 'series', args: ['Germany', 'happiness of cats'], raw: '' }, 'R1', { crises: [], flights: [], trajectories: [] })
    expect(r.ok).toBe(false)
    expect(r.text).toContain('[DATA:catalog]')
  })

  it('forecast: AR(2) with intervals, a naive baseline and an out-of-sample backtest, charted with the interval', async () => {
    const { runTool } = await load()
    const pts: [number, number][] = Array.from({ length: 30 }, (_, i) => [1995 + i, 2 + Math.sin(i) + (i % 3) * 0.3])
    mockFetch(() => jsonResponse(wbRows({ DE: pts })))
    const r = await runTool({ tool: 'forecast', args: ['Germany', 'NY.GDP.MKTP.KD.ZG'], raw: '' }, 'R1', { crises: [], flights: [], trajectories: [] })
    expect(r.ok).toBe(true)
    expect(r.text).toMatch(/AR\(2\) forecast: 2025 .*\[95% /)
    expect(r.text).toContain('Headline model: AR(2)')
    expect(r.text).toMatch(/backtest over \d+ one-year-ahead folds/)
    expect(r.chart).toMatchObject({ kind: 'line', series: [{ label: 'Germany (observed)' }, { label: 'AR(2) forecast', dashed: true }] })
    expect(r.chart!.kind === 'line' && r.chart!.area?.points).toHaveLength(3)
    // 30 years give 18 three-year-ahead errors, one short of an empirical interval: that horizon's coverage is not claimed
    expect(r.text).toMatch(/2025 [^;]*\[95% interval \(held 93\.1%/)
    expect(r.text).toMatch(/2027 [^;]*\[95% interval \(coverage not measured/)
  })

  it('forecast: for inflation the headline is "no change", with no AR(2) forecast given, and the model choice is explained', async () => {
    const { runTool } = await load()
    // a 1990s hyperinflation then low single digits: full-history AR(2) would forecast a return towards the 1990s
    const ys = [400, 2000, 900, 60, 20, 10, ...Array.from({ length: 28 }, (_, i) => 3 + Math.sin(i) * 0.5)]
    const pts: [number, number][] = ys.map((y, i) => [1990 + i, y])
    mockFetch(() => jsonResponse(wbRows({ BR: pts })))
    const r = await runTool({ tool: 'forecast', args: ['Brazil', 'FP.CPI.TOTL.ZG'], raw: '' }, 'R1', { crises: [], flights: [], trajectories: [] })
    expect(r.ok).toBe(true)
    const lastV = ys[ys.length - 1].toFixed(1)
    expect(r.text).toMatch(new RegExp(`No-change forecast: 2024 \\+?${lastV}%`))
    expect(r.text).toContain('hyperinflation or crisis years')
    expect(r.text).not.toMatch(/AR\(2\): 20/)
    expect(r.text).toContain('Headline model: "no change"')
    expect(r.chart).toMatchObject({ kind: 'line', series: [{ label: 'Brazil (observed)' }, { label: 'No-change forecast', dashed: true }] })
  })

  it('quakes: filters by place and charts per day', async () => {
    const { runTool } = await load()
    const f = (id: string, mag: number, place: string, time: number) => ({ id, properties: { mag, place, time, url: '' }, geometry: { coordinates: [0, 0, 10] } })
    mockFetch(() => jsonResponse({ features: [f('a', 6.1, '50 km S of Tokyo, Japan', NOW - 3600e3), f('b', 4.6, 'Chile', NOW - 86400e3)] }))
    const r = await runTool({ tool: 'quakes', args: ['Japan'], raw: '' }, 'R1', { crises: [], flights: [], trajectories: [], now: NOW })
    expect(r.text).toMatch(/^1 earthquakes matching "Japan" \(of 2 worldwide\)/)
    expect(r.text).toContain('M6.1 50 km S of Tokyo, Japan')
  })

  it('network failure becomes a NOT AVAILABLE result, not a thrown error', async () => {
    const { runTool } = await load()
    mockFetch(() => { throw new TypeError('Failed to fetch') })
    const r = await runTool({ tool: 'rank', args: ['GDP per capita'], raw: '[DATA:rank|GDP per capita]' }, 'R3', { crises: [], flights: [], trajectories: [] })
    expect(r).toMatchObject({ id: 'R3', ok: false, call: '[DATA:rank|GDP per capita]' })
    expect(r.text).toMatch(/^NOT AVAILABLE: request failed/)
  })
})

describe('catalogue and formatting', () => {
  it('every tool is documented with its usage line in the prompt catalogue', async () => {
    const { toolCatalogue, TOOL_NAMES } = await load()
    const cat = toolCatalogue()
    for (const n of TOOL_NAMES) expect(cat).toContain(`[DATA:${n}`)
  })

  it('matches indicators by name as well as id', async () => {
    const { _test } = await load()
    expect(_test.findSeries('inflation')?.id).toBe('FP.CPI.TOTL.ZG')
    expect(_test.findSeries('NY.GDP.PCAP.CD')?.id).toBe('NY.GDP.PCAP.CD')
    expect(_test.findSeries('zzz')).toBeNull()
    expect(_test.findIndicator('military spending')?.id).toBeTruthy()
  })

  it('formats results with ids, sources and a chartable marker, and says when requests were dropped', async () => {
    const { formatToolResults } = await load()
    const txt = formatToolResults([
      { id: 'R1', call: '[DATA:quakes]', tool: 'quakes', args: [], ok: true, at: 0, title: 'Quakes', source: 'USGS', text: '3 earthquakes', chart: { kind: 'rank', unit: 'x', items: [] } },
      { id: 'R2', call: '[DATA:fires]', tool: 'fires', args: [], ok: false, at: 0, title: 'fires', source: '', text: 'NOT AVAILABLE: x' },
    ], 2)
    expect(txt).toMatch(/^TOOL RESULTS/)
    expect(txt).toContain('--- R1 · [DATA:quakes] · Quakes · source: USGS · chartable\n3 earthquakes')
    expect(txt).toContain('--- R2 · [DATA:fires]\nNOT AVAILABLE: x')
    expect(txt).toContain('2 further requests dropped')
  })
})
