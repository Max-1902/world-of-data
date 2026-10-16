import { useEffect, useState } from 'react'
import { esc } from '../geoPopups'
import mapboxgl from 'mapbox-gl'
import { fetchDataCenters, type DataCenterPoint } from '../../../services/datacenters'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addDatacenterLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Data Centers (OpenStreetMap, live) ────────────────────────────────
  map.addSource('datacenters', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'datacenter-circles', type: 'circle', source: 'datacenters',
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 2, 2.5, 6, 4.5, 10, 7],
      'circle-color':        '#a855f7',
      'circle-opacity':      0.9,
      'circle-stroke-width': 1.2,
      'circle-stroke-color': 'rgba(0,0,0,0.5)',
    },
    layout: { visibility: 'none' },
  })
  map.addLayer({
    id: 'datacenter-labels', type: 'symbol', source: 'datacenters', minzoom: 7,
    layout: {
      'text-field':    ['get', 'name'],
      'text-font':     ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size':     9,
      'text-offset':   [0, 1.4],
      'text-optional': true,
      'text-allow-overlap': false,
    } as Record<string, unknown>,
    paint: {
      'text-color':      '#a855f7',
      'text-halo-color': 'rgba(0,0,0,0.85)',
      'text-halo-width': 1,
    },
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'datacenter-circles', (e) => {
    if (!e.features?.[0]) return
    const p      = e.features[0].properties as Record<string, unknown>
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:280px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;font-weight:800;color:#14161a;">▤ ${esc(String(p.name))}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:#a855f7;border:1px solid #a855f755;padding:1px 5px;">DATA CENTER</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.5;">
        ${p.operator ? `<div><span style="color:#9ca3af;">Operator:</span> ${esc(String(p.operator))}</div>` : ''}
        ${p.country  ? `<div><span style="color:#9ca3af;">Country:</span> ${esc(String(p.country))}</div>` : ''}
        ${p.notes    ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">${esc(String(p.notes))}</div>` : ''}
        <div style="margin-top:4px;font-size:10px;color:#9ca3af;">Source: OpenStreetMap</div>
      </div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
      .setLngLat(coords).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'datacenter-circles', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'datacenter-circles', () => { map.getCanvas().style.cursor = '' })
}

/** Data Centers GeoJSON (live, OpenStreetMap via Overpass) */
export function useDatacenterData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showDatacenters }: Pick<MapViewProps, 'showDatacenters'>) {
  // ── Data Centers GeoJSON (live, OpenStreetMap via Overpass) ───────────────
  const [datacenters, setDatacenters] = useState<DataCenterPoint[]>([])
  useEffect(() => {
    if (!showDatacenters) return
    let cancelled = false
    fetchDataCenters().then(pts => { if (!cancelled) setDatacenters(pts) }).catch(err => console.warn('[DataCenters] load failed:', err))
    return () => { cancelled = true }
  }, [showDatacenters])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const dcSrc = map.getSource('datacenters') as mapboxgl.GeoJSONSource | undefined
    if (!dcSrc) return
    const vis = showDatacenters ? 'visible' : 'none'
    if (map.getLayer('datacenter-circles')) map.setLayoutProperty('datacenter-circles', 'visibility', vis)
    if (map.getLayer('datacenter-labels'))  map.setLayoutProperty('datacenter-labels',  'visibility', vis)
    if (!showDatacenters) {
      dcSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    const dcFeatures: GeoJSON.Feature[] = datacenters.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name:     p.name,
        operator: p.operator ?? null,
        country:  p.country  ?? null,
        notes:    p.notes    ?? null,
      },
    }))
    dcSrc.setData({ type: 'FeatureCollection', features: dcFeatures })
  }, [showDatacenters, mapReady, datacenters])
}
