import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { UNHCR_OFFICES, BORDER_CROSSINGS, REFUGEE_CAMPS, CROSSING_STATUS_COLORS, OFFICE_TYPE_COLORS } from '../../../services/unhcr'
import { addDisplacementLayers, useDisplacementLayerData } from './displacement'
import { destinationPoint } from '../flightLayer'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addHumanitarianLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Humanitarian (UNHCR offices, border crossings, refugee camps) ────────
  map.addSource('humanitarian-offices',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('humanitarian-crossings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('humanitarian-camps',     { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

  // UNHCR Offices – blue circles by type
  map.addLayer({
    id: 'humanitarian-offices', type: 'circle', source: 'humanitarian-offices',
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 3, 5, 5, 9, 8],
      'circle-color':        ['get', 'color'],
      'circle-opacity':      0.9,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(0,170,255,0.55)',
    },
    layout: { visibility: 'none' },
  })
  map.addLayer({
    id: 'humanitarian-offices-labels', type: 'symbol', source: 'humanitarian-offices', minzoom: 4,
    layout: {
      'text-field':         ['get', 'city'],
      'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size':          8,
      'text-offset':        [0, 1.3],
      'text-optional':      true,
      'text-allow-overlap': false,
      'visibility':         'none',
    } as Record<string, unknown>,
    paint: { 'text-color': '#00aaff', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.2 },
  } as Parameters<typeof map.addLayer>[0])

  // Border Crossings – exact crossing path (the physical road/axis across the border)
  map.addSource('humanitarian-crossing-paths', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  // Wide soft glow underlay
  map.addLayer({
    id: 'humanitarian-crossing-path-glow', type: 'line', source: 'humanitarian-crossing-paths',
    paint: {
      'line-color':   ['get', 'statusColor'],
      'line-width':   ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 6, 12, 10],
      'line-opacity': 0.18,
      'line-blur':    3,
    },
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
  })
  // Crisp dashed crossing axis
  map.addLayer({
    id: 'humanitarian-crossing-path', type: 'line', source: 'humanitarian-crossing-paths',
    paint: {
      'line-color':     ['get', 'statusColor'],
      'line-width':     ['interpolate', ['linear'], ['zoom'], 4, 1.4, 8, 2.2, 12, 3],
      'line-opacity':   0.95,
      'line-dasharray': ['match', ['get', 'status'], 'closed', ['literal', [1, 1.4]], ['literal', [3, 1.6]]],
    },
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
  })
  // Perpendicular "gate" ticks marking the actual border line at each crossing
  map.addSource('humanitarian-crossing-gates', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'humanitarian-crossing-gate', type: 'line', source: 'humanitarian-crossing-gates',
    paint: {
      'line-color': ['get', 'statusColor'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.6, 8, 2.4, 12, 3.2],
      'line-opacity': 0.9,
    },
    layout: { 'line-cap': 'round', visibility: 'none' },
  })
  map.addLayer({
    id: 'humanitarian-crossings', type: 'circle', source: 'humanitarian-crossings',
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 5, 10, 7],
      'circle-color':        ['get', 'statusColor'],
      'circle-opacity':      0.85,
      'circle-stroke-width': 1.2,
      'circle-stroke-color': 'rgba(0,0,0,0.55)',
    },
    layout: { visibility: 'none' },
  })
  map.addLayer({
    id: 'humanitarian-crossings-labels', type: 'symbol', source: 'humanitarian-crossings', minzoom: 5,
    layout: {
      'text-field':         ['get', 'name'],
      'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size':          7.5,
      'text-offset':        [0, 1.3],
      'text-optional':      true,
      'text-allow-overlap': false,
      'visibility':         'none',
    } as Record<string, unknown>,
    paint: { 'text-color': ['get', 'statusColor'], 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.2 },
  } as Parameters<typeof map.addLayer>[0])

  // Refugee Camps – cyan/green circles scaled by population
  map.addLayer({
    id: 'humanitarian-camps', type: 'circle', source: 'humanitarian-camps',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        1, ['interpolate', ['linear'], ['get', 'pop'], 0, 2, 1000000, 8],
        6, ['interpolate', ['linear'], ['get', 'pop'], 0, 4, 1000000, 18],
        10, ['interpolate', ['linear'], ['get', 'pop'], 0, 6, 1000000, 26],
      ],
      'circle-color':        ['get', 'color'],
      'circle-opacity':      0.75,
      'circle-stroke-width': 1.2,
      'circle-stroke-color': 'rgba(0,0,0,0.5)',
    },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.addLayer({
    id: 'humanitarian-camps-labels', type: 'symbol', source: 'humanitarian-camps', minzoom: 4,
    layout: {
      'text-field':         ['get', 'name'],
      'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size':          8,
      'text-offset':        [0, 1.4],
      'text-optional':      true,
      'text-allow-overlap': false,
      'visibility':         'none',
    } as Record<string, unknown>,
    paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.2 },
  } as Parameters<typeof map.addLayer>[0])

  // ── Heatmap: displacement intensity from camp populations ──────────
  map.addSource('humanitarian-heatmap', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'humanitarian-heatmap',
    type: 'heatmap',
    source: 'humanitarian-heatmap',
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['get', 'pop'], 0, 0, 1_000_000, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 6, 1.5],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 0, 15, 6, 50, 10, 80],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(0,0,0,0)',
        0.1, 'rgba(0,50,120,0.3)',
        0.3, 'rgba(0,100,200,0.5)',
        0.5, 'rgba(0,255,136,0.55)',
        0.7, 'rgba(255,200,0,0.65)',
        0.9, 'rgba(255,100,0,0.75)',
        1,   'rgba(255,30,30,0.85)',
      ],
      'heatmap-opacity': 0.7,
    },
    layout: { visibility: 'none' },
  }, 'humanitarian-offices')

  // ── Clustered camps/offices with pulsing ──────────────────────────
  map.addSource('humanitarian-clusters', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 10,
    clusterRadius: 60,
    clusterProperties: { totalPop: ['+', ['get', 'pop']] },
  })
  // Cluster circles — sized by aggregated population
  map.addLayer({
    id: 'humanitarian-cluster-circles',
    type: 'circle',
    source: 'humanitarian-clusters',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'interpolate', ['linear'], ['get', 'totalPop'],
        10_000,    'rgba(0,170,255,0.5)',
        500_000,   'rgba(255,200,0,0.6)',
        2_000_000, 'rgba(255,60,30,0.7)',
      ],
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'totalPop'],
        10_000, 14,
        500_000, 28,
        2_000_000, 42,
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,0.25)',
      'circle-opacity': 0.7,
    },
    layout: { visibility: 'none' },
  })
  // Outer pulsing ring (larger, lower opacity)
  map.addLayer({
    id: 'humanitarian-cluster-pulse',
    type: 'circle',
    source: 'humanitarian-clusters',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color':   'transparent',
      'circle-radius':  [
        'interpolate', ['linear'], ['get', 'totalPop'],
        10_000, 20,
        500_000, 38,
        2_000_000, 56,
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': [
        'interpolate', ['linear'], ['get', 'totalPop'],
        10_000,    'rgba(0,170,255,0.3)',
        2_000_000, 'rgba(255,60,30,0.3)',
      ],
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 8, 0.9],
    },
    layout: { visibility: 'none' },
  })
  // Cluster count label
  map.addLayer({
    id: 'humanitarian-cluster-count',
    type: 'symbol',
    source: 'humanitarian-clusters',
    filter: ['has', 'point_count'],
    layout: {
      'text-field':       ['concat', ['get', 'point_count'], ' sites'],
      'text-font':        ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size':        9,
      'text-allow-overlap': true,
      visibility:         'none',
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 },
  } as Parameters<typeof map.addLayer>[0])

  // Click handlers — clusters (zoom in on click)
  map.on('click', 'humanitarian-cluster-circles', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['humanitarian-cluster-circles'] })
    if (!features.length) return
    const clusterId = features[0].properties?.cluster_id
    const src = map.getSource('humanitarian-clusters') as mapboxgl.GeoJSONSource
    src.getClusterExpansionZoom(clusterId, (_err, zoom) => {
      const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
      map.easeTo({ center: coords, zoom: zoom ?? (map.getZoom() + 2) })
    })
  })
  map.on('mouseenter', 'humanitarian-cluster-circles', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'humanitarian-cluster-circles', () => { map.getCanvas().style.cursor = '' })

  // Click handlers
  map.on('click', 'humanitarian-offices', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, string>
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:210px;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></div>
        <span style="font-size:11px;font-weight:800;color:#14161a;">UNHCR ${p.city}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.6;">
        <div><span style="color:#9ca3af;">Office:</span> ${p.name}</div>
        <div><span style="color:#9ca3af;">Country:</span> ${p.country}</div>
        <div><span style="color:#9ca3af;">Type:</span> <b style="color:#2563eb;">${p.officeType.toUpperCase()}</b></div>
      </div>
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR PRESENCE MAP · unhcr.org</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '280px', className: 'cy-popup' })
      .setLngLat(coords).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'humanitarian-offices',   () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'humanitarian-offices',   () => { map.getCanvas().style.cursor = '' })

  map.on('click', 'humanitarian-crossings', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, string>
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
    const statusLabel = p.status.toUpperCase()
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:210px;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <div style="width:8px;height:8px;border-radius:50%;background:${p.statusColor};flex-shrink:0;"></div>
        <span style="font-size:11px;font-weight:800;color:#14161a;">${p.name}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.6;">
        <div><span style="color:#9ca3af;">Countries:</span> ${p.country1} ↔ ${p.country2}</div>
        <div><span style="color:#9ca3af;">Status:</span> <b style="color:${p.statusColor};">${statusLabel}</b></div>
      </div>
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR BORDER CROSSING POINTS</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '280px', className: 'cy-popup' })
      .setLngLat(coords).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'humanitarian-crossings', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'humanitarian-crossings', () => { map.getCanvas().style.cursor = '' })

  map.on('click', 'humanitarian-crossing-path', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, string>
    const statusLabel = p.status.toUpperCase()
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:210px;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <div style="width:8px;height:8px;border-radius:50%;background:${p.statusColor};flex-shrink:0;"></div>
        <span style="font-size:11px;font-weight:800;color:#14161a;">${p.name}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.6;">
        <div><span style="color:#9ca3af;">Countries:</span> ${p.country1} ↔ ${p.country2}</div>
        <div><span style="color:#9ca3af;">Status:</span> <b style="color:${p.statusColor};">${statusLabel}</b></div>
        <div><span style="color:#9ca3af;">Crossing axis:</span> mapped to true bearing</div>
      </div>
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR BORDER CROSSING POINTS</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '280px', className: 'cy-popup' })
      .setLngLat(e.lngLat).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'humanitarian-crossing-path', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'humanitarian-crossing-path', () => { map.getCanvas().style.cursor = '' })

  map.on('click', 'humanitarian-camps', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, unknown>
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
    const pop = Number(p.pop ?? 0)
    const fmt = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : n.toString()
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></div>
        <span style="font-size:11px;font-weight:800;color:#14161a;">${p.name}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.6;">
        <div><span style="color:#9ca3af;">Country:</span> ${p.country}</div>
        <div><span style="color:#9ca3af;">Population:</span> <b style="color:${p.color};">${fmt(pop)} people</b></div>
        <div><span style="color:#9ca3af;">Type:</span> ${String(p.campType).replace('_', ' ').toUpperCase()}</div>
        ${p.notes ? `<div style="margin-top:3px;font-size:10px;color:#9ca3af;">${p.notes}</div>` : ''}
      </div>
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: UNHCR POPULATION REFERENCE POINTS</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '290px', className: 'cy-popup' })
      .setLngLat(coords).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'humanitarian-camps', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'humanitarian-camps', () => { map.getCanvas().style.cursor = '' })

  // Live UNHCR corridors, origin/host circles and the country fill, drawn beneath the point markers.
  addDisplacementLayers(map, ctx, 'humanitarian-offices')
}

/** Humanitarian (UNHCR) layers */
export function useHumanitarianData(handle: MapHandle, { showHumanitarian }: Pick<MapViewProps, 'showHumanitarian'>) {
  const { mapRef, layersReadyRef, mapReady } = handle
  useDisplacementLayerData(handle, showHumanitarian)
  // ── Humanitarian (UNHCR) layers ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const HUM_LAYERS = [
      'humanitarian-offices', 'humanitarian-offices-labels',
      'humanitarian-crossing-path-glow', 'humanitarian-crossing-path', 'humanitarian-crossing-gate',
      'humanitarian-crossings', 'humanitarian-crossings-labels',
      'humanitarian-camps', 'humanitarian-camps-labels',
      'humanitarian-heatmap',
      'humanitarian-cluster-circles', 'humanitarian-cluster-pulse',
      'humanitarian-cluster-count',
    ]
    const vis = showHumanitarian ? 'visible' : 'none'
    HUM_LAYERS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis) })
    if (!showHumanitarian) {
      ;(['humanitarian-offices', 'humanitarian-crossings', 'humanitarian-crossing-paths', 'humanitarian-crossing-gates', 'humanitarian-camps',
        'humanitarian-heatmap', 'humanitarian-clusters',
      ] as const).forEach(srcId => {
        const src = map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined
        src?.setData({ type: 'FeatureCollection', features: [] })
      })
      return
    }

    // Populate offices
    const officesSrc = map.getSource('humanitarian-offices') as mapboxgl.GeoJSONSource | undefined
    officesSrc?.setData({
      type: 'FeatureCollection',
      features: UNHCR_OFFICES.map(o => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [o.lng, o.lat] },
        properties: { name: o.name, city: o.city, country: o.country, officeType: o.type, color: OFFICE_TYPE_COLORS[o.type] },
      })),
    })

    // Populate crossings
    const crossSrc = map.getSource('humanitarian-crossings') as mapboxgl.GeoJSONSource | undefined
    crossSrc?.setData({
      type: 'FeatureCollection',
      features: BORDER_CROSSINGS.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { name: c.name, country1: c.country1, country2: c.country2, status: c.status, statusColor: CROSSING_STATUS_COLORS[c.status] },
      })),
    })

    // Populate exact crossing paths — a short geodesic segment along the true
    // crossing axis (country1 → country2), plus a perpendicular gate tick at the border.
    const CROSSING_HALF_LEN_KM = 1.4
    const GATE_HALF_LEN_KM = 0.55
    const pathSrc  = map.getSource('humanitarian-crossing-paths') as mapboxgl.GeoJSONSource | undefined
    const gateSrc  = map.getSource('humanitarian-crossing-gates') as mapboxgl.GeoJSONSource | undefined
    pathSrc?.setData({
      type: 'FeatureCollection',
      features: BORDER_CROSSINGS.map(c => {
        const from = destinationPoint(c.lng, c.lat, (c.bearing + 180) % 360, CROSSING_HALF_LEN_KM)
        const to   = destinationPoint(c.lng, c.lat, c.bearing, CROSSING_HALF_LEN_KM)
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: [from, [c.lng, c.lat], to] },
          properties: { name: c.name, country1: c.country1, country2: c.country2, status: c.status, statusColor: CROSSING_STATUS_COLORS[c.status] },
        }
      }),
    })
    gateSrc?.setData({
      type: 'FeatureCollection',
      features: BORDER_CROSSINGS.map(c => {
        const perp = (c.bearing + 90) % 360
        const from = destinationPoint(c.lng, c.lat, perp, GATE_HALF_LEN_KM)
        const to   = destinationPoint(c.lng, c.lat, (perp + 180) % 360, GATE_HALF_LEN_KM)
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: [from, to] },
          properties: { name: c.name, status: c.status, statusColor: CROSSING_STATUS_COLORS[c.status] },
        }
      }),
    })

    // Populate camps
    const campSrc = map.getSource('humanitarian-camps') as mapboxgl.GeoJSONSource | undefined
    const campColor = (type: string) => {
      if (type === 'camp')       return '#00ff88'
      if (type === 'settlement') return '#00ff88'
      if (type === 'poc_site')   return '#ffdd00'
      if (type === 'transit')    return '#ffaa00'
      return '#8844ff'
    }
    campSrc?.setData({
      type: 'FeatureCollection',
      features: REFUGEE_CAMPS.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { name: c.name, country: c.country, pop: c.population, campType: c.type, notes: c.notes ?? null, color: campColor(c.type) },
      })),
    })

    // Populate heatmap (same camp data, weighted by population)
    const heatSrc = map.getSource('humanitarian-heatmap') as mapboxgl.GeoJSONSource | undefined
    heatSrc?.setData({
      type: 'FeatureCollection',
      features: REFUGEE_CAMPS.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { pop: c.population },
      })),
    })

    // Populate clustered source (camps + offices merged)
    const clusterSrc = map.getSource('humanitarian-clusters') as mapboxgl.GeoJSONSource | undefined
    const allPoints: GeoJSON.Feature[] = [
      ...REFUGEE_CAMPS.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { name: c.name, pop: c.population, kind: 'camp' },
      })),
      ...UNHCR_OFFICES.map(o => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [o.lng, o.lat] },
        properties: { name: o.name, pop: 1000, kind: 'office' },
      })),
    ]
    clusterSrc?.setData({ type: 'FeatureCollection', features: allPoints })
  }, [showHumanitarian, mapReady])

  // ── Animate cluster pulse ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !showHumanitarian) return
    let frame = 0
    let raf: number
    const animate = () => {
      frame++
      // Pulse the cluster outer ring opacity
      if (map.getLayer('humanitarian-cluster-pulse')) {
        const pulse = 0.3 + Math.sin(frame * 0.04) * 0.2
        map.setPaintProperty('humanitarian-cluster-pulse', 'circle-stroke-opacity', pulse)
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [showHumanitarian, mapReady])
}
