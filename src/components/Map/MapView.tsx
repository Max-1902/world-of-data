import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Flight, CrisisEvent, NewsArticle, MapViewMode } from '../../types'
import type { FirePoint } from '../../services/wildfires'
import type { Earthquake } from '../../services/earthquakes'
import { MARKET_HUBS } from '../../services/stocks'
import {
  MILITARY_FACILITIES, NUCLEAR_PLANTS,
  FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS,
} from '../../services/military'
import {
  SANCTIONED_COUNTRIES, SANCTION_COLORS, SANCTIONS_BY_ISO2,
} from '../../services/sanctions'
import { PORTS, PORT_TYPE_COLORS, PORT_TYPE_LABELS } from '../../services/ports'
import { GAS_PIPELINES, PIPELINE_STATUS_COLORS, PIPELINE_STATUS_LABELS } from '../../services/pipelines'
import {
  detectFlightType, countFlightTypes, headingToCompass,
  FLIGHT_TYPE_COLORS, FLIGHT_TYPE_LABELS,
  type FlightType,
} from '../../utils/flightType'
import { EARTHCAM_CAMERAS, type LiveCamera } from '../../services/earthcam'
import { registerUSWebcams } from '../panels/PanelContent'
import { ALL_INFRA_POINTS, PIPELINE_ROUTES, INFRA_COLORS, INFRA_LABELS, INFRA_ICONS } from '../../services/infrastructure'
import { FIR_REGIONS, analyzeAirspace } from '../../services/notam'
import { type Vessel, vesselTypeFromCode, detectVesselType, VESSEL_TYPE_COLORS } from '../../services/aisstream'
import {
  OIL_GAS_DATA, getMaxValue, formatValue, getRegionTotals,
  METRIC_COLORS, METRIC_LABELS,
  type OilGasMetric,
} from '../../services/oilgas'
import { GPS_JAM_ZONES, SEVERITY_COLORS, TYPE_LABELS } from '../../services/gpsjam'
import { CHOKEPOINTS, CHOKEPOINT_COLORS } from '../../services/chokepoints'
import { SUPPLY_CHAIN_FACILITIES, FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from '../../services/supplychain'
import { SHIPPING_ROUTES } from '../../services/shippingRoutes'
import {
  UNHCR_OFFICES, BORDER_CROSSINGS, REFUGEE_CAMPS,
  CROSSING_STATUS_COLORS, OFFICE_TYPE_COLORS,
  REFUGEE_FLOWS, COUNTRY_DISPLACEMENT,
} from '../../services/unhcr'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

// ── Vision mode CSS canvas filters ──────────────────────────────────────────
// Pure CSS filters work reliably on WebGL canvases (SVG url() filters do NOT
// render properly on <canvas> in most browsers — they produce blank/broken output).
// The distinctive look of each mode comes from the filter + colored overlays.
const CANVAS_FILTERS: Partial<Record<MapViewMode, string>> = {
  dark:        'brightness(0.35) contrast(1.4) saturate(0.3)',
  nightvision: 'brightness(0.75) contrast(1.7) saturate(0)',
  bw:          'grayscale(100%) contrast(1.3) brightness(0.95)',
  infrared:    'brightness(1.15) contrast(1.5) saturate(0) invert(1)',
  snow:        'brightness(1.5) contrast(1.15) saturate(0.25) sepia(0.08)',
  thermal:     'brightness(0.9) contrast(1.7) saturate(0)',
  // Crisp, high-clarity satellite-imagery look — punchier than the neutral globe default
  satellite:   'brightness(1.05) contrast(1.25) saturate(1.3)',
  // Flattened, cartographic look — desaturated and brightened to read like a vector road map
  standard:    'brightness(1.2) contrast(0.92) saturate(0.35)',
}

// Overlay configs per mode — multiple overlay layers for realistic look
interface VisionOverlay {
  layers: {
    background?: string
    mixBlendMode?: string
    opacity?: number
    boxShadow?: string
  }[]
  scanlines?: boolean
  noise?: { opacity: number; blend: string }
}
const VISION_OVERLAYS: Partial<Record<MapViewMode, VisionOverlay>> = {
  nightvision: {
    layers: [
      // P43 phosphor green tint
      { background: 'rgba(0,255,16,0.2)', mixBlendMode: 'multiply', opacity: 1 },
      // Green color cast
      { background: 'rgba(0,200,0,0.25)', mixBlendMode: 'color', opacity: 1 },
      // Tube vignette — softer so center stays readable
      { background: 'radial-gradient(circle at center, transparent 45%, rgba(0,6,0,0.3) 65%, rgba(0,2,0,0.6) 85%, rgba(0,0,0,0.85) 100%)' },
      { boxShadow: 'inset 0 0 120px 30px rgba(0,0,0,0.5)' },
    ],
    scanlines: true,
    noise: { opacity: 0.05, blend: 'overlay' },
  },
  infrared: {
    layers: [
      // Warm amber on bright (hot) regions
      { background: 'rgba(255,190,100,0.1)', mixBlendMode: 'screen', opacity: 1 },
      // Light cool blue in shadows
      { background: 'linear-gradient(180deg, rgba(0,15,50,0.08) 0%, rgba(0,8,30,0.12) 100%)', mixBlendMode: 'multiply', opacity: 1 },
      // Gentle sensor vignette
      { background: 'radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.3) 85%, rgba(0,0,0,0.55) 100%)' },
      { boxShadow: 'inset 0 0 80px 20px rgba(0,0,0,0.35)' },
    ],
    noise: { opacity: 0.03, blend: 'overlay' },
  },
  thermal: {
    layers: [
      // Iron palette: violet/blue shadows → red/orange mids → yellow peaks
      { background: 'linear-gradient(180deg, rgba(80,0,180,0.15) 0%, rgba(20,0,80,0.18) 100%)', mixBlendMode: 'screen', opacity: 1 },
      // Red/orange color cast
      { background: 'rgba(255,50,0,0.15)', mixBlendMode: 'color', opacity: 1 },
      // Yellow center hotspot
      { background: 'radial-gradient(ellipse at 50% 45%, rgba(255,240,0,0.07) 0%, transparent 50%)', mixBlendMode: 'screen', opacity: 1 },
      // Moderate vignette
      { background: 'radial-gradient(circle at center, transparent 50%, rgba(0,0,10,0.35) 80%, rgba(0,0,0,0.6) 100%)' },
      { boxShadow: 'inset 0 0 100px 25px rgba(0,0,10,0.4)' },
    ],
    noise: { opacity: 0.04, blend: 'overlay' },
  },
  snow: {
    layers: [
      // Light blue-white wash
      { background: 'rgba(210,230,255,0.15)', mixBlendMode: 'screen', opacity: 1 },
      // Subtle desaturation so markers pop
      { background: 'rgba(230,238,250,0.1)', mixBlendMode: 'saturation', opacity: 1 },
      // Very light edge shading
      { background: 'radial-gradient(circle at center, transparent 65%, rgba(160,180,210,0.12) 90%, rgba(120,140,180,0.2) 100%)' },
      { boxShadow: 'inset 0 0 60px 15px rgba(180,200,230,0.1)' },
    ],
  },
  dark: {
    layers: [
      // Moderate vignette — keep center bright enough to read
      { background: 'radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.6) 100%)' },
      { boxShadow: 'inset 0 0 100px 30px rgba(0,0,0,0.4)' },
    ],
  },
}

const CRISIS_COLORS: Record<string, string> = {
  war:'#ff1a2e', conflict:'#ff6600', terrorism:'#cc0033',
  protest:'#ffcc00', political:'#aa44ff', disaster:'#ff8800',
}
const SEV_SIZE: Record<string, number> = { critical: 16, high: 11, medium: 8, low: 5 }

const ALL_TYPES: FlightType[] = ['passenger', 'cargo', 'military', 'private', 'unknown']

interface Props {
  viewMode:      MapViewMode
  flights:       Flight[]
  crises:        CrisisEvent[]
  newsArticles:  NewsArticle[]
  earthquakes:   Earthquake[]
  showFlights:   boolean
  showCrises:    boolean
  showNews:      boolean
  showStocks:    boolean
  deepstateMode: boolean
  onFlightClick: (f: Flight) => void
  onCrisisClick: (c: CrisisEvent) => void
  fires:         FirePoint[]
  showWildfires: boolean
  showMilitary:  boolean
  showNuclear:   boolean
  showSanctions:     boolean
  showCameras:        boolean
  showInfrastructure: boolean
  showAirspace:       boolean
  showHumanitarian:   boolean
  vessels:            Vessel[]
  showVessels:        boolean
  showOil:            boolean
  showGas:            boolean
  showGPSJam:         boolean
  showPorts:          boolean
  showPipelines:      boolean
  showChokepoints:    boolean
  showSupplyChain:    boolean
  showShippingRoutes: boolean
  flyToQuery?:        string
  geoFlyTo?:          string
  onCountryClick?:    (country: string) => void
  reticleColor?:      string
  panelState?:        import('../../types').PanelState
  onToggleLayer?:     (id: keyof import('../../types').PanelState) => void
}

// ── Geodesic destination point: given [lng,lat], bearing (deg), distance (km) ──
function destinationPoint(lng: number, lat: number, bearingDeg: number, distKm: number): [number, number] {
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
function buildFlightGeoJSON(
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
const aircraftCache = new Map<string, AircraftMeta>()

async function fetchAircraftMeta(icao24: string): Promise<AircraftMeta> {
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
function buildFlightHTML(p: Record<string, unknown>, meta?: AircraftMeta): string {
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
function addAirplaneImage(map: mapboxgl.Map) {
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

// ── Vessel SDF icons — one per vessel type, sized small→large ────────────────
function addVesselImages(map: mapboxgl.Map) {
  // Helper: create SDF image from a drawing function
  function makeSDF(name: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#fff'
    draw(ctx, size)
    map.addImage(name, ctx.getImageData(0, 0, size, size), { sdf: true })
  }

  // Cargo — large boxy freighter (28px)
  makeSDF('vessel-cargo', 28, (ctx, s) => {
    ctx.beginPath()
    ctx.moveTo(14, 1)    // bow
    ctx.lineTo(21, 7)
    ctx.lineTo(22, 22)
    ctx.lineTo(20, 26)
    ctx.lineTo(8, 26)
    ctx.lineTo(6, 22)
    ctx.lineTo(7, 7)
    ctx.closePath()
    ctx.fill()
    // Containers on deck
    ctx.fillRect(9, 10, 10, 3)
    ctx.fillRect(9, 14, 10, 3)
    ctx.fillRect(9, 18, 10, 3)
    // Bridge
    ctx.fillRect(10, 22, 8, 3)
  })

  // Tanker — long hull with rounded bow (28px)
  makeSDF('vessel-tanker', 28, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(14, 1)
    ctx.lineTo(20, 6)
    ctx.lineTo(21, 24)
    ctx.lineTo(18, 27)
    ctx.lineTo(10, 27)
    ctx.lineTo(7, 24)
    ctx.lineTo(8, 6)
    ctx.closePath()
    ctx.fill()
    // Deck pipes
    ctx.fillRect(12, 8, 4, 14)
    // Bridge at stern
    ctx.fillRect(10, 23, 8, 3)
  })

  // Passenger — cruise ship with multiple decks (26px)
  makeSDF('vessel-passenger', 26, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(13, 1)
    ctx.lineTo(19, 6)
    ctx.lineTo(20, 20)
    ctx.lineTo(18, 24)
    ctx.lineTo(8, 24)
    ctx.lineTo(6, 20)
    ctx.lineTo(7, 6)
    ctx.closePath()
    ctx.fill()
    // Multiple deck lines
    ctx.clearRect(8, 9, 10, 1)
    ctx.clearRect(8, 13, 10, 1)
    ctx.clearRect(8, 17, 10, 1)
    // Funnel
    ctx.fillRect(11, 2, 4, 4)
  })

  // Fishing — small boat with mast (20px)
  makeSDF('vessel-fishing', 20, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(10, 2)   // bow
    ctx.lineTo(15, 6)
    ctx.lineTo(16, 15)
    ctx.lineTo(14, 18)
    ctx.lineTo(6, 18)
    ctx.lineTo(4, 15)
    ctx.lineTo(5, 6)
    ctx.closePath()
    ctx.fill()
    // Mast/boom
    ctx.fillRect(9, 3, 2, 10)
    // Outrigger lines
    ctx.fillRect(5, 7, 10, 1)
  })

  // Military — sleek warship (26px)
  makeSDF('vessel-military', 26, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(13, 0)   // sharp bow
    ctx.lineTo(18, 7)
    ctx.lineTo(19, 20)
    ctx.lineTo(17, 24)
    ctx.lineTo(9, 24)
    ctx.lineTo(7, 20)
    ctx.lineTo(8, 7)
    ctx.closePath()
    ctx.fill()
    // Superstructure
    ctx.fillRect(10, 10, 6, 6)
    // Forward gun
    ctx.fillRect(12, 4, 2, 5)
    // Radar mast
    ctx.fillRect(12, 8, 2, 2)
  })

  // Tug — small stubby vessel (18px)
  makeSDF('vessel-tug', 18, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(9, 2)    // bow
    ctx.lineTo(14, 5)
    ctx.lineTo(14, 14)
    ctx.lineTo(12, 16)
    ctx.lineTo(6, 16)
    ctx.lineTo(4, 14)
    ctx.lineTo(4, 5)
    ctx.closePath()
    ctx.fill()
    // Wheelhouse
    ctx.fillRect(6, 6, 6, 5)
  })

  // Other — generic small boat (20px)
  makeSDF('vessel-other', 20, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(10, 2)
    ctx.lineTo(15, 6)
    ctx.lineTo(15, 16)
    ctx.lineTo(13, 18)
    ctx.lineTo(7, 18)
    ctx.lineTo(5, 16)
    ctx.lineTo(5, 6)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(8, 8, 4, 4)
  })
}

export default function MapView({
  viewMode, flights, crises, newsArticles, earthquakes,
  showFlights, showCrises, showNews, showStocks,
  deepstateMode,
  onFlightClick, onCrisisClick,
  fires, showWildfires,
  showMilitary, showNuclear, showSanctions,
  showCameras, showInfrastructure, showAirspace, showHumanitarian,
  vessels, showVessels, showOil, showGas, showGPSJam, showPorts, showPipelines,
  showChokepoints, showSupplyChain, showShippingRoutes,
  flyToQuery, geoFlyTo, onCountryClick,
  reticleColor = '#00ff88',
  panelState, onToggleLayer,
}: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<mapboxgl.Map | null>(null)
  const markersRef     = useRef<mapboxgl.Marker[]>([])
  const layersReadyRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const popupRef       = useRef<mapboxgl.Popup | null>(null)
  const flightDataRef  = useRef<Flight[]>([])
  const onCountryClickRef = useRef(onCountryClick)
  onCountryClickRef.current = onCountryClick

  // Filter state
  const [filterQuery, setFilterQuery] = useState('')
  const [filterTypes, setFilterTypes] = useState<Set<FlightType>>(new Set(ALL_TYPES))
  const [showFilter,  setShowFilter]  = useState(false)
  const [showReticle, setShowReticle] = useState(true)
  const [showOverlays, setShowOverlays] = useState(false)

  // Flight counts for the breakdown bar
  const typeCounts = countFlightTypes(flights)
  const filteredCount = buildFlightGeoJSON(flights, filterQuery, filterTypes, showFlights).features.length

  const toggleType = useCallback((t: FlightType) => {
    setFilterTypes((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }, [])

  // Size shortcut groups (derived from type — OpenSky has no size data)
  const SIZE_GROUPS: { label: string; color: string; types: FlightType[] }[] = [
    { label: 'LARGE',  color: '#00ff88', types: ['passenger', 'cargo'] },
    { label: 'MEDIUM', color: '#ffaa00', types: ['military'] },
    { label: 'SMALL',  color: '#8844ff', types: ['private', 'unknown'] },
  ]

  // ── Fly to via Mapbox Geocoding ────────────────────────────────────────────
  function geocodeAndFly(q: string) {
    if (!q || !mapRef.current) return
    const map = mapRef.current

    // ── Direct coordinate input: "lat, lon" or "lat lon" ──────────────────
    const coordMatch = q.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1])
      const lon = parseFloat(coordMatch[2])
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        map.flyTo({ center: [lon, lat], zoom: 11, duration: 1800 })
        return
      }
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&limit=1&types=country,region,place,address,poi,postcode&fuzzyMatch=true&worldview=us`
    fetch(url).then(r => r.json()).then(data => {
      const feature = data?.features?.[0]
      if (!feature) return
      if (!mapRef.current) return
      const placeType: string = feature.place_type?.[0] ?? ''
      // Zoom level by result type
      const ZOOM: Record<string, number> = {
        country: 5, region: 7, place: 11, postcode: 13, address: 17, poi: 17,
      }
      const zoom = ZOOM[placeType] ?? 13
      if (feature.bbox && placeType !== 'address' && placeType !== 'poi') {
        mapRef.current.fitBounds(feature.bbox as [number, number, number, number], { padding: 60, duration: 1800 })
      } else {
        mapRef.current.flyTo({ center: feature.center as [number, number], zoom, duration: 1800 })
      }
    }).catch(() => {})
  }

  useEffect(() => { geocodeAndFly(flyToQuery?.trim() ?? '') }, [flyToQuery])
  // geoFlyTo has a \0+timestamp suffix to force re-trigger; strip it before geocoding
  useEffect(() => {
    if (!geoFlyTo) return
    geocodeAndFly(geoFlyTo.split('\u0000')[0].trim())
  }, [geoFlyTo])

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !TOKEN) return

    const map = new mapboxgl.Map({
      container:   containerRef.current,
      style:       'mapbox://styles/mapbox/satellite-streets-v12',
      center:      [15, 25],
      zoom:        2,
      projection:  'globe' as string,
      accessToken: TOKEN,
      antialias:   true,
    })
    mapRef.current = map

    // Navigation controls
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    map.on('load', () => {
      // ── Terrain (3D relief like Google Earth) ────────────────────────────
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url:  'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512, maxzoom: 14,
      })
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 })

      // ── Atmosphere ───────────────────────────────────────────────────────
      map.addLayer({ id: 'sky', type: 'sky', paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 0.0],
        'sky-atmosphere-sun-intensity': 15,
      }})

      // Fog (space + horizon haze — the "Google Earth" atmosphere ring)
      map.setFog({
        range:           [0.8, 8],
        color:           '#1a2040',
        'high-color':    '#0d1530',
        'space-color':   '#08091a',
        'star-intensity': 0.18,
        'horizon-blend': 0.04,
      } as Parameters<typeof map.setFog>[0])

      // ── 3D buildings layer (for city3d view mode) ────────────────────────
      map.addLayer({
        id: '3d-buildings', type: 'fill-extrusion',
        source: 'composite', 'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        minzoom: 12,
        paint: {
          'fill-extrusion-color': '#0d1a2a',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
          'fill-extrusion-base':   ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
          'fill-extrusion-opacity': 0.85,
        } as Record<string, unknown>,
        layout: { visibility: 'none' },
      })

      // ── Add airplane SDF image ───────────────────────────────────────────
      addAirplaneImage(map)
      addVesselImages(map)

      // ── Flight GeoJSON source ────────────────────────────────────────────
      map.addSource('flights', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Apply any pending flight data that arrived before the map loaded
      const applyFlights = () => {
        const src = map.getSource('flights') as mapboxgl.GeoJSONSource | undefined
        if (src && flightDataRef.current.length > 0) {
          src.setData(buildFlightGeoJSON(flightDataRef.current, '', new Set(ALL_TYPES), true))
          console.info(`[Map] Applied ${flightDataRef.current.length} cached flights after load`)
        }
      }
      applyFlights()
      // Also apply after a short delay in case of async source registration
      setTimeout(applyFlights, 500)

      // Airplane icon layer — visible at ALL zoom levels, sized by zoom
      // Uses SDF icon so each feature can have its own color via icon-color
      map.addLayer({
        id: 'flights-icons', type: 'symbol', source: 'flights',
        layout: {
          'icon-image':            'airplane-sdf',
          'icon-rotate':           ['get', 'heading'],
          // Scale from tiny at globe view up to full-size at street zoom
          'icon-size':             ['interpolate', ['linear'], ['zoom'],
            1, 0.14,   // globe overview — tiny but identifiable as planes
            3, 0.20,
            5, 0.32,
            7, 0.55,
            10, 0.82,
            13, 1.2,
          ],
          'icon-allow-overlap':    true,
          'icon-ignore-placement': true,
          // Callsign label only at zoom ≥ 8 (too cluttered below)
          'text-field':  ['step', ['zoom'], '', 8,
            ['case', ['==', ['get', 'callsign'], ''], '', ['get', 'callsign']],
          ],
          'text-font':   ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':   ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 11],
          'text-offset': [0, 1.6],
          'text-optional':      true,
          'text-allow-overlap': false,
        } as Record<string, unknown>,
        paint: {
          'icon-color': ['match', ['get', 'flightType'],
            'passenger', FLIGHT_TYPE_COLORS.passenger,
            'cargo',     FLIGHT_TYPE_COLORS.cargo,
            'military',  FLIGHT_TYPE_COLORS.military,
            'private',   FLIGHT_TYPE_COLORS.private,
            FLIGHT_TYPE_COLORS.unknown,
          ],
          'icon-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.75, 4, 0.88, 7, 0.95],
          'text-color': '#e0eeff',
          'text-halo-color': 'rgba(0,0,0,0.75)',
          'text-halo-width': 1.2,
        } as Record<string, unknown>,
      })

      // ── Click → popup with async aircraft data ──────────────────────────
      map.on('click', 'flights-icons', (e) => {
        if (!e.features?.[0]) return
        const feature = e.features[0]
        const props   = feature.properties as Record<string, unknown>
        const coords  = (feature.geometry as GeoJSON.Point).coordinates as [number, number]

        const icao24 = String(props.icao24 || '')
        const flight = flightDataRef.current.find((f) => f.icao24 === icao24)
        if (flight) onFlightClick(flight)

        if (popupRef.current) popupRef.current.remove()

        // Check cache first — if hit, show full popup immediately
        const cached = aircraftCache.get(icao24)
        const popup = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
          .setLngLat(coords)
          .setHTML(buildFlightHTML(props, cached))
          .addTo(map)
        popupRef.current = popup

        // If not cached, fetch async then update popup in-place
        if (!cached && icao24) {
          fetchAircraftMeta(icao24).then(meta => {
            if (popupRef.current === popup && popup.isOpen()) {
              popup.setHTML(buildFlightHTML(props, meta))
            }
          })
        }
      })

      map.on('mouseenter', 'flights-icons', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'flights-icons', () => { map.getCanvas().style.cursor = '' })

      // ── Wildfire GeoJSON source + layer ──────────────────────────────────
      map.addSource('wildfires', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Heatmap layer (low zoom — shows density)
      map.addLayer({
        id: 'fires-heat', type: 'heatmap', source: 'wildfires', maxzoom: 7,
        paint: {
          'heatmap-weight':     ['interpolate', ['linear'], ['get', 'frp'], 0, 0, 500, 1],
          'heatmap-intensity':  ['interpolate', ['linear'], ['zoom'], 2, 0.6, 7, 2],
          'heatmap-radius':     ['interpolate', ['linear'], ['zoom'], 2, 6,  7, 20],
          'heatmap-opacity':    ['interpolate', ['linear'], ['zoom'], 5, 0.8, 7, 0],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(255,90,0,0)',
            0.2, 'rgba(255,100,0,0.4)',
            0.5, 'rgba(255,140,0,0.7)',
            0.8, 'rgba(255,60,0,0.9)',
            1,   'rgba(255,0,0,1)',
          ],
        },
      } as Parameters<typeof map.addLayer>[0])

      // Circle layer (high zoom — individual fire detections)
      map.addLayer({
        id: 'fires-dots', type: 'circle', source: 'wildfires', minzoom: 4,
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 4, 2, 8, ['interpolate', ['linear'], ['get', 'frp'], 0, 3, 500, 10]],
          'circle-color':        ['match', ['get', 'confidence'], 'high', '#ff2200', 'nominal', '#ff6600', '#ff9900'],
          'circle-opacity':      0.85,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': 'rgba(255,200,0,0.5)',
        },
      })

      map.on('click', 'fires-dots', (e) => {
        if (!e.features?.[0]) return
        const props = e.features[0].properties as Record<string, unknown>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const frp  = Number(props.frp || 0)
        const conf = String(props.confidence || 'nominal')
        const html = `
          <div style="font-family:'Inter',-apple-system,sans-serif;font-size:11px;color:#14161a;line-height:1.6;min-width:160px">
            <div style="font-size:12px;font-weight:700;color:#ea580c;letter-spacing:.1em;margin-bottom:4px">🔥 ACTIVE FIRE</div>
            <div><span style="color:#6b7280">FRP:</span> <b style="color:#ea580c">${frp.toFixed(1)} MW</b></div>
            <div><span style="color:#6b7280">Confidence:</span> <span style="color:${conf==='high'?'#dc2626':conf==='low'?'#d97706':'#ea580c'}">${conf.toUpperCase()}</span></div>
            <div><span style="color:#6b7280">Satellite:</span> ${String(props.satellite||'')}</div>
            <div><span style="color:#6b7280">Detected:</span> ${String(props.date||'')} ${String(props.time||'').replace(/(\d{2})(\d{2})/, '$1:$2')} UTC</div>
            <div><span style="color:#6b7280">Day/Night:</span> ${props.daynight === 'D' ? '☀ Day' : '🌙 Night'}</div>
            <div style="margin-top:4px;font-size:10px;color:#9ca3af;font-family:monospace;">${coords[1].toFixed(4)}°, ${coords[0].toFixed(4)}°</div>
          </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '260px', className: 'cy-popup' })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'fires-dots', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'fires-dots', () => { map.getCanvas().style.cursor = '' })

      // ── Sanctions country fill layer ─────────────────────────────────────
      map.addSource('sanctions-countries', {
        type: 'vector',
        url:  'mapbox://mapbox.country-boundaries-v1',
      })
      map.addLayer({
        id: 'sanctions-fill', type: 'fill',
        source: 'sanctions-countries',
        'source-layer': 'country_boundaries',
        paint: {
          'fill-color': [
            'match', ['get', 'iso_3166_1'],
            ...SANCTIONED_COUNTRIES.flatMap(c => [c.iso2, SANCTION_COLORS[c.severity]]),
            'transparent',
          ],
          'fill-opacity': 0.28,
        },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])
      map.addLayer({
        id: 'sanctions-outline', type: 'line',
        source: 'sanctions-countries',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': [
            'match', ['get', 'iso_3166_1'],
            ...SANCTIONED_COUNTRIES.flatMap(c => [c.iso2, SANCTION_COLORS[c.severity]]),
            'transparent',
          ],
          'line-width': 1.2,
          'line-opacity': 0.6,
        },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])

      // Sanctions click popup (via map markers instead of vector tile click to get full data)
      map.on('click', 'sanctions-fill', (e) => {
        const iso2 = e.features?.[0]?.properties?.iso_3166_1 as string | undefined
        if (!iso2) return
        const c = SANCTIONS_BY_ISO2[iso2]
        if (!c) return
        const sevColor = SANCTION_COLORS[c.severity as keyof typeof SANCTION_COLORS] || '#888'
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:280px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:13px;font-weight:800;color:#14161a;">${c.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${sevColor};border:1px solid ${sevColor}55;padding:1px 5px;">${c.severity.toUpperCase()}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.55;margin-bottom:7px;">${c.summary}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;">
            ${c.regimes.map((r: string) => `<span style="font-size:10px;border:1px solid #16a34a55;background:rgba(22,163,74,0.08);color:#16a34a;padding:0 4px;">${r}</span>`).join('')}
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${c.categories.map((cat: string) => `<span style="font-size:10px;border:1px solid #ea580c55;background:rgba(234,88,12,0.08);color:#ea580c;padding:0 4px;">${cat.replace('_',' ')}</span>`).join('')}
          </div>
          ${c.since ? `<div style="margin-top:5px;font-size:10px;color:#9ca3af;">Since: ${c.since}${c.totalDesignations ? ` · ~${c.totalDesignations.toLocaleString()} designations` : ''}</div>` : ''}
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'sanctions-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'sanctions-fill', () => { map.getCanvas().style.cursor = '' })

      // ── Military facilities GeoJSON source ───────────────────────────────
      map.addSource('military', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'military-circles', type: 'circle', source: 'military',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3.5, 6, 5, 10, 8],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.25)',
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'military-labels', type: 'symbol', source: 'military', minzoom: 7,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 9,
          'text-offset': [0, 1.4],
          'text-optional': true,
          'text-allow-overlap': false,
        } as Record<string, unknown>,
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
        // label layer — visibility controlled via setLayoutProperty
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'military-circles', (e) => {
        if (!e.features?.[0]) return
        const p    = e.features[0].properties as Record<string, unknown>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const color  = String(p.color || '#888')
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:290px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
            <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">${p.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${p.typeLabel}</span>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:6px;font-size:10px;">
            <span style="color:#6b7280;">🏳 <b style="color:#14161a">${p.operator}</b></span>
            <span style="color:#6b7280;">📍 <b style="color:#2563eb">${p.host}</b></span>
            ${p.personnel ? `<span style="color:#6b7280;">👥 <b style="color:#2563eb">${Number(p.personnel).toLocaleString()}</b></span>` : ''}
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.55;margin-bottom:6px;">${p.notes}</div>
          ${p.nuclear ? `<div style="font-size:10px;color:#dc2626;border:1px solid #dc262633;background:rgba(220,38,38,0.08);padding:2px 6px;display:inline-flex;align-items:center;gap:4px;">☢ NUCLEAR-CAPABLE / NUCLEAR WEAPONS STORAGE</div>` : ''}
          ${p.since ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">Established: ${p.since} · ${String(p.status||'').toUpperCase()}</div>` : ''}
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'military-circles', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'military-circles', () => { map.getCanvas().style.cursor = '' })

      // ── Ports GeoJSON source ────────────────────────────────────────────
      map.addSource('ports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'port-circles', type: 'circle', source: 'ports',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 5, 5, 8, 7, 12, 10],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.2)',
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'port-labels', type: 'symbol', source: 'ports', minzoom: 5,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 9,
          'text-offset': [0, 1.4],
          'text-optional': true,
          'text-allow-overlap': false,
        } as Record<string, unknown>,
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'port-circles', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const color = String(p.color || '#00ccff')
        const teu = p.annualTEU ? `<span style="color:#6b7280;">📦 <b style="color:#2563eb">${Number(p.annualTEU).toLocaleString()}K TEU/yr</b></span>` : ''
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:290px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
            <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">⚓ ${p.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${p.typeLabel}</span>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:6px;font-size:10px;flex-wrap:wrap;">
            <span style="color:#6b7280;">🏳 <b style="color:#14161a">${p.country}</b></span>
            ${teu}
          </div>
          <div style="font-size:11px;color:#14161a;margin-bottom:4px;">🏭 <b>${p.topIndustry}</b></div>
          ${p.notes ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;">${p.notes}</div>` : ''}
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'port-circles', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'port-circles', () => { map.getCanvas().style.cursor = '' })

      // ── Gas Pipelines GeoJSON source ────────────────────────────────────
      map.addSource('pipelines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'pipeline-lines', type: 'line', source: 'pipelines',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 4, 2, 7, 3.5, 10, 5],
          'line-opacity': 0.8,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: 'none',
        },
      })
      map.addLayer({
        id: 'pipeline-labels', type: 'symbol', source: 'pipelines', minzoom: 4,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 10, 12, 12],
          'text-allow-overlap': false,
          'text-optional': true,
          visibility: 'none',
        } as Record<string, unknown>,
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.85)',
          'text-halo-width': 1.5,
        },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'pipeline-lines', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const color = String(p.color || '#44ddaa')
        const cap = p.capacityBcmYr ? `<span style="color:#6b7280;">⛽ <b style="color:#2563eb">${p.capacityBcmYr} bcm/yr</b></span>` : ''
        const len = p.lengthKm ? `<span style="color:#6b7280;">📏 <b style="color:#2563eb">${Number(p.lengthKm).toLocaleString()} km</b></span>` : ''
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:240px;max-width:310px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
            <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">${p.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${p.statusLabel}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:5px;">${p.countries}</div>
          <div style="display:flex;gap:8px;margin-bottom:5px;font-size:10px;flex-wrap:wrap;">
            ${cap}${len}
            ${p.operator ? `<span style="color:#6b7280;">🏢 <b style="color:#2563eb">${p.operator}</b></span>` : ''}
          </div>
          ${p.notes ? `<div style="font-size:10px;color:#6b7280;line-height:1.5;">${p.notes}</div>` : ''}
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '330px', className: 'cy-popup' })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'pipeline-lines', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'pipeline-lines', () => { map.getCanvas().style.cursor = '' })

      // ── Nuclear power plants GeoJSON source ──────────────────────────────
      map.addSource('nuclear-plants', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'nuclear-circles', type: 'circle', source: 'nuclear-plants',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 6, 6, 10, 9],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.88,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.35,
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'nuclear-labels', type: 'symbol', source: 'nuclear-plants', minzoom: 6,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 8.5,
          'text-offset': [0, 1.5],
          'text-optional': true,
          'text-allow-overlap': false,
        } as Record<string, unknown>,
        paint: {
          'text-color': '#ffdd00',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
        // label layer — visibility controlled via setLayoutProperty
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'nuclear-circles', (e) => {
        if (!e.features?.[0]) return
        const p    = e.features[0].properties as Record<string, unknown>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const color  = String(p.color || '#ffdd00')
        const statusLabel: Record<string, string> = { operating:'OPERATING', under_construction:'UNDER CONSTRUCTION', shutdown:'SHUTDOWN', planned:'PLANNED' }
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:290px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
            <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">${p.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${statusLabel[String(p.status)] ?? p.status}</span>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:6px;font-size:10px;">
            <span style="color:#6b7280;">🌍 <b style="color:#14161a">${p.country}</b></span>
            <span style="color:#6b7280;">⚛ <b style="color:#d97706">${p.type}</b></span>
            <span style="color:#6b7280;">🔢 <b style="color:#2563eb">${p.reactors} reactor${Number(p.reactors) !== 1 ? 's' : ''}</b></span>
          </div>
          ${p.capacity ? `<div style="font-size:10px;color:#6b7280;margin-bottom:5px;">Capacity: <b style="color:#14161a">${Number(p.capacity).toLocaleString()} MWe</b></div>` : ''}
          <div style="font-size:11px;color:#6b7280;line-height:1.55;margin-bottom:4px;">${p.notes}</div>
          ${p.since ? `<div style="font-size:10px;color:#9ca3af;">First unit: ${p.since}</div>` : ''}
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'nuclear-circles', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'nuclear-circles', () => { map.getCanvas().style.cursor = '' })

      // ── Airspace closure overlay ──────────────────────────────────────────
      // FIR bounding boxes rendered as filled polygons; updated reactively
      const firFeatures: GeoJSON.Feature[] = FIR_REGIONS.map(fir => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [fir.minLng, fir.minLat],
            [fir.maxLng, fir.minLat],
            [fir.maxLng, fir.maxLat],
            [fir.minLng, fir.maxLat],
            [fir.minLng, fir.minLat],
          ]],
        },
        properties: { icao: fir.icao, name: fir.name, status: 'normal', baseline: fir.baseline },
      }))
      map.addSource('airspace-fir', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: firFeatures },
      })
      // Closed = dense red diagonal stripes via fill + line pattern
      map.addLayer({
        id: 'airspace-fill', type: 'fill', source: 'airspace-fir',
        paint: {
          'fill-color': ['match', ['get', 'status'],
            'closed',     '#ff1a3e',
            'restricted', '#ff8800',
            'transparent',
          ],
          'fill-opacity': 0.12,
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'airspace-lines', type: 'line', source: 'airspace-fir',
        paint: {
          'line-color': ['match', ['get', 'status'],
            'closed',     '#ff1a3e',
            'restricted', '#ff8800',
            'rgba(0,255,136,0.13)',
          ],
          'line-width': ['match', ['get', 'status'], 'closed', 1.5, 'restricted', 1, 0.4],
          'line-dasharray': ['match', ['get', 'status'], 'normal', ['literal', [2, 4]], ['literal', [1, 0]]],
          'line-opacity': ['match', ['get', 'status'], 'normal', 0.2, 0.75],
        },
        layout: { visibility: 'none' },
      })

      // ── Critical Infrastructure ───────────────────────────────────────────
      map.addSource('infrastructure', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'infra-circles', type: 'circle', source: 'infrastructure',
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 2, 3, 6, 5, 10, 8],
          'circle-color':        ['get', 'color'],
          'circle-opacity':      0.9,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': 'rgba(0,0,0,0.5)',
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'infra-labels', type: 'symbol', source: 'infrastructure', minzoom: 6,
        layout: {
          'text-field':    ['get', 'name'],
          'text-font':     ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':     9,
          'text-offset':   [0, 1.4],
          'text-optional': true,
          'text-allow-overlap': false,
        } as Record<string, unknown>,
        paint: {
          'text-color':       ['get', 'color'],
          'text-halo-color':  'rgba(0,0,0,0.85)',
          'text-halo-width':  1,
        },
        // visibility controlled via setLayoutProperty
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'infra-circles', (e) => {
        if (!e.features?.[0]) return
        const p     = e.features[0].properties as Record<string, unknown>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const color  = String(p.color || '#00ff88')
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:290px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:12px;font-weight:800;color:#14161a;">${p.icon} ${p.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;">${p.typeLabel}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.5;">
            <div><span style="color:#9ca3af;">Country:</span> ${p.country}</div>
            ${p.capacity ? `<div><span style="color:#9ca3af;">Capacity:</span> <b style="color:${color};">${p.capacity}</b></div>` : ''}
            ${p.river    ? `<div><span style="color:#9ca3af;">River:</span> ${p.river}</div>` : ''}
            ${p.notes    ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">${p.notes}</div>` : ''}
            <div style="margin-top:4px;font-size:10px;color:#${p.status === 'operational' ? '16a34a' : p.status === 'under_construction' ? 'd97706' : 'dc2626'};">● ${String(p.status).replace('_',' ').toUpperCase()}</div>
          </div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
          .setLngLat(coords).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'infra-circles', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'infra-circles', () => { map.getCanvas().style.cursor = '' })

      map.on('click', 'pipeline-lines', (e) => {
        if (!e.features?.[0]) return
        const p     = e.features[0].properties as Record<string, unknown>
        const color  = String(p.color || '#ea580c')
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:280px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:12px;font-weight:800;color:#14161a;">⬡ ${p.name}</span>
            <span style="font-size:10px;color:${color};border:1px solid ${color}55;padding:1px 5px;">${String(p.type).toUpperCase()}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">
            <div><span style="color:#9ca3af;">Route:</span> ${p.from} → ${p.to}</div>
            ${p.capacity ? `<div><span style="color:#9ca3af;">Capacity:</span> ${p.capacity}</div>` : ''}
            ${p.notes    ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">${p.notes}</div>` : ''}
            <div style="margin-top:4px;font-size:10px;color:#${p.status === 'operational' ? '16a34a' : p.status === 'under_construction' ? 'd97706' : 'dc2626'};">● ${String(p.status).replace('_',' ').toUpperCase()}</div>
          </div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'pipeline-lines', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'pipeline-lines', () => { map.getCanvas().style.cursor = '' })

      // ── Humanitarian (UNHCR offices, border crossings, refugee camps) ────────
      map.addSource('humanitarian-offices',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('humanitarian-crossings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('humanitarian-camps',     { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      // UNHCR Offices – blue circles by type
      map.addLayer({
        id: 'humanitarian-offices', type: 'circle', source: 'humanitarian-offices',
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 3, 5, 5, 9, 8],
          'circle-color':        ['get', 'color'],
          'circle-opacity':      0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(0,170,255,0.55)',
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'humanitarian-offices-labels', type: 'symbol', source: 'humanitarian-offices', minzoom: 4,
        layout: {
          'text-field':         ['get', 'city'],
          'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':          8,
          'text-offset':        [0, 1.3],
          'text-optional':      true,
          'text-allow-overlap': false,
          'visibility':         'none',
        } as Record<string, unknown>,
        paint: { 'text-color': '#00aaff', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.2 },
      } as Parameters<typeof map.addLayer>[0])

      // Border Crossings – exact crossing path (the physical road/axis across the border)
      map.addSource('humanitarian-crossing-paths', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      // Wide soft glow underlay
      map.addLayer({
        id: 'humanitarian-crossing-path-glow', type: 'line', source: 'humanitarian-crossing-paths',
        paint: {
          'line-color':   ['get', 'statusColor'],
          'line-width':   ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 6, 12, 10],
          'line-opacity': 0.18,
          'line-blur':    3,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      })
      // Crisp dashed crossing axis
      map.addLayer({
        id: 'humanitarian-crossing-path', type: 'line', source: 'humanitarian-crossing-paths',
        paint: {
          'line-color':     ['get', 'statusColor'],
          'line-width':     ['interpolate', ['linear'], ['zoom'], 4, 1.4, 8, 2.2, 12, 3],
          'line-opacity':   0.95,
          'line-dasharray': ['match', ['get', 'status'], 'closed', ['literal', [1, 1.4]], ['literal', [3, 1.6]]],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      })
      // Perpendicular "gate" ticks marking the actual border line at each crossing
      map.addSource('humanitarian-crossing-gates', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'humanitarian-crossing-gate', type: 'line', source: 'humanitarian-crossing-gates',
        paint: {
          'line-color': ['get', 'statusColor'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.6, 8, 2.4, 12, 3.2],
          'line-opacity': 0.9,
        },
        layout: { 'line-cap': 'round', visibility: 'none' },
      })
      map.addLayer({
        id: 'humanitarian-crossings', type: 'circle', source: 'humanitarian-crossings',
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 5, 10, 7],
          'circle-color':        ['get', 'statusColor'],
          'circle-opacity':      0.85,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': 'rgba(0,0,0,0.55)',
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'humanitarian-crossings-labels', type: 'symbol', source: 'humanitarian-crossings', minzoom: 5,
        layout: {
          'text-field':         ['get', 'name'],
          'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':          7.5,
          'text-offset':        [0, 1.3],
          'text-optional':      true,
          'text-allow-overlap': false,
          'visibility':         'none',
        } as Record<string, unknown>,
        paint: { 'text-color': ['get', 'statusColor'], 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.2 },
      } as Parameters<typeof map.addLayer>[0])

      // Refugee Camps – cyan/green circles scaled by population
      map.addLayer({
        id: 'humanitarian-camps', type: 'circle', source: 'humanitarian-camps',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, ['interpolate', ['linear'], ['get', 'pop'], 0, 2, 1000000, 8],
            6, ['interpolate', ['linear'], ['get', 'pop'], 0, 4, 1000000, 18],
            10, ['interpolate', ['linear'], ['get', 'pop'], 0, 6, 1000000, 26],
          ],
          'circle-color':        ['get', 'color'],
          'circle-opacity':      0.75,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': 'rgba(0,0,0,0.5)',
        },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])
      map.addLayer({
        id: 'humanitarian-camps-labels', type: 'symbol', source: 'humanitarian-camps', minzoom: 4,
        layout: {
          'text-field':         ['get', 'name'],
          'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':          8,
          'text-offset':        [0, 1.4],
          'text-optional':      true,
          'text-allow-overlap': false,
          'visibility':         'none',
        } as Record<string, unknown>,
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.2 },
      } as Parameters<typeof map.addLayer>[0])

      // ── Choropleth: country fill by displacement total ──────────────────
      // Use Mapbox's built-in country-boundaries source (part of composite)
      // Build a match expression from COUNTRY_DISPLACEMENT keyed by iso_3166_1_alpha_3
      const isoEntries = Object.entries(COUNTRY_DISPLACEMENT)
      const maxDisp = Math.max(...isoEntries.map(([, d]) => d.hosting + d.origin))
      const matchExpr: (string | number | string[])[] = ['match', ['get', 'iso_3166_1_alpha_3']]
      for (const [iso3, d] of isoEntries) {
        const total = d.hosting + d.origin
        // Normalize 0..1 then map to color stops
        const t = Math.min(1, total / maxDisp)
        // blue(low) → yellow → red(high)
        const r = Math.round(t < 0.5 ? t * 2 * 255 : 255)
        const g = Math.round(t < 0.5 ? 200 + t * 110 : 255 * (1 - (t - 0.5) * 2))
        const b = Math.round(t < 0.5 ? 255 * (1 - t * 2) : 0)
        matchExpr.push(iso3, `rgba(${r},${g},${b},0.45)`)
      }
      matchExpr.push('rgba(0,0,0,0)')  // default — transparent
      if (!map.getSource('humanitarian-boundaries')) {
        map.addSource('humanitarian-boundaries', {
          type: 'vector',
          url:  'mapbox://mapbox.country-boundaries-v1',
        })
      }
      map.addLayer({
        id: 'humanitarian-choropleth',
        type: 'fill',
        source: 'humanitarian-boundaries',
        'source-layer': 'country_boundaries',
        paint: { 'fill-color': matchExpr as unknown as mapboxgl.Expression },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0], 'humanitarian-offices')  // insert below existing humanitarian layers

      // Choropleth country border outlines
      const outlineMatch: (string | number | string[])[] = ['match', ['get', 'iso_3166_1_alpha_3']]
      for (const [iso3] of isoEntries) { outlineMatch.push(iso3, 'rgba(255,100,50,0.5)') }
      outlineMatch.push('rgba(0,0,0,0)')
      map.addLayer({
        id: 'humanitarian-choropleth-line',
        type: 'line',
        source: 'humanitarian-boundaries',
        'source-layer': 'country_boundaries',
        paint: { 'line-color': outlineMatch as unknown as mapboxgl.Expression, 'line-width': 1 },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0], 'humanitarian-offices')

      // ── Heatmap: displacement intensity from camp populations ──────────
      map.addSource('humanitarian-heatmap', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'humanitarian-heatmap',
        type: 'heatmap',
        source: 'humanitarian-heatmap',
        paint: {
          'heatmap-weight':    ['interpolate', ['linear'], ['get', 'pop'], 0, 0, 1_000_000, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 6, 1.5],
          'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 0, 15, 6, 50, 10, 80],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(0,0,0,0)',
            0.1, 'rgba(0,50,120,0.3)',
            0.3, 'rgba(0,100,200,0.5)',
            0.5, 'rgba(0,255,136,0.55)',
            0.7, 'rgba(255,200,0,0.65)',
            0.9, 'rgba(255,100,0,0.75)',
            1,   'rgba(255,30,30,0.85)',
          ],
          'heatmap-opacity': 0.7,
        },
        layout: { visibility: 'none' },
      }, 'humanitarian-offices')

      // ── Flow lines: animated refugee corridors ─────────────────────────
      map.addSource('humanitarian-flows', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      // The flow arcs — dashed animated lines
      map.addLayer({
        id: 'humanitarian-flows',
        type: 'line',
        source: 'humanitarian-flows',
        paint: {
          'line-color':     ['get', 'color'],
          'line-width':     ['interpolate', ['linear'], ['get', 'count'], 100_000, 1.5, 4_000_000, 4],
          'line-opacity':   0.7,
          'line-dasharray': [2, 2],
        },
        layout: { 'line-cap': 'round', visibility: 'none' },
      })
      // Flow labels (on hover only — show on the line)
      map.addLayer({
        id: 'humanitarian-flows-labels',
        type: 'symbol',
        source: 'humanitarian-flows',
        layout: {
          'symbol-placement': 'line-center',
          'text-field':       ['get', 'label'],
          'text-font':        ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':        9,
          'text-allow-overlap': false,
          visibility:         'none',
        },
        paint: {
          'text-color':      '#ffcc00',
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 1.5,
        },
      } as Parameters<typeof map.addLayer>[0])

      // ── Clustered camps/offices with pulsing ──────────────────────────
      map.addSource('humanitarian-clusters', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 60,
        clusterProperties: { totalPop: ['+', ['get', 'pop']] },
      })
      // Cluster circles — sized by aggregated population
      map.addLayer({
        id: 'humanitarian-cluster-circles',
        type: 'circle',
        source: 'humanitarian-clusters',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'interpolate', ['linear'], ['get', 'totalPop'],
            10_000,    'rgba(0,170,255,0.5)',
            500_000,   'rgba(255,200,0,0.6)',
            2_000_000, 'rgba(255,60,30,0.7)',
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'totalPop'],
            10_000, 14,
            500_000, 28,
            2_000_000, 42,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.25)',
          'circle-opacity': 0.7,
        },
        layout: { visibility: 'none' },
      })
      // Outer pulsing ring (larger, lower opacity)
      map.addLayer({
        id: 'humanitarian-cluster-pulse',
        type: 'circle',
        source: 'humanitarian-clusters',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color':   'transparent',
          'circle-radius':  [
            'interpolate', ['linear'], ['get', 'totalPop'],
            10_000, 20,
            500_000, 38,
            2_000_000, 56,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': [
            'interpolate', ['linear'], ['get', 'totalPop'],
            10_000,    'rgba(0,170,255,0.3)',
            2_000_000, 'rgba(255,60,30,0.3)',
          ],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 8, 0.9],
        },
        layout: { visibility: 'none' },
      })
      // Cluster count label
      map.addLayer({
        id: 'humanitarian-cluster-count',
        type: 'symbol',
        source: 'humanitarian-clusters',
        filter: ['has', 'point_count'],
        layout: {
          'text-field':       ['concat', ['get', 'point_count'], ' sites'],
          'text-font':        ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':        9,
          'text-allow-overlap': true,
          visibility:         'none',
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 },
      } as Parameters<typeof map.addLayer>[0])

      // Click handlers — flow lines
      map.on('click', 'humanitarian-flows', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const fmtN = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : n.toString()
        const html = `<div style="padding:8px 10px;font-family:'Inter',-apple-system,sans-serif;">
          <div style="font-size:11px;font-weight:800;color:#d97706;margin-bottom:4px;">${p.label}</div>
          <div style="font-size:11px;color:#16a34a;font-weight:700;">${fmtN(Number(p.count))} displaced</div>
          <div style="margin-top:4px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR GLOBAL TRENDS 2023</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '240px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'humanitarian-flows', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'humanitarian-flows', () => { map.getCanvas().style.cursor = '' })

      // Click handlers — choropleth
      map.on('click', 'humanitarian-choropleth', (e) => {
        if (!e.features?.[0]) return
        const iso3 = (e.features[0].properties as Record<string, string>).iso_3166_1_alpha_3
        const d = COUNTRY_DISPLACEMENT[iso3]
        if (!d) return
        const fmtN = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : n.toString()
        const html = `<div style="padding:8px 10px;font-family:'Inter',-apple-system,sans-serif;">
          <div style="font-size:11px;font-weight:800;color:#14161a;margin-bottom:4px;">${iso3}</div>
          ${d.hosting ? `<div style="font-size:10px;color:#2563eb;">HOSTING: <b>${fmtN(d.hosting)}</b></div>` : ''}
          ${d.origin ? `<div style="font-size:10px;color:#ea580c;">ORIGIN: <b>${fmtN(d.origin)}</b></div>` : ''}
          <div style="font-size:10px;color:#d97706;font-weight:700;">TOTAL: ${fmtN(d.hosting + d.origin)}</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '220px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'humanitarian-choropleth', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'humanitarian-choropleth', () => { map.getCanvas().style.cursor = '' })

      // Click handlers — clusters (zoom in on click)
      map.on('click', 'humanitarian-cluster-circles', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['humanitarian-cluster-circles'] })
        if (!features.length) return
        const clusterId = features[0].properties?.cluster_id
        const src = map.getSource('humanitarian-clusters') as mapboxgl.GeoJSONSource
        src.getClusterExpansionZoom(clusterId, (_err, zoom) => {
          const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
          map.easeTo({ center: coords, zoom: zoom ?? (map.getZoom() + 2) })
        })
      })
      map.on('mouseenter', 'humanitarian-cluster-circles', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'humanitarian-cluster-circles', () => { map.getCanvas().style.cursor = '' })

      // Click handlers
      map.on('click', 'humanitarian-offices', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, string>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:210px;">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></div>
            <span style="font-size:11px;font-weight:800;color:#14161a;">UNHCR ${p.city}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">
            <div><span style="color:#9ca3af;">Office:</span> ${p.name}</div>
            <div><span style="color:#9ca3af;">Country:</span> ${p.country}</div>
            <div><span style="color:#9ca3af;">Type:</span> <b style="color:#2563eb;">${p.officeType.toUpperCase()}</b></div>
          </div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR PRESENCE MAP · unhcr.org</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '280px', className: 'cy-popup' })
          .setLngLat(coords).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'humanitarian-offices',   () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'humanitarian-offices',   () => { map.getCanvas().style.cursor = '' })

      map.on('click', 'humanitarian-crossings', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, string>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const statusLabel = p.status.toUpperCase()
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:210px;">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <div style="width:8px;height:8px;border-radius:50%;background:${p.statusColor};flex-shrink:0;"></div>
            <span style="font-size:11px;font-weight:800;color:#14161a;">${p.name}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">
            <div><span style="color:#9ca3af;">Countries:</span> ${p.country1} ↔ ${p.country2}</div>
            <div><span style="color:#9ca3af;">Status:</span> <b style="color:${p.statusColor};">${statusLabel}</b></div>
          </div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR BORDER CROSSING POINTS</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '280px', className: 'cy-popup' })
          .setLngLat(coords).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'humanitarian-crossings', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'humanitarian-crossings', () => { map.getCanvas().style.cursor = '' })

      map.on('click', 'humanitarian-crossing-path', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, string>
        const statusLabel = p.status.toUpperCase()
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:210px;">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <div style="width:8px;height:8px;border-radius:50%;background:${p.statusColor};flex-shrink:0;"></div>
            <span style="font-size:11px;font-weight:800;color:#14161a;">${p.name}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">
            <div><span style="color:#9ca3af;">Countries:</span> ${p.country1} ↔ ${p.country2}</div>
            <div><span style="color:#9ca3af;">Status:</span> <b style="color:${p.statusColor};">${statusLabel}</b></div>
            <div><span style="color:#9ca3af;">Crossing axis:</span> mapped to true bearing</div>
          </div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR BORDER CROSSING POINTS</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '280px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'humanitarian-crossing-path', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'humanitarian-crossing-path', () => { map.getCanvas().style.cursor = '' })

      map.on('click', 'humanitarian-camps', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const pop = Number(p.pop ?? 0)
        const fmt = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : n.toString()
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></div>
            <span style="font-size:11px;font-weight:800;color:#14161a;">${p.name}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">
            <div><span style="color:#9ca3af;">Country:</span> ${p.country}</div>
            <div><span style="color:#9ca3af;">Population:</span> <b style="color:${p.color};">${fmt(pop)} people</b></div>
            <div><span style="color:#9ca3af;">Type:</span> ${String(p.campType).replace('_', ' ').toUpperCase()}</div>
            ${p.notes ? `<div style="margin-top:3px;font-size:10px;color:#9ca3af;">${p.notes}</div>` : ''}
          </div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR POPULATION REFERENCE POINTS</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '290px', className: 'cy-popup' })
          .setLngLat(coords).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'humanitarian-camps', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'humanitarian-camps', () => { map.getCanvas().style.cursor = '' })

      // ── Vessels (AIS) — no clustering, per-type icons like flights ─────
      map.addSource('vessels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Vessel icon layer — visible at ALL zoom levels, per-type icon + color
      map.addLayer({
        id: 'vessel-icons',
        type: 'symbol',
        source: 'vessels',
        layout: {
          'icon-image': ['match', ['get', 'vesselType'],
            'cargo',     'vessel-cargo',
            'tanker',    'vessel-tanker',
            'passenger', 'vessel-passenger',
            'fishing',   'vessel-fishing',
            'military',  'vessel-military',
            'tug',       'vessel-tug',
            'vessel-other',
          ],
          'icon-rotate':           ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          // Scale from tiny at globe view up to full-size at street zoom (match flights)
          'icon-size':             ['interpolate', ['linear'], ['zoom'],
            1, 0.14,
            3, 0.20,
            5, 0.32,
            7, 0.55,
            10, 0.82,
            13, 1.2,
          ],
          'icon-allow-overlap':    true,
          'icon-ignore-placement': true,
          // Vessel name label only at zoom ≥ 8
          'text-field':  ['step', ['zoom'], '', 8,
            ['case', ['==', ['get', 'name'], ''], '', ['get', 'name']],
          ],
          'text-font':   ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':   ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 11],
          'text-offset': [0, 1.6],
          'text-optional':      true,
          'text-allow-overlap': false,
          visibility: 'none',
        } as Record<string, unknown>,
        paint: {
          'icon-color': ['match', ['get', 'vesselType'],
            'cargo',     VESSEL_TYPE_COLORS.cargo,
            'tanker',    VESSEL_TYPE_COLORS.tanker,
            'passenger', VESSEL_TYPE_COLORS.passenger,
            'fishing',   VESSEL_TYPE_COLORS.fishing,
            'military',  VESSEL_TYPE_COLORS.military,
            'tug',       VESSEL_TYPE_COLORS.tug,
            VESSEL_TYPE_COLORS.other,
          ],
          'icon-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.75, 4, 0.88, 7, 0.95],
          'text-color': '#c0dcc4',
          'text-halo-color': 'rgba(0,0,0,0.75)',
          'text-halo-width': 1.2,
        } as Record<string, unknown>,
      })

      // Vessel click popup
      map.on('click', 'vessel-icons', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, string>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const sog = parseFloat(p.sog || '0').toFixed(1)
        const cog = parseFloat(p.cog || '0').toFixed(0)
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></div>
            <span style="font-size:11px;font-weight:800;color:#14161a;">${p.name || 'UNKNOWN'}</span>
            <span style="font-size:10px;color:#9ca3af;margin-left:auto;">${p.vesselType?.toUpperCase()}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">
            <div><span style="color:#9ca3af;">MMSI:</span> ${p.mmsi}</div>
            <div><span style="color:#9ca3af;">Speed:</span> <b style="color:#16a34a;">${sog} kn</b></div>
            <div><span style="color:#9ca3af;">Course:</span> ${cog}°</div>
            <div><span style="color:#9ca3af;">Heading:</span> ${p.heading}°</div>
            ${p.destination ? `<div><span style="color:#9ca3af;">Dest:</span> ${p.destination}</div>` : ''}
          </div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: AIS VESSEL TRACKING</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '290px', className: 'cy-popup' })
          .setLngLat(coords).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'vessel-icons', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'vessel-icons', () => { map.getCanvas().style.cursor = '' })

      // ── GPS Jamming interference zones ───────────────────────────────────
      // Point source (for labels + heatmap)
      map.addSource('gpsjam', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      // Polygon source (actual radius coverage areas)
      map.addSource('gpsjam-areas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      // Fill layer — actual affected area polygons
      map.addLayer({
        id: 'gpsjam-fill',
        type: 'fill',
        source: 'gpsjam-areas',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['match', ['get', 'severity'], 'high', 0.15, 'medium', 0.10, 0.06],
        },
        layout: { visibility: 'none' },
      })
      // Outline of affected area
      map.addLayer({
        id: 'gpsjam-outline',
        type: 'line',
        source: 'gpsjam-areas',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['match', ['get', 'severity'], 'high', 1.5, 'medium', 1, 0.7],
          'line-opacity': 0.5,
          'line-dasharray': [3, 2],
        },
        layout: { visibility: 'none' },
      })
      // Heatmap glow layer
      map.addLayer({
        id: 'gpsjam-heat',
        type: 'heatmap',
        source: 'gpsjam',
        maxzoom: 8,
        paint: {
          'heatmap-weight': ['match', ['get', 'severity'], 'high', 1, 'medium', 0.6, 0.3],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 8, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 20, 4, 40, 6, 60, 8, 80],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(255,100,0,0.15)',
            0.4, 'rgba(255,60,0,0.3)',
            0.6, 'rgba(255,34,68,0.45)',
            0.8, 'rgba(255,0,40,0.6)',
            1.0, 'rgba(255,0,20,0.8)',
          ],
          'heatmap-opacity': 0.75,
        },
        layout: { visibility: 'none' },
      })
      // Small center dot markers
      map.addLayer({
        id: 'gpsjam-circles',
        type: 'circle',
        source: 'gpsjam',
        minzoom: 3,
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'high', 5, 'medium', 4, 3],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.7,
          'circle-stroke-width': 1,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.9,
        },
        layout: { visibility: 'none' },
      })
      // Labels
      map.addLayer({
        id: 'gpsjam-labels',
        type: 'symbol',
        source: 'gpsjam',
        minzoom: 5,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 9,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true,
          visibility: 'none',
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.85)',
          'text-halo-width': 1.2,
        },
      })
      // Click popup
      map.on('click', 'gpsjam-circles', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const sevColor = String(p.color || '#ff2244')
        const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:220px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${sevColor};box-shadow:0 0 8px ${sevColor}88;"></div>
            <span style="font-size:12px;font-weight:700;color:${sevColor};letter-spacing:.06em;">${p.name}</span>
          </div>
          <div style="font-size:10px;color:#9ca3af;letter-spacing:.12em;margin-bottom:6px;">${String(p.region).toUpperCase()} · ${p.typeLabel}</div>
          <div style="display:grid;grid-template-columns:70px 1fr;gap:3px 8px;font-size:11px;">
            <span style="color:#9ca3af;">Severity</span><span style="color:${sevColor};font-weight:700;">${String(p.severity).toUpperCase()}</span>
            <span style="color:#9ca3af;">Type</span><span style="color:#14161a;">${p.typeLabel}</span>
            <span style="color:#9ca3af;">Radius</span><span style="color:#14161a;">${p.radius} km</span>
            <span style="color:#9ca3af;">Status</span><span style="color:${p.active === 'true' || p.active === true ? '#16a34a' : '#9ca3af'};">${p.active === 'true' || p.active === true ? 'ACTIVE' : 'INACTIVE'}</span>
          </div>
          <div style="margin-top:6px;font-size:10px;color:#6b7280;line-height:1.5;">${p.notes}</div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: ${p.source}</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
          .setLngLat(coords).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'gpsjam-circles', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'gpsjam-circles', () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'gpsjam-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'gpsjam-fill', () => { map.getCanvas().style.cursor = '' })
      // Click on area polygon shows same popup
      map.on('click', 'gpsjam-fill', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const sevColor = String(p.color || '#ff2244')
        const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:220px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${sevColor};box-shadow:0 0 8px ${sevColor}88;"></div>
            <span style="font-size:12px;font-weight:700;color:${sevColor};letter-spacing:.06em;">${p.name}</span>
          </div>
          <div style="font-size:10px;color:#9ca3af;letter-spacing:.12em;margin-bottom:6px;">${String(p.region).toUpperCase()} · ${p.typeLabel}</div>
          <div style="display:grid;grid-template-columns:70px 1fr;gap:3px 8px;font-size:11px;">
            <span style="color:#9ca3af;">Severity</span><span style="color:${sevColor};font-weight:700;">${String(p.severity).toUpperCase()}</span>
            <span style="color:#9ca3af;">Type</span><span style="color:#14161a;">${p.typeLabel}</span>
            <span style="color:#9ca3af;">Radius</span><span style="color:#14161a;">${p.radius} km</span>
            <span style="color:#9ca3af;">Status</span><span style="color:${p.active === 'true' || p.active === true ? '#16a34a' : '#9ca3af'};">${p.active === 'true' || p.active === true ? 'ACTIVE' : 'INACTIVE'}</span>
          </div>
          <div style="margin-top:6px;font-size:10px;color:#6b7280;line-height:1.5;">${p.notes}</div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: ${p.source}</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })

      // ── Oil & Gas 3D extruded bars (separate layers, side by side) ────
      for (const kind of ['oil', 'gas'] as const) {
        map.addSource(`${kind}-bars`, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: `${kind}-extrusion`,
          type: 'fill-extrusion',
          source: `${kind}-bars`,
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.82,
          },
          layout: { visibility: 'none' },
        })
        map.addLayer({
          id: `${kind}-labels`,
          type: 'symbol',
          source: `${kind}-bars`,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 2, 7, 6, 9, 10, 11],
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 0],
            'text-anchor': 'center',
            'text-allow-overlap': false,
            'text-optional': true,
            visibility: 'none',
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': 'rgba(0,0,0,0.9)',
            'text-halo-width': 1.5,
          },
        })
      }

      // Click handler for oil or gas bars (shared popup showing all 4 metrics)
      function oilgasClickHandler(e: mapboxgl.MapLayerMouseEvent) {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const country = OIL_GAS_DATA.find(c => c.iso2 === p.iso2)
        if (!country) return

        const metrics: OilGasMetric[] = ['oilReserves', 'gasReserves', 'oilProduction', 'gasProduction']
        const maxVals = metrics.map(m => getMaxValue(m))
        const bars = metrics.map((m, i) => {
          const val = country[m]
          const pct = maxVals[i] > 0 ? Math.max(1, (val / maxVals[i]) * 100) : 0
          const rank = [...OIL_GAS_DATA].sort((a, b) => b[m] - a[m]).findIndex(c => c.iso2 === country.iso2) + 1
          return `
            <div style="margin:3px 0;">
              <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:1px;">
                <span style="color:${METRIC_COLORS[m]};font-weight:700;">${METRIC_LABELS[m]}</span>
                <span style="color:#9ca3af;">#${rank} of ${OIL_GAS_DATA.filter(c => c[m] > 0).length}</span>
              </div>
              <div style="background:#fafbfc;height:10px;position:relative;border:1px solid #e5e7eb;">
                <div style="position:absolute;top:0;left:0;height:100%;width:${pct}%;background:${METRIC_COLORS[m]};opacity:0.7;"></div>
                <span style="position:absolute;right:3px;top:0;font-size:10px;color:#14161a;line-height:10px;">${formatValue(val, m)}</span>
              </div>
            </div>`
        }).join('')

        const regionTotals = getRegionTotals('oilReserves')
        const regionRank = regionTotals.findIndex(r => r.region === country.region) + 1

        const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:260px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:700;color:#ea580c;letter-spacing:.08em;">${country.name}</span>
            <span style="font-size:10px;color:#6b7280;border:1px solid #e5e7eb;padding:0 4px;letter-spacing:.1em;">${country.iso2}</span>
          </div>
          <div style="font-size:10px;color:#9ca3af;letter-spacing:.12em;margin-bottom:6px;">${country.region.toUpperCase()} · REGION RANK #${regionRank}</div>
          ${bars}
          <div style="margin-top:6px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: EIA / OPEC / BP STATISTICAL REVIEW 2023</div>
        </div>`

        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
          .setLngLat([country.lng, country.lat]).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      }
      map.on('click', 'oil-extrusion', oilgasClickHandler)
      map.on('click', 'gas-extrusion', oilgasClickHandler)
      map.on('mouseenter', 'oil-extrusion', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'oil-extrusion', () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'gas-extrusion', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'gas-extrusion', () => { map.getCanvas().style.cursor = '' })

      // ── Chokepoints GeoJSON source ──────────────────────────────────────
      map.addSource('chokepoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'chokepoint-zones', type: 'fill', source: 'chokepoints',
        paint: {
          'fill-color': CHOKEPOINT_COLORS.zone,
          'fill-opacity': 0.12,
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'chokepoint-borders', type: 'line', source: 'chokepoints',
        paint: {
          'line-color': CHOKEPOINT_COLORS.zoneBorder,
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [4, 2],
        },
        layout: { visibility: 'none' },
      })
      map.addSource('chokepoint-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'chokepoint-label-layer', type: 'symbol', source: 'chokepoint-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 6, 12],
          'text-allow-overlap': true,
          visibility: 'none',
        } as Record<string, unknown>,
        paint: {
          'text-color': '#ff4466',
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 1.5,
        },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'chokepoint-zones', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:250px;max-width:320px;">
          <div style="font-size:12px;font-weight:800;color:#dc2626;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:5px;">${p.name}</div>
          <div style="display:grid;grid-template-columns:90px 1fr;gap:3px 8px;font-size:11px;">
            <span style="color:#9ca3af;">Daily Transits</span><span style="color:#ea580c;font-weight:700;">${p.dailyTransits} vessels</span>
            <span style="color:#9ca3af;">World Trade</span><span style="color:#d97706;font-weight:700;">${p.pctWorldTrade}%</span>
            ${p.pctOilTrade ? `<span style="color:#9ca3af;">Oil Trade</span><span style="color:#ea580c;font-weight:700;">${p.pctOilTrade}%</span>` : ''}
            <span style="color:#9ca3af;">Controlled By</span><span style="color:#14161a;">${p.controlledBy}</span>
          </div>
          <div style="margin-top:6px;font-size:11px;color:#6b7280;"><b>Key goods:</b> ${p.keyGoods}</div>
          <div style="margin-top:4px;font-size:11px;color:#dc2626;"><b>Risks:</b> ${p.risks}</div>
          ${p.notes ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">${p.notes}</div>` : ''}
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: IMF PORTWATCH · UNCTAD</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '340px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'chokepoint-zones', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'chokepoint-zones', () => { map.getCanvas().style.cursor = '' })

      // ── Supply Chain Facilities GeoJSON source ────────────────────────────
      map.addSource('supplychain', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'supplychain-circles', type: 'circle', source: 'supplychain',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3.5, 5, 5, 8, 7, 12, 10],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.25)',
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'supplychain-labels', type: 'symbol', source: 'supplychain', minzoom: 4,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 9,
          'text-offset': [0, 1.4],
          'text-optional': true,
          'text-allow-overlap': false,
          visibility: 'none',
        } as Record<string, unknown>,
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'supplychain-circles', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const color = String(p.color || '#00ccff')
        const share = p.globalShare ? `<span style="color:#d97706;font-weight:700;">${p.globalShare}% global share</span>` : ''
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:240px;max-width:310px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
            <span style="font-size:12px;font-weight:800;color:${color};line-height:1.3;">${p.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${p.typeLabel}</span>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:5px;font-size:10px;flex-wrap:wrap;">
            <span style="color:#6b7280;">🏢 <b style="color:#14161a">${p.operator}</b></span>
            <span style="color:#6b7280;">🏳 <b style="color:#14161a">${p.country}</b></span>
          </div>
          <div style="font-size:11px;color:#14161a;margin-bottom:4px;">⚙ <b>${p.product}</b></div>
          ${share ? `<div style="font-size:11px;margin-bottom:4px;">${share}</div>` : ''}
          ${p.notes ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;">${p.notes}</div>` : ''}
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: SEMICONDUCTOR INDUSTRY ASSOCIATION · USGS</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '330px', className: 'cy-popup' })
          .setLngLat((e.features[0].geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'supplychain-circles', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'supplychain-circles', () => { map.getCanvas().style.cursor = '' })

      // ── Shipping Routes GeoJSON source ────────────────────────────────────
      map.addSource('shipping-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'shipping-route-lines', type: 'line', source: 'shipping-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 3, 2, 6, 3, 10, 4],
          'line-opacity': 0.6,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: 'none',
        },
      })
      map.addLayer({
        id: 'shipping-route-labels', type: 'symbol', source: 'shipping-routes', minzoom: 3,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 8, 6, 10, 10, 12],
          'text-allow-overlap': false,
          'text-optional': true,
          visibility: 'none',
        } as Record<string, unknown>,
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.85)',
          'text-halo-width': 1.5,
        },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'shipping-route-lines', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const color = String(p.color || '#00aaff')
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:300px;">
          <div style="font-size:12px;font-weight:800;color:${color};margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:5px;">${p.name}</div>
          <div style="font-size:11px;color:#d97706;font-weight:700;margin-bottom:5px;">${p.annualTonnageMt}M tonnes/year</div>
          <div style="font-size:11px;color:#14161a;"><b>Key goods:</b> ${p.keyGoods}</div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNCTAD REVIEW OF MARITIME TRANSPORT</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'shipping-route-lines', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'shipping-route-lines', () => { map.getCanvas().style.cursor = '' })

      // ── Country click — reverse geocode any click on the map ─────────
      let featureClickedFlag = false
      let featureClickTimer: ReturnType<typeof setTimeout> | null = null
      map.on('click', (e) => {
        if (featureClickTimer) clearTimeout(featureClickTimer)
        featureClickTimer = setTimeout(() => {
          if (featureClickedFlag) {
            featureClickedFlag = false
            return
          }
          if (!onCountryClickRef.current) return
          // Reverse geocode — works for every click on land
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${e.lngLat.lng},${e.lngLat.lat}.json?types=country&access_token=${mapboxgl.accessToken}`)
            .then(r => r.json())
            .then(json => {
              const countryName = json.features?.[0]?.text || json.features?.[0]?.place_name
              if (countryName && onCountryClickRef.current) {
                onCountryClickRef.current(countryName)
              }
            })
            .catch(() => {})
        }, 150)
      })
      ;(map as any).__markFeatureClick = () => { featureClickedFlag = true }

      // Mark layers ready AFTER all sources/layers are added
      layersReadyRef.current = true
      // Force re-render so useEffects that depend on layersReadyRef pick up the initial state
      setMapReady(true)
    })

    return () => {
      popupRef.current?.remove()
      markersRef.current.forEach((m) => m.remove())
      map.remove()
      layersReadyRef.current = false
    }
  }, []) // eslint-disable-line

  // ── Update flight GeoJSON ─────────────────────────────────────────────────
  useEffect(() => {
    flightDataRef.current = flights
    if (!mapRef.current || !layersReadyRef.current) return
    const src = mapRef.current.getSource('flights') as mapboxgl.GeoJSONSource | undefined
    src?.setData(buildFlightGeoJSON(flights, filterQuery, filterTypes, showFlights))
  }, [flights, filterQuery, filterTypes, showFlights])

  // ── Update wildfire GeoJSON ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !layersReadyRef.current) return
    const src = mapRef.current.getSource('wildfires') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    if (!showWildfires) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    const features: GeoJSON.Feature[] = fires.map(f => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] },
      properties: {
        frp:        f.frp,
        confidence: f.confidence,
        date:       f.date,
        time:       f.time,
        satellite:  f.satellite,
        daynight:   f.daynight,
        brightness: f.brightness,
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [fires, showWildfires])

  // ── Update vessel GeoJSON ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !layersReadyRef.current) return
    const src = mapRef.current.getSource('vessels') as mapboxgl.GeoJSONSource 
    if (!src) return

    const vis = showVessels ? 'visible' : 'none'
    if (mapRef.current.getLayer('vessel-icons')) {
      mapRef.current.setLayoutProperty('vessel-icons', 'visibility', vis)
    }

    if (!showVessels) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    const features: GeoJSON.Feature[] = vessels.map(v => {
      const vt = v.shipType ? vesselTypeFromCode(v.shipType) : detectVesselType(v.name)
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
        properties: {
          mmsi: v.mmsi,
          name: v.name,
          sog: v.sog,
          cog: v.cog,
          heading: v.heading,
          navStatus: v.navStatus,
          vesselType: vt,
          color: VESSEL_TYPE_COLORS[vt],
          destination: v.destination || '',
        },
      }
    })
    src.setData({ type: 'FeatureCollection', features })
  }, [vessels, showVessels, mapReady])

  // ── Sanctions layer visibility ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showSanctions ? 'visible' : 'none'
    if (map.getLayer('sanctions-fill'))    map.setLayoutProperty('sanctions-fill',    'visibility', vis)
    if (map.getLayer('sanctions-outline')) map.setLayoutProperty('sanctions-outline', 'visibility', vis)
  }, [showSanctions, mapReady])

  // ── Military facilities GeoJSON ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('military') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showMilitary ? 'visible' : 'none'
    if (map.getLayer('military-circles')) map.setLayoutProperty('military-circles', 'visibility', vis)
    if (map.getLayer('military-labels'))  map.setLayoutProperty('military-labels',  'visibility', vis)
    if (!showMilitary) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = MILITARY_FACILITIES.map(f => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
      properties: {
        name:      f.name,
        type:      f.type,
        typeLabel: FACILITY_LABELS[f.type],
        color:     FACILITY_COLORS[f.type],
        operator:  f.operator,
        host:      f.host,
        personnel: f.personnel ?? null,
        status:    f.status,
        notes:     f.notes,
        nuclear:   f.nuclear ?? false,
        since:     f.since ?? null,
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showMilitary, mapReady])

  // ── Ports GeoJSON ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('ports') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showPorts ? 'visible' : 'none'
    if (map.getLayer('port-circles')) map.setLayoutProperty('port-circles', 'visibility', vis)
    if (map.getLayer('port-labels'))  map.setLayoutProperty('port-labels',  'visibility', vis)
    if (!showPorts) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = PORTS.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name:        p.name,
        country:     p.country,
        type:        p.type,
        typeLabel:   PORT_TYPE_LABELS[p.type],
        color:       PORT_TYPE_COLORS[p.type],
        topIndustry: p.topIndustry,
        annualTEU:   p.annualTEU ?? null,
        notes:       p.notes ?? '',
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showPorts, mapReady])

  // ── Gas Pipelines GeoJSON ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('pipelines') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showPipelines ? 'visible' : 'none'
    if (map.getLayer('pipeline-lines'))  map.setLayoutProperty('pipeline-lines',  'visibility', vis)
    if (map.getLayer('pipeline-labels')) map.setLayoutProperty('pipeline-labels', 'visibility', vis)
    if (!showPipelines) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = GAS_PIPELINES.map(p => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: p.path },
      properties: {
        name:           p.name,
        countries:      p.countries,
        status:         p.status,
        statusLabel:    PIPELINE_STATUS_LABELS[p.status],
        color:          PIPELINE_STATUS_COLORS[p.status],
        capacityBcmYr:  p.capacityBcmYr ?? null,
        lengthKm:       p.lengthKm ?? null,
        operator:       p.operator ?? '',
        notes:          p.notes ?? '',
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showPipelines, mapReady])

  // ── Chokepoints GeoJSON ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('chokepoints') as mapboxgl.GeoJSONSource | undefined
    const labelSrc = map.getSource('chokepoint-labels') as mapboxgl.GeoJSONSource | undefined
    if (!src || !labelSrc) return
    const vis = showChokepoints ? 'visible' : 'none'
    if (map.getLayer('chokepoint-zones'))       map.setLayoutProperty('chokepoint-zones',       'visibility', vis)
    if (map.getLayer('chokepoint-borders'))     map.setLayoutProperty('chokepoint-borders',     'visibility', vis)
    if (map.getLayer('chokepoint-label-layer')) map.setLayoutProperty('chokepoint-label-layer', 'visibility', vis)
    if (!showChokepoints) {
      src.setData({ type: 'FeatureCollection', features: [] })
      labelSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    const zoneFeatures: GeoJSON.Feature[] = CHOKEPOINTS.map(c => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [c.zone] },
      properties: {
        name: c.name, dailyTransits: c.dailyTransits,
        pctWorldTrade: c.pctWorldTrade, pctOilTrade: c.pctOilTrade ?? null,
        keyGoods: c.keyGoods.join(', '), risks: c.risks.join(', '),
        controlledBy: c.controlledBy, notes: c.notes ?? '',
      },
    }))
    const labelFeatures: GeoJSON.Feature[] = CHOKEPOINTS.map(c => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { name: c.name },
    }))
    src.setData({ type: 'FeatureCollection', features: zoneFeatures })
    labelSrc.setData({ type: 'FeatureCollection', features: labelFeatures })
  }, [showChokepoints, mapReady])

  // ── Supply Chain Facilities GeoJSON ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('supplychain') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showSupplyChain ? 'visible' : 'none'
    if (map.getLayer('supplychain-circles')) map.setLayoutProperty('supplychain-circles', 'visibility', vis)
    if (map.getLayer('supplychain-labels'))  map.setLayoutProperty('supplychain-labels',  'visibility', vis)
    if (!showSupplyChain) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = SUPPLY_CHAIN_FACILITIES.map(f => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
      properties: {
        name: f.name, type: f.type,
        typeLabel: FACILITY_TYPE_LABELS[f.type],
        color: FACILITY_TYPE_COLORS[f.type],
        operator: f.operator, country: f.country,
        product: f.product, globalShare: f.globalShare ?? null,
        notes: f.notes ?? '',
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showSupplyChain, mapReady])

  // ── Shipping Routes GeoJSON ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('shipping-routes') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showShippingRoutes ? 'visible' : 'none'
    if (map.getLayer('shipping-route-lines'))  map.setLayoutProperty('shipping-route-lines',  'visibility', vis)
    if (map.getLayer('shipping-route-labels')) map.setLayoutProperty('shipping-route-labels', 'visibility', vis)
    if (!showShippingRoutes) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = SHIPPING_ROUTES.map(r => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: r.path },
      properties: {
        name: r.name, color: r.color,
        annualTonnageMt: r.annualTonnageMt,
        keyGoods: r.keyGoods.join(', '),
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showShippingRoutes, mapReady])

  // ── Nuclear power plants GeoJSON ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('nuclear-plants') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showNuclear ? 'visible' : 'none'
    if (map.getLayer('nuclear-circles')) map.setLayoutProperty('nuclear-circles', 'visibility', vis)
    if (map.getLayer('nuclear-labels'))  map.setLayoutProperty('nuclear-labels',  'visibility', vis)
    if (!showNuclear) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = NUCLEAR_PLANTS.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name:     p.name,
        country:  p.country,
        reactors: p.reactors,
        capacity: p.capacity,
        status:   p.status,
        type:     p.type,
        notes:    p.notes,
        since:    p.since ?? null,
        color:    PLANT_STATUS_COLORS[p.status],
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showNuclear, mapReady])

  // ── Airspace closure overlay ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showAirspace ? 'visible' : 'none'
    if (map.getLayer('airspace-fill'))  map.setLayoutProperty('airspace-fill',  'visibility', vis)
    if (map.getLayer('airspace-lines')) map.setLayoutProperty('airspace-lines', 'visibility', vis)
    if (!showAirspace) return
    const { statuses } = analyzeAirspace(flights)
    const src = map.getSource('airspace-fir') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const features: GeoJSON.Feature[] = FIR_REGIONS.map(fir => {
      const s = statuses.find(x => x.icao === fir.icao)
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [fir.minLng, fir.minLat], [fir.maxLng, fir.minLat],
            [fir.maxLng, fir.maxLat], [fir.minLng, fir.maxLat],
            [fir.minLng, fir.minLat],
          ]],
        },
        properties: {
          icao: fir.icao, name: fir.name,
          status: s?.status ?? 'normal',
          baseline: fir.baseline,
        },
      }
    })
    src.setData({ type: 'FeatureCollection', features })
  }, [flights, showAirspace])

  // ── Critical Infrastructure GeoJSON ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const infraSrc    = map.getSource('infrastructure') as mapboxgl.GeoJSONSource | undefined
    const pipelineSrc = map.getSource('pipelines')      as mapboxgl.GeoJSONSource | undefined
    if (!infraSrc || !pipelineSrc) return
    const vis = showInfrastructure ? 'visible' : 'none'
    if (map.getLayer('infra-circles')) map.setLayoutProperty('infra-circles', 'visibility', vis)
    if (map.getLayer('infra-labels'))  map.setLayoutProperty('infra-labels',  'visibility', vis)
    if (map.getLayer('pipeline-lines'))map.setLayoutProperty('pipeline-lines','visibility', vis)
    if (!showInfrastructure) {
      infraSrc.setData({ type: 'FeatureCollection', features: [] })
      pipelineSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    // Populate infra points
    const infraFeatures: GeoJSON.Feature[] = ALL_INFRA_POINTS.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name:      p.name,
        type:      p.type,
        typeLabel: INFRA_LABELS[p.type],
        color:     INFRA_COLORS[p.type],
        icon:      INFRA_ICONS[p.type],
        country:   p.country,
        capacity:  p.capacity  ?? null,
        river:     p.river     ?? null,
        notes:     p.notes     ?? null,
        status:    p.status,
      },
    }))
    infraSrc.setData({ type: 'FeatureCollection', features: infraFeatures })
    // Populate pipelines
    const PIPE_COLORS: Record<string, string> = { oil: '#ff6600', gas: '#ffdd00', multi: '#ff8800' }
    const pipeFeatures: GeoJSON.Feature[] = PIPELINE_ROUTES.map(r => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: r.coords },
      properties: {
        name:     r.name, type: r.type, from: r.from, to: r.to,
        capacity: r.capacity ?? null, notes: r.notes ?? null, status: r.status,
        color:    PIPE_COLORS[r.type] ?? '#ff8800',
      },
    }))
    pipelineSrc.setData({ type: 'FeatureCollection', features: pipeFeatures })
  }, [showInfrastructure, mapReady])

  // ── Humanitarian (UNHCR) layers ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const HUM_LAYERS = [
      'humanitarian-offices', 'humanitarian-offices-labels',
      'humanitarian-crossing-path-glow', 'humanitarian-crossing-path', 'humanitarian-crossing-gate',
      'humanitarian-crossings', 'humanitarian-crossings-labels',
      'humanitarian-camps', 'humanitarian-camps-labels',
      'humanitarian-choropleth', 'humanitarian-choropleth-line',
      'humanitarian-heatmap',
      'humanitarian-flows', 'humanitarian-flows-labels',
      'humanitarian-cluster-circles', 'humanitarian-cluster-pulse',
      'humanitarian-cluster-count',
    ]
    const vis = showHumanitarian ? 'visible' : 'none'
    HUM_LAYERS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis) })
    if (!showHumanitarian) {
      ;(['humanitarian-offices', 'humanitarian-crossings', 'humanitarian-crossing-paths', 'humanitarian-crossing-gates', 'humanitarian-camps',
        'humanitarian-heatmap', 'humanitarian-flows', 'humanitarian-clusters',
      ] as const).forEach(srcId => {
        const src = map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined
        src?.setData({ type: 'FeatureCollection', features: [] })
      })
      return
    }

    // Populate offices
    const officesSrc = map.getSource('humanitarian-offices') as mapboxgl.GeoJSONSource | undefined
    officesSrc?.setData({
      type: 'FeatureCollection',
      features: UNHCR_OFFICES.map(o => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [o.lng, o.lat] },
        properties: { name: o.name, city: o.city, country: o.country, officeType: o.type, color: OFFICE_TYPE_COLORS[o.type] },
      })),
    })

    // Populate crossings
    const crossSrc = map.getSource('humanitarian-crossings') as mapboxgl.GeoJSONSource | undefined
    crossSrc?.setData({
      type: 'FeatureCollection',
      features: BORDER_CROSSINGS.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { name: c.name, country1: c.country1, country2: c.country2, status: c.status, statusColor: CROSSING_STATUS_COLORS[c.status] },
      })),
    })

    // Populate exact crossing paths — a short geodesic segment along the true
    // crossing axis (country1 → country2), plus a perpendicular gate tick at the border.
    const CROSSING_HALF_LEN_KM = 1.4
    const GATE_HALF_LEN_KM = 0.55
    const pathSrc  = map.getSource('humanitarian-crossing-paths') as mapboxgl.GeoJSONSource | undefined
    const gateSrc  = map.getSource('humanitarian-crossing-gates') as mapboxgl.GeoJSONSource | undefined
    pathSrc?.setData({
      type: 'FeatureCollection',
      features: BORDER_CROSSINGS.map(c => {
        const from = destinationPoint(c.lng, c.lat, (c.bearing + 180) % 360, CROSSING_HALF_LEN_KM)
        const to   = destinationPoint(c.lng, c.lat, c.bearing, CROSSING_HALF_LEN_KM)
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: [from, [c.lng, c.lat], to] },
          properties: { name: c.name, country1: c.country1, country2: c.country2, status: c.status, statusColor: CROSSING_STATUS_COLORS[c.status] },
        }
      }),
    })
    gateSrc?.setData({
      type: 'FeatureCollection',
      features: BORDER_CROSSINGS.map(c => {
        const perp = (c.bearing + 90) % 360
        const from = destinationPoint(c.lng, c.lat, perp, GATE_HALF_LEN_KM)
        const to   = destinationPoint(c.lng, c.lat, (perp + 180) % 360, GATE_HALF_LEN_KM)
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: [from, to] },
          properties: { name: c.name, status: c.status, statusColor: CROSSING_STATUS_COLORS[c.status] },
        }
      }),
    })

    // Populate camps
    const campSrc = map.getSource('humanitarian-camps') as mapboxgl.GeoJSONSource | undefined
    const campColor = (type: string) => {
      if (type === 'camp')       return '#00ff88'
      if (type === 'settlement') return '#00ff88'
      if (type === 'poc_site')   return '#ffdd00'
      if (type === 'transit')    return '#ffaa00'
      return '#8844ff'
    }
    campSrc?.setData({
      type: 'FeatureCollection',
      features: REFUGEE_CAMPS.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { name: c.name, country: c.country, pop: c.population, campType: c.type, notes: c.notes ?? null, color: campColor(c.type) },
      })),
    })

    // Populate heatmap (same camp data, weighted by population)
    const heatSrc = map.getSource('humanitarian-heatmap') as mapboxgl.GeoJSONSource | undefined
    heatSrc?.setData({
      type: 'FeatureCollection',
      features: REFUGEE_CAMPS.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { pop: c.population },
      })),
    })

    // Populate flow lines (great-circle arcs approximated as LineStrings)
    const flowSrc = map.getSource('humanitarian-flows') as mapboxgl.GeoJSONSource | undefined
    flowSrc?.setData({
      type: 'FeatureCollection',
      features: REFUGEE_FLOWS.map(f => {
        // Generate curved arc with 40 interpolated points
        const [oLng, oLat] = f.origin
        const [dLng, dLat] = f.dest
        const coords: [number, number][] = []
        for (let i = 0; i <= 40; i++) {
          const t = i / 40
          const lng = oLng + (dLng - oLng) * t
          const lat = oLat + (dLat - oLat) * t
          // Add vertical arc bulge proportional to distance
          const dist = Math.sqrt((dLng - oLng) ** 2 + (dLat - oLat) ** 2)
          const bulge = Math.sin(t * Math.PI) * dist * 0.15
          coords.push([lng, lat + bulge])
        }
        // Color by count: blue→yellow→red
        const t = Math.min(1, f.count / 4_000_000)
        const r = Math.round(t < 0.5 ? 255 * t * 2 : 255)
        const g = Math.round(t < 0.5 ? 200 : 255 * (1 - (t - 0.5) * 2))
        const b = Math.round(t < 0.5 ? 255 * (1 - t * 2) : 0)
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: coords },
          properties: { label: f.label, count: f.count, color: `rgb(${r},${g},${b})` },
        }
      }),
    })

    // Populate clustered source (camps + offices merged)
    const clusterSrc = map.getSource('humanitarian-clusters') as mapboxgl.GeoJSONSource | undefined
    const allPoints: GeoJSON.Feature[] = [
      ...REFUGEE_CAMPS.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { name: c.name, pop: c.population, kind: 'camp' },
      })),
      ...UNHCR_OFFICES.map(o => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [o.lng, o.lat] },
        properties: { name: o.name, pop: 1000, kind: 'office' },
      })),
    ]
    clusterSrc?.setData({ type: 'FeatureCollection', features: allPoints })
  }, [showHumanitarian, mapReady])

  // ── Animate flow-line dashes & cluster pulse ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !showHumanitarian) return
    let frame = 0
    let raf: number
    const animate = () => {
      frame++
      // Pulse the cluster outer ring opacity
      if (map.getLayer('humanitarian-cluster-pulse')) {
        const pulse = 0.3 + Math.sin(frame * 0.04) * 0.2
        map.setPaintProperty('humanitarian-cluster-pulse', 'circle-stroke-opacity', pulse)
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [showHumanitarian, mapReady])

  // ── Oil & Gas 3D bars update (separate layers, side by side) ─────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return

    const eitherOn = showOil || showGas

    // Toggle visibility per layer
    for (const kind of ['oil', 'gas'] as const) {
      const on = kind === 'oil' ? showOil : showGas
      const vis = on ? 'visible' : 'none'
      if (map.getLayer(`${kind}-extrusion`)) map.setLayoutProperty(`${kind}-extrusion`, 'visibility', vis)
      if (map.getLayer(`${kind}-labels`)) map.setLayoutProperty(`${kind}-labels`, 'visibility', vis)
      if (!on) {
        const src = map.getSource(`${kind}-bars`) as mapboxgl.GeoJSONSource | undefined
        if (src) src.setData({ type: 'FeatureCollection', features: [] })
      }
    }

    if (!eitherOn) return

    // fill-extrusion doesn't render on globe projection — switch to mercator
    if ((map.getProjection?.()?.name ?? map.getProjection?.()) === 'globe') {
      map.setProjection('mercator')
    }
    // Tilt map for 3D view
    if (map.getPitch() < 30) {
      map.easeTo({ pitch: 45, duration: 800 })
    }

    // Both bars shown side-by-side need to know if the other is also on
    const bothOn = showOil && showGas
    // Offset: when both are on, shift oil left and gas right by 0.45°
    const offset = bothOn ? 0.45 : 0

    function buildFeatures(metric: OilGasMetric, side: 'left' | 'right' | 'center'): GeoJSON.Feature[] {
      const maxVal = getMaxValue(metric)
      if (maxVal === 0) return []
      const barWidth = bothOn ? 0.3 : 0.4
      const lngShift = side === 'left' ? -offset : side === 'right' ? offset : 0

      return OIL_GAS_DATA
        .filter(c => c[metric] > 0)
        .map(c => {
          const val = c[metric]
          const normalised = Math.log10(val + 1) / Math.log10(maxVal + 1)
          const height = normalised * 500000
          const lng = c.lng + lngShift
          const lat = c.lat
          const s = barWidth
          const ring: [number, number][] = [
            [lng - s, lat - s], [lng + s, lat - s],
            [lng + s, lat + s], [lng - s, lat + s],
            [lng - s, lat - s],
          ]
          return {
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [ring] },
            properties: {
              iso2: c.iso2, name: c.name, value: val, height,
              color: METRIC_COLORS[metric],
              label: `${c.iso2} ${formatValue(val, metric)}`,
              region: c.region,
            },
          }
        })
    }

    if (showOil) {
      const src = map.getSource('oil-bars') as mapboxgl.GeoJSONSource | undefined
      if (src) src.setData({ type: 'FeatureCollection', features: buildFeatures('oilReserves', bothOn ? 'left' : 'center') })
    }
    if (showGas) {
      const src = map.getSource('gas-bars') as mapboxgl.GeoJSONSource | undefined
      if (src) src.setData({ type: 'FeatureCollection', features: buildFeatures('gasReserves', bothOn ? 'right' : 'center') })
    }
  }, [showOil, showGas, mapReady])

  // ── GPS Jamming zones update ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('gpsjam') as mapboxgl.GeoJSONSource | undefined
    const areaSrc = map.getSource('gpsjam-areas') as mapboxgl.GeoJSONSource | undefined
    if (!src || !areaSrc) return

    const vis = showGPSJam ? 'visible' : 'none'
    for (const lid of ['gpsjam-heat', 'gpsjam-circles', 'gpsjam-labels', 'gpsjam-fill', 'gpsjam-outline']) {
      if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', vis)
    }

    if (!showGPSJam) {
      src.setData({ type: 'FeatureCollection', features: [] })
      areaSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    // Helper: generate a GeoJSON polygon circle from center + radius in km
    function makeCircle(lng: number, lat: number, radiusKm: number, steps = 64): GeoJSON.Polygon {
      const coords: [number, number][] = []
      const earthRadiusKm = 6371
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI
        const dLat = (radiusKm / earthRadiusKm) * (180 / Math.PI) * Math.cos(angle)
        const dLng = (radiusKm / earthRadiusKm) * (180 / Math.PI) * Math.sin(angle) / Math.cos(lat * Math.PI / 180)
        coords.push([lng + dLng, lat + dLat])
      }
      return { type: 'Polygon', coordinates: [coords] }
    }

    // Point features (for labels, heatmap, center dots)
    const pointFeatures: GeoJSON.Feature[] = GPS_JAM_ZONES.map(z => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
      properties: {
        id: z.id, name: z.name, severity: z.severity, type: z.type,
        typeLabel: TYPE_LABELS[z.type], color: SEVERITY_COLORS[z.severity],
        radius: z.radius, source: z.source, region: z.region, notes: z.notes, active: z.active,
      },
    }))

    // Polygon features (actual coverage areas)
    const areaFeatures: GeoJSON.Feature[] = GPS_JAM_ZONES.map(z => ({
      type: 'Feature' as const,
      geometry: makeCircle(z.lng, z.lat, z.radius),
      properties: {
        id: z.id, name: z.name, severity: z.severity,
        color: SEVERITY_COLORS[z.severity], radius: z.radius,
        typeLabel: TYPE_LABELS[z.type], source: z.source,
        region: z.region, notes: z.notes, active: z.active,
      },
    }))

    src.setData({ type: 'FeatureCollection', features: pointFeatures })
    areaSrc.setData({ type: 'FeatureCollection', features: areaFeatures })
  }, [showGPSJam, mapReady])

  // ── Resize Mapbox when deepstate split activates / deactivates ───────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Resize multiple times during the 250ms flex transition so the canvas keeps up
    const timers = [0, 50, 150, 300].map(ms =>
      setTimeout(() => { map.resize() }, ms)
    )
    // Also listen for transitionend as a final resize
    const container = containerRef.current
    const onEnd = () => { map.resize() }
    container?.addEventListener('transitionend', onEnd)
    return () => {
      timers.forEach(clearTimeout)
      container?.removeEventListener('transitionend', onEnd)
    }
  }, [deepstateMode])

  // ── EarthCam CCTV camera markers ──────────────────────────────────────────
  const cameraMarkersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
    cameraMarkersRef.current.forEach(m => m.remove())
    cameraMarkersRef.current = []
    if (!showCameras) return

    // Wait for map to be ready
    const add = () => {
      const allCameras: LiveCamera[] = [...EARTHCAM_CAMERAS, ...registerUSWebcams()]
      allCameras.forEach(cam => {
        const el = document.createElement('div')
        el.title = `${cam.name} — ${cam.city}, ${cam.country}`
        el.style.cssText = [
          'width:18px', 'height:18px', 'cursor:pointer',
          'background:rgba(0,255,136,0.12)', 'border:1px solid #00ff8899',
          'border-radius:2px', 'display:flex', 'align-items:center',
          'justify-content:center', 'font-size:10px', 'line-height:1',
          'box-shadow:0 0 6px rgba(0,255,136,0.35)',
          'transition:all .15s',
        ].join(';')
        el.textContent = '📷'

        el.addEventListener('mouseenter', () => {
          el.style.background = 'rgba(0,255,136,0.28)'
          el.style.boxShadow  = '0 0 12px rgba(0,255,136,0.7)'
        })
        el.addEventListener('mouseleave', () => {
          el.style.background = 'rgba(0,255,136,0.12)'
          el.style.boxShadow  = '0 0 6px rgba(0,255,136,0.35)'
        })

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          ;(map as any).__markFeatureClick?.()
          // Fly to camera location
          map.flyTo({ center: [cam.lng, cam.lat], zoom: 14, pitch: 45, duration: 1500 })

          // Show camera info popup — opens live feed in new window (iframe blocked by source)
          const html = `<div style="padding:0;font-family:'Inter',-apple-system,sans-serif;width:260px;">
            <div style="padding:8px 10px;">
              <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:2px;">📷 ${cam.name}</div>
              <div style="font-size:10px;color:#6b7280;margin-bottom:6px;">${cam.city}, ${cam.country}</div>
              <div style="font-size:9px;color:#9ca3af;margin-bottom:8px;font-family:monospace;">${cam.lat.toFixed(4)}, ${cam.lng.toFixed(4)}</div>
              <a href="${cam.url}" target="_blank" rel="noopener"
                style="display:block;text-align:center;font-size:10px;font-weight:700;color:#16a34a;text-decoration:none;border:1px solid #16a34a44;padding:5px 0;background:rgba(22,163,74,0.08);letter-spacing:.06em;">
                OPEN LIVE FEED ↗
              </a>
            </div>
          </div>`
          if (popupRef.current) popupRef.current.remove()
          popupRef.current = new mapboxgl.Popup({ maxWidth: '400px', className: 'cy-popup cam-popup', closeButton: true })
            .setLngLat([cam.lng, cam.lat])
            .setHTML(html)
            .addTo(map)
        })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center', draggable: false })
          .setLngLat([cam.lng, cam.lat])
          .addTo(map)
        cameraMarkersRef.current.push(marker)
      })
    }

    if (map.loaded()) add()
    else map.once('load', add)

    return () => {
      cameraMarkersRef.current.forEach(m => m.remove())
      cameraMarkersRef.current = []
    }
  }, [showCameras, mapReady])

  // ── Vision mode → CSS filter on canvas + multi-layer overlays + 3D city ───
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const canvas = map.getCanvas()
    if (canvas) canvas.style.filter = CANVAS_FILTERS[viewMode] || ''

    const container = containerRef.current
    if (container) {
      // Clean up previous overlays
      container.querySelectorAll('.sv-vision-overlay, .sv-scanlines, .sv-noise').forEach(el => {
        const raf = (el as HTMLElement).dataset.raf
        if (raf) cancelAnimationFrame(Number(raf))
        el.remove()
      })

      const cfg = VISION_OVERLAYS[viewMode]
      if (cfg) {
        // Stack multiple overlay layers for realistic composite
        for (const layer of cfg.layers) {
          const el = document.createElement('div')
          el.className = 'sv-vision-overlay'
          el.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:5;transition:opacity .3s;`
          if (layer.background) el.style.background = layer.background
          if (layer.boxShadow)  el.style.boxShadow = layer.boxShadow
          if (layer.mixBlendMode) el.style.mixBlendMode = layer.mixBlendMode
          el.style.opacity = String(layer.opacity ?? 1)
          container.appendChild(el)
        }

        // CRT phosphor scan lines (nightvision)
        if (cfg.scanlines) {
          const sl = document.createElement('div')
          sl.className = 'sv-scanlines'
          sl.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:6;
            background:repeating-linear-gradient(
              to bottom,
              transparent 0px, transparent 1.5px,
              rgba(0,20,0,0.15) 1.5px, rgba(0,20,0,0.15) 3px
            );opacity:0.6;`
          container.appendChild(sl)
        }

        // Animated sensor noise grain
        if (cfg.noise) {
          const ns = document.createElement('div')
          ns.className = 'sv-noise'
          ns.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:7;
            opacity:${cfg.noise.opacity};mix-blend-mode:${cfg.noise.blend};
            background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
            background-size:128px 128px;`
          let frame = 0
          const animNoise = () => {
            frame = (frame + 1) % 128
            ns.style.backgroundPosition = `${frame}px ${(frame * 0.7) | 0}px`
            ns.dataset.raf = String(requestAnimationFrame(animNoise))
          }
          animNoise()
          container.appendChild(ns)
        }
      }
    }

    // 3D city view: tilt + show building extrusions
    if (viewMode === 'city3d') {
      map.easeTo({ pitch: 55, duration: 800 })
      if (map.getLayer('3d-buildings')) {
        map.setLayoutProperty('3d-buildings', 'visibility', 'visible')
      }
    } else {
      map.easeTo({ pitch: 0, duration: 600 })
      if (map.getLayer('3d-buildings')) {
        map.setLayoutProperty('3d-buildings', 'visibility', 'none')
      }
    }

    return () => {
      // Cleanup animated noise RAF
      if (container) {
        container.querySelectorAll('.sv-noise').forEach(el => {
          const raf = (el as HTMLElement).dataset.raf
          if (raf) cancelAnimationFrame(Number(raf))
        })
        container.querySelectorAll('.sv-vision-overlay, .sv-scanlines, .sv-noise').forEach(el => el.remove())
      }
    }
  }, [viewMode])

  // ── Crisis / earthquake markers ───────────────────────────────────────────
  const buildCrisisMarkers = useCallback(() => {
    const map = mapRef.current
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    if (!map || !showCrises) return

    const addMarker = (el: HTMLElement, lng: number, lat: number, popupHTML: string) => {
      const popup = new mapboxgl.Popup({ maxWidth: '260px', className: 'cy-popup', offset: 8 })
        .setHTML(popupHTML)
      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map)
      markersRef.current.push(m)
    }

    crises.forEach((c) => {
      const color = CRISIS_COLORS[c.type] || '#ff6600'
      const size  = SEV_SIZE[c.severity]  || 8
      const el    = document.createElement('div')
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:1px solid rgba(255,255,255,0.3);cursor:pointer;box-shadow:0 0 ${size + 4}px ${color}66;`
      const popup = `<div style="padding:9px;font-family:'Inter',-apple-system,sans-serif;font-size:11px;color:#14161a;line-height:1.5;">
        <b style="color:${color};font-size:13px;">${c.title}</b><br>
        <span style="color:#6b7280;font-size:10px;letter-spacing:.1em;">${c.country} · ${new Date(c.date).toLocaleDateString()}</span>
        ${c.fatalities ? `<br><span style="color:#dc2626;">⚠ ${c.fatalities} fatalities</span>` : ''}
        ${c.description ? `<br><span style="opacity:.85;font-size:10px;">${c.description.slice(0,140)}…</span>` : ''}
        <br><span style="color:#9ca3af;font-size:10px;">src: ${c.source}</span></div>`
      el.addEventListener('click', () => onCrisisClick(c))
      addMarker(el, c.longitude, c.latitude, popup)
    })

    earthquakes.forEach((eq) => {
      const mag   = eq.magnitude
      const size  = Math.max(8, Math.min(26, mag * 3.3))
      const color = mag >= 7 ? '#ff0022' : mag >= 6 ? '#ff6600' : mag >= 5 ? '#ffcc00' : '#88aaff'
      const el    = document.createElement('div')
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${color};background:transparent;cursor:pointer;box-shadow:0 0 ${size}px ${color}44;`
      const popup = `<div style="padding:9px;font-family:'Inter',-apple-system,sans-serif;font-size:11px;color:#14161a;">
        <b style="color:${color};">M${mag.toFixed(1)} Earthquake</b><br>
        ${eq.place}<br>
        <span style="color:#6b7280;font-size:10px;">${new Date(eq.time).toLocaleString()} · Depth: ${eq.depth}km</span></div>`
      addMarker(el, eq.longitude, eq.latitude, popup)
    })

    if (showNews) {
      newsArticles.filter((a) => a.latitude && a.longitude).forEach((a) => {
        const el = document.createElement('div')
        el.style.cssText = 'width:7px;height:7px;background:#aa44ff;transform:rotate(45deg);box-shadow:0 0 4px #aa44ff66;cursor:pointer;'
        addMarker(el, a.longitude!, a.latitude!, `<div style="padding:8px;font-family:'Inter',-apple-system,sans-serif;font-size:11px;color:#14161a;max-width:220px;">${a.title}</div>`)
      })
    }

    if (showStocks) {
      MARKET_HUBS.forEach((hub) => {
        const el = document.createElement('div')
        el.style.cssText = 'padding:1px 5px;background:rgba(0,136,255,0.15);border:1px solid #0088ff55;color:#00ff88;font-family:monospace;font-size:8px;font-weight:700;white-space:nowrap;cursor:default;'
        el.textContent = hub.exchange
        const m = new mapboxgl.Marker({ element: el }).setLngLat([hub.lng, hub.lat]).addTo(mapRef.current!)
        markersRef.current.push(m)
      })
    }
  }, [crises, earthquakes, newsArticles, showCrises, showNews, showStocks, onCrisisClick])

  useEffect(() => { buildCrisisMarkers() }, [buildCrisisMarkers])

  if (!TOKEN) {
    return (
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#080e13', flexDirection:'column', gap:12, fontFamily:'monospace', fontSize:11, color:'#98aab4' }}>
        <div style={{ fontSize:14, color:'#d5a85f' }}>◆ MAPBOX TOKEN REQUIRED</div>
        <div style={{ color:'#647883', fontSize:9, letterSpacing:'.1em' }}>Add VITE_MAPBOX_TOKEN to .env</div>
      </div>
    )
  }

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', overflow:'hidden' }}>

      {/* ── LEFT: Mapbox map ────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          flex: deepstateMode ? '0 0 50%' : '1',
          height: '100%',
          overflow: 'hidden',
          transition: 'flex-basis .25s ease',
        }}
      >

      {/* ── Flight filter flyout (only when flights enabled) ──────────── */}
      {showFlights && !deepstateMode && (
        <div style={{ position:'absolute', top:52, left:10, zIndex:30 }}>
          {/* Toggle button */}
          <button
            onClick={() => setShowFilter(v => !v)}
            style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'3px 10px', fontSize:8.5, fontWeight:700,
              letterSpacing:'.14em', textTransform:'uppercase',
              border:`1px solid ${showFilter ? 'rgba(105,201,167,.55)' : '#263843'}`,
              background: showFilter ? 'rgba(105,201,167,.10)' : 'rgba(9,16,22,.9)',
              color: showFilter ? '#69c9a7' : '#c0cbd0',
              cursor:'pointer', transition:'all .15s', fontFamily:'monospace',
              backdropFilter:'blur(8px)',
            }}
          >
            ✈ FILTER
            <span style={{ fontSize:7, color: showFilter ? '#9ad9c2' : '#7c909a', fontVariantNumeric:'tabular-nums' }}>
              {filteredCount.toLocaleString()}
            </span>
          </button>

          {/* Flyout panel */}
          {showFilter && (
            <div style={{
              marginTop:3,
              background:'rgba(9,16,22,0.97)',
              border:'1px solid #263843', borderLeft:'2px solid rgba(105,201,167,.55)',
              backdropFilter:'blur(10px)',
              width:230,
              boxShadow:'0 4px 20px rgba(0,0,0,0.7)',
            }}>
              {/* Search input */}
              <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 8px', borderBottom:'1px solid #263843' }}>
                <span style={{ fontSize:9, color:'#7c909a', flexShrink:0 }}>⌕</span>
                <input
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  placeholder="callsign · country · icao24"
                  style={{
                    flex:1, background:'transparent', border:'none', outline:'none',
                    fontSize:9, color:'#e5ecef', fontFamily:'monospace', letterSpacing:'.03em',
                  }}
                />
                {filterQuery && (
                  <button onClick={() => setFilterQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#98aab4', fontSize:10, padding:0 }}>×</button>
                )}
              </div>

              {/* Type filters with count badges */}
              <div style={{ padding:'5px 8px', borderBottom:'1px solid #263843' }}>
                <div style={{ fontSize:7, color:'#7c909a', letterSpacing:'.15em', marginBottom:4 }}>// TYPE</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  <button onClick={() => setFilterTypes(new Set(ALL_TYPES))}
                    style={{ padding:'2px 6px', fontSize:7.5, fontWeight:700, letterSpacing:'.1em', border:'1px solid #31434d', background:'rgba(255,255,255,0.04)', color:'#c0cbd0', cursor:'pointer' }}>
                    ALL
                  </button>
                  {ALL_TYPES.map(type => {
                    const on    = filterTypes.has(type)
                    const color = FLIGHT_TYPE_COLORS[type]
                    const icon  = type === 'passenger' ? '✈' : type === 'cargo' ? '▣' : type === 'military' ? '⚔' : type === 'private' ? '◆' : '?'
                    const label = type === 'passenger' ? 'PAX' : type === 'cargo' ? 'CGO' : type === 'military' ? 'MIL' : type === 'private' ? 'PVT' : 'UNK'
                    const count = typeCounts[type] || 0
                    return (
                      <button key={type} onClick={() => toggleType(type)} style={{
                        display:'flex', alignItems:'center', gap:3,
                        padding:'2px 6px', fontSize:7.5, fontWeight:700, letterSpacing:'.08em',
                        border:`1px solid ${on ? color + '66' : '#263843'}`,
                        background: on ? color + '18' : 'transparent',
                        color: on ? color : '#7c909a', cursor:'pointer', transition:'all .12s',
                      }}>
                        {icon} {label}
                        <span style={{ fontSize:7, opacity:.7, fontVariantNumeric:'tabular-nums' }}>{count.toLocaleString()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Size shortcuts */}
              <div style={{ padding:'5px 8px', borderBottom:'1px solid #263843' }}>
                <div style={{ fontSize:7, color:'#7c909a', letterSpacing:'.15em', marginBottom:4 }}>// SIZE</div>
                <div style={{ display:'flex', gap:3 }}>
                  {SIZE_GROUPS.map(g => {
                    const on = g.types.every(t => filterTypes.has(t))
                    return (
                      <button key={g.label} onClick={() => setFilterTypes(new Set(g.types))} style={{
                        padding:'2px 7px', fontSize:7.5, fontWeight:700, letterSpacing:'.08em',
                        border:`1px solid ${on ? g.color + '55' : '#263843'}`,
                        background: on ? g.color + '14' : 'transparent',
                        color: on ? g.color : '#7c909a', cursor:'pointer', transition:'all .12s',
                      }}>
                        {g.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Distribution bars */}
              <div style={{ padding:'5px 8px 7px' }}>
                {ALL_TYPES.map(type => {
                  const count = typeCounts[type] || 0
                  const pct   = flights.length ? (count / flights.length) * 100 : 0
                  const color = FLIGHT_TYPE_COLORS[type]
                  const on    = filterTypes.has(type)
                  return (
                    <div key={type} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3, opacity: on ? 1 : 0.35 }}>
                      <div style={{ width:4, height:4, background:color, flexShrink:0 }} />
                      <span style={{ fontSize:7, color:'#98aab4', width:22, letterSpacing:'.06em', flexShrink:0, textTransform:'uppercase' }}>{type.slice(0,3)}</span>
                      <div style={{ flex:1, height:2, background:'#263843', position:'relative', borderRadius:1 }}>
                        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`, background:color, opacity:.6, transition:'width .5s', borderRadius:1 }} />
                      </div>
                      <span style={{ fontSize:7, color:'#7c909a', width:28, textAlign:'right', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{count.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Overlay layer toggles (below flight filter) ────────────────── */}
      {!deepstateMode && panelState && onToggleLayer && (
        <div style={{ position:'absolute', top: showFlights ? 82 : 52, left:10, zIndex:29 }}
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => setShowOverlays(v => !v)}
            style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'3px 10px', fontSize:8.5, fontWeight:700,
              letterSpacing:'.14em', textTransform:'uppercase',
              border:`1px solid ${showOverlays ? 'rgba(213,168,95,.58)' : '#263843'}`,
              background: showOverlays ? 'rgba(213,168,95,.10)' : 'rgba(9,16,22,.9)',
              color: showOverlays ? '#d5a85f' : '#c0cbd0',
              cursor:'pointer', transition:'all .15s', fontFamily:'monospace',
              backdropFilter:'blur(8px)',
            }}
          >
            ◈ OVERLAYS
            <span style={{ fontSize:7, color: showOverlays ? '#e5c997' : '#7c909a' }}>
              {Object.values(panelState).filter(Boolean).length}
            </span>
          </button>

          {showOverlays && (
            <div style={{
              marginTop:3,
              background:'rgba(9,16,22,0.97)',
              border:'1px solid #263843', borderLeft:'2px solid rgba(213,168,95,.58)',
              backdropFilter:'blur(10px)',
              width:200,
              boxShadow:'0 4px 20px rgba(0,0,0,0.7)',
              maxHeight: 360, overflowY: 'auto',
            }}>
              {([
                { key: 'flights',        label: 'FLIGHTS',        icon: '✈', color: '#00ff88' },
                { key: 'crises',         label: 'CRISES',         icon: '⚠', color: '#ff6600' },
                { key: 'vessels',        label: 'VESSELS',        icon: '⚓', color: '#00aaff' },
                { key: 'wildfires',      label: 'WILDFIRES',      icon: '🔥', color: '#ff4400' },
                { key: 'news',           label: 'NEWS',           icon: '◉', color: '#cccccc' },
                { key: 'stocks',         label: 'MARKETS',        icon: '$', color: '#00ff88' },
                { key: 'military',       label: 'MILITARY',       icon: '⚔', color: '#ff2244' },
                { key: 'nuclear',        label: 'NUCLEAR',        icon: '☢', color: '#ffcc00' },
                { key: 'sanctions',      label: 'SANCTIONS',      icon: '⛔', color: '#ff3344' },
                { key: 'cameras',        label: 'CAMERAS',        icon: '◎', color: '#aa88ff' },
                { key: 'infrastructure', label: 'INFRA',          icon: '⚡', color: '#ff8800' },
                { key: 'airspace',       label: 'AIRSPACE',       icon: '◇', color: '#44aaff' },
                { key: 'humanitarian',   label: 'HUMANITARIAN',   icon: '♥', color: '#ff6688' },
                { key: 'oil',            label: 'OIL',             icon: '▲', color: '#ff6600' },
                { key: 'gas',            label: 'GAS',             icon: '▲', color: '#00aaff' },
                { key: 'ports',          label: 'PORTS',          icon: '⚓', color: '#00ccff' },
                { key: 'pipelines',      label: 'PIPELINES',      icon: '═', color: '#44ddaa' },
                { key: 'gpsjam',         label: 'GPS JAM',        icon: '◌', color: '#ff3344' },
                { key: 'chokepoints',    label: 'CHOKEPOINTS',    icon: '⊘', color: '#ff4466' },
                { key: 'supplychain',    label: 'SUPPLY CHAIN',   icon: '◆', color: '#00ccff' },
                { key: 'shippingRoutes', label: 'SHIPPING',       icon: '≈', color: '#44ff88' },
              ] as { key: keyof import('../../types').PanelState; label: string; icon: string; color: string }[]).map(item => {
                const on = panelState[item.key]
                return (
                  <button
                    key={item.key}
                    onClick={(e) => { e.stopPropagation(); onToggleLayer(item.key) }}
                    style={{
                      display:'flex', alignItems:'center', gap:6, width:'100%',
                      padding:'5px 8px', fontSize:8, fontWeight:600,
                      letterSpacing:'.08em', textAlign:'left',
                      border:'none', borderBottom:'1px solid #1c2b35',
                      background: on ? item.color + '0c' : 'transparent',
                      color: on ? item.color : '#98aab4',
                      cursor:'pointer', transition:'all .12s', fontFamily:'monospace',
                    }}
                    onMouseEnter={e => { if (!on) (e.currentTarget as HTMLButtonElement).style.color = '#e5ecef' }}
                    onMouseLeave={e => { if (!on) (e.currentTarget as HTMLButtonElement).style.color = '#98aab4' }}
                  >
                    <span style={{ width:14, textAlign:'center', fontSize:9 }}>{item.icon}</span>
                    <span style={{ flex:1 }}>{item.label}</span>
                    <span style={{
                      width:6, height:6, borderRadius:'50%',
                      background: on ? item.color : '#263843',
                      border: `1px solid ${on ? item.color + '88' : '#31434d'}`,
                      transition:'all .15s',
                    }} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Targeting reticle ─────────────────────────────────────────── */}
      {showReticle && !deepstateMode && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:88, height:88, pointerEvents:'none', zIndex:10 }}>
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="41" fill="none" stroke={reticleColor} strokeWidth=".5" opacity=".3"/>
            <circle cx="44" cy="44" r="3"  fill="none" stroke={reticleColor} strokeWidth=".8" opacity=".65"/>
            <line x1="0"  y1="44" x2="32" y2="44" stroke={reticleColor} strokeWidth=".5" opacity=".45"/>
            <line x1="56" y1="44" x2="88" y2="44" stroke={reticleColor} strokeWidth=".5" opacity=".45"/>
            <line x1="44" y1="0"  x2="44" y2="32" stroke={reticleColor} strokeWidth=".5" opacity=".45"/>
            <line x1="44" y1="56" x2="44" y2="88" stroke={reticleColor} strokeWidth=".5" opacity=".45"/>
            <path d="M 8 8 L 8 19 M 8 8 L 19 8"   stroke={reticleColor} strokeWidth=".9" fill="none" opacity=".55"/>
            <path d="M 80 8 L 80 19 M 80 8 L 69 8" stroke={reticleColor} strokeWidth=".9" fill="none" opacity=".55"/>
            <path d="M 8 80 L 8 69 M 8 80 L 19 80" stroke={reticleColor} strokeWidth=".9" fill="none" opacity=".55"/>
            <path d="M 80 80 L 80 69 M 80 80 L 69 80" stroke={reticleColor} strokeWidth=".9" fill="none" opacity=".55"/>
          </svg>
        </div>
      )}

      {/* ── Reticle toggle (top-left) ─────────────────────────────────── */}
      {!deepstateMode && (
        <div style={{ position:'absolute', top:10, left:10, zIndex:20 }}>
          <button
            onClick={() => setShowReticle(v => !v)}
            style={{
              background: showReticle ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
              border:`1px solid ${showReticle ? reticleColor + '66' : '#31434d'}`,
              color: showReticle ? reticleColor : '#c0cbd0',
              padding:'3px 8px', fontSize:8, fontFamily:'IBM Plex Mono, monospace',
              fontWeight:500, letterSpacing:'.1em', cursor:'pointer', transition:'all .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = reticleColor }}
            onMouseLeave={e => { if (!showReticle) (e.currentTarget as HTMLButtonElement).style.color = '#c0cbd0' }}
          >
            RETICLE
          </button>
        </div>
      )}
      </div>

      {/* ── RIGHT: DeepState split panel ──────────────────────────────── */}
      {deepstateMode && (
        <div style={{
          flex: '0 0 50%', height: '100%', position: 'relative',
          background: '#03060e',
          borderLeft: '2px solid #ff1a3e33',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            background: 'rgba(8,14,10,0.96)',
            borderBottom: '1px solid #ff1a3e33',
            flexShrink: 0, zIndex: 2,
          }}>
            <div style={{ width: 6, height: 6, background: '#ff1a3e', borderRadius: '50%', animation: 'blink 1s step-end infinite' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ff1a3e', fontWeight: 700, letterSpacing: '.15em' }}>
              ◆ DEEPSTATE · UKRAINE BATTLEFIELD MONITOR
            </span>
            <a
              href="https://deepstatemap.live/en#7/48.8/32.4"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: 'auto', fontFamily: 'monospace', fontSize: 7.5,
                color: '#2a3e2e', letterSpacing: '.1em', fontWeight: 700,
                border: '1px solid #141e16', padding: '2px 8px', textDecoration: 'none',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.color = '#ff1a3e'; a.style.borderColor = '#ff1a3e55' }}
              onMouseLeave={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.color = '#2a3e2e'; a.style.borderColor = '#141e16' }}
            >
              ↗ OPEN FULL MAP
            </a>
          </div>

          {/* Embedded DeepState map — may be blocked by CSP on some browsers */}
          <iframe
            key="deepstate-iframe"
            src="https://deepstatemap.live/en#7/48.8/32.4"
            title="DeepState Ukraine Battlefield Map"
            allow="fullscreen"
            style={{ flex: 1, border: 'none', width: '100%', display: 'block' }}
          />

          {/* Fallback overlay shown on top — dim unless iframe loads */}
          <div style={{
            position: 'absolute', inset: 0, top: 34, /* below header */
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 0,
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#1a2e1e', letterSpacing: '.12em', textAlign: 'center', lineHeight: 2 }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.15 }}>🗺</div>
              <div>DEEPSTATE MAP LOADING…</div>
              <div style={{ fontSize: 7, marginTop: 4, color: '#141e16' }}>
                If blocked by browser, use ↗ OPEN FULL MAP above
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
