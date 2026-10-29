import type { CrisisEvent } from '../types'
import { healthTracker, type DataNote } from './sourceHealth'

// ── ACLED OAuth ──────────────────────────────────────────────────────────────
// Docs: https://apidocs.acleddata.com/
const ACLED_TOKEN_URL = '/api/acled-token'
const ACLED_API = '/api/acled/read'

// ACLED locks an account after repeated failed logins (HTTP 403 "flood_user_blocked"), and every failed
// attempt while locked can extend the lock. So the token (valid 24 h) and the "stay off the auth endpoint"
// cooldown are both persisted in localStorage — otherwise every page reload or dev-server restart would
// log in again, or retry straight after a failure.
const TOKEN_KEY = 'ws-acled-token'
const RETRY_KEY = 'ws-acled-retry-at'
const TOKEN_RETRY_COOLDOWN_MS = 30 * 60 * 1000
const LOCKED_RETRY_COOLDOWN_MS = 2 * 60 * 60 * 1000

let _token: string | null = null
let _tokenExpiry = 0
let _tokenRetryAt = 0

function readStored(): void {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (raw && !_token) {
      const { token, expiry } = JSON.parse(raw) as { token?: string; expiry?: number }
      if (typeof token === 'string' && typeof expiry === 'number') { _token = token; _tokenExpiry = expiry }
    }
    const retry = Number(localStorage.getItem(RETRY_KEY))
    if (Number.isFinite(retry) && retry > _tokenRetryAt) _tokenRetryAt = retry
  } catch { /* storage unavailable — in-memory state still works */ }
}

function storeToken(): void {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: _token, expiry: _tokenExpiry })) } catch { /* ignore */ }
}

function backOff(ms: number): void {
  _tokenRetryAt = Date.now() + ms
  try { localStorage.setItem(RETRY_KEY, String(_tokenRetryAt)) } catch { /* ignore */ }
}

async function getACLEDToken(): Promise<string | null> {
  readStored()
  if (_token && Date.now() < _tokenExpiry) return _token
  if (Date.now() < _tokenRetryAt) return null

  try {
    const res = await fetch(ACLED_TOKEN_URL, { method: 'POST' })

    if (!res.ok) {
      console.warn('[ACLED OAuth] token request failed:', res.status)
      backOff(res.status === 403 ? LOCKED_RETRY_COOLDOWN_MS : TOKEN_RETRY_COOLDOWN_MS)
      return null
    }

    const data = await res.json()
    _token = data.access_token ?? null
    // expires_in is in seconds; subtract 60 s buffer
    _tokenExpiry = Date.now() + ((data.expires_in ?? 86400) - 60) * 1000
    if (!_token) backOff(TOKEN_RETRY_COOLDOWN_MS)
    else storeToken()
    return _token
  } catch (err) {
    console.warn('[ACLED OAuth] error:', err)
    backOff(TOKEN_RETRY_COOLDOWN_MS)
    return null
  }
}

const TYPE_MAP: Record<string, CrisisEvent['type']> = {
  Battles: 'war',
  Explosions: 'conflict',
  'Violence against civilians': 'conflict',
  Protests: 'protest',
  Riots: 'protest',
  'Strategic developments': 'political',
}

const SEVERITY_MAP: Record<CrisisEvent['type'], CrisisEvent['severity']> = {
  war: 'critical',
  conflict: 'high',
  terrorism: 'high',
  protest: 'medium',
  political: 'medium',
  disaster: 'high',
}

/** Fields the dashboard requests from ACLED's read API. */
export const ACLED_FIELDS = 'event_id_cnty|event_date|event_type|country|admin1|location|latitude|longitude|notes|fatalities'
/** The dashboard caps each poll at this many events (the cap can truncate the window). */
export const ACLED_LIMIT = 500

/** The exact query the dashboard sends. */
export function acledDashboardQuery(days: number, now: number = Date.now()): URLSearchParams {
  const since = new Date(now - days * 86400000).toISOString().split('T')[0]
  const today = new Date(now).toISOString().split('T')[0]
  return acledWindowQuery(since, today)
}

function acledWindowQuery(since: string, until: string): URLSearchParams {
  return new URLSearchParams({
    _format: 'json',
    event_date: `${since}|${until}`,
    event_date_where: 'BETWEEN',
    limit: String(ACLED_LIMIT),
    fields: ACLED_FIELDS,
  })
}

export function acledToCrisisEvent(e: Record<string, string>): CrisisEvent {
  const type = TYPE_MAP[e.event_type] ?? 'conflict'
  return {
    id: e.event_id_cnty,
    title: `${e.event_type} in ${e.location}, ${e.admin1}`,
    type,
    severity: SEVERITY_MAP[type] ?? 'medium',
    latitude: parseFloat(e.latitude),
    longitude: parseFloat(e.longitude),
    country: e.country,
    date: e.event_date,
    description: e.notes?.slice(0, 300) ?? '',
    source: 'ACLED',
    fatalities: parseInt(e.fatalities) || 0,
  }
}

let lastPoll: { rows: number; capped: boolean } | null = null

/**
 * The last successful ACLED poll: how many rows came back and whether that hit ACLED_LIMIT. A capped poll is a
 * sample of the 14-day window (ACLED records far more than 500 events a fortnight worldwide), so its counts are
 * not totals.
 */
export function lastAcledPoll(): { rows: number; capped: boolean } | null {
  return lastPoll
}

/**
 * What the footer says about the ACLED response: a 200 only means the feed answered. Some accounts get data that
 * trails the present by months, so the newest event date and any shortfall are stated, never implied.
 */
export function acledDataNote(rows: Record<string, string>[], days: number, now: number = Date.now()): DataNote {
  const dates = rows.map(r => r.event_date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  const newest = dates[dates.length - 1]
  if (!newest) {
    return { coverage: `no events in the last ${days} days`, warn: `No events came back for the last ${days} days: the feed may be behind the present, or this window was quiet.` }
  }
  const age = Math.floor((now - Date.parse(newest)) / 86_400_000)
  return {
    asOf: `newest event ${newest}`,
    coverage: `${rows.length} events${rows.length >= ACLED_LIMIT ? ` (capped sample of the last ${days} days, not a total)` : ''}`,
    warn: age > days ? `The newest event is ${age} days old: this feed is behind the present, so recent events are not shown.` : undefined,
  }
}

export async function fetchACLEDEvents(days = 14): Promise<CrisisEvent[]> {
  const rows = await fetchACLEDRows(acledDashboardQuery(days))
  if (!rows) return []
  lastPoll = { rows: rows.length, capped: rows.length >= ACLED_LIMIT }
  healthTracker.note('acled', acledDataNote(rows, days))
  return toEvents(rows)
}

// ── Archive fallback ─────────────────────────────────────────────────────────
// Some myACLED access tiers only serve events older than ~12 months (measured Oct 2026 on the owner's account:
// newest event 2025-10-20, so the 14-day query comes back empty). When that happens the map can show the same
// window one year earlier instead, flagged `archived` so it is drawn and labelled as history. Archive events
// must never be merged into the live crisis list: that list feeds alerts, snapshots, trends and the analyst,
// which all treat it as current.

export interface AcledArchive {
  events: CrisisEvent[]
  /** Inclusive date range of the archive window, YYYY-MM-DD. */
  from: string
  to: string
}

/** The `days`-long window ending exactly one calendar year before `now`. */
export function acledArchiveWindow(days: number, now: number = Date.now()): { from: string; to: string } {
  const end = new Date(now)
  end.setUTCFullYear(end.getUTCFullYear() - 1)
  const start = new Date(end.getTime() - days * 86400000)
  return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] }
}

export async function fetchACLEDArchive(days = 14, now: number = Date.now()): Promise<AcledArchive | null> {
  const { from, to } = acledArchiveWindow(days, now)
  const rows = await fetchACLEDRows(acledWindowQuery(from, to))
  if (!rows?.length) return null
  healthTracker.note('acled', {
    asOf: `archive ${from} to ${to}`, coverage: `${rows.length} events`,
    warn: 'The last 14 days came back empty, so this is the same window one year earlier, shown as history. It is not current.',
  })
  return { from, to, events: toEvents(rows).map(e => ({ ...e, archived: true })) }
}

// a row without coordinates can't be placed and would draw at NaN
const toEvents = (rows: Record<string, string>[]): CrisisEvent[] =>
  rows.map(acledToCrisisEvent).filter(e => Number.isFinite(e.latitude) && Number.isFinite(e.longitude))

/** Raw rows for one query, or null when there is no token or the request failed. */
async function fetchACLEDRows(query: URLSearchParams): Promise<Record<string, string>[] | null> {
  const token = await getACLEDToken()
  if (!token) return null

  try {
    const res = await fetch(`${ACLED_API}?${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) throw new Error(`ACLED ${res.status}`)
    const json = await res.json()

    if (json.status !== 200) {
      console.warn('[ACLED] API error:', json.error)
      return null
    }

    return Array.isArray(json.data) ? json.data : []
  } catch (err) {
    console.warn('[ACLED] fetch error:', err)
    return null
  }
}

// No GDELT here on purpose. The GEO 2.0 API this used to call (/api/v2/geo/geo) now 404s for every
// query, and the replacement — GDELT's raw 15-minute event exports — was measured against live data
// (Sep 2026): even restricted to armed-violence CAMEO codes, city-level geocodes and armed actors,
// only ~1 in 3 of the top events was actual armed conflict (the rest were a cockpit scuffle, a football
// transfer, a book award…). Plotting that as "war" markers would present noise as fact.
