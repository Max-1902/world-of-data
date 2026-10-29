import { useEffect } from 'react'
import { CHOKEPOINTS, SHIPPING_LANE_LABEL_IDS } from '../../../services/chokepoints'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addShippingDensityLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
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
}

/** Shipping density raster toggle */
export function useShippingDensityVisibility({ mapRef, layersReadyRef, mapReady }: MapHandle, { showShippingDensity }: Pick<MapViewProps, 'showShippingDensity'>) {
  // ── Shipping density raster toggle ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showShippingDensity ? 'visible' : 'none'
    for (const id of ['shipping-density-layer', 'shipping-density-rings', 'shipping-density-label-text']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
  }, [showShippingDensity, mapReady])
}
