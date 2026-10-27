import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addWildfireLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
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
        <div style="margin-top:4px;font-size:10px;color:#9ca3af;font-variant-numeric:tabular-nums;">${coords[1].toFixed(4)}°, ${coords[0].toFixed(4)}°</div>
      </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '260px', className: 'cy-popup' })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'fires-dots', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'fires-dots', () => { map.getCanvas().style.cursor = '' })
}

/** Update wildfire GeoJSON */
export function useWildfireData({ mapRef, layersReadyRef }: MapHandle, { fires, showWildfires }: Pick<MapViewProps, 'fires' | 'showWildfires'>) {
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
}
