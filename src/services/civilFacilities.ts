/**
 * Civil infrastructure — hospitals, police, and telecom facilities —
 * fetched live from OpenStreetMap via the Overpass API, centered on a
 * country's capital/population centroid.
 *
 * Real, community-mapped OSM data (ODbL), not a static/curated list —
 * unlike dams/refineries/power plants, hospital/police/telecom counts run
 * into the thousands per country, so there is no accurate way to hand-pick
 * "major" ones without misrepresenting coverage. Fetched on-demand per
 * country (like fetchResourceRents) and capped for display.
 *
 * No API key required. https://overpass-api.de/
 *
 * Implementation notes (found by testing live against the API):
 * - A whole-country polygon lookup (`area[ISO3166-1=...][admin_level=2]`)
 *   reliably times out for large countries (tested: Germany 504s even for
 *   hospitals alone). An `around:radius` query centered on a point is index
 *   -backed and fast regardless of country size, so this queries a radius
 *   around the country's centroid instead — meaning coverage is the capital
 *   /population-center region, not literally the whole country.
 * - Combining hospital+police+telecom tags in a single query pushed dense
 *   cities (tested: Tokyo) over Overpass's server-side timeout. Hospital+
 *   police and telecom are fetched as two separate parallel requests.
 * - Overpass rejects requests with no User-Agent (HTTP 429) — one is set
 *   explicitly since not every fetch environment guarantees a default.
 */

import { COUNTRY_CENTROIDS } from './outages'

export type CivilFacilityType = 'hospital' | 'police' | 'telecom'

export interface CivilFacility {
  id:      string
  name:    string
  type:    CivilFacilityType
  lat:     number
  lng:     number
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'WorldSurveillanceDashboard/1.0'
const RADIUS_M = 60_000 // ~60km around the country centroid

const cache = new Map<string, CivilFacility[]>()
const CACHE_TTL = 60 * 60 * 1000

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
}

async function runOverpassQuery(query: string): Promise<OverpassElement[]> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(28_000),
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  const json = await res.json()
  return Array.isArray(json?.elements) ? json.elements : []
}

function toFacility(e: OverpassElement, type: CivilFacilityType): CivilFacility | null {
  const lat = Number(e.lat)
  const lng = Number(e.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const tags = e.tags ?? {}
  const fallbackName = type === 'telecom' ? 'Telecom facility' : type === 'hospital' ? 'Hospital' : 'Police station'
  return { id: `osm-${e.type}-${e.id}`, name: tags.name || fallbackName, type, lat, lng }
}

/**
 * Fetch hospitals, police stations, and telecom facilities (data centers /
 * communications towers) within ~60km of a country's centroid, identified by
 * ISO 3166-1 alpha-2 code (e.g. "DE", "US").
 */
export async function fetchCivilFacilities(iso2: string, limitPerType = 40): Promise<CivilFacility[]> {
  const key = iso2.toUpperCase()
  const cached = cache.get(key)
  if (cached) return cached

  const centroid = COUNTRY_CENTROIDS[key]
  if (!centroid) return []
  const [lng, lat] = centroid
  const around = `around:${RADIUS_M},${lat},${lng}`

  const hospitalPoliceQuery = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](${around});
      node["amenity"="police"](${around});
    );
    out center ${limitPerType * 2};
  `.trim()

  const telecomQuery = `
    [out:json][timeout:25];
    (
      node["telecom"="data_center"](${around});
      node["man_made"="communications_tower"](${around});
    );
    out center ${limitPerType};
  `.trim()

  const [hpResult, telecomResult] = await Promise.allSettled([
    runOverpassQuery(hospitalPoliceQuery),
    runOverpassQuery(telecomQuery),
  ])

  const facilities: CivilFacility[] = []
  const byType: Record<CivilFacilityType, CivilFacility[]> = { hospital: [], police: [], telecom: [] }

  if (hpResult.status === 'fulfilled') {
    for (const e of hpResult.value) {
      const type: CivilFacilityType | null =
        e.tags?.amenity === 'hospital' ? 'hospital' : e.tags?.amenity === 'police' ? 'police' : null
      if (!type) continue
      const f = toFacility(e, type)
      if (f) byType[type].push(f)
    }
  }
  if (telecomResult.status === 'fulfilled') {
    for (const e of telecomResult.value) {
      const f = toFacility(e, 'telecom')
      if (f) byType.telecom.push(f)
    }
  }

  for (const t of ['hospital', 'police', 'telecom'] as CivilFacilityType[]) {
    facilities.push(...byType[t].slice(0, limitPerType))
  }

  // Only cache if at least one sub-query succeeded — don't lock in an empty
  // result for the TTL window just because Overpass hiccuped once.
  if (hpResult.status === 'fulfilled' || telecomResult.status === 'fulfilled') {
    cache.set(key, facilities)
    setTimeout(() => cache.delete(key), CACHE_TTL)
  }
  return facilities
}

export const CIVIL_FACILITY_COLORS: Record<CivilFacilityType, string> = {
  hospital: '#ef4444',
  police:   '#3b82f6',
  telecom:  '#a855f7',
}

export const CIVIL_FACILITY_LABELS: Record<CivilFacilityType, string> = {
  hospital: 'HOSPITAL',
  police:   'POLICE',
  telecom:  'TELECOM',
}
