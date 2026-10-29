import { useEffect, useState } from 'react'
import { esc } from '../geoPopups'
import mapboxgl from 'mapbox-gl'
import { ALL_INFRA_POINTS, INFRA_COLORS, INFRA_LABELS, INFRA_ICONS, fetchAllPowerPlants, type InfraPoint } from '../../../services/infrastructure'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { MARK_ICON_LAYOUT, MARK_ICON_PAINT, addMarkShapes, iconSizeFor, shapeFor } from './markShapes'

export function addInfrastructureLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  addMarkShapes(map)
  const { popupRef } = ctx
  // ── Critical Infrastructure ───────────────────────────────────────────
  map.addSource('infrastructure', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'infra-circles', type: 'symbol', source: 'infrastructure',
    layout: {
      visibility: 'none',
      ...MARK_ICON_LAYOUT,
      // Mark size follows plant capacity (curated dams/LNG/refineries have no MW → mid size)
      'icon-size': ['interpolate', ['linear'], ['zoom'],
        2,  ['interpolate', ['linear'], ['coalesce', ['get', 'mw'], 800], 0, iconSizeFor(1.5), 1000, iconSizeFor(3.5)],
        6,  ['interpolate', ['linear'], ['coalesce', ['get', 'mw'], 800], 0, iconSizeFor(2.5), 1000, iconSizeFor(6)],
        10, ['interpolate', ['linear'], ['coalesce', ['get', 'mw'], 800], 0, iconSizeFor(4),   1000, iconSizeFor(10)],
      ],
      // Larger plants draw on top of small ones
      'symbol-sort-key': ['coalesce', ['get', 'mw'], 800],
    } as Record<string, unknown>,
    paint: { ...MARK_ICON_PAINT } as Record<string, unknown>,
  })
  map.addLayer({
    id: 'infra-labels', type: 'symbol', source: 'infrastructure', minzoom: 6,
    layout: {
      'text-field':    ['get', 'name'],
      'text-font':     ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size':     9,
      'text-offset':   [0, 1.4],
      'text-optional': true,
      'text-allow-overlap': false,
    } as Record<string, unknown>,
    paint: {
      'text-color':       ['get', 'color'],
      'text-halo-color':  'rgba(0,0,0,0.85)',
      'text-halo-width':  1,
    },
    // visibility controlled via setLayoutProperty
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'infra-circles', (e) => {
    if (!e.features?.[0]) return
    const p     = e.features[0].properties as Record<string, unknown>
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
    const color  = String(p.color || '#00ff88')
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:290px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;font-weight:800;color:#14161a;">${p.icon} ${esc(String(p.name))}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}55;padding:1px 5px;">${esc(String(p.typeLabel))}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.5;">
        <div><span style="color:#9ca3af;">Country:</span> ${esc(String(p.country))}</div>
        ${p.capacity ? `<div><span style="color:#9ca3af;">Capacity:</span> <b style="color:${color};">${esc(String(p.capacity))}</b></div>` : ''}
        ${p.river    ? `<div><span style="color:#9ca3af;">River:</span> ${esc(String(p.river))}</div>` : ''}
        ${p.notes    ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">${esc(String(p.notes))}</div>` : ''}
        <div style="margin-top:4px;font-size:10px;color:#${p.status === 'operational' ? '16a34a' : p.status === 'under_construction' ? 'd97706' : p.status === 'unknown' ? '9ca3af' : 'dc2626'};">● ${p.status === 'unknown' ? 'OPERATING STATUS NOT IN SOURCE' : String(p.status).replace('_',' ').toUpperCase()}</div>
      </div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
      .setLngLat(coords).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'infra-circles', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'infra-circles', () => { map.getCanvas().style.cursor = '' })
}

/** Critical Infrastructure GeoJSON */
export function useInfrastructureData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showInfrastructure }: Pick<MapViewProps, 'showInfrastructure'>) {
  // ── Critical Infrastructure GeoJSON ───────────────────────────────────────
  const [powerPlants, setPowerPlants] = useState<InfraPoint[]>([])
  useEffect(() => {
    if (!showInfrastructure) return
    let cancelled = false
    fetchAllPowerPlants().then(pts => { if (!cancelled) setPowerPlants(pts) }).catch(() => {})
    return () => { cancelled = true }
  }, [showInfrastructure])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const infraSrc = map.getSource('infrastructure') as mapboxgl.GeoJSONSource | undefined
    if (!infraSrc) return
    const vis = showInfrastructure ? 'visible' : 'none'
    if (map.getLayer('infra-circles')) map.setLayoutProperty('infra-circles', 'visibility', vis)
    if (map.getLayer('infra-labels'))  map.setLayoutProperty('infra-labels',  'visibility', vis)
    if (!showInfrastructure) {
      infraSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    // Populate infra points (curated static + live power plants)
    const infraFeatures: GeoJSON.Feature[] = [...ALL_INFRA_POINTS, ...powerPlants].map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name:      p.name,
        type:      p.type,
        typeLabel: INFRA_LABELS[p.type],
        color:     INFRA_COLORS[p.type],
        shape:     shapeFor(Object.keys(INFRA_COLORS), p.type),
        icon:      INFRA_ICONS[p.type],
        country:   p.country,
        capacity:  p.capacity  ?? null,
        mw:        p.capacityMw ?? null,
        river:     p.river     ?? null,
        notes:     p.notes     ?? null,
        status:    p.status,
      },
    }))
    infraSrc.setData({ type: 'FeatureCollection', features: infraFeatures })
  }, [showInfrastructure, mapReady, powerPlants])
}
