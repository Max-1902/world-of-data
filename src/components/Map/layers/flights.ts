import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { Flight } from '../../../types'
import { FLIGHT_TYPE_COLORS, type FlightType } from '../../../utils/flightType'
import { ALL_TYPES, buildFlightGeoJSON, aircraftCache, fetchAircraftMeta, buildFlightHTML, addAirplaneImage } from '../flightLayer'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addFlightLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef, flightDataRef, onFlightClick } = ctx
  // ── Add airplane SDF image ───────────────────────────────────────────
  addAirplaneImage(map)

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
        'airline', FLIGHT_TYPE_COLORS.airline,
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
}

/** Update flight GeoJSON */
export function useFlightData({ mapRef, layersReadyRef, flightDataRef }: MapHandle, { flights, showFlights, filterQuery, filterTypes }: Pick<MapViewProps, 'flights' | 'showFlights'> & { filterQuery: string; filterTypes: Set<FlightType> }) {
  // ── Update flight GeoJSON ─────────────────────────────────────────────────
  useEffect(() => {
    flightDataRef.current = flights
    if (!mapRef.current || !layersReadyRef.current) return
    const src = mapRef.current.getSource('flights') as mapboxgl.GeoJSONSource | undefined
    src?.setData(buildFlightGeoJSON(flights, filterQuery, filterTypes, showFlights))
  }, [flights, filterQuery, filterTypes, showFlights])
}
