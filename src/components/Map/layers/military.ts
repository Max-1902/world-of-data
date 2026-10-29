import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { MILITARY_FACILITIES, FACILITY_COLORS, FACILITY_LABELS } from '../../../services/military'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { MARK_ICON_LAYOUT, MARK_ICON_PAINT, addMarkShapes, iconSizeFor, shapeFor } from './markShapes'

export function addMilitaryLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  addMarkShapes(map)
  const { popupRef } = ctx
  // ── Military facilities GeoJSON source ───────────────────────────────
  map.addSource('military', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'military-circles', type: 'symbol', source: 'military',
    layout: {
      visibility: 'none',
      ...MARK_ICON_LAYOUT,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 2, iconSizeFor(3.5), 6, iconSizeFor(5), 10, iconSizeFor(8)],
    } as Record<string, unknown>,
    paint: { ...MARK_ICON_PAINT } as Record<string, unknown>,
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
    markFeatureClick(map)
  })
  map.on('mouseenter', 'military-circles', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'military-circles', () => { map.getCanvas().style.cursor = '' })
}

/** Military facilities GeoJSON */
export function useMilitaryData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showMilitary }: Pick<MapViewProps, 'showMilitary'>) {
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
        shape:     shapeFor(Object.keys(FACILITY_COLORS), f.type),
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
}
