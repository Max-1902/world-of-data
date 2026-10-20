import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { esc } from '../geoPopups'
import { PIPELINE_COLORS, PIPELINE_LABELS, PIPELINE_ATTRIBUTION, PIPELINE_DETAIL_MIN_ZOOM, fetchTrunkPipelines, fetchPipelineCell, cellsForBounds, type PipelineFeature } from '../../../services/pipelines'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addPipelineLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Oil & gas pipelines (OpenStreetMap) ─────────────────────────────
  // 'pipelines' = world snapshot of long-distance lines; 'pipelines-detail'
  // = live per-way geometry loaded when zoomed in (see services/pipelines.ts).
  const pipeColor: mapboxgl.Expression = ['match', ['get', 'substance'],
    'oil', PIPELINE_COLORS.oil, 'gas', PIPELINE_COLORS.gas, '#ffffff']
  const pipeWidth = (scale: number): mapboxgl.Expression => ['interpolate', ['linear'], ['zoom'],
    1, 0.7 * scale, 4, 1.2 * scale, 7, 1.9 * scale, 10, 3 * scale, 14, 4.5 * scale]
  const pipeLayout = { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' } as const
  // Underground / subsea segments are drawn dashed, above-ground solid.
  const pipeDash: mapboxgl.Expression = ['match', ['get', 'location'],
    ['underground', 'underwater'], ['literal', [2, 1.5]], ['literal', [1, 0]]]

  map.addSource('pipelines',        { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('pipelines-detail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

  // World snapshot fades out as the detailed live geometry takes over.
  map.addLayer({
    id: 'pipeline-casing', type: 'line', source: 'pipelines', layout: pipeLayout,
    paint: {
      'line-color': '#04121a',
      'line-width': pipeWidth(1.9),
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 10, 0.1],
    },
  })
  map.addLayer({
    id: 'pipeline-lines', type: 'line', source: 'pipelines', layout: pipeLayout,
    paint: {
      'line-color': pipeColor,
      'line-width': pipeWidth(1),
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.95, 10, 0.35],
    },
  })
  map.addLayer({
    id: 'pipeline-detail-casing', type: 'line', source: 'pipelines-detail', layout: pipeLayout,
    paint: { 'line-color': '#04121a', 'line-width': pipeWidth(1.9), 'line-opacity': 0.55 },
  })
  map.addLayer({
    id: 'pipeline-detail-lines', type: 'line', source: 'pipelines-detail', layout: pipeLayout,
    paint: {
      'line-color': pipeColor,
      'line-width': pipeWidth(1),
      'line-opacity': 0.95,
      'line-dasharray': pipeDash,
    },
  })
  map.addLayer({
    id: 'pipeline-labels', type: 'symbol', source: 'pipelines', minzoom: 4,
    filter: ['!=', ['get', 'name'], ''],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 420,
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 11, 12, 12],
      'text-max-angle': 30,
      'text-allow-overlap': false,
      'text-optional': true,
      visibility: 'none',
    } as Record<string, unknown>,
    paint: {
      'text-color': pipeColor,
      'text-halo-color': 'rgba(4,18,26,0.92)',
      'text-halo-width': 1.6,
    },
  } as Parameters<typeof map.addLayer>[0])

  const PIPE_HIT = ['pipeline-lines', 'pipeline-detail-lines']
  map.on('click', PIPE_HIT, (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, unknown>
    const sub = p.substance === 'oil' ? 'oil' : 'gas'
    const color = PIPELINE_COLORS[sub]
    const rows = [
      p.operator ? `<div><span style="color:#9ca3af;">Operator:</span> ${esc(p.operator)}</div>` : '',
      p.diameter ? `<div><span style="color:#9ca3af;">Diameter:</span> ${esc(p.diameter)} mm</div>` : '',
      p.location ? `<div><span style="color:#9ca3af;">Laid:</span> ${esc(p.location)}</div>` : '',
    ].join('')
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:300px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;gap:6px;">
        <span style="font-size:12px;font-weight:800;color:#14161a;line-height:1.3;">${esc(p.name) || `Unnamed ${PIPELINE_LABELS[sub].toLowerCase()} pipeline`}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${color};border:1px solid ${color}88;padding:1px 5px;flex-shrink:0;background:#0b1c26;">${PIPELINE_LABELS[sub].toUpperCase()}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.6;">${rows}</div>
      <div style="margin-top:5px;font-size:10px;color:#9ca3af;">${PIPELINE_ATTRIBUTION}${p.osm ? ` · <a href="https://www.openstreetmap.org/${esc(p.osm)}" target="_blank" rel="noopener noreferrer">${esc(p.osm)}</a>` : ''}</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '330px', className: 'cy-popup' })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', PIPE_HIT, () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', PIPE_HIT, () => { map.getCanvas().style.cursor = '' })
}

/** Oil & gas pipelines (OSM): world snapshot + live detail when zoomed in */
export function usePipelineData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showPipelines }: Pick<MapViewProps, 'showPipelines'>) {
  // ── Oil & gas pipelines (OSM): world snapshot + live detail when zoomed in ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('pipelines') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showPipelines ? 'visible' : 'none'
    for (const id of ['pipeline-casing', 'pipeline-lines', 'pipeline-labels', 'pipeline-detail-casing', 'pipeline-detail-lines']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
    if (!showPipelines) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    let cancelled = false
    fetchTrunkPipelines().then(fc => { if (!cancelled) src.setData(fc) })
    return () => { cancelled = true }
  }, [showPipelines, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const detail = map.getSource('pipelines-detail') as mapboxgl.GeoJSONSource | undefined
    if (!detail) return
    const clear = () => detail.setData({ type: 'FeatureCollection', features: [] })
    if (!showPipelines) { clear(); return }

    let seq = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      const mine = ++seq
      if (map.getZoom() < PIPELINE_DETAIL_MIN_ZOOM) { clear(); return }
      const b = map.getBounds()
      if (!b) return
      const cells = cellsForBounds(b.getWest(), b.getSouth(), b.getEast(), b.getNorth())
      const byId = new Map<string, PipelineFeature>()
      const POOL = 3
      for (let i = 0; i < cells.length && mine === seq; i += POOL) {
        const chunk = await Promise.all(cells.slice(i, i + POOL).map(fetchPipelineCell))
        if (mine !== seq) return
        for (const feats of chunk) for (const f of feats) byId.set(f.properties.osm, f)
        detail.setData({ type: 'FeatureCollection', features: [...byId.values()] })
      }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 350) }
    map.on('moveend', schedule)
    schedule()
    return () => { seq++; clearTimeout(timer); map.off('moveend', schedule) }
  }, [showPipelines, mapReady])
}
