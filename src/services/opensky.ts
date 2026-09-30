import type { Flight } from '../types'

// OpenSky Network — OAuth2 client credentials via Vite dev proxy (bypasses CORS)
// Proxy routes defined in vite.config.ts:
//   /api/opensky-token → https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token
//   /api/opensky       → https://opensky-network.org/api
const BASE      = '/api/opensky'
const TOKEN_URL = '/api/opensky-token'

// ── Token cache ───────────────────────────────────────────────────────────────
let cachedToken    = ''
let tokenExpiresAt = 0   // ms timestamp

async function getBearerToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
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
