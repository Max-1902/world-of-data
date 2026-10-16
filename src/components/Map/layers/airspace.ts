import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { FIR_REGIONS, analyzeAirspace } from '../../../services/notam'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addAirspaceLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  // ── Airspace low-traffic overlay (heuristic, not closures) ───────────
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
  map.addLayer({
    id: 'airspace-fill', type: 'fill', source: 'airspace-fir',
    paint: {
      // very low / low traffic vs a hand-set reference: amber and grey, not "closure" red (see services/notam.ts)
      'fill-color': ['match', ['get', 'status'],
        'very_low', '#ff8800',
        'low',      '#9ca3af',
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
        'very_low', '#ff8800',
        'low',      '#9ca3af',
        'rgba(0,255,136,0.13)',
      ],
      'line-width': ['match', ['get', 'status'], 'very_low', 1.5, 'low', 1, 0.4],
      'line-dasharray': ['match', ['get', 'status'], 'very_low', ['literal', [1, 0]], 'low', ['literal', [1, 0]], ['literal', [2, 4]]],
      'line-opacity': ['match', ['get', 'status'], 'very_low', 0.75, 'low', 0.75, 0.2],
    },
    layout: { visibility: 'none' },
  })
}

/** Airspace low-traffic overlay: OpenSky counts vs hand-set references (services/notam.ts) */
export function useAirspaceData({ mapRef, layersReadyRef }: MapHandle, { flights, showAirspace }: Pick<MapViewProps, 'flights' | 'showAirspace'>) {
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
