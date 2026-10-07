import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { CHOKEPOINTS, CHOKEPOINT_COLORS } from '../../../services/chokepoints'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addChokepointLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Chokepoints GeoJSON source ──────────────────────────────────────
  map.addSource('chokepoints', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'chokepoint-zones', type: 'fill', source: 'chokepoints',
    paint: {
      'fill-color': CHOKEPOINT_COLORS.zone,
      'fill-opacity': 0.12,
    },
    layout: { visibility: 'none' },
  })
  map.addLayer({
    id: 'chokepoint-borders', type: 'line', source: 'chokepoints',
    paint: {
      'line-color': CHOKEPOINT_COLORS.zoneBorder,
      'line-width': 2,
      'line-opacity': 0.7,
      'line-dasharray': [4, 2],
    },
    layout: { visibility: 'none' },
  })
  map.addSource('chokepoint-labels', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'chokepoint-label-layer', type: 'symbol', source: 'chokepoint-labels',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 6, 12],
      'text-allow-overlap': true,
      visibility: 'none',
    } as Record<string, unknown>,
    paint: {
      'text-color': '#ff4466',
      'text-halo-color': 'rgba(0,0,0,0.9)',
      'text-halo-width': 1.5,
    },
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'chokepoint-zones', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, unknown>
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:250px;max-width:320px;">
      <div style="font-size:12px;font-weight:800;color:#dc2626;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:5px;">${p.name}</div>
      <div style="display:grid;grid-template-columns:90px 1fr;gap:3px 8px;font-size:11px;">
        <span style="color:#9ca3af;">Daily Transits</span><span style="color:#ea580c;font-weight:700;">${p.dailyTransits} vessels</span>
        <span style="color:#9ca3af;">World Trade</span><span style="color:#d97706;font-weight:700;">${p.pctWorldTrade}%</span>
        ${p.pctOilTrade ? `<span style="color:#9ca3af;">Oil Trade</span><span style="color:#ea580c;font-weight:700;">${p.pctOilTrade}%</span>` : ''}
        <span style="color:#9ca3af;">Controlled By</span><span style="color:#14161a;">${p.controlledBy}</span>
      </div>
      <div style="margin-top:6px;font-size:11px;color:#6b7280;"><b>Key goods:</b> ${p.keyGoods}</div>
      <div style="margin-top:4px;font-size:11px;color:#dc2626;"><b>Risks:</b> ${p.risks}</div>
      ${p.notes ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">${p.notes}</div>` : ''}
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: IMF PORTWATCH · UNCTAD</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '340px', className: 'cy-popup' })
      .setLngLat(e.lngLat).setHTML(html).addTo(map)
    ;(map as any).__markFeatureClick?.()
  })
  map.on('mouseenter', 'chokepoint-zones', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'chokepoint-zones', () => { map.getCanvas().style.cursor = '' })
}

/** Chokepoints GeoJSON */
export function useChokepointData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showChokepoints }: Pick<MapViewProps, 'showChokepoints'>) {
  // ── Chokepoints GeoJSON ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('chokepoints') as mapboxgl.GeoJSONSource | undefined
    const labelSrc = map.getSource('chokepoint-labels') as mapboxgl.GeoJSONSource | undefined
    if (!src || !labelSrc) return
    const vis = showChokepoints ? 'visible' : 'none'
    if (map.getLayer('chokepoint-zones'))       map.setLayoutProperty('chokepoint-zones',       'visibility', vis)
    if (map.getLayer('chokepoint-borders'))     map.setLayoutProperty('chokepoint-borders',     'visibility', vis)
    if (map.getLayer('chokepoint-label-layer')) map.setLayoutProperty('chokepoint-label-layer', 'visibility', vis)
    if (!showChokepoints) {
      src.setData({ type: 'FeatureCollection', features: [] })
      labelSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    const zoneFeatures: GeoJSON.Feature[] = CHOKEPOINTS.map(c => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [c.zone] },
      properties: {
        name: c.name, dailyTransits: c.dailyTransits,
        pctWorldTrade: c.pctWorldTrade, pctOilTrade: c.pctOilTrade ?? null,
        keyGoods: c.keyGoods.join(', '), risks: c.risks.join(', '),
        controlledBy: c.controlledBy, notes: c.notes ?? '',
      },
    }))
    const labelFeatures: GeoJSON.Feature[] = CHOKEPOINTS.map(c => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { name: c.name },
    }))
    src.setData({ type: 'FeatureCollection', features: zoneFeatures })
    labelSrc.setData({ type: 'FeatureCollection', features: labelFeatures })
  }, [showChokepoints, mapReady])
}
