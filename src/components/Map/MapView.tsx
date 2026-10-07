import CloseButton from '../CloseButton'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Flight, CrisisEvent, Stock, MapViewMode } from '../../types'
import { FirePoint } from '../../services/wildfires'
import { Earthquake } from '../../services/earthquakes'
import { MARKET_HUBS } from '../../services/stocks'
import { addHoverMarker, type HoverMarker } from './hoverMarker'
import { PLACE_MIN_ZOOM, pickClickedPlace } from '../../utils/placePick'
import { NEWS_COLORS, esc, marketPinHTML, newsPinHTML } from './geoPopups'
import type { GeoNewsPin } from '../../utils/geoNews'
import { LAYER_SECTIONS } from '../../utils/layerSections'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../../services/military'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS, SANCTIONS_BY_ISO2 } from '../../services/sanctions'
import { PORTS, PORT_TYPE_COLORS, PORT_TYPE_LABELS } from '../../services/ports'
import { PIPELINE_COLORS, PIPELINE_LABELS, PIPELINE_ATTRIBUTION, PIPELINE_DETAIL_MIN_ZOOM, fetchTrunkPipelines, fetchPipelineCell, cellsForBounds, type PipelineFeature } from '../../services/pipelines'
import { countFlightTypes, FLIGHT_TYPE_COLORS, type FlightType } from '../../utils/flightType'
import { EARTHCAM_CAMERAS, type LiveCamera } from '../../services/earthcam'
import { registerUSWebcams } from '../../services/usWebcams'
import { ALL_INFRA_POINTS, INFRA_COLORS, INFRA_LABELS, INFRA_ICONS, fetchAllPowerPlants, type InfraPoint } from '../../services/infrastructure'
import { fetchDataCenters, type DataCenterPoint } from '../../services/datacenters'
import { FIR_REGIONS, analyzeAirspace } from '../../services/notam'
import { type Vessel, vesselTypeFromCode, detectVesselType, VESSEL_TYPE_COLORS } from '../../services/aisstream'
import { OIL_GAS_DATA, getMaxValue, formatValue, getRegionTotals, METRIC_COLORS, METRIC_LABELS, type OilGasMetric } from '../../services/oilgas'
import { SEVERITY_COLORS, SEVERITY_LABELS, GPSJAM_ATTRIBUTION, type GPSJamData } from '../../services/gpsjam'
import { useAnalyticsData } from '../../hooks/useAnalyticsData'
import { analyticsData } from '../../services/analyticsData'
import { HEIGHT_SCALE } from '../../utils/hexbin'
import { useCountryAnalytics } from '../../hooks/useCountryAnalytics'
import { countryColors, type Residual } from '../../utils/countryStats'
import { sequentialColor, SEQUENTIAL, BELOW, NEUTRAL, ABOVE } from '../../utils/vizPalette'
import { CHOKEPOINTS, CHOKEPOINT_COLORS, SHIPPING_LANE_LABEL_IDS } from '../../services/chokepoints'
import { SUPPLY_CHAIN_FACILITIES, FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from '../../services/supplychain'
import { getCountryCentroid, type OutageEvent } from '../../services/outages'
import { RESOURCE_PROFILES, fetchResourceRents } from '../../services/resources'
import { fetchMilitaryPersonnelRanking, type MilitaryPersonnelEntry } from '../../services/militaryPersonnel'
import { fetchInfraIndicatorRanking, type CountryInfraEntry } from '../../services/infraIndicators'
import { TRADE_PROFILES } from '../../services/tradeStats'
import { UNHCR_OFFICES, BORDER_CROSSINGS, REFUGEE_CAMPS, CROSSING_STATUS_COLORS, OFFICE_TYPE_COLORS, REFUGEE_FLOWS, COUNTRY_DISPLACEMENT } from '../../services/unhcr'
import { CANVAS_FILTERS, VISION_OVERLAYS } from './viewModes'
import { ALL_TYPES, destinationPoint, buildFlightGeoJSON, aircraftCache, fetchAircraftMeta, buildFlightHTML, addAirplaneImage } from './flightLayer'
import { addVesselImages } from './vesselImages'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

const CRISIS_COLORS: Record<string, string> = {
  war:'#ff1a2e', conflict:'#ff6600', terrorism:'#cc0033',
  protest:'#ffcc00', political:'#aa44ff', disaster:'#ff8800',
}

const SEV_SIZE: Record<string, number> = { critical: 16, high: 11, medium: 8, low: 5 }

interface Props {
  viewMode:      MapViewMode
  flights:       Flight[]
  crises:        CrisisEvent[]
  newsPins:      GeoNewsPin[]
  stocks:        Stock[]
  earthquakes:   Earthquake[]
  showFlights:   boolean
  showCrises:    boolean
  showNews:      boolean
  showStocks:    boolean
  deepstateMode: boolean
  /** Closes the DeepState split panel (shown in its header). */
  onCloseDeepstate?: () => void
  onFlightClick: (f: Flight) => void
  onCrisisClick: (c: CrisisEvent) => void
  fires:         FirePoint[]
  showWildfires: boolean
  showMilitary:  boolean
  showNuclear:   boolean
  showSanctions:     boolean
  showCameras:        boolean
  showInfrastructure: boolean
  showDatacenters:    boolean
  showAirspace:       boolean
  showHumanitarian:   boolean
  vessels:            Vessel[]
  showVessels:        boolean
  showOil:            boolean
  showGas:            boolean
  showGPSJam:         boolean
  gpsJam:             GPSJamData | null
  showPorts:          boolean
  showPipelines:      boolean
  showChokepoints:    boolean
  showSupplyChain:    boolean
  showShippingDensity: boolean
  outages:            OutageEvent[]
  showOutages:        boolean
  showResources:      boolean
  showTradeStats:     boolean
  showMilitaryPersonnel: boolean
  showInfraIndicators: boolean
  showAnalyticsHex: boolean
  showCountryAnalytics: boolean
  flyToQuery?:        string
  geoFlyTo?:          string
  onCountryClick?:    (country: string) => void
  /** a click on a city (zoomed in enough to target one); otherwise the click is reported via onCountryClick */
  onPlaceClick?:      (place: import('../../types').SelectedPlace) => void
  selectedCountry?:   string | null
  selectedPlace?:     import('../../types').SelectedPlace | null
  reticleColor?:      string
  panelState?:        import('../../types').PanelState
  onToggleLayer?:     (id: keyof import('../../types').PanelState) => void
}

const OVERLAY_ITEMS: Record<keyof import('../../types').PanelState, { label: string; icon: string; color: string }> = {
  outages: { label: 'OUTAGES', icon: '◐', color: '#f59e0b' },
  resources: { label: 'RESOURCES', icon: '◭', color: '#d97706' },
  tradeStats: { label: 'TRADE', icon: '⇄', color: '#22d3ee' },
  flights: { label: 'FLIGHTS', icon: '✈', color: '#00ff88' },
  crises: { label: 'CRISES', icon: '⚠', color: '#ff6600' },
  vessels: { label: 'VESSELS', icon: '⎈', color: '#00aaff' },
  wildfires: { label: 'WILDFIRES', icon: '✱', color: '#ff4400' },
  news: { label: 'NEWS', icon: '◉', color: '#cccccc' },
  stocks: { label: 'MARKETS', icon: '$', color: '#00ff88' },
  military: { label: 'MILITARY', icon: '⚔', color: '#ff2244' },
  militaryPersonnel: { label: 'FORCE SIZE', icon: '⚔', color: '#dc2626' },
  nuclear: { label: 'NUCLEAR', icon: '☢', color: '#ffcc00' },
  sanctions: { label: 'SANCTIONS', icon: '⊗', color: '#ff3344' },
  cameras: { label: 'CAMERAS', icon: '◎', color: '#aa88ff' },
  infrastructure: { label: 'INFRA', icon: '↯', color: '#ff8800' },
  airspace: { label: 'AIRSPACE', icon: '◇', color: '#44aaff' },
  humanitarian: { label: 'HUMANITARIAN', icon: '✚', color: '#ff6688' },
  oil: { label: 'OIL', icon: '▲', color: '#ff6600' },
  gas: { label: 'GAS', icon: '▲', color: '#00aaff' },
  ports: { label: 'PORTS', icon: '⎈', color: '#00ccff' },
  pipelines: { label: 'PIPELINES', icon: '═', color: PIPELINE_COLORS.gas },
  gpsjam: { label: 'GPS JAM', icon: '◌', color: '#ff3344' },
  chokepoints: { label: 'CHOKEPOINTS', icon: '⊘', color: '#ff4466' },
  supplychain: { label: 'SUPPLY CHAIN', icon: '◆', color: '#00ccff' },
  shippingDensity: { label: 'SHIPPING', icon: '≋', color: '#ff4466' },
  infraIndicators: { label: 'INFRA ACCESS', icon: '↯', color: '#22d3ee' },
  analyticsHex: { label: 'HAZARD HEX', icon: '⬢', color: '#3987e5' },
  countryAnalytics: { label: 'COUNTRY DATA', icon: '▦', color: '#3987e5' },
  datacenters: { label: 'DATA CENTERS', icon: '▤', color: '#a855f7' },
}

export default function MapView({
  viewMode, flights, crises, newsPins, stocks, earthquakes,
  showFlights, showCrises, showNews, showStocks,
  deepstateMode,
  onCloseDeepstate,
  onFlightClick, onCrisisClick,
  fires, showWildfires,
  showMilitary, showNuclear, showSanctions,
  showCameras, showInfrastructure, showDatacenters, showAirspace, showHumanitarian,
  vessels, showVessels, showOil, showGas, showGPSJam, gpsJam, showPorts, showPipelines,
  showChokepoints, showSupplyChain, showShippingDensity,
  outages, showOutages, showResources, showTradeStats, showMilitaryPersonnel,
  showInfraIndicators, showAnalyticsHex, showCountryAnalytics,
  flyToQuery, geoFlyTo, onCountryClick, onPlaceClick, selectedCountry, selectedPlace,
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
  const onPlaceClickRef = useRef(onPlaceClick)
  onPlaceClickRef.current = onPlaceClick
  const placeMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const militaryPersonnelRef = useRef<MilitaryPersonnelEntry[]>([])
  const infraIndicatorsRef = useRef<CountryInfraEntry[]>([])
  const countryAnalyticsRef = useRef<{
    yRows: Map<string, { name: string; value: number; year: string }>   // keyed by ISO-3166 alpha-3
    points: Map<string, Residual>
    xShort: string; yShort: string
    xFormat: (v: number) => string; yFormat: (v: number) => string
  } | null>(null)

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
        'sky-atmosphere-sun-intensity': 0,
      }})

      // Mapbox default fog/space background
      map.setFog({})

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
            <div style="font-size:12px;font-weight:700;color:#ea580c;letter-spacing:.1em;margin-bottom:4px">✱ ACTIVE FIRE</div>
            <div><span style="color:#6b7280">FRP:</span> <b style="color:#ea580c">${frp.toFixed(1)} MW</b></div>
            <div><span style="color:#6b7280">Confidence:</span> <span style="color:${conf==='high'?'#dc2626':conf==='low'?'#d97706':'#ea580c'}">${conf.toUpperCase()}</span></div>
            <div><span style="color:#6b7280">Satellite:</span> ${String(props.satellite||'')}</div>
            <div><span style="color:#6b7280">Detected:</span> ${String(props.date||'')} ${String(props.time||'').replace(/(\d{2})(\d{2})/, '$1:$2')} UTC</div>
            <div><span style="color:#6b7280">Day/Night:</span> ${props.daynight === 'D' ? '☼ Day' : '☾ Night'}</div>
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

      // ── Selected-country border highlight ────────────────────────────────
      map.addSource('selected-country-boundary', {
        type: 'vector',
        url:  'mapbox://mapbox.country-boundaries-v1',
      })
      map.addLayer({
        id: 'selected-country-outline', type: 'line',
        source: 'selected-country-boundary',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': '#ef4444',
          'line-width': 1.5,
          'line-opacity': 0.7,
        },
        filter: ['==', ['get', 'name_en'], ''],
      } as Parameters<typeof map.addLayer>[0])

      // ── Critical minerals / resources country fill layer ────────────────
      map.addSource('resources-countries', {
        type: 'vector',
        url:  'mapbox://mapbox.country-boundaries-v1',
      })
      map.addLayer({
        id: 'resources-fill', type: 'fill',
        source: 'resources-countries',
        'source-layer': 'country_boundaries',
        paint: {
          // Curated major-producer countries get an amber tint; every other
          // country still gets a faint fill so the whole globe is clickable
          // for the live World Bank resource-rent lookup.
          'fill-color': [
            'match', ['get', 'iso_3166_1'],
            ...RESOURCE_PROFILES.flatMap(p => [p.iso2, '#d97706']),
            '#94a3b8',
          ],
          'fill-opacity': [
            'match', ['get', 'iso_3166_1'],
            ...RESOURCE_PROFILES.flatMap(p => [p.iso2, 0.22]),
            0.08,
          ],
        },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])
      map.addLayer({
        id: 'resources-outline', type: 'line',
        source: 'resources-countries',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': [
            'match', ['get', 'iso_3166_1'],
            ...RESOURCE_PROFILES.flatMap(p => [p.iso2, '#d97706']),
            '#94a3b8',
          ],
          'line-width': 1.2,
          'line-opacity': [
            'match', ['get', 'iso_3166_1'],
            ...RESOURCE_PROFILES.flatMap(p => [p.iso2, 0.55]),
            0.25,
          ],
        },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'resources-fill', (e) => {
        const feat = e.features?.[0]
        const iso2 = feat?.properties?.iso_3166_1 as string | undefined
        if (!iso2) return
        const nameEn = (feat?.properties?.name_en as string | undefined) || iso2
        const p = RESOURCE_PROFILES.find(r => r.iso2 === iso2)

        const renderHtml = (rentRows: string) => `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:250px;max-width:320px;max-height:400px;overflow-y:auto;">
          <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${p ? p.name : nameEn}</div>
          ${p ? `<div style="font-size:10px;font-weight:700;color:#92400e;letter-spacing:0.03em;margin-bottom:3px;">MAJOR PRODUCER — KNOWN COMMODITIES</div>
          ${p.resources.map(r => `<div style="font-size:11px;color:#374151;margin-bottom:2px;">◆ <b>${r.mineral}</b>${r.rank ? ` — #${r.rank} world${r.shareOfWorld ? ` (${r.shareOfWorld}% share)` : ''}` : ''}${r.note ? `<div style="font-size:10px;color:#6b7280;margin-left:14px;">${r.note}</div>` : ''}</div>`).join('')}
          ${p.strategic ? `<div style="margin:6px 0;font-size:10px;color:#6b7280;line-height:1.5;">${p.strategic}</div>` : ''}` : ''}
          <div style="font-size:10px;font-weight:700;color:#0f172a;letter-spacing:0.03em;margin:${p ? '8px' : '0'} 0 3px;padding-top:${p ? '6px' : '0'};${p ? 'border-top:1px solid #e5e7eb;' : ''}">RESOURCE RENTS (% OF GDP, WORLD BANK)</div>
          ${rentRows}
        </div>`

        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '340px', className: 'cy-popup' })
          .setLngLat(e.lngLat)
          .setHTML(renderHtml('<div style="font-size:11px;color:#9ca3af;">Loading live data…</div>'))
          .addTo(map)
        ;(map as any).__markFeatureClick?.()

        const clickedPopup = popupRef.current
        fetchResourceRents(iso2).then(rents => {
          if (popupRef.current !== clickedPopup) return // user clicked elsewhere while loading
          const rows = rents.length
            ? rents
                .sort((a, b) => b.value - a.value)
                .map(r => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#374151;margin-bottom:2px;"><span>${r.label.replace(' (% of GDP)', '')}</span><span style="font-weight:700;color:#0f172a;">${r.value.toFixed(2)}%</span></div><div style="font-size:9px;color:#9ca3af;margin:-2px 0 3px;">${r.year}</div>`)
                .join('')
            : '<div style="font-size:11px;color:#9ca3af;">No World Bank data available for this country.</div>'
          clickedPopup.setHTML(renderHtml(rows))
        }).catch(() => {
          if (popupRef.current !== clickedPopup) return
          clickedPopup.setHTML(renderHtml('<div style="font-size:11px;color:#9ca3af;">Failed to load data.</div>'))
        })
      })
      map.on('mouseenter', 'resources-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'resources-fill', () => { map.getCanvas().style.cursor = '' })

      // ── Trade statistics country fill layer ──────────────────────────────
      map.addSource('tradestats-countries', {
        type: 'vector',
        url:  'mapbox://mapbox.country-boundaries-v1',
      })
      map.addLayer({
        id: 'tradestats-fill', type: 'fill',
        source: 'tradestats-countries',
        'source-layer': 'country_boundaries',
        paint: {
          'fill-color': [
            'match', ['get', 'iso_3166_1'],
            ...TRADE_PROFILES.flatMap(p => [p.iso2, '#0891b2']),
            'transparent',
          ],
          'fill-opacity': 0.2,
        },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])
      map.addLayer({
        id: 'tradestats-outline', type: 'line',
        source: 'tradestats-countries',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': [
            'match', ['get', 'iso_3166_1'],
            ...TRADE_PROFILES.flatMap(p => [p.iso2, '#0891b2']),
            'transparent',
          ],
          'line-width': 1.2,
          'line-opacity': 0.55,
        },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'tradestats-fill', (e) => {
        const iso2 = e.features?.[0]?.properties?.iso_3166_1 as string | undefined
        if (!iso2) return
        const p = TRADE_PROFILES.find(t => t.iso2 === iso2)
        if (!p) return
        const topExp = p.topExportPartners.slice(0, 3).map(x => `${x.country} (${x.pct}%)`).join(', ')
        const topImp = p.topImportPartners.slice(0, 3).map(x => `${x.country} (${x.pct}%)`).join(', ')
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:300px;">
          <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${p.name}</div>
          <div style="font-size:11px;color:#374151;margin-bottom:3px;">Exports to: ${topExp}</div>
          <div style="font-size:11px;color:#374151;margin-bottom:3px;">Imports from: ${topImp}</div>
          ${p.tradeBalance != null ? `<div style="font-size:11px;color:#374151;">Trade balance: <b style="color:${p.tradeBalance >= 0 ? '#16a34a' : '#dc2626'}">${p.tradeBalance >= 0 ? '+' : ''}$${p.tradeBalance}B</b></div>` : ''}
          ${p.dependencies?.length ? `<div style="margin-top:6px;font-size:10px;color:#6b7280;line-height:1.5;">${p.dependencies.join(' · ')}</div>` : ''}
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'tradestats-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'tradestats-fill', () => { map.getCanvas().style.cursor = '' })

      // ── Armed forces personnel country fill layer (World Bank, live-ranked) ──
      // Colors/opacity are set once the ranking loads (see effect below) since
      // rank order depends on live data rather than a static curated list.
      map.addSource('military-personnel-countries', {
        type: 'vector',
        url:  'mapbox://mapbox.country-boundaries-v1',
      })
      map.addLayer({
        id: 'military-personnel-fill', type: 'fill',
        source: 'military-personnel-countries',
        'source-layer': 'country_boundaries',
        paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.08 },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])
      map.addLayer({
        id: 'military-personnel-outline', type: 'line',
        source: 'military-personnel-countries',
        'source-layer': 'country_boundaries',
        paint: { 'line-color': '#dc2626', 'line-width': 1.2, 'line-opacity': 0.25 },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'military-personnel-fill', (e) => {
        const feat = e.features?.[0]
        const iso2 = feat?.properties?.iso_3166_1 as string | undefined
        if (!iso2) return
        const nameEn = (feat?.properties?.name_en as string | undefined) || iso2
        const entry = militaryPersonnelRef.current.find(m => m.iso2 === iso2)
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:280px;">
          <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${entry?.country || nameEn}</div>
          ${entry
            ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">Rank: <b style="color:#dc2626;">#${entry.rank}</b> of ${militaryPersonnelRef.current.length} (world)</div>
               <div style="font-size:11px;color:#374151;">Armed forces personnel: <b>${entry.personnel.toLocaleString()}</b></div>
               <div style="font-size:9px;color:#9ca3af;margin-top:3px;">World Bank (IISS Military Balance), ${entry.year}</div>`
            : `<div style="font-size:11px;color:#9ca3af;">No World Bank armed-forces personnel data for this country.</div>`}
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'military-personnel-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'military-personnel-fill', () => { map.getCanvas().style.cursor = '' })

      map.addSource('infra-indicators-countries', {
        type: 'vector',
        url:  'mapbox://mapbox.country-boundaries-v1',
      })
      map.addLayer({
        id: 'infra-indicators-fill', type: 'fill',
        source: 'infra-indicators-countries',
        'source-layer': 'country_boundaries',
        paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.08 },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])
      map.addLayer({
        id: 'infra-indicators-outline', type: 'line',
        source: 'infra-indicators-countries',
        'source-layer': 'country_boundaries',
        paint: { 'line-color': '#22d3ee', 'line-width': 1.2, 'line-opacity': 0.25 },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'infra-indicators-fill', (e) => {
        const feat = e.features?.[0]
        const iso2 = feat?.properties?.iso_3166_1 as string | undefined
        if (!iso2) return
        const nameEn = (feat?.properties?.name_en as string | undefined) || iso2
        const entry = infraIndicatorsRef.current.find(m => m.iso2 === iso2)
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:300px;">
          <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${entry?.country || nameEn}</div>
          ${entry
            ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">Access index rank: <b style="color:#22d3ee;">#${entry.rank}</b> of ${infraIndicatorsRef.current.length} (world)</div>
               <div style="font-size:11px;color:#374151;margin-bottom:4px;">Access index: <b>${entry.accessIndex === null ? 'n/a' : entry.accessIndex.toFixed(1) + '%'}</b> <span style="color:#9ca3af;">(avg of electricity, internet, water, sanitation)</span></div>
               ${entry.indicators.map(i => `<div style="font-size:10px;color:#6b7280;">${i.label}: <b style="color:#374151;">${i.value.toLocaleString()}</b> (${i.year})</div>`).join('')}
               <div style="font-size:9px;color:#9ca3af;margin-top:4px;">Source: World Bank (World Development Indicators)</div>`
            : `<div style="font-size:11px;color:#9ca3af;">No World Bank infrastructure data for this country.</div>`}
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'infra-indicators-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'infra-indicators-fill', () => { map.getCanvas().style.cursor = '' })

      // ── Internet/power outage GeoJSON source (live, IODA) ─────────────────
      map.addSource('outages', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'outages-circles', type: 'circle', source: 'outages',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 5, 5, 8, 8, 12],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.75,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
        },
        layout: { visibility: 'none' },
      })
      map.on('click', 'outages-circles', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const color = String(p.color || '#dc2626')
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:200px;max-width:280px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:13px;font-weight:800;color:#14161a;">${p.entityName}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;">${String(p.level).toUpperCase()}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;">Entity type: ${p.entityType}</div>
          <div style="font-size:11px;color:#6b7280;">Severity score: <b style="color:${color}">${p.score}</b></div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
          .setLngLat((e.features[0].geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'outages-circles', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'outages-circles', () => { map.getCanvas().style.cursor = '' })

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
            <span style="color:#6b7280;">⚑ <b style="color:#14161a">${p.operator}</b></span>
            <span style="color:#6b7280;">◉ <b style="color:#2563eb">${p.host}</b></span>
            ${p.personnel ? `<span style="color:#6b7280;">☰ <b style="color:#2563eb">${Number(p.personnel).toLocaleString()}</b></span>` : ''}
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
        const teu = p.annualTEU ? `<span style="color:#6b7280;">▣ <b style="color:#2563eb">${Number(p.annualTEU).toLocaleString()}K TEU/yr</b></span>` : ''
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:290px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
            <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">⎈ ${p.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${p.typeLabel}</span>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:6px;font-size:10px;flex-wrap:wrap;">
            <span style="color:#6b7280;">⚑ <b style="color:#14161a">${p.country}</b></span>
            ${teu}
          </div>
          <div style="font-size:11px;color:#14161a;margin-bottom:4px;">▣ <b>${p.topIndustry}</b></div>
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

      // ── Oil & gas pipelines (OpenStreetMap) ─────────────────────────────
      // 'pipelines' = world snapshot of long-distance lines; 'pipelines-detail'
      // = live per-way geometry loaded when zoomed in (see services/pipelines.ts).
      const pipeColor: mapboxgl.Expression = ['match', ['get', 'substance'],
        'oil', PIPELINE_COLORS.oil, 'gas', PIPELINE_COLORS.gas, '#ffffff']
      const pipeWidth = (scale: number): mapboxgl.Expression => ['interpolate', ['linear'], ['zoom'],
        1, 0.7 * scale, 4, 1.2 * scale, 7, 1.9 * scale, 10, 3 * scale, 14, 4.5 * scale]
      const pipeLayout = { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' } as const
      // Underground / subsea segments are drawn dashed, above-ground solid.
      const pipeDash: mapboxgl.Expression = ['match', ['get', 'location'],
        ['underground', 'underwater'], ['literal', [2, 1.5]], ['literal', [1, 0]]]

      map.addSource('pipelines',        { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('pipelines-detail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      // World snapshot fades out as the detailed live geometry takes over.
      map.addLayer({
        id: 'pipeline-casing', type: 'line', source: 'pipelines', layout: pipeLayout,
        paint: {
          'line-color': '#04121a',
          'line-width': pipeWidth(1.9),
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 10, 0.1],
        },
      })
      map.addLayer({
        id: 'pipeline-lines', type: 'line', source: 'pipelines', layout: pipeLayout,
        paint: {
          'line-color': pipeColor,
          'line-width': pipeWidth(1),
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.95, 10, 0.35],
        },
      })
      map.addLayer({
        id: 'pipeline-detail-casing', type: 'line', source: 'pipelines-detail', layout: pipeLayout,
        paint: { 'line-color': '#04121a', 'line-width': pipeWidth(1.9), 'line-opacity': 0.55 },
      })
      map.addLayer({
        id: 'pipeline-detail-lines', type: 'line', source: 'pipelines-detail', layout: pipeLayout,
        paint: {
          'line-color': pipeColor,
          'line-width': pipeWidth(1),
          'line-opacity': 0.95,
          'line-dasharray': pipeDash,
        },
      })
      map.addLayer({
        id: 'pipeline-labels', type: 'symbol', source: 'pipelines', minzoom: 4,
        filter: ['!=', ['get', 'name'], ''],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 420,
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 11, 12, 12],
          'text-max-angle': 30,
          'text-allow-overlap': false,
          'text-optional': true,
          visibility: 'none',
        } as Record<string, unknown>,
        paint: {
          'text-color': pipeColor,
          'text-halo-color': 'rgba(4,18,26,0.92)',
          'text-halo-width': 1.6,
        },
      } as Parameters<typeof map.addLayer>[0])

      const PIPE_HIT = ['pipeline-lines', 'pipeline-detail-lines']
      map.on('click', PIPE_HIT, (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const sub = p.substance === 'oil' ? 'oil' : 'gas'
        const color = PIPELINE_COLORS[sub]
        const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
        const rows = [
          p.operator ? `<div><span style="color:#9ca3af;">Operator:</span> ${esc(p.operator)}</div>` : '',
          p.diameter ? `<div><span style="color:#9ca3af;">Diameter:</span> ${esc(p.diameter)} mm</div>` : '',
          p.location ? `<div><span style="color:#9ca3af;">Laid:</span> ${esc(p.location)}</div>` : '',
        ].join('')
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:300px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
            <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">${esc(p.name) || `Unnamed ${PIPELINE_LABELS[sub].toLowerCase()} pipeline`}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}88;padding:1px 5px;flex-shrink:0;background:#0b1c26;">${PIPELINE_LABELS[sub].toUpperCase()}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">${rows}</div>
          <div style="margin-top:5px;font-size:10px;color:#9ca3af;">${PIPELINE_ATTRIBUTION}${p.osm ? ` · <a href="https://www.openstreetmap.org/${esc(p.osm)}" target="_blank" rel="noopener noreferrer">${esc(p.osm)}</a>` : ''}</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '330px', className: 'cy-popup' })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', PIPE_HIT, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', PIPE_HIT, () => { map.getCanvas().style.cursor = '' })

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
            <span style="color:#6b7280;">◍ <b style="color:#14161a">${p.country}</b></span>
            <span style="color:#6b7280;">⚛ <b style="color:#d97706">${p.type}</b></span>
            <span style="color:#6b7280;">№ <b style="color:#2563eb">${p.reactors} reactor${Number(p.reactors) !== 1 ? 's' : ''}</b></span>
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
          // Dot size follows plant capacity (curated dams/LNG/refineries have no MW → mid size)
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            2,  ['interpolate', ['linear'], ['coalesce', ['get', 'mw'], 800], 0, 1.5, 1000, 3.5],
            6,  ['interpolate', ['linear'], ['coalesce', ['get', 'mw'], 800], 0, 2.5, 1000, 6],
            10, ['interpolate', ['linear'], ['coalesce', ['get', 'mw'], 800], 0, 4,   1000, 10],
          ],
          'circle-color':        ['get', 'color'],
          'circle-opacity':      0.85,
          'circle-stroke-width': 0.6,
          'circle-stroke-color': 'rgba(0,0,0,0.45)',
        },
        // Larger plants draw on top of small ones
        layout: { visibility: 'none', 'circle-sort-key': ['coalesce', ['get', 'mw'], 800] },
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

      // ── Data Centers (OpenStreetMap, live) ────────────────────────────────
      map.addSource('datacenters', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'datacenter-circles', type: 'circle', source: 'datacenters',
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 2, 2.5, 6, 4.5, 10, 7],
          'circle-color':        '#a855f7',
          'circle-opacity':      0.9,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': 'rgba(0,0,0,0.5)',
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'datacenter-labels', type: 'symbol', source: 'datacenters', minzoom: 7,
        layout: {
          'text-field':    ['get', 'name'],
          'text-font':     ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':     9,
          'text-offset':   [0, 1.4],
          'text-optional': true,
          'text-allow-overlap': false,
        } as Record<string, unknown>,
        paint: {
          'text-color':      '#a855f7',
          'text-halo-color': 'rgba(0,0,0,0.85)',
          'text-halo-width': 1,
        },
      } as Parameters<typeof map.addLayer>[0])

      map.on('click', 'datacenter-circles', (e) => {
        if (!e.features?.[0]) return
        const p      = e.features[0].properties as Record<string, unknown>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:280px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:12px;font-weight:800;color:#14161a;">▤ ${p.name}</span>
            <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:#a855f7;border:1px solid #a855f755;padding:1px 5px;">DATA CENTER</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.5;">
            ${p.operator ? `<div><span style="color:#9ca3af;">Operator:</span> ${p.operator}</div>` : ''}
            ${p.country  ? `<div><span style="color:#9ca3af;">Country:</span> ${p.country}</div>` : ''}
            ${p.notes    ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">${p.notes}</div>` : ''}
            <div style="margin-top:4px;font-size:10px;color:#9ca3af;">Source: OpenStreetMap</div>
          </div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
          .setLngLat(coords).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'datacenter-circles', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'datacenter-circles', () => { map.getCanvas().style.cursor = '' })


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
          'fill-opacity': ['match', ['get', 'severity'], 'high', 0.35, 0.2],
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
          'line-width': ['match', ['get', 'severity'], 'high', 1, 0.7],
          'line-opacity': 0.6,
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
          'heatmap-weight': ['match', ['get', 'severity'], 'high', 1, 0.5],
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
          'circle-radius': ['match', ['get', 'severity'], 'high', 4, 3],
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
        minzoom: 6,
        layout: {
          'text-field': ['get', 'pctLabel'],
          'text-size': 9,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
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
      // Click popup — same card whether the dot or the hex is clicked
      for (const layerId of ['gpsjam-circles', 'gpsjam-fill']) {
        map.on('click', layerId, (e) => {
          if (!e.features?.[0]) return
          const p = e.features[0].properties as Record<string, unknown>
          const sevColor = String(p.color || '#ff2244')
          const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:220px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
              <div style="width:8px;height:8px;border-radius:50%;background:${sevColor};box-shadow:0 0 8px ${sevColor}88;"></div>
              <span style="font-size:12px;font-weight:700;color:${sevColor};letter-spacing:.06em;">GPS INTERFERENCE</span>
            </div>
            <div style="font-size:10px;color:#9ca3af;letter-spacing:.12em;margin-bottom:6px;">${String(p.date)} (UTC DAY)</div>
            <div style="display:grid;grid-template-columns:90px 1fr;gap:3px 8px;font-size:11px;">
              <span style="color:#9ca3af;">Level</span><span style="color:${sevColor};font-weight:700;">${String(p.severityLabel)}</span>
              <span style="color:#9ca3af;">Degraded</span><span style="color:#14161a;">${String(p.pctLabel)} of aircraft</span>
              <span style="color:#9ca3af;">Aircraft seen</span><span style="color:#14161a;">${Number(p.bad)} degraded · ${Number(p.good)} good</span>
            </div>
            <div style="margin-top:6px;font-size:10px;color:#6b7280;line-height:1.5;">Share of aircraft crossing this ~22 km cell that reported low navigation accuracy. Suggests jamming or spoofing but can't prove the cause.</div>
            <div style="margin-top:5px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: ${GPSJAM_ATTRIBUTION}</div>
          </div>`
          if (popupRef.current) popupRef.current.remove()
          popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
            .setLngLat(layerId === 'gpsjam-circles' ? (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number] : e.lngLat)
            .setHTML(html).addTo(map)
          ;(map as any).__markFeatureClick?.()
        })
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
      }

      // ── Country analytics (Country Analytics panel): countries shaded by the compared indicators ─────
      map.addSource('country-analytics-countries', { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' })
      map.addLayer({
        id: 'country-analytics-fill', type: 'fill',
        source: 'country-analytics-countries', 'source-layer': 'country_boundaries',
        paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0.78 },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])
      map.addLayer({
        id: 'country-analytics-outline', type: 'line',
        source: 'country-analytics-countries', 'source-layer': 'country_boundaries',
        paint: { 'line-color': '#e5ecef', 'line-width': 0.6, 'line-opacity': 0.35 },
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])
      map.on('click', 'country-analytics-fill', (e) => {
        const feat = e.features?.[0]
        const iso3 = feat?.properties?.iso_3166_1_alpha_3 as string | undefined
        const info = countryAnalyticsRef.current
        if (!iso3 || !info) return
        const esc = (v: unknown) => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
        const yRow = info.yRows.get(iso3)
        const pt = info.points.get(iso3)
        const name = yRow?.name ?? pt?.name ?? (feat?.properties?.name_en as string | undefined) ?? iso3
        const row = (k: string, v: string) => `<span style="color:#9ca3af;">${esc(k)}</span><span style="color:#14161a;">${v}</span>`
        const body = [
          yRow ? row(info.yShort, `<b>${esc(info.yFormat(yRow.value))}</b> (${esc(yRow.year)})`) : '',
          pt ? row(info.xShort, `${esc(info.xFormat(pt.x))} (${esc(pt.xYear)})`) : '',
          pt ? row('Trend expects', esc(info.yFormat(pt.expected))) : '',
          pt ? row('Vs trend', `<b style="color:${pt.z >= 0 ? '#c0392b' : '#256abf'};">${pt.z >= 0 ? '+' : '−'}${Math.abs(pt.z).toFixed(1)} σ</b>`) : '',
        ].join('')
        const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:230px;">
          <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${esc(name)}</div>
          ${body ? `<div style="display:grid;grid-template-columns:100px 1fr;gap:3px 8px;font-size:11px;">${body}</div>` : `<div style="font-size:11px;color:#9ca3af;">No data for this country in the selected indicators.</div>`}
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: WORLD BANK OPEN DATA · LATEST YEAR SINCE 2010</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' }).setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'country-analytics-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
      map.on('mouseleave', 'country-analytics-fill', () => { map.getCanvas().style.cursor = '' })

      // ── Hazard hex (Hazard Analytics panel): wildfire / earthquake points binned into H3 cells, extruded by activity ─────
      map.addSource('analytics-hex', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'analytics-hex-extrusion',
        type: 'fill-extrusion',
        source: 'analytics-hex',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.88,
        },
        layout: { visibility: 'none' },
      })
      map.on('click', 'analytics-hex-extrusion', (e) => {
        if (!e.features?.[0]) return
        const p = e.features[0].properties as Record<string, unknown>
        const fires = p.source === 'fires'
        const n = (v: unknown) => Number(v).toLocaleString()
        const rows = fires
          ? `<span style="color:#9ca3af;">Detections</span><span style="color:#14161a;font-weight:700;">${n(p.count)}</span>
             <span style="color:#9ca3af;">Total fire power</span><span style="color:#14161a;">${n(Math.round(Number(p.value)))} MW</span>
             <span style="color:#9ca3af;">Strongest fire</span><span style="color:#14161a;">${n(Math.round(Number(p.peak)))} MW</span>`
          : `<span style="color:#9ca3af;">Earthquakes</span><span style="color:#14161a;font-weight:700;">${n(p.count)}</span>
             <span style="color:#9ca3af;">Strongest</span><span style="color:#14161a;">M${Number(p.peak).toFixed(1)}</span>`
        const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:220px;">
          <div style="font-size:12px;font-weight:700;color:#14161a;margin-bottom:2px;">${fires ? 'WILDFIRE DETECTIONS' : 'EARTHQUAKES'}</div>
          <div style="font-size:10px;color:#9ca3af;letter-spacing:.1em;margin-bottom:6px;">${fires ? 'LAST 24 H · ~22 KM CELL' : 'M4.5+ · LAST 7 DAYS · ~60 KM CELL'}</div>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:3px 8px;font-size:11px;">${rows}</div>
          <div style="margin-top:6px;font-size:10px;color:#6b7280;line-height:1.5;">${fires ? 'Satellite detections in this cell; height and colour follow the summed fire radiative power.' : 'Height and colour follow the number of quakes in this cell.'}</div>
          <div style="margin-top:5px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: ${fires ? 'NASA FIRMS (VIIRS)' : 'USGS'}</div>
        </div>`
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' }).setLngLat(e.lngLat).setHTML(html).addTo(map)
        ;(map as any).__markFeatureClick?.()
      })
      map.on('mouseenter', 'analytics-hex-extrusion', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'analytics-hex-extrusion', () => { map.getCanvas().style.cursor = '' })

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
            <span style="color:#6b7280;">▦ <b style="color:#14161a">${p.operator}</b></span>
            <span style="color:#6b7280;">⚑ <b style="color:#14161a">${p.country}</b></span>
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

      // ── Shipping density heatmap (Resource Watch com.012 "Global Shipping Lanes") ──
      // NOAA/NCEAS/ICOADS: 1.19M position reports from 3,374 Voluntary Observing Ships,
      // Oct 2004–Oct 2005 (~11% of ships at sea). Historical and under-counts busy lanes —
      // NOT live AIS. Keyless, CORS-open, free; license on RW is "Restrictions Apply".
      map.addSource('shipping-density', {
        type: 'raster',
        tiles: ['https://api.resourcewatch.org/v1/layer/096b7e26-a2b9-4c17-a32c-07ceed9dc27a/tile/gee/{z}/{x}/{y}'],
        tileSize: 256,
        maxzoom: 12,
        attribution: 'Shipping lanes 2004–05: NOAA / NCEAS / ICOADS (WMO VOS) via Resource Watch',
      })
      map.addLayer({
        id: 'shipping-density-layer', type: 'raster', source: 'shipping-density',
        paint: {
          'raster-opacity': 0.92,
          'raster-fade-duration': 300,
          // Source tiles ship in a viridis ramp (RW legend: ≤1, ≤3, ≤5, ≤10, ≤50, ≤1,158 ships) and
          // are OPAQUE over the whole ocean — the "no traffic" baseline is the darkest purple
          // (luminance ~0.12), only land is transparent. Luminance rises monotonically with
          // traffic (~0.27 at ≤1 … ~0.85 at the top), so with range [0,1] raster-value IS luminance:
          // clear everything below 0.2 (baseline) and paint a green → yellow → red ramp above it.
          // (Calibrated by rendering ramp variants; a narrower range fails to clear the baseline.)
          'raster-color-mix': [0.30, 0.59, 0.11, 0],
          'raster-color-range': [0, 1],
          'raster-color': [
            'interpolate', ['linear'], ['raster-value'],
            0,    'rgba(0,0,0,0)',
            0.20, 'rgba(0,0,0,0)',
            0.24, 'rgba(60,220,60,0.5)',
            0.27, 'rgba(70,225,55,0.7)',
            0.36, 'rgba(140,235,35,0.8)',
            0.43, 'rgba(210,240,20,0.88)',
            0.54, 'rgba(255,215,0,0.93)',
            0.69, 'rgba(255,110,0,0.97)',
            0.85, 'rgba(235,0,0,1)',
          ] as unknown as [string, ...unknown[]],
        } as Record<string, unknown>,
        layout: { visibility: 'none' },
      } as Parameters<typeof map.addLayer>[0])

      // Ringed chokepoint labels for the overlay (Suez, Bab-el-Mandeb, Gibraltar, Cape of Good Hope,
      // Malacca, Magellan, Panama) — positions come from the CHOKEPOINTS dataset.
      map.addSource('shipping-density-labels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: SHIPPING_LANE_LABEL_IDS.flatMap(id => {
            const c = CHOKEPOINTS.find(x => x.id === id)
            return c ? [{
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
              properties: { name: c.name },
            }] : []
          }),
        },
      })
      map.addLayer({
        id: 'shipping-density-rings', type: 'circle', source: 'shipping-density-labels',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 6, 10],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#2a3ee6',
          'circle-stroke-width': 2.5,
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'shipping-density-label-text', type: 'symbol', source: 'shipping-density-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 15],
          'text-max-width': 6,
          'text-anchor': 'bottom',
          'text-offset': [0, -0.9],
          'text-allow-overlap': true,
          visibility: 'none',
        } as Record<string, unknown>,
        paint: {
          'text-color': '#2a3ee6',
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 1.6,
        },
      } as Parameters<typeof map.addLayer>[0])

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
          // Reverse geocode — works for every click on land. Zoomed in far enough, a city wins over its country.
          const { lng, lat } = e.lngLat
          const geocode = (types: string, limit = 1) =>
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=${types}&limit=${limit}&access_token=${TOKEN}`)
              .then(r => r.json())
          const wantPlace = !!onPlaceClickRef.current && map.getZoom() >= PLACE_MIN_ZOOM
          Promise.all([
            geocode('country'),
            wantPlace ? geocode('place', 3).catch(() => null) : Promise.resolve(null),
          ])
            .then(([countryJson, placeJson]) => {
              const place = placeJson ? pickClickedPlace(placeJson, { lng, lat }) : null
              if (place && onPlaceClickRef.current) { onPlaceClickRef.current(place); return }
              const countryName = countryJson.features?.[0]?.text || countryJson.features?.[0]?.place_name
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

  // ── Selected-country border highlight ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    if (!map.getLayer('selected-country-outline')) return
    map.setFilter('selected-country-outline', ['==', ['get', 'name_en'], selectedCountry || ''])
  }, [selectedCountry, mapReady])

  // ── Picked-city marker ───────────────────────────────────────────────────
  useEffect(() => {
    placeMarkerRef.current?.remove()
    placeMarkerRef.current = null
    const map = mapRef.current
    if (!map || !selectedPlace) return
    const el = document.createElement('div')
    el.className = 'place-pin'
    el.setAttribute('aria-label', `Selected place: ${selectedPlace.name}`)
    placeMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([selectedPlace.lng, selectedPlace.lat]).addTo(map)
    return () => { placeMarkerRef.current?.remove(); placeMarkerRef.current = null }
  }, [selectedPlace, mapReady])

  // ── Sanctions layer visibility ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showSanctions ? 'visible' : 'none'
    if (map.getLayer('sanctions-fill'))    map.setLayoutProperty('sanctions-fill',    'visibility', vis)
    if (map.getLayer('sanctions-outline')) map.setLayoutProperty('sanctions-outline', 'visibility', vis)
  }, [showSanctions, mapReady])

  // ── Resources layer visibility ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showResources ? 'visible' : 'none'
    if (map.getLayer('resources-fill'))    map.setLayoutProperty('resources-fill',    'visibility', vis)
    if (map.getLayer('resources-outline')) map.setLayoutProperty('resources-outline', 'visibility', vis)
  }, [showResources, mapReady])

  // ── Trade stats layer visibility ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showTradeStats ? 'visible' : 'none'
    if (map.getLayer('tradestats-fill'))    map.setLayoutProperty('tradestats-fill',    'visibility', vis)
    if (map.getLayer('tradestats-outline')) map.setLayoutProperty('tradestats-outline', 'visibility', vis)
  }, [showTradeStats, mapReady])

  // ── Armed forces personnel layer visibility + live World Bank ranking ────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showMilitaryPersonnel ? 'visible' : 'none'
    if (map.getLayer('military-personnel-fill'))    map.setLayoutProperty('military-personnel-fill',    'visibility', vis)
    if (map.getLayer('military-personnel-outline')) map.setLayoutProperty('military-personnel-outline', 'visibility', vis)
    if (!showMilitaryPersonnel || militaryPersonnelRef.current.length > 0) return

    fetchMilitaryPersonnelRanking().then(ranking => {
      militaryPersonnelRef.current = ranking
      const m = mapRef.current
      if (!m || !m.getLayer('military-personnel-fill')) return
      // Strongest militaries (by personnel) get the deepest red; opacity fades
      // out toward the rest of the ranked list rather than a hard cutoff.
      const top = ranking.slice(0, 30)
      const maxRank = top.length
      m.setPaintProperty('military-personnel-fill', 'fill-opacity', [
        'match', ['get', 'iso_3166_1'],
        ...top.flatMap((e, i) => [e.iso2, 0.55 - (i / maxRank) * 0.4]),
        0.05,
      ])
      m.setPaintProperty('military-personnel-outline', 'line-opacity', [
        'match', ['get', 'iso_3166_1'],
        ...top.flatMap(e => [e.iso2, 0.7]),
        0.15,
      ])
    }).catch(() => { /* live lookup unavailable; layer stays visible with base styling */ })
  }, [showMilitaryPersonnel, mapReady])

  // ── Infrastructure access indicators layer visibility + live World Bank data ─
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showInfraIndicators ? 'visible' : 'none'
    if (map.getLayer('infra-indicators-fill'))    map.setLayoutProperty('infra-indicators-fill',    'visibility', vis)
    if (map.getLayer('infra-indicators-outline')) map.setLayoutProperty('infra-indicators-outline', 'visibility', vis)
    if (!showInfraIndicators || infraIndicatorsRef.current.length > 0) return

    fetchInfraIndicatorRanking().then(ranking => {
      infraIndicatorsRef.current = ranking
      const m = mapRef.current
      if (!m || !m.getLayer('infra-indicators-fill')) return
      // Best electricity access gets the deepest cyan; opacity fades toward
      // lower-ranked countries rather than a hard cutoff.
      const top = ranking.slice(0, 30)
      const maxRank = top.length
      m.setPaintProperty('infra-indicators-fill', 'fill-opacity', [
        'match', ['get', 'iso_3166_1'],
        ...top.flatMap((e, i) => [e.iso2, 0.55 - (i / maxRank) * 0.4]),
        0.05,
      ])
      m.setPaintProperty('infra-indicators-outline', 'line-opacity', [
        'match', ['get', 'iso_3166_1'],
        ...top.flatMap(e => [e.iso2, 0.7]),
        0.15,
      ])
    }).catch(() => { /* live lookup unavailable; layer stays visible with base styling */ })
  }, [showInfraIndicators, mapReady])

  // ── Outages GeoJSON (live) ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('outages') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showOutages ? 'visible' : 'none'
    if (map.getLayer('outages-circles')) map.setLayoutProperty('outages-circles', 'visibility', vis)
    if (!showOutages) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = []
    for (const o of outages) {
      const centroid = getCountryCentroid(o.entityCode)
      if (!centroid) continue
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: centroid },
        properties: {
          entityName: o.entityName,
          entityType: o.entityType,
          level:      o.level,
          score:      o.score,
          color:      o.level === 'critical' ? '#dc2626' : '#d97706',
        },
      })
    }
    src.setData({ type: 'FeatureCollection', features })
  }, [outages, showOutages, mapReady])

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

  // ── Oil & gas pipelines (OSM): world snapshot + live detail when zoomed in ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('pipelines') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showPipelines ? 'visible' : 'none'
    for (const id of ['pipeline-casing', 'pipeline-lines', 'pipeline-labels', 'pipeline-detail-casing', 'pipeline-detail-lines']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
    if (!showPipelines) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    let cancelled = false
    fetchTrunkPipelines().then(fc => { if (!cancelled) src.setData(fc) })
    return () => { cancelled = true }
  }, [showPipelines, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const detail = map.getSource('pipelines-detail') as mapboxgl.GeoJSONSource | undefined
    if (!detail) return
    const clear = () => detail.setData({ type: 'FeatureCollection', features: [] })
    if (!showPipelines) { clear(); return }

    let seq = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      const mine = ++seq
      if (map.getZoom() < PIPELINE_DETAIL_MIN_ZOOM) { clear(); return }
      const b = map.getBounds()
      if (!b) return
      const cells = cellsForBounds(b.getWest(), b.getSouth(), b.getEast(), b.getNorth())
      const byId = new Map<string, PipelineFeature>()
      const POOL = 3
      for (let i = 0; i < cells.length && mine === seq; i += POOL) {
        const chunk = await Promise.all(cells.slice(i, i + POOL).map(fetchPipelineCell))
        if (mine !== seq) return
        for (const feats of chunk) for (const f of feats) byId.set(f.properties.osm, f)
        detail.setData({ type: 'FeatureCollection', features: [...byId.values()] })
      }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 350) }
    map.on('moveend', schedule)
    schedule()
    return () => { seq++; clearTimeout(timer); map.off('moveend', schedule) }
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

  // ── Shipping density raster toggle ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showShippingDensity ? 'visible' : 'none'
    for (const id of ['shipping-density-layer', 'shipping-density-rings', 'shipping-density-label-text']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
  }, [showShippingDensity, mapReady])

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
  const [powerPlants, setPowerPlants] = useState<InfraPoint[]>([])
  useEffect(() => {
    if (!showInfrastructure) return
    let cancelled = false
    fetchAllPowerPlants().then(pts => { if (!cancelled) setPowerPlants(pts) }).catch(() => {})
    return () => { cancelled = true }
  }, [showInfrastructure])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const infraSrc = map.getSource('infrastructure') as mapboxgl.GeoJSONSource | undefined
    if (!infraSrc) return
    const vis = showInfrastructure ? 'visible' : 'none'
    if (map.getLayer('infra-circles')) map.setLayoutProperty('infra-circles', 'visibility', vis)
    if (map.getLayer('infra-labels'))  map.setLayoutProperty('infra-labels',  'visibility', vis)
    if (!showInfrastructure) {
      infraSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    // Populate infra points (curated static + live power plants)
    const infraFeatures: GeoJSON.Feature[] = [...ALL_INFRA_POINTS, ...powerPlants].map(p => ({
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
        mw:        p.capacityMw ?? null,
        river:     p.river     ?? null,
        notes:     p.notes     ?? null,
        status:    p.status,
      },
    }))
    infraSrc.setData({ type: 'FeatureCollection', features: infraFeatures })
  }, [showInfrastructure, mapReady, powerPlants])

  // ── Data Centers GeoJSON (live, OpenStreetMap via Overpass) ───────────────
  const [datacenters, setDatacenters] = useState<DataCenterPoint[]>([])
  useEffect(() => {
    if (!showDatacenters) return
    let cancelled = false
    fetchDataCenters().then(pts => { if (!cancelled) setDatacenters(pts) }).catch(err => console.warn('[DataCenters] load failed:', err))
    return () => { cancelled = true }
  }, [showDatacenters])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const dcSrc = map.getSource('datacenters') as mapboxgl.GeoJSONSource | undefined
    if (!dcSrc) return
    const vis = showDatacenters ? 'visible' : 'none'
    if (map.getLayer('datacenter-circles')) map.setLayoutProperty('datacenter-circles', 'visibility', vis)
    if (map.getLayer('datacenter-labels'))  map.setLayoutProperty('datacenter-labels',  'visibility', vis)
    if (!showDatacenters) {
      dcSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    const dcFeatures: GeoJSON.Feature[] = datacenters.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name:     p.name,
        operator: p.operator ?? null,
        country:  p.country  ?? null,
        notes:    p.notes    ?? null,
      },
    }))
    dcSrc.setData({ type: 'FeatureCollection', features: dcFeatures })
  }, [showDatacenters, mapReady, datacenters])

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

  // ── GPS interference cells update ──────────────────────────────────────────────
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

    const cells = gpsJam?.cells ?? []
    const props = (c: GPSJamData['cells'][number]) => ({
      id: c.id, severity: c.severity, severityLabel: SEVERITY_LABELS[c.severity], color: SEVERITY_COLORS[c.severity],
      pctLabel: `${Math.round(c.percentBad)}%`, good: c.good, bad: c.bad, date: gpsJam!.date,
    })

    // Point features (for labels, heatmap, center dots)
    const pointFeatures: GeoJSON.Feature[] = cells.map(c => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      properties: props(c),
    }))

    // Polygon features (the H3 hexagons themselves)
    const areaFeatures: GeoJSON.Feature[] = cells.map(c => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [c.ring] },
      properties: props(c),
    }))

    src.setData({ type: 'FeatureCollection', features: pointFeatures })
    areaSrc.setData({ type: 'FeatureCollection', features: areaFeatures })
  }, [showGPSJam, gpsJam, mapReady])

  // ── Country analytics update (countries shaded by the compared indicators) ────
  const countryData = useCountryAnalytics(showCountryAnalytics)
  const countryShading = useMemo(
    () => countryColors(countryData.state.mapMode, countryData.ySlice.rows, countryData.ys, countryData.analysis),
    [countryData.state.mapMode, countryData.ySlice.rows, countryData.ys, countryData.analysis],
  )
  countryAnalyticsRef.current = {
    yRows: new Map(countryData.ySlice.rows.map(r => [r.iso3, r])),
    points: new Map((countryData.analysis?.points ?? []).map(p => [p.iso3, p])),
    xShort: countryData.xMeta.short, yShort: countryData.yMeta.short,
    xFormat: countryData.xMeta.format, yFormat: countryData.yMeta.format,
  }
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showCountryAnalytics ? 'visible' : 'none'
    for (const id of ['country-analytics-fill', 'country-analytics-outline']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    if (!showCountryAnalytics || !map.getLayer('country-analytics-fill')) return
    const entries = Object.entries(countryShading.colors)
    // a `match` expression needs at least one label/output pair, so an empty result is a plain transparent fill
    map.setPaintProperty('country-analytics-fill', 'fill-color', entries.length
      ? ['match', ['get', 'iso_3166_1_alpha_3'], ...entries.flat(), 'rgba(0,0,0,0)']
      : 'rgba(0,0,0,0)')
  }, [showCountryAnalytics, countryShading, mapReady])

  // ── Analytics hexagons (wildfires / earthquakes) update ───────────────────────
  const analytics = useAnalyticsData({})
  useEffect(() => {
    if (!showAnalyticsHex) return
    const load = () => { void analyticsData.load(analytics.hexSource) }
    load()
    const timer = window.setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [showAnalyticsHex, analytics.hexSource])
  const hexSlice = analytics[analytics.hexSource]
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('analytics-hex') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    if (map.getLayer('analytics-hex-extrusion')) map.setLayoutProperty('analytics-hex-extrusion', 'visibility', showAnalyticsHex ? 'visible' : 'none')
    if (!showAnalyticsHex) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    src.setData({
      type: 'FeatureCollection',
      features: hexSlice.cells.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [c.ring] },
        // the map ramp starts above the chart ramp's darkest step so low cells don't vanish into satellite imagery
        properties: { source: analytics.hexSource, color: sequentialColor(0.3 + 0.7 * c.intensity), height: c.intensity * HEIGHT_SCALE + 15000, value: c.value, count: c.count, peak: c.peak },
      })),
    })
  }, [showAnalyticsHex, hexSlice.cells, analytics.hexSource, mapReady])

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
        el.textContent = '◎'

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
              <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:2px;">◎ ${cam.name}</div>
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
  }, [viewMode, mapReady])

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
  }, [crises, earthquakes, showCrises, onCrisisClick])

  useEffect(() => { buildCrisisMarkers() }, [buildCrisisMarkers])

  // ── News pins: the most important stories, placed where they happened ──────
  // Independent of the Crises layer — they used to be built inside the crisis-marker pass, which bailed out
  // whenever Crises was off, so neither news nor markets ever showed.
  const newsMarkersRef = useRef<HoverMarker[]>([])
  useEffect(() => {
    newsMarkersRef.current.forEach(m => m.remove())
    newsMarkersRef.current = []
    const map = mapRef.current
    if (!map || !mapReady || !showNews) return
    newsMarkersRef.current = newsPins.map((pin) => {
      const color = NEWS_COLORS[pin.items[0].category]
      const size = pin.items.length > 1 ? 20 : 14
      const el = document.createElement('div')
      el.setAttribute('aria-label', esc(pin.items[0].article.title))
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;` +
        `font:700 9px Inter,sans-serif;color:#fff;border:2px solid #fff;background:${color};`
      if (pin.items.length > 1) el.textContent = String(pin.items.length)
      return addHoverMarker(map, el, pin.lng, pin.lat, newsPinHTML(pin))
    })
    return () => { newsMarkersRef.current.forEach(m => m.remove()); newsMarkersRef.current = [] }
  }, [newsPins, showNews, mapReady])

  // ── Market hubs: exchange chips with the live day change ──────────────────
  const marketMarkersRef = useRef<HoverMarker[]>([])
  useEffect(() => {
    marketMarkersRef.current.forEach(m => m.remove())
    marketMarkersRef.current = []
    const map = mapRef.current
    if (!map || !mapReady || !showStocks) return
    const bySymbol = new Map(stocks.map(s => [s.symbol, s]))
    marketMarkersRef.current = MARKET_HUBS.map((hub) => {
      const q = bySymbol.get(hub.symbol)
      const color = !q ? '#6b7280' : q.change >= 0 ? '#16a34a' : '#dc2626'
      const el = document.createElement('div')
      el.style.cssText = `padding:2px 7px;background:#fff;border:1.5px solid ${color};border-radius:999px;color:${color};` +
        `font:700 10px Inter,sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.25);`
      el.textContent = q ? `${hub.exchange} ${q.change >= 0 ? '▲' : '▼'}${Math.abs(q.changePercent).toFixed(1)}%` : hub.exchange
      return addHoverMarker(map, el, hub.lng, hub.lat, marketPinHTML(hub, q), '260px')
    })
    return () => { marketMarkersRef.current.forEach(m => m.remove()); marketMarkersRef.current = [] }
  }, [stocks, showStocks, mapReady])

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

      {/* ── Country analytics legend ─────────────────────────────────── */}
      {showCountryAnalytics && !deepstateMode && (
        <div style={{ position:'absolute', right:10, bottom: showAnalyticsHex ? 232 : 58, zIndex:30, width:230, padding:'8px 10px', background:'rgba(9,16,22,0.94)', border:'1px solid #263843', borderRadius:6, backdropFilter:'blur(10px)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize:10.5, fontWeight:650, color:'#e5ecef', lineHeight:1.35 }}>
            {countryData.state.mapMode === 'trend' ? `${countryData.yMeta.short} vs what ${countryData.xMeta.short} predicts` : countryData.yMeta.label}
          </div>
          <div style={{ marginTop:6, height:6, borderRadius:3, background: countryData.state.mapMode === 'trend'
            ? `linear-gradient(90deg, ${BELOW}, ${NEUTRAL}, ${ABOVE})` : `linear-gradient(90deg, ${SEQUENTIAL.join(',')})` }} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9, color:'#98aab4' }}>
            {countryData.state.mapMode === 'trend'
              ? <><span>Below trend</span><span>On trend</span><span>Above</span></>
              : <><span>{countryShading.lo === null ? 'Low' : countryData.yMeta.format(countryShading.lo)}</span><span>{countryShading.hi === null ? 'High' : countryData.yMeta.format(countryShading.hi)}</span></>}
          </div>
          <div style={{ marginTop:5, fontSize:9, color:'#647883', lineHeight:1.45 }}>
            {countryData.xSlice.status === 'loading' || countryData.ySlice.status === 'loading' || countryData.ySlice.status === 'idle' ? 'Loading World Bank data…'
              : countryData.ySlice.status === 'error' ? `Could not load this indicator${countryData.ySlice.error ? ` (${countryData.ySlice.error})` : ''}.`
              : Object.keys(countryShading.colors).length === 0 ? 'No countries to shade for this selection.'
              : `${Object.keys(countryShading.colors).length} countries shaded${countryData.state.mapMode === 'value' ? ' (colour clipped to the 2nd–98th percentile)' : ''}. Click a country.`}
          </div>
          <div style={{ marginTop:6, display:'flex', gap:4 }}>
            {(['value', 'trend'] as const).map(m => (
              <button key={m} onClick={() => countryData.setMapMode(m)}
                style={{ padding:'3px 8px', fontSize:9.5, color: countryData.state.mapMode === m ? '#d5a85f' : '#e5ecef', background: countryData.state.mapMode === m ? 'rgba(213,168,95,0.12)' : 'rgba(255,255,255,0.06)', border:'1px solid #263843', borderRadius:4, cursor:'pointer' }}>
                {m === 'value' ? 'Value' : 'Vs trend'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Analytics hexagon legend ─────────────────────────────────── */}
      {showAnalyticsHex && !deepstateMode && (
        <div style={{ position:'absolute', right:10, bottom:58, zIndex:30, width:220, padding:'8px 10px', background:'rgba(9,16,22,0.94)', border:'1px solid #263843', borderRadius:6, backdropFilter:'blur(10px)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize:10.5, fontWeight:650, color:'#e5ecef' }}>
            {analytics.hexSource === 'fires' ? 'Wildfire power, last 24 h' : 'Earthquakes M4.5+, last 7 days'}
          </div>
          <div style={{ marginTop:6, height:6, borderRadius:3, background:`linear-gradient(90deg, ${SEQUENTIAL.join(',')})` }} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9, color:'#98aab4' }}><span>Low</span><span>High</span></div>
          <div style={{ marginTop:5, fontSize:9, color:'#647883', lineHeight:1.45 }}>
            {hexSlice.status === 'loading' || hexSlice.status === 'idle' ? 'Loading…'
              : hexSlice.status === 'error' ? `Could not load this feed${hexSlice.error ? ` (${hexSlice.error})` : ''}.`
              : hexSlice.status === 'empty' ? 'The feed returned no data — nothing to draw.'
              : `${hexSlice.cells.length.toLocaleString()} cells from ${hexSlice.data.length.toLocaleString()} ${analytics.hexSource === 'fires' ? 'detections' : 'quakes'}. Height and colour = ${analytics.hexSource === 'fires' ? 'total fire power' : 'quake count'}. Click a cell.`}
          </div>
          <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
            {(['fires', 'quakes'] as const).map(k => (
              <button key={k} onClick={() => analyticsData.setHexSource(k)}
                style={{ padding:'3px 8px', fontSize:9.5, color: analytics.hexSource === k ? '#d5a85f' : '#e5ecef', background: analytics.hexSource === k ? 'rgba(213,168,95,0.12)' : 'rgba(255,255,255,0.06)', border:'1px solid #263843', borderRadius:4, cursor:'pointer' }}>
                {k === 'fires' ? 'Wildfires' : 'Earthquakes'}
              </button>
            ))}
            <button onClick={() => { const m = mapRef.current; if (m) m.easeTo({ pitch: m.getPitch() > 10 ? 0 : 55, duration: 800 }) }}
              style={{ padding:'3px 8px', fontSize:9.5, color:'#e5ecef', background:'rgba(255,255,255,0.06)', border:'1px solid #263843', borderRadius:4, cursor:'pointer' }}>
              Tilt map
            </button>
          </div>
        </div>
      )}

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
              {LAYER_SECTIONS.map(section => (
                <div key={section.title}>
                  <div style={{ padding:'5px 8px 3px', fontSize:7, fontWeight:700, letterSpacing:'.16em', color:'#647883', background:'rgba(255,255,255,.03)', borderBottom:'1px solid #1c2b35', position:'sticky', top:0, zIndex:1 }}>
                    {section.title}
                  </div>
                  {section.keys.map(key => {
                    const item = { key, ...OVERLAY_ITEMS[key] }
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
              ))}
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
            {onCloseDeepstate && (
              <CloseButton onClick={onCloseDeepstate} label="Close DeepState panel" style={{ color: '#9fb0b8' }} />
            )}
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
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.15 }}>◍</div>
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
