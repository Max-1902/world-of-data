import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { NUCLEAR_PLANTS, PLANT_STATUS_COLORS } from '../../../services/military'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { MARK_HALO } from './halo'

export function addNuclearLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Nuclear power plants GeoJSON source ──────────────────────────────
  map.addSource('nuclear-plants', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'nuclear-circles', type: 'circle', source: 'nuclear-plants',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 6, 6, 10, 9],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.88,
      ...MARK_HALO,
    },
    layout: { visibility: 'none' },
  })
  map.addLayer({
    id: 'nuclear-labels', type: 'symbol', source: 'nuclear-plants', minzoom: 6,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 8.5,
      'text-offset': [0, 1.5],
      'text-optional': true,
      'text-allow-overlap': false,
    } as Record<string, unknown>,
    paint: {
      'text-color': '#ffdd00',
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 1.2,
    },
    // label layer — visibility controlled via setLayoutProperty
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'nuclear-circles', (e) => {
    if (!e.features?.[0]) return
    const p    = e.features[0].properties as Record<string, unknown>
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
    const color  = String(p.color || '#ffdd00')
    const statusLabel: Record<string, string> = { operating:'OPERATING', under_construction:'UNDER CONSTRUCTION', shutdown:'SHUTDOWN', planned:'PLANNED' }
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:290px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
        <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">${p.name}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${statusLabel[String(p.status)] ?? p.status}</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:6px;font-size:10px;">
        <span style="color:#6b7280;">◍ <b style="color:#14161a">${p.country}</b></span>
        <span style="color:#6b7280;">⚛ <b style="color:#d97706">${p.type}</b></span>
        <span style="color:#6b7280;">№ <b style="color:#2563eb">${p.reactors} reactor${Number(p.reactors) !== 1 ? 's' : ''}</b></span>
      </div>
      ${p.capacity ? `<div style="font-size:10px;color:#6b7280;margin-bottom:5px;">Capacity: <b style="color:#14161a">${Number(p.capacity).toLocaleString()} MWe</b></div>` : ''}
      <div style="font-size:11px;color:#6b7280;line-height:1.55;margin-bottom:4px;">${p.notes}</div>
      ${p.since ? `<div style="font-size:10px;color:#9ca3af;">First unit: ${p.since}</div>` : ''}
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'nuclear-circles', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'nuclear-circles', () => { map.getCanvas().style.cursor = '' })
}

/** Nuclear power plants GeoJSON */
export function useNuclearData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showNuclear }: Pick<MapViewProps, 'showNuclear'>) {
  // ── Nuclear power plants GeoJSON ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('nuclear-plants') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showNuclear ? 'visible' : 'none'
    if (map.getLayer('nuclear-circles')) map.setLayoutProperty('nuclear-circles', 'visibility', vis)
    if (map.getLayer('nuclear-labels'))  map.setLayoutProperty('nuclear-labels',  'visibility', vis)
    if (!showNuclear) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = NUCLEAR_PLANTS.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name:     p.name,
        country:  p.country,
        reactors: p.reactors,
        capacity: p.capacity,
        status:   p.status,
        type:     p.type,
        notes:    p.notes,
        since:    p.since ?? null,
        color:    PLANT_STATUS_COLORS[p.status],
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showNuclear, mapReady])
}
