import type { CrisisEvent } from '../types'

// ── ACLED OAuth ──────────────────────────────────────────────────────────────
// Docs: https://apidocs.acleddata.com/
const ACLED_EMAIL = import.meta.env.VITE_ACLED_EMAIL || ''
const ACLED_PASSWORD = import.meta.env.VITE_ACLED_PASSWORD || ''
const ACLED_TOKEN_URL = '/api/acled-token'
const ACLED_API = '/api/acled/read'

// Token cache — valid for 24 h; reuse to avoid hammering the auth endpoint
let _token: string | null = null
let _tokenExpiry = 0

async function getACLEDToken(): Promise<string | null> {
  if (!ACLED_EMAIL || !ACLED_PASSWORD) return null
  if (_token && Date.now() < _tokenExpiry) return _token

  try {
    const body = new URLSearchParams({
      username: ACLED_EMAIL,
      password: ACLED_PASSWORD,
      grant_type: 'password',
      client_id: 'acled',
    })

    const res = await fetch(ACLED_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      console.warn('[ACLED OAuth] token request failed:', res.status)
      return null
    }

    const data = await res.json()
    _token = data.access_token ?? null
    // expires_in is in seconds; subtract 60 s buffer
    _tokenExpiry = Date.now() + ((data.expires_in ?? 86400) - 60) * 1000
    return _token
  } catch (err) {
    console.warn('[ACLED OAuth] error:', err)
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

// GDELT GEO 2.0 — free, no key
const GDELT_GEO = '/api/gdelt/v2/geo/geo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GDELTFeature = any

export async function fetchGDELTCrises(query = 'war conflict attack protest crisis'): Promise<CrisisEvent[]> {
  try {
    const params = new URLSearchParams({
      query,
      mode: 'pointdata',
      maxrecords: '250',
    })

    const res = await fetch(`${GDELT_GEO}?${params}`)
    if (!res.ok) throw new Error(`GDELT ${res.status}`)

    const text = await res.text()
    if (!text.trim()) return []

    let json: { features?: GDELTFeature[] } | GDELTFeature[]
    try { json = JSON.parse(text) } catch { return [] }

    const features: GDELTFeature[] = Array.isArray(json)
      ? json
      : (json as { features?: GDELTFeature[] }).features ?? []

    return features
      .filter((f: GDELTFeature) => f?.geometry?.coordinates?.length >= 2)
      .map((f: GDELTFeature, i: number) => {
        const props = f.properties ?? {}
        const title = props.urlsharetitle || props.name || props.title || 'Conflict Event'
        const type  = guessType(title)
        return {
          id:          `gdelt-${i}-${Date.now()}`,
          title,
          type,
          severity:    SEVERITY_MAP[type] ?? 'medium',
          latitude:    f.geometry.coordinates[1],
          longitude:   f.geometry.coordinates[0],
          country:     props.countrycode || props.sourcecountry || '',
          date:        props.dateadded ?? new Date().toISOString().split('T')[0],
          description: '',
          source:      'GDELT',
        } satisfies CrisisEvent
      })
  } catch (err) {
    console.warn('[GDELT Crises] fetch error:', err)
    return []
  }
}

function guessType(title: string): CrisisEvent['type'] {
  const t = title.toLowerCase()
  if (t.includes('war') || t.includes('attack') || t.includes('military')) return 'war'
  if (t.includes('terror') || t.includes('bomb') || t.includes('explos')) return 'terrorism'
  if (t.includes('protest') || t.includes('demonstrat') || t.includes('riot')) return 'protest'
  if (t.includes('election') || t.includes('coup') || t.includes('politic')) return 'political'
  if (t.includes('earthquake') || t.includes('flood') || t.includes('hurricane') || t.includes('disaster')) return 'disaster'
  return 'conflict'
}
