import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { FIR_REGIONS, analyzeAirspace } from '../../../services/notam'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addAirspaceLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
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
}

/** Airspace closure overlay */
export function useAirspaceData({ mapRef, layersReadyRef }: MapHandle, { flights, showAirspace }: Pick<MapViewProps, 'flights' | 'showAirspace'>) {
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
}
