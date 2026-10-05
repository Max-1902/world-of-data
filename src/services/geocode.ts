// Place-name → coordinates, via Open-Meteo's geocoding API (https://open-meteo.com/en/docs/geocoding-api).
// Free and keyless — no account, no billing; the free tier allows ~10k calls/day and we cache every answer
// (including "no match") in localStorage, so a place is looked up once per browser, not once per reload.
// A candidate is only accepted when the API returns a place whose name equals what we asked for and that is a
// real settlement, region or country — "Trump" must not resolve to a village of the same name.

export type GeoPrecision = 'city' | 'region' | 'country'

export interface GeoPlace {
  name: string
  lat: number
  lng: number
  country: string
  precision: GeoPrecision
}

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'
const LS_KEY = 'ws-geocode-v1'
const REQUEST_GAP_MS = 120
/** Settlements below this population are ignored unless they're an administrative seat or capital. */
const MIN_POPULATION = 40_000

interface ApiResult {
  name?: string
  latitude?: number
  longitude?: number
  feature_code?: string
  country?: string
  population?: number
}

const cache = new Map<string, GeoPlace | null>()
const inFlight = new Map<string, Promise<GeoPlace | null>>()
let hydrated = false
let tail: Promise<unknown> = Promise.resolve()

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function hydrate() {
  if (hydrated) return
  hydrated = true
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, GeoPlace | null>
    for (const [k, v] of Object.entries(obj)) cache.set(k, v)
  } catch { /* corrupt or unavailable storage: start empty */ }
}

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(cache))) } catch { /* quota / private mode */ }
}

function precisionOf(featureCode: string | undefined): GeoPrecision | null {
  if (!featureCode) return null
  if (featureCode.startsWith('PCL')) return 'country'
  if (featureCode === 'ADM1') return 'region'
  if (featureCode.startsWith('PPL')) return 'city'
  return null
}

/** Picks the best acceptable result for `query`, or null. Exported for tests. */
export function pickPlace(query: string, results: ApiResult[]): GeoPlace | null {
  const q = norm(query)
  for (const r of results) {
    if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number' || !r.name) continue
    if (norm(r.name) !== q) continue
    const precision = precisionOf(r.feature_code)
    if (!precision) continue
    const seat = r.feature_code === 'PPLC' || r.feature_code === 'PPLA' || r.feature_code === 'PPLA2'
    if (precision === 'city' && !seat && (r.population ?? 0) < MIN_POPULATION) continue
    return { name: r.name, lat: r.latitude, lng: r.longitude, country: r.country ?? '', precision }
  }
  return null
}

/** `undefined` = the lookup itself failed (don't cache); `null` = answered, no acceptable place. */
async function lookup(query: string): Promise<GeoPlace | null | undefined> {
  try {
    const res = await fetch(`${ENDPOINT}?name=${encodeURIComponent(query)}&count=10&language=en&format=json`)
    if (!res.ok) return undefined // transient (rate limit / outage): retry on a later call
    const json = await res.json()
    return pickPlace(query, Array.isArray(json?.results) ? json.results : [])
  } catch {
    return undefined
  }
}

/** Resolves a place name to coordinates, or null when it isn't a known place. Never throws. */
export function geocodePlace(name: string): Promise<GeoPlace | null> {
  hydrate()
  const key = norm(name)
  if (!key) return Promise.resolve(null)
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null)
  const pending = inFlight.get(key)
  if (pending) return pending

  const run = tail.then(async () => {
    const found = await lookup(name)
    if (found !== undefined) { cache.set(key, found); persist() }
    return found ?? null
  })
  tail = run.then(() => new Promise(r => setTimeout(r, REQUEST_GAP_MS)), () => undefined)
  inFlight.set(key, run)
  void run.finally(() => inFlight.delete(key))
  return run
}

/** Test hook: forget everything, including the persisted cache. */
export function resetGeocodeCache() {
  cache.clear(); inFlight.clear(); hydrated = false; tail = Promise.resolve()
  try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
}
