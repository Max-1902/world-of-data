import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { SUPPLY_CHAIN_FACILITIES, FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from '../../../services/supplychain'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { MARK_HALO } from './halo'

export function addSupplyChainLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Supply Chain Facilities GeoJSON source ────────────────────────────
  map.addSource('supplychain', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'supplychain-circles', type: 'circle', source: 'supplychain',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3.5, 5, 5, 8, 7, 12, 10],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.85,
      ...MARK_HALO,
    },
    layout: { visibility: 'none' },
  })
  map.addLayer({
    id: 'supplychain-labels', type: 'symbol', source: 'supplychain', minzoom: 4,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 9,
      'text-offset': [0, 1.4],
      'text-optional': true,
      'text-allow-overlap': false,
      visibility: 'none',
    } as Record<string, unknown>,
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 1.2,
    },
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'supplychain-circles', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, unknown>
    const color = String(p.color || '#00ccff')
    const share = p.globalShare ? `<span style="color:#d97706;font-weight:700;">${p.globalShare}% global share</span>` : ''
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:240px;max-width:310px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
        <span style="font-size:12px;font-weight:800;color:${color};line-height:1.3;">${p.name}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;flex-shrink:0;">${p.typeLabel}</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:5px;font-size:10px;flex-wrap:wrap;">
        <span style="color:#6b7280;">▦ <b style="color:#14161a">${p.operator}</b></span>
        <span style="color:#6b7280;">⚑ <b style="color:#14161a">${p.country}</b></span>
      </div>
      <div style="font-size:11px;color:#14161a;margin-bottom:4px;">⚙ <b>${p.product}</b></div>
      ${share ? `<div style="font-size:11px;margin-bottom:4px;">${share}</div>` : ''}
      ${p.notes ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;">${p.notes}</div>` : ''}
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;word-break:break-word;">SOURCE: ${p.source} · checked ${p.asOf}</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '330px', className: 'cy-popup' })
      .setLngLat((e.features[0].geometry as GeoJSON.Point).coordinates as [number, number])
      .setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'supplychain-circles', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'supplychain-circles', () => { map.getCanvas().style.cursor = '' })
}

/** Supply Chain Facilities GeoJSON */
export function useSupplyChainData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showSupplyChain }: Pick<MapViewProps, 'showSupplyChain'>) {
  // ── Supply Chain Facilities GeoJSON ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('supplychain') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showSupplyChain ? 'visible' : 'none'
    if (map.getLayer('supplychain-circles')) map.setLayoutProperty('supplychain-circles', 'visibility', vis)
    if (map.getLayer('supplychain-labels'))  map.setLayoutProperty('supplychain-labels',  'visibility', vis)
    if (!showSupplyChain) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = SUPPLY_CHAIN_FACILITIES.map(f => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
      properties: {
        name: f.name, type: f.type,
        typeLabel: FACILITY_TYPE_LABELS[f.type],
        color: FACILITY_TYPE_COLORS[f.type],
        operator: f.operator, country: f.country,
        product: f.product, globalShare: f.globalShare ?? null,
        notes: f.notes ?? '', source: f.source, asOf: f.asOf,
      },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [showSupplyChain, mapReady])
}
