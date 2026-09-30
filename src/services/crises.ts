import type { CrisisEvent } from '../types'

// ── ACLED OAuth ──────────────────────────────────────────────────────────────
// Docs: https://apidocs.acleddata.com/
const ACLED_TOKEN_URL = '/api/acled-token'
const ACLED_API = '/api/acled/read'

// Token cache — valid for 24 h; reuse to avoid hammering the auth endpoint
let _token: string | null = null
let _tokenExpiry = 0

// After a failed token request, stay off the auth endpoint for a while. ACLED locks an account after
// repeated failed logins (HTTP 403 "flood_user_blocked"), so retrying on every poll keeps it locked.
const TOKEN_RETRY_COOLDOWN_MS = 30 * 60 * 1000
let _tokenRetryAt = 0

async function getACLEDToken(): Promise<string | null> {
  if (_token && Date.now() < _tokenExpiry) return _token
  if (Date.now() < _tokenRetryAt) return null

  try {
    const res = await fetch(ACLED_TOKEN_URL, { method: 'POST' })

    if (!res.ok) {
      console.warn('[ACLED OAuth] token request failed:', res.status)
      _tokenRetryAt = Date.now() + TOKEN_RETRY_COOLDOWN_MS
      return null
    }

    const data = await res.json()
    _token = data.access_token ?? null
    // expires_in is in seconds; subtract 60 s buffer
    _tokenExpiry = Date.now() + ((data.expires_in ?? 86400) - 60) * 1000
    if (!_token) _tokenRetryAt = Date.now() + TOKEN_RETRY_COOLDOWN_MS
    return _token
  } catch (err) {
    console.warn('[ACLED OAuth] error:', err)
    _tokenRetryAt = Date.now() + TOKEN_RETRY_COOLDOWN_MS
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

export async function fetchACLEDEvents(days = 14): Promise<CrisisEvent[]> {
  const token = await getACLEDToken()
  if (!token) return []

  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  try {
    const params = new URLSearchParams({
      _format: 'json',
      event_date: `${since}|${today}`,
      event_date_where: 'BETWEEN',
      limit: '500',
      fields: 'event_id_cnty|event_date|event_type|country|admin1|location|latitude|longitude|notes|fatalities',
    })

    const res = await fetch(`${ACLED_API}?${params}`, {
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

    return (json.data || []).map((e: Record<string, string>) => {
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
      } satisfies CrisisEvent
    })
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
