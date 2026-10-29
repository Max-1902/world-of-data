import type { LayerCtx } from './types'

export function addBaseLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
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
}
