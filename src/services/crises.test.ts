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

describe('ACLED data note', () => {
  beforeEach(() => quietConsole())
  const NOW = Date.UTC(2026, 9, 28)
  const noteOf = async () => (await import('./sourceHealth')).healthTracker.getNotes().get('acled')

  it('states the newest event, the count, and that a capped poll is a sample', async () => {
    const { acledDataNote, ACLED_LIMIT } = await load()
    const rows = [acledRow({ event_date: '2026-10-20' }), acledRow({ event_date: '2026-10-26' })]
    expect(acledDataNote(rows, 14, NOW)).toEqual({ asOf: 'newest event 2026-10-26', coverage: '2 events', warn: undefined })
    const capped = Array.from({ length: ACLED_LIMIT }, () => acledRow({ event_date: '2026-10-26' }))
    expect(acledDataNote(capped, 14, NOW).coverage).toContain('capped sample')
  })

  it('warns when the newest event is older than the window, and when nothing came back', async () => {
    const { acledDataNote } = await load()
    const old = acledDataNote([acledRow({ event_date: '2025-10-20' })], 14, NOW)
    expect(old.asOf).toBe('newest event 2025-10-20')
    expect(old.warn).toContain('373 days old')
    const none = acledDataNote([], 14, NOW)
    expect(none.asOf).toBeUndefined()
    expect(none.warn).toContain('No events came back for the last 14 days')
  })

  it('is recorded on the live poll and replaced by the archive note when only history is available', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [acledRow({ event_date: '2025-10-20' })] }))
    const { fetchACLEDEvents, fetchACLEDArchive } = await load()
    await fetchACLEDEvents()
    expect((await noteOf())?.asOf).toBe('newest event 2025-10-20')
    await fetchACLEDArchive(14, NOW)
    expect((await noteOf())?.warn).toContain('one year earlier')
  })

  it('leaves the note alone when the request fails', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({}, { status: 500 }))
    const { fetchACLEDEvents } = await load()
    await fetchACLEDEvents()
    expect(await noteOf()).toBeUndefined()
  })
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

  it('drops rows without usable coordinates', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [
      acledRow({ event_id_cnty: 'A', latitude: '' }),
      acledRow({ event_id_cnty: 'B', longitude: 'n/a' }),
      acledRow({ event_id_cnty: 'C' }),
    ] }))
    const { fetchACLEDEvents } = await load()
    expect((await fetchACLEDEvents()).map(e => e.id)).toEqual(['C'])
  })

  it('records whether the poll hit ACLED_LIMIT, so callers can say counts are a sample (not totals)', async () => {
    const row = (i: number) => ({ event_id_cnty: `E${i}`, event_date: '2026-10-14', event_type: 'Battles', country: 'X', admin1: 'a', location: 'b', latitude: '1', longitude: '2', notes: '', fatalities: '0' })
    const { fetchACLEDEvents, lastAcledPoll, ACLED_LIMIT } = await load()
    expect(lastAcledPoll()).toBeNull()
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: Array.from({ length: ACLED_LIMIT }, (_, i) => row(i)) }))
    await fetchACLEDEvents()
    expect(lastAcledPoll()).toEqual({ rows: ACLED_LIMIT, capped: true })
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [row(1)] }))
    await fetchACLEDEvents()
    expect(lastAcledPoll()).toEqual({ rows: 1, capped: false })
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

describe('ACLED archive fallback (account tiers that lag ~12 months)', () => {
  beforeEach(() => { quietConsole(); installLocalStorage() })

  it('targets the same-length window ending one calendar year before now', async () => {
    const { acledArchiveWindow } = await load()
    expect(acledArchiveWindow(14, Date.parse('2026-10-19T12:00:00Z'))).toEqual({ from: '2025-10-05', to: '2025-10-19' })
  })

  it('queries that window and flags every event as archived', async () => {
    const fetchMock = mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [acledRow({ event_date: '2025-10-12' })] }))
    const { fetchACLEDArchive } = await load()
    const archive = await fetchACLEDArchive(14, Date.parse('2026-10-19T12:00:00Z'))
    expect(archive).toMatchObject({ from: '2025-10-05', to: '2025-10-19' })
    expect(archive!.events).toHaveLength(1)
    expect(archive!.events[0]).toMatchObject({ id: 'UKR1', archived: true, date: '2025-10-12' })
    const [url] = fetchMock.mock.calls.find(c => String(c[0]).startsWith('/api/acled/read'))!
    expect(new URL(String(url), 'http://x').searchParams.get('event_date')).toBe('2025-10-05|2025-10-19')
  })

  it('does not touch the live poll stats the analyst reads', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [acledRow()] }))
    const { fetchACLEDArchive, lastAcledPoll } = await load()
    await fetchACLEDArchive()
    expect(lastAcledPoll()).toBeNull()
  })

  it('returns null when the archive is empty, the request fails, or there is no token', async () => {
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({ status: 200, data: [] }))
    expect(await (await load()).fetchACLEDArchive()).toBeNull()
    mockFetch(url => url === TOKEN_URL ? okToken() : jsonResponse({}, { status: 500 }))
    expect(await (await load()).fetchACLEDArchive()).toBeNull()
    installLocalStorage() // forget the token stored above
    mockFetch(() => jsonResponse({ access_token: null }))
    expect(await (await load()).fetchACLEDArchive()).toBeNull()
  })
})
