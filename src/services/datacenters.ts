/**
 * Data Centers — real, geolocated facilities.
 *
 * Source: OpenStreetMap, queried live via the free/keyless Overpass API
 * (no signup, no key, no billing account — same trust tier as the OSM
 * data already used elsewhere in this app). We query for nodes/ways tagged
 * `telecom=data_center`, the tag OSM contributors use to map real,
 * named data center buildings/campuses worldwide.
 *
 * This mirrors the Global Power Plant Database pattern in infrastructure.ts:
 * fetch a real open dataset live, cache in-memory, no hand-written static
 * list of "plausible-looking" facilities.
 *
 * https://wiki.openstreetmap.org/wiki/Tag:telecom%3Ddata_center
 * https://overpass-api.de/ (public Overpass instance, free, no key)
 */

export interface DataCenterPoint {
  id:        string
  name:      string
  operator?: string
  country?:  string
  lat:       number
  lng:       number
  notes?:    string
}

// The worldwide query returns ~4.7k elements (~1.6 MB) and takes 35–55 s on the
// public mirrors, so the per-request timeout has to be generous and the list
// needs several mirrors (any one of them is frequently slow, blocked, or down).
const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const QUERY = `
[out:json][timeout:90];
(
  node["telecom"="data_center"];
  way["telecom"="data_center"];
  relation["telecom"="data_center"];
);
out center tags;
`

let cache: DataCenterPoint[] | null = null
let inflight: Promise<DataCenterPoint[]> | null = null

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function queryOverpass(): Promise<OverpassElement[]> {
  let lastErr: unknown
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(QUERY),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(100_000),
      })
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
      const json = await res.json()
      return json.elements as OverpassElement[]
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

/** Fetch all real, OSM-tagged data centers worldwide. Cached in-memory for the session. */
export async function fetchDataCenters(): Promise<DataCenterPoint[]> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = (async () => {
    const elements = await queryOverpass()
    const points: DataCenterPoint[] = []
    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const tags = el.tags ?? {}
      const name = tags.name || tags.operator || 'Unnamed Data Center'
      points.push({
        id:       `osm-${el.type}-${el.id}`,
        name,
        operator: tags.operator,
        country:  tags['addr:country'],
        lat:      lat as number,
        lng:      lng as number,
        notes:    tags.description,
      })
    }
    cache = points
    return points
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/** Data centers within a given country name (loose match against tagged country/name text). */
export async function fetchDataCentersForCountry(countryName: string): Promise<DataCenterPoint[]> {
  const all = await fetchDataCenters()
  const lc = countryName.toLowerCase()
  return all.filter(p =>
    (p.country && p.country.toLowerCase() === lc) ||
    p.name.toLowerCase().includes(lc)
  )
}
