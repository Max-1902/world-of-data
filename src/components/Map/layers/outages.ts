import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { getCountryCentroid } from '../../../services/outages'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addOutageLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Internet/power outage GeoJSON source (live, IODA) ─────────────────
  map.addSource('outages', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'outages-circles', type: 'circle', source: 'outages',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 5, 5, 8, 8, 12],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.75,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.3)',
    },
    layout: { visibility: 'none' },
  })
  map.on('click', 'outages-circles', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, unknown>
    const color = String(p.color || '#dc2626')
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:200px;max-width:280px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:13px;font-weight:800;color:#14161a;">${p.entityName}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;">${String(p.level).toUpperCase()}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;">Entity type: ${p.entityType}</div>
      <div style="font-size:11px;color:#6b7280;">Severity score: <b style="color:${color}">${p.score}</b></div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
      .setLngLat((e.features[0].geometry as GeoJSON.Point).coordinates as [number, number])
      .setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'outages-circles', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'outages-circles', () => { map.getCanvas().style.cursor = '' })
}

/** Outages GeoJSON (live) */
export function useOutageData({ mapRef, layersReadyRef, mapReady }: MapHandle, { outages, showOutages }: Pick<MapViewProps, 'outages' | 'showOutages'>) {
  // ── Outages GeoJSON (live) ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('outages') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showOutages ? 'visible' : 'none'
    if (map.getLayer('outages-circles')) map.setLayoutProperty('outages-circles', 'visibility', vis)
    if (!showOutages) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    const features: GeoJSON.Feature[] = []
    for (const o of outages) {
      const centroid = getCountryCentroid(o.entityCode)
      if (!centroid) continue
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: centroid },
        properties: {
          entityName: o.entityName,
          entityType: o.entityType,
          level:      o.level,
          score:      o.score,
          color:      o.level === 'critical' ? '#dc2626' : '#d97706',
        },
      })
    }
    src.setData({ type: 'FeatureCollection', features })
  }, [outages, showOutages, mapReady])
}
