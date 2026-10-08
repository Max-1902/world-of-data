import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Flight } from '../../types'
import type { FlightType } from '../../utils/flightType'
import type { MilitaryPersonnelEntry } from '../../services/militaryPersonnel'
import type { CountryInfraEntry } from '../../services/infraIndicators'
import { ALL_TYPES, buildFlightGeoJSON } from './flightLayer'
import {
  addAllLayers,
  type CountryAnalyticsView,
  useAirspaceData,
  useCameraMarkers,
  useChokepointData,
  useCountryAnalyticsLayer,
  useCountryIndicatorData,
  useDatacenterData,
  useFlightData,
  useGpsJamData,
  useHazardHexLayer,
  useHumanitarianData,
  useInfrastructureData,
  useCrisisMarkers,
  useNewsMarkers,
  useMarketMarkers,
  useMilitaryData,
  useNuclearData,
  useOilGasData,
  useOutageData,
  usePipelineData,
  usePortData,
  useResourcesVisibility,
  useSanctionsVisibility,
  useSelectedCountryHighlight,
  usePlaceMarker,
  useShippingDensityVisibility,
  useSupplyChainData,
  useTradeStatsVisibility,
  useVesselData,
  useViewMode,
  useMapResize,
  useWildfireData,
} from './layers'
import type { MapHandle, MapViewProps } from './types'
import CountryAnalyticsLegend from './overlays/CountryAnalyticsLegend'
import HazardHexLegend from './overlays/HazardHexLegend'
import FlightFilter from './overlays/FlightFilter'
import OverlayMenu from './overlays/OverlayMenu'
import Reticle from './overlays/Reticle'
import DeepStatePanel from './overlays/DeepStatePanel'
import { MAPBOX_TOKEN as TOKEN } from './token'

export default function MapView({
  viewMode, flights, crises, newsPins, stocks, earthquakes,
  showFlights, showCrises, showNews, showStocks,
  deepstateMode,
  onCloseDeepstate, onToggleDeepstate,
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
  panelState, onToggleLayer, onClearLayers,
}: MapViewProps) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<mapboxgl.Map | null>(null)
  const markersRef     = useRef<mapboxgl.Marker[]>([])
  const layersReadyRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const popupRef       = useRef<mapboxgl.Popup | null>(null)
  const flightDataRef  = useRef<Flight[]>([])
  // Handlers are read through refs so the once-only map init below always calls the latest prop.
  const onFlightClickRef = useRef(onFlightClick)
  onFlightClickRef.current = onFlightClick
  const onCountryClickRef = useRef(onCountryClick)
  onCountryClickRef.current = onCountryClick
  const onPlaceClickRef = useRef(onPlaceClick)
  onPlaceClickRef.current = onPlaceClick
  const militaryPersonnelRef = useRef<MilitaryPersonnelEntry[]>([])
  const infraIndicatorsRef = useRef<CountryInfraEntry[]>([])
  const countryAnalyticsRef = useRef<CountryAnalyticsView | null>(null)

  // Filter state
  const [filterQuery, setFilterQuery] = useState('')
  const [filterTypes, setFilterTypes] = useState<Set<FlightType>>(new Set(ALL_TYPES))

  const filteredCount = buildFlightGeoJSON(flights, filterQuery, filterTypes, showFlights).features.length

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
      addAllLayers(map, { popupRef, flightDataRef, militaryPersonnelRef, infraIndicatorsRef, countryAnalyticsRef, onFlightClick: f => onFlightClickRef.current(f), onCountryClickRef, onPlaceClickRef })

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
  }, [])

  const handle: MapHandle = { mapRef, containerRef, layersReadyRef, mapReady, flightDataRef, popupRef, markersRef, militaryPersonnelRef, infraIndicatorsRef, countryAnalyticsRef }

  useFlightData(handle, { flights, showFlights, filterQuery, filterTypes })
  useWildfireData(handle, { fires, showWildfires })
  useVesselData(handle, { vessels, showVessels })
  useSelectedCountryHighlight(handle, { selectedCountry })
  usePlaceMarker(handle, { selectedPlace })
  useSanctionsVisibility(handle, { showSanctions })
  useResourcesVisibility(handle, { showResources })
  useTradeStatsVisibility(handle, { showTradeStats })
  useCountryIndicatorData(handle, { showMilitaryPersonnel, showInfraIndicators })
  useOutageData(handle, { outages, showOutages })
  useMilitaryData(handle, { showMilitary })
  usePortData(handle, { showPorts })
  usePipelineData(handle, { showPipelines })
  useChokepointData(handle, { showChokepoints })
  useSupplyChainData(handle, { showSupplyChain })
  useShippingDensityVisibility(handle, { showShippingDensity })
  useNuclearData(handle, { showNuclear })
  useAirspaceData(handle, { flights, showAirspace })
  useInfrastructureData(handle, { showInfrastructure })
  useDatacenterData(handle, { showDatacenters })
  useHumanitarianData(handle, { showHumanitarian })
  useOilGasData(handle, { showOil, showGas })
  useGpsJamData(handle, { showGPSJam, gpsJam })
  const { countryData, countryShading } = useCountryAnalyticsLayer(handle, { showCountryAnalytics })
  const { analytics, hexSlice } = useHazardHexLayer(handle, { showAnalyticsHex })
  useMapResize(handle, { deepstateMode })
  useCameraMarkers(handle, { showCameras })
  useViewMode(handle, { viewMode })
  useCrisisMarkers(handle, { crises, earthquakes, showCrises, onCrisisClick })
  useNewsMarkers(handle, { newsPins, showNews })
  useMarketMarkers(handle, { stocks, showStocks })

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

      {showCountryAnalytics && !deepstateMode && (
        <CountryAnalyticsLegend countryData={countryData} countryShading={countryShading} raised={showAnalyticsHex} />
      )}
      {showAnalyticsHex && !deepstateMode && (
        <HazardHexLegend
          analytics={analytics}
          hexSlice={hexSlice}
          onTilt={() => { const m = mapRef.current; if (m) m.easeTo({ pitch: m.getPitch() > 10 ? 0 : 55, duration: 800 }) }}
        />
      )}
      {showFlights && !deepstateMode && (
        <FlightFilter
          flights={flights} filteredCount={filteredCount}
          filterQuery={filterQuery} setFilterQuery={setFilterQuery}
          filterTypes={filterTypes} setFilterTypes={setFilterTypes}
        />
      )}
      {panelState && onToggleLayer && (
        <OverlayMenu panelState={panelState} onToggleLayer={onToggleLayer} onClearLayers={onClearLayers} deepstateMode={deepstateMode} onToggleDeepstate={onToggleDeepstate} top={showFlights && !deepstateMode ? 82 : 52} />
      )}
      {!deepstateMode && <Reticle color={reticleColor} />}
      </div>

      {deepstateMode && <DeepStatePanel onClose={onCloseDeepstate} />}

    </div>
  )
}
