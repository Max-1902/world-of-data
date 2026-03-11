import type { Flight } from '../types'

// OpenSky Network — OAuth2 client credentials via Vite dev proxy (bypasses CORS)
// Proxy routes defined in vite.config.ts:
//   /api/opensky-token → https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token
//   /api/opensky       → https://opensky-network.org/api
const BASE      = '/api/opensky'
const TOKEN_URL = '/api/opensky-token'

const CLIENT_ID     = import.meta.env.VITE_OPENSKY_USER || ''
const CLIENT_SECRET = import.meta.env.VITE_OPENSKY_PASS || ''

// ── Token cache ───────────────────────────────────────────────────────────────
let cachedToken    = ''
let tokenExpiresAt = 0   // ms timestamp

async function getBearerToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) return ''
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    console.error(`[OpenSky] token request failed: ${res.status}`)
    return ''
  }
  const json = await res.json()
  cachedToken    = json.access_token ?? ''
  tokenExpiresAt = Date.now() + (json.expires_in ?? 1800) * 1000
  console.info(`[OpenSky] token refreshed, expires in ${json.expires_in}s`)
  return cachedToken
}

export async function fetchFlights(): Promise<Flight[]> {
  try {
    const token   = await getBearerToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    console.debug('[OpenSky] fetching /states/all via proxy, authenticated:', !!token)

    const res = await fetch(`${BASE}/states/all`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    })

    if (res.status === 401) {
      // Token may have been invalidated — clear cache and retry once without auth
      cachedToken = ''; tokenExpiresAt = 0
      console.warn('[OpenSky] 401 — retrying without auth')
      const anonRes = await fetch(`${BASE}/states/all`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      })
      if (!anonRes.ok) { console.error('[OpenSky] anon retry failed:', anonRes.status); return [] }
      return parseStates(await anonRes.json())
    }

    if (!res.ok) {
      console.error(`[OpenSky] HTTP ${res.status}`)
      return []
    }

    return parseStates(await res.json())
  } catch (err) {
    console.error('[OpenSky] fetch error:', err)
    return []
  }
}

// ── Flight track ──────────────────────────────────────────────────────────────
export interface FlightWaypoint {
  time:      number
  lat:       number
  lng:       number
  altitude:  number | null
  heading:   number | null
  on_ground: boolean
}

export interface FlightTrack {
  icao24:    string
  callsign:  string
  startTime: number
  endTime:   number
  path:      FlightWaypoint[]
}

export async function fetchFlightTrack(icao24: string): Promise<FlightTrack | null> {
  try {
    const token   = await getBearerToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${BASE}/tracks/all?icao24=${icao24.toLowerCase()}&time=0`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.warn(`[OpenSky] track ${icao24} HTTP ${res.status}`)
      return null
    }
    const json = await res.json()
    if (!json || !Array.isArray(json.path)) return null

    return {
      icao24:    String(json.icao24   || icao24),
      callsign:  String(json.callsign || '').trim(),
      startTime: Number(json.startTime || 0),
      endTime:   Number(json.endTime   || 0),
      path: (json.path as unknown[][]).map(p => ({
        time:      Number(p[0]),
        lat:       Number(p[1]),
        lng:       Number(p[2]),
        altitude:  p[3] != null ? Number(p[3]) : null,
        heading:   p[4] != null ? Number(p[4]) : null,
        on_ground: Boolean(p[5]),
      })),
    }
  } catch (err) {
    console.warn('[OpenSky] track fetch error:', err)
    return null
  }
}

function parseStates(data: { states?: unknown[][] }): Flight[] {
  if (!data.states || !Array.isArray(data.states)) {
    console.warn('[OpenSky] no states in response')
    return []
  }
  const flights = (data.states as unknown[][])
    .filter(s => s[5] !== null && s[6] !== null)
    .map(s => ({
      icao24:         String(s[0]),
      callsign:       String(s[1] || '').trim(),
      origin_country: String(s[2] || ''),
      longitude:      s[5] as number,
      latitude:       s[6] as number,
      altitude:       s[7] as number | null,
      on_ground:      Boolean(s[8]),
      velocity:       s[9] as number | null,
      heading:        s[10] as number | null,
    }))
    .filter(f => !f.on_ground)

  console.info(`[OpenSky] ${flights.length} airborne flights parsed`)
  return flights
}
