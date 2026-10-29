import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { PORTS, PORT_TYPE_COLORS, PORT_TYPE_LABELS } from '../../../services/ports'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { MARK_ICON_LAYOUT, MARK_ICON_PAINT, addMarkShapes, iconSizeFor, shapeFor } from './markShapes'

export function addPortLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  addMarkShapes(map)
  const { popupRef } = ctx
  // ── Ports GeoJSON source ────────────────────────────────────────────
  map.addSource('ports', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'port-circles', type: 'symbol', source: 'ports',
    layout: {
      visibility: 'none',
      ...MARK_ICON_LAYOUT,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 2, iconSizeFor(3), 5, iconSizeFor(5), 8, iconSizeFor(7), 12, iconSizeFor(10)],
    } as Record<string, unknown>,
    paint: { ...MARK_ICON_PAINT } as Record<string, unknown>,
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
    const calls = p.portCalls != null ? `<span style="color:#6b7280;">⚓ <b style="color:#2563eb">${Number(p.portCalls).toLocaleString()} calls</b> · ${p.tradeMt} Mt (${p.activityYear})</span>` : ''
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:290px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
        <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">⎈ ${p.name}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${p.typeLabel}</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:6px;font-size:10px;flex-wrap:wrap;">
        <span style="color:#6b7280;">⚑ <b style="color:#14161a">${p.country}</b></span>
        ${calls}
      </div>
      <div style="font-size:11px;color:#14161a;margin-bottom:4px;">▣ <b>${p.topIndustry}</b></div>
      ${p.notes ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;">${p.notes}</div>` : ''}
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: IMF PORTWATCH (${p.portwatchName}${p.locode ? ` · ${p.locode}` : ''}) · CALLS & TONNES ESTIMATED FROM AIS</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'port-circles', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'port-circles', () => { map.getCanvas().style.cursor = '' })
}

/** Ports GeoJSON */
export function usePortData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showPorts }: Pick<MapViewProps, 'showPorts'>) {
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
        shape:     shapeFor(Object.keys(PORT_TYPE_COLORS), p.type),
        topIndustry: p.topIndustry,
        portCalls:   p.activity?.portCalls ?? null,
        tradeMt:     p.activity?.tradeMt ?? null,
        activityYear: p.activity?.year ?? null,
        portwatchName: p.portwatchName,
        locode:      p.locode ?? '',
        notes:       p.notes ?? '',
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showPorts, mapReady])
}
