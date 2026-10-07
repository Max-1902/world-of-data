import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { SEVERITY_COLORS, SEVERITY_LABELS, GPSJAM_ATTRIBUTION, type GPSJamData } from '../../../services/gpsjam'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addGpsJamLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── GPS Jamming interference zones ───────────────────────────────────
  // Point source (for labels + heatmap)
  map.addSource('gpsjam', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  // Polygon source (actual radius coverage areas)
  map.addSource('gpsjam-areas', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  // Fill layer — actual affected area polygons
  map.addLayer({
    id: 'gpsjam-fill',
    type: 'fill',
    source: 'gpsjam-areas',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': ['match', ['get', 'severity'], 'high', 0.35, 0.2],
    },
    layout: { visibility: 'none' },
  })
  // Outline of affected area
  map.addLayer({
    id: 'gpsjam-outline',
    type: 'line',
    source: 'gpsjam-areas',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['match', ['get', 'severity'], 'high', 1, 0.7],
      'line-opacity': 0.6,
    },
    layout: { visibility: 'none' },
  })
  // Heatmap glow layer
  map.addLayer({
    id: 'gpsjam-heat',
    type: 'heatmap',
    source: 'gpsjam',
    maxzoom: 8,
    paint: {
      'heatmap-weight': ['match', ['get', 'severity'], 'high', 1, 0.5],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 8, 2],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 20, 4, 40, 6, 60, 8, 80],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)',
        0.2, 'rgba(255,100,0,0.15)',
        0.4, 'rgba(255,60,0,0.3)',
        0.6, 'rgba(255,34,68,0.45)',
        0.8, 'rgba(255,0,40,0.6)',
        1.0, 'rgba(255,0,20,0.8)',
      ],
      'heatmap-opacity': 0.75,
    },
    layout: { visibility: 'none' },
  })
  // Small center dot markers
  map.addLayer({
    id: 'gpsjam-circles',
    type: 'circle',
    source: 'gpsjam',
    minzoom: 3,
    paint: {
      'circle-radius': ['match', ['get', 'severity'], 'high', 4, 3],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-opacity': 0.9,
    },
    layout: { visibility: 'none' },
  })
  // Labels
  map.addLayer({
    id: 'gpsjam-labels',
    type: 'symbol',
    source: 'gpsjam',
    minzoom: 6,
    layout: {
      'text-field': ['get', 'pctLabel'],
      'text-size': 9,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-anchor': 'center',
      'text-allow-overlap': false,
      'text-optional': true,
      visibility: 'none',
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0,0,0,0.85)',
      'text-halo-width': 1.2,
    },
  })
  // Click popup — same card whether the dot or the hex is clicked
  for (const layerId of ['gpsjam-circles', 'gpsjam-fill']) {
    map.on('click', layerId, (e) => {
      if (!e.features?.[0]) return
      const p = e.features[0].properties as Record<string, unknown>
      const sevColor = String(p.color || '#ff2244')
      const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:220px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${sevColor};box-shadow:0 0 8px ${sevColor}88;"></div>
          <span style="font-size:12px;font-weight:700;color:${sevColor};letter-spacing:.06em;">GPS INTERFERENCE</span>
        </div>
        <div style="font-size:10px;color:#9ca3af;letter-spacing:.12em;margin-bottom:6px;">${String(p.date)} (UTC DAY)</div>
        <div style="display:grid;grid-template-columns:90px 1fr;gap:3px 8px;font-size:11px;">
          <span style="color:#9ca3af;">Level</span><span style="color:${sevColor};font-weight:700;">${String(p.severityLabel)}</span>
          <span style="color:#9ca3af;">Degraded</span><span style="color:#14161a;">${String(p.pctLabel)} of aircraft</span>
          <span style="color:#9ca3af;">Aircraft seen</span><span style="color:#14161a;">${Number(p.bad)} degraded · ${Number(p.good)} good</span>
        </div>
        <div style="margin-top:6px;font-size:10px;color:#6b7280;line-height:1.5;">Share of aircraft crossing this ~22 km cell that reported low navigation accuracy. Suggests jamming or spoofing but can't prove the cause.</div>
        <div style="margin-top:5px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: ${GPSJAM_ATTRIBUTION}</div>
      </div>`
      if (popupRef.current) popupRef.current.remove()
      popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' })
        .setLngLat(layerId === 'gpsjam-circles' ? (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number] : e.lngLat)
        .setHTML(html).addTo(map)
      ;(map as any).__markFeatureClick?.()
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  }
}

/** GPS interference cells update */
export function useGpsJamData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showGPSJam, gpsJam }: Pick<MapViewProps, 'showGPSJam' | 'gpsJam'>) {
  // ── GPS interference cells update ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('gpsjam') as mapboxgl.GeoJSONSource | undefined
    const areaSrc = map.getSource('gpsjam-areas') as mapboxgl.GeoJSONSource | undefined
    if (!src || !areaSrc) return

    const vis = showGPSJam ? 'visible' : 'none'
    for (const lid of ['gpsjam-heat', 'gpsjam-circles', 'gpsjam-labels', 'gpsjam-fill', 'gpsjam-outline']) {
      if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', vis)
    }

    if (!showGPSJam) {
      src.setData({ type: 'FeatureCollection', features: [] })
      areaSrc.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    const cells = gpsJam?.cells ?? []
    const props = (c: GPSJamData['cells'][number]) => ({
      id: c.id, severity: c.severity, severityLabel: SEVERITY_LABELS[c.severity], color: SEVERITY_COLORS[c.severity],
      pctLabel: `${Math.round(c.percentBad)}%`, good: c.good, bad: c.bad, date: gpsJam!.date,
    })

    // Point features (for labels, heatmap, center dots)
    const pointFeatures: GeoJSON.Feature[] = cells.map(c => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      properties: props(c),
    }))

    // Polygon features (the H3 hexagons themselves)
    const areaFeatures: GeoJSON.Feature[] = cells.map(c => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [c.ring] },
      properties: props(c),
    }))

    src.setData({ type: 'FeatureCollection', features: pointFeatures })
    areaSrc.setData({ type: 'FeatureCollection', features: areaFeatures })
  }, [showGPSJam, gpsJam, mapReady])
}
