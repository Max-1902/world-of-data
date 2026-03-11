/**
 * Vessel tracking — Digitraffic AIS (Finnish Transport Infrastructure Agency)
 * REST polling with 30s interval. Coverage: Baltic Sea & Northern Europe.
 * Vessel metadata (names, ship types) loaded separately and cached.
 */

export interface Vessel {
  mmsi: number
  name: string
  latitude: number
  longitude: number
  cog: number        // course over ground (degrees)
  sog: number        // speed over ground (knots)
  heading: number    // true heading (0-359)
  navStatus: number
  shipType: number   // AIS ship type code (0-99)
  timestamp: string
}

export type VesselType = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'tug' | 'other'

export function vesselTypeFromCode(code: number): VesselType {
  if (code >= 70 && code <= 79) return 'cargo'
  if (code >= 80 && code <= 89) return 'tanker'
  if (code >= 60 && code <= 69) return 'passenger'
  if (code === 30) return 'fishing'
  if (code >= 31 && code <= 32) return 'tug'
  if (code === 35) return 'military'
  return 'other'
}

export function detectVesselType(name: string): VesselType {
  const n = name.toUpperCase()
  if (/\b(NAVY|USCG|HMCS|USS |HMS |FRIGATE|CORVETTE|PATROL)\b/.test(n)) return 'military'
  if (/\b(TANKER|CRUDE|LNG |LPG |OIL|CHEMICAL|PRODUCT)\b/.test(n)) return 'tanker'
  if (/\b(CRUISE|FERRY|PASSENGER|SPIRIT OF|QUEEN)\b/.test(n)) return 'passenger'
  if (/\b(FISH|TRAWL|SEINER|LONGLIN)\b/.test(n)) return 'fishing'
  if (/\b(TUG|PILOT|PUSH|SALVAG)\b/.test(n)) return 'tug'
  if (/\b(CONTAINER|BULK|CARGO|CARRIER|MAERSK|MSC |CMA |COSCO|EVERGREEN|BOX)\b/.test(n)) return 'cargo'
  return 'other'
}

export const VESSEL_TYPE_COLORS: Record<VesselType, string> = {
  cargo:     '#00cc88',
  tanker:    '#ff6600',
  passenger: '#00aaff',
  fishing:   '#ffcc00',
  military:  '#ff2244',
  tug:       '#aa88ff',
  other:     '#888888',
}

export const VESSEL_TYPE_LABELS: Record<VesselType, string> = {
  cargo:     'Cargo',
  tanker:    'Tanker',
  passenger: 'Passenger',
  fishing:   'Fishing',
  military:  'Military',
  tug:       'Tug/Pilot',
  other:     'Other',
}

// ── Vessel metadata cache ────────────────────────────────────────────────────
let vesselMeta: Map<number, { name: string; shipType: number }> | null = null
let metaLoading = false

async function loadVesselMeta(): Promise<Map<number, { name: string; shipType: number }>> {
  if (vesselMeta) return vesselMeta
  if (metaLoading) return new Map()
  metaLoading = true
  try {
    const res = await fetch('/api/digitraffic/api/ais/v1/vessels', {
      signal: AbortSignal.timeout(25000),
      headers: { 'Accept-Encoding': 'gzip' },
    })
    if (!res.ok) { metaLoading = false; return new Map() }
    const arr = await res.json() as Array<{ mmsi: number; name: string; shipType: number }>
    vesselMeta = new Map(arr.map(v => [v.mmsi, { name: v.name, shipType: v.shipType }]))
    console.log(`[AIS] Cached ${vesselMeta.size} vessel metadata records`)
    return vesselMeta
  } catch {
    metaLoading = false
    return new Map()
  }
}

// ── Fetch vessel positions ───────────────────────────────────────────────────
async function fetchVesselPositions(): Promise<Vessel[]> {
  const [locRes, meta] = await Promise.all([
    fetch('/api/digitraffic/api/ais/v1/locations', {
      signal: AbortSignal.timeout(20000),
      headers: { 'Accept-Encoding': 'gzip' },
    }),
    loadVesselMeta(),
  ])
  if (!locRes.ok) { console.warn('[AIS] HTTP', locRes.status); return [] }

  const json = await locRes.json()
  const features = json.features as Array<{
    mmsi: number
    geometry: { coordinates: [number, number] }
    properties: {
      mmsi: number; sog: number; cog: number; navStat: number
      heading: number; timestampExternal: string
    }
  }>
  if (!Array.isArray(features)) return []

  const vessels: Vessel[] = []
  for (const f of features) {
    const coords = f.geometry?.coordinates
    if (!coords) continue
    const lng = coords[0]
    const lat = coords[1]
    // Skip null-island and invalid
    if (lng === 0 && lat === 0) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue

    const mmsi = f.mmsi || f.properties.mmsi
    const info = meta.get(mmsi)
    const rawHeading = f.properties.heading
    const heading = (rawHeading === 511 || rawHeading > 360) ? f.properties.cog : rawHeading

    vessels.push({
      mmsi,
      name: info?.name || '',
      latitude: lat,
      longitude: lng,
      cog: f.properties.cog ?? 0,
      sog: f.properties.sog ?? 0,
      heading: heading ?? 0,
      navStatus: f.properties.navStat ?? 0,
      shipType: info?.shipType ?? 0,
      timestamp: f.properties.timestampExternal
        ? new Date(Number(f.properties.timestampExternal)).toISOString()
        : new Date().toISOString(),
    })
  }
  return vessels
}

// ── Public API ───────────────────────────────────────────────────────────────
export function connectAISStream(onUpdate: (vessels: Vessel[]) => void): () => void {
  let closed = false
  let timer: number | null = null

  // Pre-load metadata
  loadVesselMeta()

  async function poll() {
    if (closed) return
    try {
      const vessels = await fetchVesselPositions()
      if (vessels.length > 0 && !closed) {
        console.log(`[AIS] ${vessels.length} vessels`)
        onUpdate(vessels)
      }
    } catch (e) {
      console.warn('[AIS] fetch error:', e)
    }
    if (!closed) timer = window.setTimeout(poll, 30_000)
  }

  poll()

  return () => {
    closed = true
    if (timer) clearTimeout(timer)
  }
}
