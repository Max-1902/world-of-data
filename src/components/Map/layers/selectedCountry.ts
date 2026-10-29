import { useEffect } from 'react'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addSelectedCountryLayer(map: mapboxgl.Map, ctx: LayerCtx): void {
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
}

/** Selected-country border highlight */
export function useSelectedCountryHighlight({ mapRef, layersReadyRef, mapReady }: MapHandle, { selectedCountry }: Pick<MapViewProps, 'selectedCountry'>) {
  // ── Selected-country border highlight ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    if (!map.getLayer('selected-country-outline')) return
    map.setFilter('selected-country-outline', ['==', ['get', 'name_en'], selectedCountry || ''])
  }, [selectedCountry, mapReady])
}
