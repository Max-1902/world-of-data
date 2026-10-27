/**
 * The Analyst tools not covered in aiTools.test.ts. Fetching services are mocked at the module boundary;
 * static datasets are the real ones, so each test checks the tool reports what the dataset actually says.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Flight } from '../types'
import type { ToolContext } from './aiTools'

const m = vi.hoisted(() => ({
  fetchWildfires: vi.fn(), loadDisasterAlerts: vi.fn(), fetchOutageEvents: vi.fn(), fetchRadarOutages: vi.fn(), fetchGPSJam: vi.fn(),
  searchAllSources: vi.fn(), fetchTopHeadlines: vi.fn(), fetchMultipleQuotes: vi.fn(), fetchEiaSeries: vi.fn(),
  fetchIndicatorAll: vi.fn(), fetchCountryDataset: vi.fn(), fetchPowerGenerationRanking: vi.fn(),
  fetchMilitaryPersonnelRanking: vi.fn(), fetchResourceRents: vi.fn(), historyLoad: vi.fn(), getSnapshots: vi.fn(),
}))

vi.mock('./wildfires', () => ({ fetchWildfires: m.fetchWildfires }))
vi.mock('./gdacs', async orig => ({ ...await orig<typeof import('./gdacs')>(), loadDisasterAlerts: m.loadDisasterAlerts }))
vi.mock('./outages', async orig => ({ ...await orig<typeof import('./outages')>(), fetchOutageEvents: m.fetchOutageEvents }))
vi.mock('./radarOutages', async orig => ({ ...await orig<typeof import('./radarOutages')>(), fetchRadarOutages: m.fetchRadarOutages }))
vi.mock('./gpsjam', async orig => ({ ...await orig<typeof import('./gpsjam')>(), fetchGPSJam: m.fetchGPSJam }))
vi.mock('./news', async orig => ({ ...await orig<typeof import('./news')>(), searchAllSources: m.searchAllSources, fetchTopHeadlines: m.fetchTopHeadlines }))
vi.mock('./stocks', async orig => ({ ...await orig<typeof import('./stocks')>(), fetchMultipleQuotes: m.fetchMultipleQuotes }))
vi.mock('./eia', async orig => ({ ...await orig<typeof import('./eia')>(), fetchEiaSeries: m.fetchEiaSeries }))
vi.mock('./countryIndicators', async orig => ({ ...await orig<typeof import('./countryIndicators')>(), fetchIndicatorAll: m.fetchIndicatorAll }))
vi.mock('./countryLookup', async orig => ({ ...await orig<typeof import('./countryLookup')>(), fetchCountryDataset: m.fetchCountryDataset }))
vi.mock('./powerGeneration', async orig => ({ ...await orig<typeof import('./powerGeneration')>(), fetchPowerGenerationRanking: m.fetchPowerGenerationRanking }))
vi.mock('./militaryPersonnel', () => ({ fetchMilitaryPersonnelRanking: m.fetchMilitaryPersonnelRanking }))
vi.mock('./resources', async orig => ({ ...await orig<typeof import('./resources')>(), fetchResourceRents: m.fetchResourceRents }))
vi.mock('./history', async orig => ({ ...await orig<typeof import('./history')>(), history: { load: m.historyLoad, getSnapshots: m.getSnapshots } }))

const { runTool } = await import('./aiTools')
const { SANCTIONED_COUNTRIES } = await import('./sanctions')
const { MILITARY_FACILITIES } = await import('./military')
const { PORTS } = await import('./ports')
const { CHOKEPOINTS } = await import('./chokepoints')
const { TOP_HOSTING, TOP_ORIGINS } = await import('./unhcr')
const { getTradeProfile } = await import('./tradeStats')

const NOW = Date.UTC(2026, 9, 16, 12)
const ctx = (o: Partial<ToolContext> = {}): ToolContext => ({ crises: [], flights: [], trajectories: [], now: NOW, ...o })
const run = (tool: string, args: string[] = [], c: ToolContext = ctx()) => runTool({ tool, args, raw: `[DATA:${tool}${args.length ? `|${args.join('|')}` : ''}]` }, 'R1', c)

const flight = (o: Partial<Flight> = {}): Flight => ({
  icao24: 'a', callsign: 'X', origin_country: 'Germany', latitude: 50, longitude: 8, altitude: 1000, velocity: 200, heading: 0, on_ground: false, ...o,
})

beforeEach(() => { for (const fn of Object.values(m)) fn.mockReset() })

describe('catalog', () => {
  it('regression: lists every series and indicator id, untruncated', async () => {
    const { ALL_SERIES } = await import('./countryLookup')
    const { INDICATORS } = await import('./countryIndicators')
    const r = await run('catalog')
    expect(r.text).not.toContain('(truncated)')
    for (const s of ALL_SERIES) expect(r.text).toContain(`[${s.id}]`)
    for (const i of INDICATORS) expect(r.text).toContain(`[${i.id}]`)
  })
})

describe('history', () => {
  it('summarises the browser snapshots for a country and charts them', async () => {
    m.getSnapshots.mockReturnValue([
      { t: NOW - 3600_000, threat: 1, flights: null, countries: { Sudan: 10 } },
      { t: NOW, threat: 1, flights: null, countries: { Sudan: 30 } },
    ])
    const r = await run('history', ['Sudan'])
    expect(m.historyLoad).toHaveBeenCalled()
    expect(r.text).toContain('2 snapshots')
    expect(r.text).toContain('Score first 10, latest 30, max 30, min 10')
    expect(r.chart?.kind).toBe('line')
  })

  it('is NOT AVAILABLE when nothing has been recorded yet', async () => {
    m.getSnapshots.mockReturnValue([])
    const r = await run('history', ['Sudan'])
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(/NOT AVAILABLE: no snapshots/)
  })
})

describe('flights and airspace', () => {
  it('counts aircraft by registration, and for one country', async () => {
    const flights = [flight(), flight({ on_ground: true }), flight({ origin_country: 'France' })]
    const all = await run('flights', [], ctx({ flights }))
    expect(all.text).toContain('3 aircraft tracked (2 airborne)')
    expect(all.chart).toMatchObject({ kind: 'rank', items: [{ label: 'Germany', value: 2 }, { label: 'France', value: 1 }] })
    const de = await run('flights', ['Germany'], ctx({ flights }))
    expect(de.text).toContain('2 aircraft registered in Germany (1 airborne) out of 3')
  })

  it.each([
    ['the layer is off', ctx({ flights: [flight()], flightsLayer: false })],
    ['no flights arrived', ctx()],
  ])('flights and airspace are NOT AVAILABLE when %s', async (_why, c) => {
    expect((await run('flights', [], c)).ok).toBe(false)
    expect((await run('airspace', [], c)).ok).toBe(false)
  })

  it('airspace refuses to run on too few aircraft to mean anything', async () => {
    const r = await run('airspace', [], ctx({ flights: [flight()] }))
    expect(r.text).toMatch(/too few located aircraft/)
  })
})

describe('fires', () => {
  it('groups detections into 1° cells, densest first', async () => {
    const f = (lat: number, lng: number, frp: number, confidence = 'nominal') => ({ id: 'f', latitude: lat, longitude: lng, frp, confidence, date: '', time: '', satellite: '', daynight: 'D', brightness: 0 })
    m.fetchWildfires.mockResolvedValue([f(10.1, 20.2, 5, 'high'), f(9.9, 19.8, 7), f(-5, 30, 1)])
    const r = await run('fires')
    expect(r.text).toContain('3 detections (1 high confidence)')
    expect(r.text).toContain('10°, 20° 2 detections / 12 MW FRP')
    expect(r.chart).toMatchObject({ items: [{ label: '10°, 20°', value: 2 }, { label: '-5°, 30°', value: 1 }] })
  })

  it('is NOT AVAILABLE on an empty feed', async () => {
    m.fetchWildfires.mockResolvedValue([])
    expect((await run('fires')).ok).toBe(false)
  })
})

describe('disasters', () => {
  const alert = (o = {}) => ({ id: 'a', type: 'EQ', name: 'Quake', country: 'Japan', alert: 'Red', score: 1, latitude: 0, longitude: 0, from: '', to: '', reportUrl: '', severityText: 'M7', source: 'USGS', affectedCountries: ['Japan'], isCurrent: true, ...o })

  it('filters by an affected country and counts red alerts', async () => {
    m.loadDisasterAlerts.mockResolvedValue([alert(), alert({ alert: 'Orange', country: 'Chile', affectedCountries: ['Chile', 'Japan'] }), alert({ country: 'Peru', affectedCountries: ['Peru'] })])
    const r = await run('disasters', ['Japan'])
    expect(m.loadDisasterAlerts).toHaveBeenCalledWith(14)
    expect(r.text).toContain('2 alerts (1 red)')
    expect(r.text).not.toContain('Peru')
  })

  it('says plainly when there are none', async () => {
    m.loadDisasterAlerts.mockResolvedValue([])
    expect((await run('disasters')).text).toBe('No orange/red GDACS alerts in the last 14 days.')
  })

  it('reports a failed GDACS request as NOT AVAILABLE, not as no alerts', async () => {
    m.loadDisasterAlerts.mockRejectedValue(new Error('GDACS 503'))
    const r = await run('disasters')
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(/^NOT AVAILABLE: .*GDACS 503/)
  })
})

describe('outages', () => {
  const outage = (o = {}) => ({ id: 'o', entityType: 'country', entityName: 'Iran', entityCode: 'IR', org: '', status: 'ongoing', level: 'critical', severity: 'severe', dropPct: 80, start: NOW / 1000, lastAlert: NOW / 1000, signals: [], location: null, ...o })

  it('matches a country by code or name and sorts by signal drop', async () => {
    m.fetchOutageEvents.mockResolvedValue([outage({ dropPct: 40, entityName: 'Tehran', entityType: 'region', entityCode: 'x', location: { label: 'Tehran, Iran' } }), outage(), outage({ entityName: 'Peru', entityCode: 'PE' })])
    m.fetchRadarOutages.mockResolvedValue({ status: 'ok', outages: [] })
    const r = await run('outages', ['Iran'])
    expect(r.text).toMatch(/^2 IODA outage events \(2 ongoing\):\n {2}• Iran/)
    expect(r.text).not.toContain('Peru')
    expect(r.chart).toMatchObject({ items: [{ value: 80 }, { value: 40 }] })
  })

  const verified = (o = {}) => ({ id: 'r', cause: 'GOVERNMENT_DIRECTED', type: 'NATIONWIDE', scope: '', countries: [{ code: 'IR', name: 'Iran' }], asns: [], start: NOW - 3_600_000, end: null, description: 'Shutdown during protests', linkedUrl: '', ...o })

  it('adds Cloudflare Radar verified outages with their stated cause, filtered to the country', async () => {
    m.fetchOutageEvents.mockResolvedValue([])
    m.fetchRadarOutages.mockResolvedValue({ status: 'ok', outages: [verified(), verified({ id: 'p', cause: 'POWER_OUTAGE', countries: [{ code: 'PE', name: 'Peru' }] })] })
    const r = await run('outages', ['Iran'])
    expect(r.text).toContain('Cloudflare Radar verified outages, last 7 days (1;')
    expect(r.text).toContain('Iran — Government-directed shutdown, nationwide')
    expect(r.text).toContain('no end time recorded: Shutdown during protests')
    expect(r.text).not.toContain('Peru')
  })

  it('reports Radar as not available, not as "no outages", when the token is missing', async () => {
    m.fetchOutageEvents.mockResolvedValue([])
    m.fetchRadarOutages.mockResolvedValue({ status: 'not_configured' })
    const r = await run('outages')
    expect(r.text).toContain('Cloudflare Radar verified outages: NOT AVAILABLE (no token configured)')
  })
})

describe('gpsjam', () => {
  it('lists the worst cells by share of affected aircraft', async () => {
    const cell = (pct: number, sev: string) => ({ id: 'c', lat: 1.23, lng: 4.56, ring: [], percentBad: pct, good: 10, bad: 5, severity: sev })
    m.fetchGPSJam.mockResolvedValue({ date: '2026-10-15', cells: [cell(5, 'medium'), cell(40, 'high')] })
    const r = await run('gpsjam')
    expect(r.title).toBe('GPS interference, 2026-10-15')
    expect(r.text).toContain('2 cells with interference (1 high >10%)')
    expect(r.text.indexOf('40%')).toBeLessThan(r.text.indexOf('5%'))
  })
})

describe('news', () => {
  it('searches with terms and falls back to headlines without', async () => {
    const a = { id: '1', title: 'Talks resume', description: '', url: 'u', source: 'Wire', publishedAt: '2026-10-16T08:00:00Z' }
    m.searchAllSources.mockResolvedValue([a])
    m.fetchTopHeadlines.mockResolvedValue([a])
    expect((await run('news', ['Sudan talks'])).text).toBe('  • 2026-10-16 Wire: Talks resume')
    expect(m.searchAllSources).toHaveBeenCalledWith('Sudan talks')
    await run('news')
    expect(m.fetchTopHeadlines).toHaveBeenCalled()
  })

  it('is NOT AVAILABLE, not "no news", when every source came back empty', async () => {
    m.fetchTopHeadlines.mockResolvedValue([])
    expect((await run('news')).text).toMatch(/^NOT AVAILABLE/)
  })
})

describe('markets', () => {
  const q = (symbol: string, changePercent: number) => ({ symbol, name: symbol, price: 100, change: 0, changePercent, high: 0, low: 0, open: 0, previousClose: 0, currency: 'USD', exchange: '', lastUpdated: '2026-10-16T12:00:00Z' })

  it('drops invalid tickers and ranks the rest by absolute move', async () => {
    m.fetchMultipleQuotes.mockResolvedValue([q('USO', 1), q('GLD', -3)])
    const r = await run('markets', ['uso, gld, <script>'])
    expect(m.fetchMultipleQuotes).toHaveBeenCalledWith(['USO', 'GLD'])
    expect(r.chart).toMatchObject({ items: [{ label: 'GLD', text: '-3.00%' }, { label: 'USO', text: '+1.00%' }] })
  })

  it('rejects a request with no valid tickers without calling the feed', async () => {
    expect((await run('markets', ['<>'])).ok).toBe(false)
    expect(m.fetchMultipleQuotes).not.toHaveBeenCalled()
  })
})

describe('profile', () => {
  it('reports the latest value and the one ten years earlier, and flags failed requests', async () => {
    m.fetchCountryDataset.mockResolvedValue({
      iso2: 'DE', name: 'Germany', failedBatches: 1, totalBatches: 4, lastUpdated: [], fetchedAt: 0,
      series: { 'SP.POP.TOTL': { name: 'Population', points: [{ x: 2013, y: 80e6 }, { x: 2023, y: 84e6 }] } },
    })
    const r = await run('profile', ['Germany'])
    expect(r.text).toMatch(/Population.*\(2023\); .* in 2013/)
    expect(r.source).toContain('1 of 4 requests failed')
  })

  it('is NOT AVAILABLE when the World Bank returned nothing', async () => {
    m.fetchCountryDataset.mockResolvedValue({ iso2: 'DE', name: 'Germany', failedBatches: 0, totalBatches: 4, lastUpdated: [], fetchedAt: 0, series: {} })
    expect((await run('profile', ['Germany'])).ok).toBe(false)
  })
})

describe('rank', () => {
  const rows = [{ iso3: 'AAA', name: 'A', value: 1, year: '2023' }, { iso3: 'BBB', name: 'B', value: 3, year: '2023' }, { iso3: 'CCC', name: 'C', value: 2, year: '2022' }]

  it('ranks highest first by default and lowest on request, clamping N to 3–25', async () => {
    m.fetchIndicatorAll.mockResolvedValue(rows)
    const top = await run('rank', ['military spending', 'top', '1'])
    expect(top.text).toMatch(/1\) B: .*\n {2}2\) C: .*\n {2}3\) A:/)
    const bottom = await run('rank', ['military spending', 'lowest'])
    expect(bottom.title).toMatch(/lowest 12$/)
    expect(bottom.text).toMatch(/1\) A:/)
  })

  it('rejects an indicator it does not know', async () => {
    expect((await run('rank', ['zzz unknown'])).text).toMatch(/unknown indicator/)
    expect(m.fetchIndicatorAll).not.toHaveBeenCalled()
  })
})

describe('static datasets', () => {
  it('trade: reports the profile it has and refuses one it does not', async () => {
    const p = getTradeProfile('Germany')!
    const r = await run('trade', ['Germany'])
    expect(r.text).toContain(`Germany (${p.year})`)
    expect(r.chart).toMatchObject({ items: p.topExportPartners.map(x => ({ label: x.country, value: x.pct })) })
  })

  it('sanctions: one country, and the full list without one', async () => {
    const iran = SANCTIONED_COUNTRIES.find(s => s.iso2 === 'IR')!
    expect((await run('sanctions', ['Iran'])).text).toContain(`regimes ${iran.regimes.join(', ')}`)
    expect((await run('sanctions')).text.split('\n')).toHaveLength(SANCTIONED_COUNTRIES.length)
    expect((await run('sanctions', ['Iceland'])).text).toBe("Iceland is not in the dashboard's sanctions dataset.")
  })

  it('military: counts facilities hosted, and says when the personnel request failed', async () => {
    m.fetchMilitaryPersonnelRanking.mockRejectedValue(new Error('offline'))
    const hosted = MILITARY_FACILITIES.filter(f => f.host === 'Germany').length
    const r = await run('military', ['Germany'])
    expect(r.text).toContain(`Facilities on its territory (${hosted})`)
    expect(r.text).toContain('World Bank request failed')
  })

  it('ports: lists a country’s ports from the dataset', async () => {
    const nl = PORTS.filter(p => p.country === 'Netherlands')
    const r = await run('ports', ['Netherlands'])
    expect(r.text.split('\n')).toHaveLength(nl.length)
    expect(r.text).toContain('Rotterdam')
  })

  it('chokepoints and refugees come straight from their datasets', async () => {
    expect((await run('chokepoints')).text.split('\n')).toHaveLength(CHOKEPOINTS.length)
    const ref = await run('refugees')
    expect(ref.text).toContain(TOP_HOSTING[0].country)
    expect(ref.chart?.kind === 'rank' && ref.chart.items[0]).toMatchObject({ label: TOP_ORIGINS[0].country, value: TOP_ORIGINS[0].total })
  })
})

describe('energy and resources', () => {
  it('energy: the Ember mix sorted by output, plus Factbook oil and gas', async () => {
    m.fetchPowerGenerationRanking.mockResolvedValue([{ country: 'Iran', code: 'IRN', year: 2024, totalTwh: 300, lowCarbonPct: 7, bySource: { coal: 0, gas: 250, oil: 30, nuclear: 6, hydro: 14, wind: 0, solar: 0, bioenergy: 0, other: 0 } }])
    const r = await run('energy', ['Iran'])
    expect(r.text).toMatch(/Mix: Gas 250 TWh, Oil 30 TWh/)
    expect(r.text).toContain('Oil reserves')
  })

  it('energy: NOT AVAILABLE when neither source has the country', async () => {
    m.fetchPowerGenerationRanking.mockResolvedValue([])
    expect((await run('energy', ['Iceland'])).ok).toBe(false)
  })

  it('resources: survives a failed rents request when a minerals profile exists', async () => {
    m.fetchResourceRents.mockRejectedValue(new Error('offline'))
    const r = await run('resources', ['Chile'])
    expect(r.ok).toBe(true)
    expect(r.text).toContain('Resource rents: unavailable.')
  })
})

describe('inventories', () => {
  const pt = (i: number, value: number) => ({ period: `2026-W${i}`, t: i, value })

  it('reports the latest week, the weekly change and the 52-week range', async () => {
    m.fetchEiaSeries.mockResolvedValue({ status: 'ok', unit: null, points: [pt(1, 400), pt(2, 380), pt(3, 390)] })
    const r = await run('inventories', ['gas'])
    expect(m.fetchEiaSeries).toHaveBeenCalledWith('NG.NW2_EPG0_SWO_R48_BCF.W')
    expect(r.text).toContain('390 billion cubic feet in the week of 2026-W3 (+10 vs prior week). 52-week range 380–400.')
  })

  it.each([
    [{ status: 'not_configured' }, /EIA key is not configured/],
    [{ status: 'error', message: 'EIA returned HTTP 500' }, /EIA returned HTTP 500/],
    [{ status: 'ok', unit: null, points: [pt(1, 1)] }, /too few points/],
  ])('is NOT AVAILABLE for %o', async (res, why) => {
    m.fetchEiaSeries.mockResolvedValue(res)
    const r = await run('inventories')
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(why)
  })
})

describe('exposure', () => {
  const gdpRows = [{ iso3: 'DEU', name: 'Germany', value: 4.6e12, year: '2024' }, { iso3: 'KOR', name: 'South Korea', value: 1.7e12, year: '2024' }, { iso3: 'JPN', name: 'Japan', value: 4.0e12, year: '2024' }]

  it('traces a demand shock from the real Comtrade profiles, labelling each shared step', async () => {
    m.fetchIndicatorAll.mockResolvedValue(gdpRows)
    const r = await run('exposure', ['demand', 'china', '10'])
    expect(m.fetchIndicatorAll).toHaveBeenCalledWith('NY.GDP.MKTP.CD')
    expect(r.title).toContain('China')
    expect(r.text).toContain('[assumption]')
    expect(r.text).toMatch(/South Korea|Germany|Japan/)
    expect(r.chart?.kind === 'rank' && r.chart.items.length).toBeGreaterThan(0)
  })
  it('matches an oil chokepoint by name and states the observed EIA flow', async () => {
    m.fetchIndicatorAll.mockResolvedValue(gdpRows)
    const hz = CHOKEPOINTS.find(c => /hormuz/i.test(c.name))!
    const r = await run('exposure', ['oil', 'Hormuz'])
    expect(r.text).toContain('[observed]')
    expect(r.text).toContain(hz.name)
  })
  it('rejects an unknown shock type or partner instead of guessing', async () => {
    expect((await run('exposure', ['tariff', 'China'])).text).toMatch(/demand, supply or oil/)
    expect((await run('exposure', ['demand', 'Atlantis'])).text).toMatch(/not a partner/)
  })
})
