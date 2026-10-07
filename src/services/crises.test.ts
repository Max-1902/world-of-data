import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse, quietConsole, installLocalStorage } from '../test/helpers'

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

  it('does not retry a failed token request until the cooldown has passed', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = mockFetch(() => jsonResponse({ error: 'flood_user_blocked' }, { status: 403 }))
      const { fetchACLEDEvents } = await load()
      await fetchACLEDEvents()
      await fetchACLEDEvents()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 1000)
      await fetchACLEDEvents()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally { vi.useRealTimers() }
  })

  it('caches the token between calls', async () => {
    const fetchMock = mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [] }))
    const { fetchACLEDEvents } = await load()
    await fetchACLEDEvents()
    await fetchACLEDEvents()
    expect(fetchMock.mock.calls.filter(c => c[0] === TOKEN_URL)).toHaveLength(1)
  })
})

describe('ACLED login persistence across reloads', () => {
  beforeEach(() => { quietConsole(); installLocalStorage() })

  it('reuses a stored token after a page reload instead of logging in again', async () => {
    const fetchMock = mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [] }))
    await (await load()).fetchACLEDEvents()
    await (await load()).fetchACLEDEvents() // fresh module = reload
    expect(fetchMock.mock.calls.filter(c => c[0] === TOKEN_URL)).toHaveLength(1)
  })

  it('stays off the login endpoint after a reload when the account was recently locked', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ error: 'flood_user_blocked' }, { status: 403 }))
    await (await load()).fetchACLEDEvents()
    await (await load()).fetchACLEDEvents() // fresh module = reload
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('backs off for 2 hours after a lockout (403) but only 30 minutes after other failures', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = mockFetch(() => jsonResponse({ error: 'flood_user_blocked' }, { status: 403 }))
      const { fetchACLEDEvents } = await load()
      await fetchACLEDEvents()
      vi.advanceTimersByTime(31 * 60 * 1000)
      await fetchACLEDEvents()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(90 * 60 * 1000)
      await fetchACLEDEvents()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally { vi.useRealTimers() }
  })
})

describe('fetchACLEDHistory', () => {
  beforeEach(() => quietConsole())

  const row = (i: number, o: Record<string, string> = {}) => ({
    event_id_cnty: `E${i}`, event_date: '2025-01-02', event_type: 'Battles', country: 'Ukraine',
    latitude: '48.1', longitude: '37.7', fatalities: '1', ...o,
  })

  it('pages until a short page, asks for the slim field list, and maps rows', async () => {
    const pages: string[] = []
    mockFetch(url => {
      if (url === TOKEN_URL) return okToken()
      const q = new URL(url, 'http://x').searchParams
      pages.push(q.get('page')!)
      expect(q.get('fields')).not.toContain('notes')
      return jsonResponse({ status: 200, data: q.get('page') === '1' ? Array.from({ length: 5000 }, (_, i) => row(i)) : [row(9001)] })
    })
    const { fetchACLEDHistory } = await load()
    const { events, truncated } = await fetchACLEDHistory(75)
    expect(pages).toEqual(['1', '2'])
    expect(events).toHaveLength(5001)
    expect(truncated).toBe(false)
    expect(events[0]).toMatchObject({ id: 'E0', title: 'Battles in Ukraine', severity: 'critical', country: 'Ukraine', description: '', fatalities: 1 })
  })

  it('skips rows with bad coordinates or no country', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [
      row(1), row(2, { latitude: 'x' }), row(3, { country: '' }), row(4, { event_date: '' }),
    ] }))
    const { fetchACLEDHistory } = await load()
    expect((await fetchACLEDHistory()).events.map(e => e.id)).toEqual(['E1'])
  })

  it('stops at the page ceiling and marks the result truncated', async () => {
    let calls = 0
    mockFetch(url => {
      if (url === TOKEN_URL) return okToken()
      calls++
      return jsonResponse({ status: 200, data: Array.from({ length: 5000 }, (_, i) => row(i)) })
    })
    const { fetchACLEDHistory } = await load()
    const r = await fetchACLEDHistory()
    expect(calls).toBe(10)
    expect(r.truncated).toBe(true)
  })

  it('keeps earlier pages and flags truncation when a later page fails', async () => {
    mockFetch(url => {
      if (url === TOKEN_URL) return okToken()
      return new URL(url, 'http://x').searchParams.get('page') === '1'
        ? jsonResponse({ status: 200, data: Array.from({ length: 5000 }, (_, i) => row(i)) })
        : new Response('nope', { status: 500 })
    })
    const { fetchACLEDHistory } = await load()
    const r = await fetchACLEDHistory()
    expect(r.events).toHaveLength(5000)
    expect(r.truncated).toBe(true)
  })

  it('returns an empty, untruncated result without a token or on first-page failure', async () => {
    mockFetch(url => url === TOKEN_URL ? new Response('x', { status: 401 }) : jsonResponse({}))
    const a = await (await load()).fetchACLEDHistory()
    expect(a).toMatchObject({ events: [], truncated: false })

    mockFetch(url => url === TOKEN_URL ? okToken() : new Response('x', { status: 500 }))
    const b = await (await load()).fetchACLEDHistory()
    expect(b).toMatchObject({ events: [], truncated: false })
  })

  it.each([
    ['rejected credentials (400)', () => jsonResponse({ error: 'invalid_grant' }, { status: 400 }), /rejected the login/],
    ['rejected credentials (401)', () => new Response('x', { status: 401 }), /rejected the login/],
    ['a locked account (403)', () => new Response('x', { status: 403 }), /temporarily locked/],
    ['a server error (500)', () => new Response('x', { status: 500 }), /could not be reached/],
    ['missing server credentials', () => jsonResponse({ access_token: null }), /not set in \.env/],
  ])('reports why there is no data on %s', async (_label, tokenResponse, message) => {
    mockFetch(url => url === TOKEN_URL ? tokenResponse() : jsonResponse({}))
    const r = await (await load()).fetchACLEDHistory()
    expect(r.events).toEqual([])
    expect(r.reason).toMatch(message)
  })

  it('reports an unreachable login service and clears the reason after a successful login', async () => {
    mockFetch(() => { throw new Error('offline') })
    const first = await load()
    expect((await first.fetchACLEDHistory()).reason).toMatch(/could not be reached/)

    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [row(1)] }))
    const ok = await load()
    const r = await ok.fetchACLEDHistory()
    expect(r.events).toHaveLength(1)
    expect(r.reason).toBeUndefined()
    expect(ok.acledAuthMessage()).toBeNull()
  })
})
