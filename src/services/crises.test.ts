import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch, jsonResponse, textResponse, quietConsole } from '../test/helpers'

// crises.ts caches the ACLED token at module level — reload it for each test.
async function load() {
  vi.resetModules()
  return import('./crises')
}

const TOKEN_URL = '/api/acled-token'
const okToken = () => jsonResponse({ access_token: 'acled-tok', expires_in: 86400 })

const acledRow = (o: Record<string, string> = {}) => ({
  event_id_cnty: 'UKR1', event_date: '2025-01-02', event_type: 'Battles', country: 'Ukraine',
  admin1: 'Donetsk', location: 'Avdiivka', latitude: '48.14', longitude: '37.75',
  notes: 'Something happened', fatalities: '3', ...o,
})

describe('fetchACLEDEvents', () => {
  beforeEach(() => quietConsole())

  it('maps ACLED rows to crisis events with numeric coordinates and severity by type', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [
      acledRow(),
      acledRow({ event_id_cnty: 'P1', event_type: 'Protests' }),
      acledRow({ event_id_cnty: 'X1', event_type: 'Explosions' }),
    ] }))
    const { fetchACLEDEvents } = await load()
    const events = await fetchACLEDEvents()
    expect(events[0]).toEqual({
      id: 'UKR1', title: 'Battles in Avdiivka, Donetsk', type: 'war', severity: 'critical',
      latitude: 48.14, longitude: 37.75, country: 'Ukraine', date: '2025-01-02',
      description: 'Something happened', source: 'ACLED', fatalities: 3,
    })
    expect(events[1]).toMatchObject({ type: 'protest', severity: 'medium' })
    expect(events[2]).toMatchObject({ type: 'conflict', severity: 'high' })
  })

  it('defaults unknown event types to conflict, truncates notes to 300 chars, and zeroes bad fatalities', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [
      acledRow({ event_type: 'Something New', notes: 'x'.repeat(500), fatalities: 'n/a' }),
    ] }))
    const { fetchACLEDEvents } = await load()
    const [e] = await fetchACLEDEvents()
    expect(e.type).toBe('conflict')
    expect(e.description).toHaveLength(300)
    expect(e.fatalities).toBe(0)
  })

  it('sends the bearer token and a date-range query for the requested window', async () => {
    const fetchMock = mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [] }))
    const { fetchACLEDEvents } = await load()
    await fetchACLEDEvents(7)
    const [url, init] = fetchMock.mock.calls.find(c => String(c[0]).startsWith('/api/acled/read'))!
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer acled-tok')
    const params = new URL(String(url), 'http://x').searchParams
    const [since, until] = params.get('event_date')!.split('|')
    expect((Date.parse(until) - Date.parse(since)) / 86_400_000).toBe(7)
    expect(params.get('event_date_where')).toBe('BETWEEN')
  })

  it('returns [] without calling the data endpoint when no token is available', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ access_token: null }))
    const { fetchACLEDEvents } = await load()
    expect(await fetchACLEDEvents()).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns [] when the token request fails', async () => {
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await (await load()).fetchACLEDEvents()).toEqual([])
    mockFetch(() => { throw new Error('offline') })
    expect(await (await load()).fetchACLEDEvents()).toEqual([])
  })

  it('returns [] on an API-level error status or HTTP failure', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 401, error: 'bad' }))
    expect(await (await load()).fetchACLEDEvents()).toEqual([])
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({}, { status: 500 }))
    expect(await (await load()).fetchACLEDEvents()).toEqual([])
  })

  it('caches the token between calls', async () => {
    const fetchMock = mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [] }))
    const { fetchACLEDEvents } = await load()
    await fetchACLEDEvents()
    await fetchACLEDEvents()
    expect(fetchMock.mock.calls.filter(c => c[0] === TOKEN_URL)).toHaveLength(1)
  })
})

describe('fetchGDELTCrises', () => {
  beforeEach(() => quietConsole())
  afterEach(() => vi.useRealTimers())

  const feature = (title: string, coords: unknown = [10, 20], props: Record<string, unknown> = {}) => ({
    geometry: { coordinates: coords }, properties: { name: title, ...props },
  })

  it('swaps GeoJSON [lng, lat] order and classifies event type from the title', async () => {
    mockFetch(() => jsonResponse({ features: [
      feature('Missile attack on city', [30.5, 50.4]),
      feature('Car bomb explodes in market'),
      feature('Mass protest in capital'),
      feature('Coup attempt announced'),
      feature('Flood hits region'),
      feature('Unclassifiable happening'),
    ] }))
    const { fetchGDELTCrises } = await load()
    const events = await fetchGDELTCrises()
    expect(events.map(e => e.type)).toEqual(['war', 'terrorism', 'protest', 'political', 'disaster', 'conflict'])
    expect(events[0]).toMatchObject({ latitude: 50.4, longitude: 30.5, source: 'GDELT' })
    expect(events.map(e => e.severity)).toEqual(['critical', 'high', 'medium', 'medium', 'high', 'high'])
  })

  it('gives every event a unique id', async () => {
    mockFetch(() => jsonResponse({ features: Array.from({ length: 25 }, (_, i) => feature(`Event ${i}`)) }))
    const events = await (await load()).fetchGDELTCrises()
    expect(new Set(events.map(e => e.id)).size).toBe(25)
  })

  it('accepts a bare array payload and prefers urlsharetitle over name', async () => {
    mockFetch(() => jsonResponse([feature('ignored name', [1, 2], { urlsharetitle: 'Shared headline war' })]))
    const [e] = await (await load()).fetchGDELTCrises()
    expect(e.title).toBe('Shared headline war')
    expect(e.type).toBe('war')
  })

  it('drops features without usable coordinates', async () => {
    mockFetch(() => jsonResponse({ features: [
      { geometry: {}, properties: { name: 'no coords' } }, feature('one coord', [5]), { properties: {} }, feature('good'),
    ] }))
    const events = await (await load()).fetchGDELTCrises()
    expect(events.map(e => e.title)).toEqual(['good'])
  })

  it('returns [] for empty bodies, invalid JSON, HTTP errors, and network failures', async () => {
    mockFetch(() => textResponse('   '))
    expect(await (await load()).fetchGDELTCrises()).toEqual([])
    mockFetch(() => textResponse('<html>rate limited</html>'))
    expect(await (await load()).fetchGDELTCrises()).toEqual([])
    mockFetch(() => jsonResponse({}, { status: 429 }))
    expect(await (await load()).fetchGDELTCrises()).toEqual([])
    mockFetch(() => { throw new Error('offline') })
    expect(await (await load()).fetchGDELTCrises()).toEqual([])
  })
})
