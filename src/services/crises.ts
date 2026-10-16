import type { CrisisEvent } from '../types'

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
/** The dashboard caps each poll at this many events (see the research notes: the cap can truncate the window). */
export const ACLED_LIMIT = 500

/** The exact query the dashboard sends — exported so the research recorder replays it verbatim. */
export function acledDashboardQuery(days: number, now: number = Date.now()): URLSearchParams {
  const since = new Date(now - days * 86400000).toISOString().split('T')[0]
  const today = new Date(now).toISOString().split('T')[0]
  return new URLSearchParams({
    _format: 'json',
    event_date: `${since}|${today}`,
    event_date_where: 'BETWEEN',
    limit: String(ACLED_LIMIT),
    fields: ACLED_FIELDS,
  })
}

/** Severity the dashboard assigns to an ACLED event type. */
export function acledSeverity(eventType: string): CrisisEvent['severity'] {
  return SEVERITY_MAP[TYPE_MAP[eventType] ?? 'conflict'] ?? 'medium'
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

export async function fetchACLEDEvents(days = 14): Promise<CrisisEvent[]> {
  const token = await getACLEDToken()
  if (!token) return []

  try {
    const res = await fetch(`${ACLED_API}?${acledDashboardQuery(days)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) throw new Error(`ACLED ${res.status}`)
    const json = await res.json()

    if (json.status !== 200) {
      console.warn('[ACLED] API error:', json.error)
      return []
    }

    const rows: Record<string, string>[] = Array.isArray(json.data) ? json.data : []
    lastPoll = { rows: rows.length, capped: rows.length >= ACLED_LIMIT }
    return rows.map(acledToCrisisEvent)
  } catch (err) {
    console.warn('[ACLED] fetch error:', err)
    return []
  }
}

// No GDELT here on purpose. The GEO 2.0 API this used to call (/api/v2/geo/geo) now 404s for every
// query, and the replacement — GDELT's raw 15-minute event exports — was measured against live data
// (Sep 2026): even restricted to armed-violence CAMEO codes, city-level geocodes and armed actors,
// only ~1 in 3 of the top events was actual armed conflict (the rest were a cockpit scuffle, a football
// transfer, a book award…). Plotting that as "war" markers would present noise as fact.
