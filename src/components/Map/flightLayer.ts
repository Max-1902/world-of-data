import type { Map as MapboxMap } from 'mapbox-gl'
import type { Flight } from '../../types'
import { detectFlightType, headingToCompass, FLIGHT_TYPE_COLORS, FLIGHT_TYPE_LABELS, type FlightType } from '../../utils/flightType'

export const ALL_TYPES: FlightType[] = ['passenger', 'cargo', 'military', 'private', 'unknown']

// ── Geodesic destination point: given [lng,lat], bearing (deg), distance (km) ──
export function destinationPoint(lng: number, lat: number, bearingDeg: number, distKm: number): [number, number] {
  const R = 6371
  const brng = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lon1 = (lng * Math.PI) / 180
  const dR = distKm / R
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng))
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
    Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2),
  )
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

// ── Build GeoJSON for all (optionally filtered) flights ──────────────────────
export function buildFlightGeoJSON(
  flights: Flight[],
  query   = '',
  types:    Set<FlightType> = new Set(ALL_TYPES),
  visible = true,
): GeoJSON.FeatureCollection {
  if (!visible) return { type: 'FeatureCollection', features: [] }
  const q = query.toLowerCase().trim()
  const features: GeoJSON.Feature[] = []
  for (const f of flights) {
    if (f.latitude === null || f.longitude === null) continue
    const type = detectFlightType(f.callsign || '', f.icao24 || '')
    if (!types.has(type)) continue
    if (q) {
      const cs      = (f.callsign      || '').toLowerCase()
      const country = (f.origin_country|| '').toLowerCase()
      const icao    = (f.icao24        || '').toLowerCase()
      if (!cs.includes(q) && !country.includes(q) && !icao.includes(q)) continue
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] },
      properties: {
        callsign:  (f.callsign || f.icao24 || '').trim(),
        icao24:     f.icao24,
        country:    f.origin_country,
        altitude:   f.altitude,
        velocity:   f.velocity,
        heading:    f.heading ?? 0,
        on_ground:  f.on_ground,
        flightType: type,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

// ── Aircraft metadata cache (hexdb.io + planespotters.net) ───────────────────
interface AircraftMeta {
  registration?: string
  manufacturer?: string
  type?: string
  icaoType?: string
  owner?: string
  operator?: string
  photoUrl?: string
  photographer?: string
}

export const aircraftCache = new Map<string, AircraftMeta>()

export async function fetchAircraftMeta(icao24: string): Promise<AircraftMeta> {
  const cached = aircraftCache.get(icao24)
  if (cached) return cached

  const meta: AircraftMeta = {}

  // Fetch aircraft database + photo in parallel
  const [dbRes, photoRes] = await Promise.allSettled([
    fetch(`/api/hexdb/api/v1/aircraft/${icao24}`, { signal: AbortSignal.timeout(5000) }),
    fetch(`/api/planespotters/pub/photos/hex/${icao24}`, { signal: AbortSignal.timeout(5000) }),
  ])

  if (dbRes.status === 'fulfilled' && dbRes.value.ok) {
    const db = await dbRes.value.json()
    meta.registration = db.Registration || undefined
    meta.manufacturer = db.Manufacturer || undefined
    meta.type = db.Type || undefined
    meta.icaoType = db.ICAOTypeCode || undefined
    meta.owner = db.RegisteredOwners || undefined
    meta.operator = db.OperatorFlagCode || undefined
  }

  if (photoRes.status === 'fulfilled' && photoRes.value.ok) {
    const pd = await photoRes.value.json()
    const photo = pd.photos?.[0]
    if (photo) {
      meta.photoUrl = photo.thumbnail_large?.src || photo.thumbnail?.src || undefined
      meta.photographer = photo.photographer || undefined
    }
  }

  aircraftCache.set(icao24, meta)
  return meta
}

// ── Flight popup HTML ────────────────────────────────────────────────────────
export function buildFlightHTML(p: Record<string, unknown>, meta?: AircraftMeta): string {
  const cs        = String(p.callsign || p.icao24 || 'UNKNOWN')
  const type      = String(p.flightType || 'unknown') as FlightType
  const typeColor = FLIGHT_TYPE_COLORS[type] || '#888'
  const typeLabel = FLIGHT_TYPE_LABELS[type] || type.toUpperCase()

  const altM   = p.altitude ? Math.round(Number(p.altitude)) : null
  const altFt  = altM ? Math.round(altM * 3.28084) : null
  const spdKmh = p.velocity ? Math.round(Number(p.velocity) * 3.6) : null
  const spdKts = p.velocity ? Math.round(Number(p.velocity) * 1.944) : null
  const hdg    = p.heading != null ? `${Math.round(Number(p.heading))}° ${headingToCompass(Number(p.heading))}` : '—'
  const status = p.on_ground ? 'ON GROUND' : 'AIRBORNE'
  const statusColor = p.on_ground ? '#d97706' : '#16a34a'

  const row = (label: string, val: string) =>
    `<tr><td style="color:#6b7280;font-size:10px;letter-spacing:.1em;padding:2px 8px 2px 0;text-transform:uppercase;white-space:nowrap;">${label}</td><td style="color:#14161a;text-align:right;">${val}</td></tr>`

  // Aircraft info section (from hexdb)
  let aircraftSection = ''
  if (meta) {
    const parts: string[] = []
    if (meta.type || meta.icaoType) {
      const label = meta.type || meta.icaoType || ''
      parts.push(`<span style="color:#14161a;font-size:11px;font-weight:600;">${label}</span>`)
    }
    if (meta.manufacturer) {
      parts.push(`<span style="color:#6b7280;font-size:10px;letter-spacing:.05em;">${meta.manufacturer}</span>`)
    }
    if (meta.owner) {
      parts.push(`<span style="color:#16a34a;font-size:10px;">${meta.owner}</span>`)
    }
    if (meta.registration) {
      parts.push(`<span style="color:#6b7280;font-size:10px;letter-spacing:.06em;">${meta.registration}</span>`)
    }
    if (parts.length) {
      aircraftSection = `<div style="display:flex;flex-direction:column;gap:2px;padding:6px 0;border-bottom:1px solid #e5e7eb;margin-bottom:4px;">${parts.join('')}</div>`
    }
  }

  // Photo section
  let photoSection = ''
  if (meta?.photoUrl) {
    photoSection = `
      <div style="margin-top:6px;border-top:1px solid #e5e7eb;padding-top:6px;">
        <img src="${meta.photoUrl}" style="width:100%;height:auto;display:block;border:1px solid #e5e7eb;opacity:0.96;" onerror="this.style.display='none'" />
        ${meta.photographer ? `<div style="font-size:9px;color:#9ca3af;letter-spacing:.06em;margin-top:2px;text-align:right;">photo: ${meta.photographer}</div>` : ''}
      </div>`
  }

  // Loading indicator when meta hasn't arrived yet
  const loadingSection = meta === undefined
    ? `<div id="flight-meta-loading" style="padding:4px 0;font-size:10px;color:#9ca3af;letter-spacing:.1em;text-align:center;">LOADING AIRCRAFT DATA…</div>`
    : ''

  return `
    <div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:280px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:15px;font-weight:800;color:#14161a;letter-spacing:.06em;font-family:monospace;">${cs}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${typeColor};border:1px solid ${typeColor}55;padding:1px 6px;">${typeLabel.toUpperCase()}</span>
      </div>
      ${aircraftSection}
      ${loadingSection}
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        ${row('ICAO24',    String(p.icao24    || '—'))}
        ${row('COUNTRY',   String(p.country   || '—'))}
        ${row('ALTITUDE',  altM  ? `${altM.toLocaleString()} m / ${altFt!.toLocaleString()} ft` : '—')}
        ${row('SPEED',     spdKmh? `${spdKmh} km/h / ${spdKts} kts` : '—')}
        ${row('HEADING',   hdg)}
        ${row('STATUS',    `<span style="color:${statusColor};font-weight:700;">● ${status}</span>`)}
      </table>
      ${photoSection}
    </div>`
}

// ── Airplane SDF icon (allows icon-color per feature) ───────────────────────
export function addAirplaneImage(map: MapboxMap) {
  const size = 28
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#fff'
  // Airplane silhouette pointing up (north)
  ctx.beginPath()
  ctx.moveTo(14, 1);   ctx.lineTo(16, 9)
  ctx.lineTo(26, 14);  ctx.lineTo(16, 17)
  ctx.lineTo(16, 22);  ctx.lineTo(18, 26)
  ctx.lineTo(14, 24);  ctx.lineTo(10, 26)
  ctx.lineTo(12, 22);  ctx.lineTo(12, 17)
  ctx.lineTo(2,  14);  ctx.lineTo(12, 9)
  ctx.closePath()
  ctx.fill()
  map.addImage('airplane-sdf', ctx.getImageData(0, 0, size, size), { sdf: true })
}
