/**
 * Displacement layers (part of the Humanitarian overlay): live UNHCR origin → asylum corridors,
 * circles for the countries people are fleeing (sized by total displaced, coloured by
 * year-on-year change, pulsing where it grew) and rings for the countries hosting them, over a
 * country fill by displaced population. Data: src/services/displacement.ts.
 *
 * Arcs follow the great circle between the two countries' Natural Earth label points, bowed
 * slightly to the right of travel so opposite flows don't overlap. They link origin and host;
 * they are not the route people took, and every popup says so.
 */
import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import type { LayerCtx } from './types'
import type { MapHandle } from '../types'
import { markFeatureClick } from './countryClick'
import { esc } from '../geoPopups'
import { useDisplacement } from '../../../hooks/useDisplacement'
import { greatCircle, bowRight } from '../../../utils/geodesic'
import { TREND_COLORS, TREND_LABELS, changeLabel, type DisplacementSnapshot, type Trend } from '../../../services/displacement'

const FLOWS = 'displacement-flows'
const COUNTRIES = 'displacement-countries'
const BOUNDARIES = 'displacement-boundaries'

export const DISPLACEMENT_LAYERS = [
  'displacement-fill',
  'displacement-flows-glow', 'displacement-flows', 'displacement-flows-arrows',
  'displacement-hosts', 'displacement-origins-pulse', 'displacement-origins',
  'displacement-flows-labels', 'displacement-origins-labels',
] as const

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const trendColor = ['match', ['get', 'trend'],
  'new', TREND_COLORS.new, 'rising', TREND_COLORS.rising, 'falling', TREND_COLORS.falling, TREND_COLORS.steady,
] as unknown as mapboxgl.Expression

const fmt = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M' : n >= 1_000 ? Math.round(n / 1_000) + 'K' : String(Math.round(n))
const arrow = (t: Trend) => t === 'rising' || t === 'new' ? '▲' : t === 'falling' ? '▼' : '•'

export function addDisplacementLayers(map: mapboxgl.Map, ctx: LayerCtx, beforeId?: string): void {
  const { popupRef } = ctx
  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined
  const add = (layer: Parameters<typeof map.addLayer>[0]) => map.addLayer(layer, before)

  map.addSource(FLOWS, { type: 'geojson', data: EMPTY })
  map.addSource(COUNTRIES, { type: 'geojson', data: EMPTY })
  map.addSource(BOUNDARIES, { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' })

  // Country fill — colour is set from live data in the hook (transparent until then).
  add({
    id: 'displacement-fill', type: 'fill', source: BOUNDARIES, 'source-layer': 'country_boundaries',
    paint: { 'fill-color': 'rgba(0,0,0,0)' },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])

  add({
    id: 'displacement-flows-glow', type: 'line', source: FLOWS,
    paint: { 'line-color': trendColor, 'line-width': ['*', ['get', 'w'], 3], 'line-blur': 4, 'line-opacity': 0.16 },
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
  })
  add({
    id: 'displacement-flows', type: 'line', source: FLOWS,
    paint: { 'line-color': trendColor, 'line-width': ['get', 'w'], 'line-opacity': 0.85, 'line-dasharray': [0, 4, 3] },
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
  })
  // Chevrons along each arc point the way people moved.
  add({
    id: 'displacement-flows-arrows', type: 'symbol', source: FLOWS,
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 90,
      'text-field': '›', 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': ['+', 12, ['*', ['get', 'w'], 2]],
      'text-keep-upright': false, 'text-rotation-alignment': 'map', 'text-allow-overlap': true, 'text-ignore-placement': true,
      visibility: 'none',
    },
    paint: { 'text-color': trendColor, 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1 },
  } as Parameters<typeof map.addLayer>[0])

  // Host countries: hollow rings sized by people hosted.
  add({
    id: 'displacement-hosts', type: 'circle', source: COUNTRIES, filter: ['>', ['get', 'hosted'], 0],
    paint: {
      'circle-radius': ['get', 'hr'], 'circle-color': 'rgba(96,165,250,0.06)',
      'circle-stroke-color': '#60a5fa', 'circle-stroke-width': 1.25, 'circle-stroke-opacity': 0.7,
    },
    layout: { visibility: 'none' },
  })
  // Countries where displacement grew: an expanding ring (animated in the hook).
  add({
    id: 'displacement-origins-pulse', type: 'circle', source: COUNTRIES,
    filter: ['all', ['>', ['get', 'displaced'], 0], ['in', ['get', 'trend'], ['literal', ['rising', 'new']]]],
    paint: { 'circle-radius': ['get', 'r'], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': trendColor, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.6 },
    layout: { visibility: 'none' },
  })
  add({
    id: 'displacement-origins', type: 'circle', source: COUNTRIES, filter: ['>', ['get', 'displaced'], 0],
    paint: {
      'circle-radius': ['get', 'r'], 'circle-color': trendColor, 'circle-opacity': 0.42,
      'circle-stroke-color': trendColor, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.9,
    },
    layout: { visibility: 'none' },
  })
  add({
    id: 'displacement-flows-labels', type: 'symbol', source: FLOWS, minzoom: 3.5,
    layout: {
      'symbol-placement': 'line-center', 'text-field': ['get', 'label'],
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'], 'text-size': 10, 'text-offset': [0, -0.8],
      visibility: 'none',
    },
    paint: { 'text-color': '#e5e7eb', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.4 },
  } as Parameters<typeof map.addLayer>[0])
  add({
    id: 'displacement-origins-labels', type: 'symbol', source: COUNTRIES,
    filter: ['>=', ['get', 'displaced'], 500_000],
    layout: {
      'text-field': ['format', ['get', 'name'], { 'font-scale': 1 }, '\n', {}, ['get', 'sub'], { 'font-scale': 0.85 }],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 10,
      'text-anchor': 'top', 'text-offset': [0, 1.1], 'text-optional': true,
      'symbol-sort-key': ['-', 0, ['get', 'displaced']],
      visibility: 'none',
    },
    paint: { 'text-color': '#f3f4f6', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.4 },
  } as Parameters<typeof map.addLayer>[0])

  const show = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }, html: string) => {
    popupRef.current?.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '280px', className: 'cy-popup' }).setLngLat(e.lngLat).setHTML(html).addTo(map)
    markFeatureClick(map)
  }
  const box = (body: string, year: unknown) => `<div style="padding:8px 10px;font-family:'Inter',-apple-system,sans-serif;max-width:260px;">${body}
    <div style="margin-top:6px;font-size:9px;color:#9ca3af;line-height:1.4;">Source: UNHCR Refugee Data Finder, ${esc(year)} figures</div></div>`
  const row = (label: string, value: string, color = '#e5e7eb') =>
    `<div style="display:flex;justify-content:space-between;gap:10px;font-size:10.5px;"><span style="color:#9ca3af;">${label}</span><b style="color:${color};font-variant-numeric:tabular-nums;">${value}</b></div>`

  map.on('click', 'displacement-flows', (e) => {
    const p = e.features?.[0]?.properties as Record<string, string | number> | undefined
    if (!p) return
    const trend = String(p.trend) as Trend
    const parts = [
      Number(p.refugees) ? `refugees ${fmt(Number(p.refugees))}` : '',
      Number(p.asylum) ? `asylum-seekers ${fmt(Number(p.asylum))}` : '',
      Number(p.oip) ? `others in need of protection ${fmt(Number(p.oip))}` : '',
    ].filter(Boolean).join(' · ')
    show(e, box(`
      <div style="font-size:12px;font-weight:800;color:#f3f4f6;margin-bottom:4px;">${esc(p.fromName)} → ${esc(p.toName)}</div>
      ${row('People from ' + esc(p.fromName) + ' in ' + esc(p.toName), Number(p.count).toLocaleString())}
      <div style="font-size:9.5px;color:#9ca3af;margin:2px 0 4px;">${esc(parts)}</div>
      ${row(esc(p.prevYear) + ' → ' + esc(p.year), `${fmt(Number(p.prev))} → ${fmt(Number(p.count))} (${esc(changeLabel(Number(p.count), Number(p.prev)))})`, TREND_COLORS[trend])}
      <div style="font-size:9.5px;color:${TREND_COLORS[trend]};margin-top:2px;">${esc(TREND_LABELS[trend])}</div>
      <div style="margin-top:6px;font-size:9px;color:#9ca3af;line-height:1.4;">The line joins the two countries; UNHCR doesn't publish the route people took. A change in this number can be new arrivals, returns, onward moves or re-registration.</div>`, p.year))
  })

  const countryPopup = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
    const p = e.features?.[0]?.properties as Record<string, string | number> | undefined
    if (!p) return
    const trend = String(p.trend) as Trend, hTrend = String(p.hostedTrend) as Trend
    const displaced = Number(p.displaced), hosted = Number(p.hosted)
    show(e, box(`
      <div style="font-size:12px;font-weight:800;color:#f3f4f6;margin-bottom:4px;">${esc(p.name)}</div>
      ${displaced ? `
        ${row('Displaced from here', displaced.toLocaleString(), TREND_COLORS[trend])}
        ${row('&nbsp;&nbsp;abroad', Number(p.abroad).toLocaleString())}
        ${row('&nbsp;&nbsp;inside the country (IDPs)', Number(p.idps).toLocaleString())}
        ${row('vs ' + esc(p.prevYear), changeLabel(displaced, Number(p.displacedPrev)), TREND_COLORS[trend])}` : ''}
      ${hosted ? `<div style="height:5px"></div>
        ${row('Hosted from other countries', hosted.toLocaleString(), '#60a5fa')}
        ${row('vs ' + esc(p.prevYear), changeLabel(hosted, Number(p.hostedPrev)), TREND_COLORS[hTrend])}` : ''}
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;line-height:1.4;">IDP figures are UNHCR's (conflict-related). Palestine refugees under UNRWA's mandate are not included.</div>`, p.year))
  }
  map.on('click', 'displacement-origins', countryPopup)
  map.on('click', 'displacement-hosts', countryPopup)
  for (const id of ['displacement-flows', 'displacement-origins', 'displacement-hosts']) {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' })
  }
}

/** Pure: GeoJSON for the corridor and country sources. Exported for tests. */
export function displacementGeoJSON(snap: DisplacementSnapshot): { flows: GeoJSON.FeatureCollection; countries: GeoJSON.FeatureCollection } {
  const meta = { year: snap.year, prevYear: snap.prevYear }
  const flows: GeoJSON.Feature[] = snap.corridors.map(c => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: bowRight(greatCircle(c.fromPoint, c.toPoint, 48), 0.1) },
    properties: {
      ...meta, from: c.from, to: c.to, fromName: c.fromName, toName: c.toName,
      count: c.count, prev: c.prev, refugees: c.refugees, asylum: c.asylumSeekers, oip: c.oip, trend: c.trend,
      w: Math.round((1 + Math.sqrt(c.count / 1_000_000) * 3) * 10) / 10,
      label: `${c.fromName} → ${c.toName} · ${fmt(c.count)} ${arrow(c.trend)}${c.prev > 0 ? changeLabel(c.count, c.prev) : 'new'}`,
    },
  }))
  const countries: GeoJSON.Feature[] = snap.countries.map(c => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: c.point },
    properties: {
      ...meta, iso3: c.iso3, name: c.name,
      displaced: c.displaced, displacedPrev: c.abroadPrev + c.idpsPrev, abroad: c.abroad, idps: c.idps,
      hosted: c.hosted, hostedPrev: c.hostedPrev, trend: c.trend, hostedTrend: c.hostedTrend,
      r: Math.round((3 + Math.sqrt(c.displaced / 1_000_000) * 6.5) * 10) / 10,
      hr: Math.round((3 + Math.sqrt(c.hosted / 1_000_000) * 6.5) * 10) / 10,
      sub: `${fmt(c.displaced)} displaced ${arrow(c.trend)}`,
    },
  }))
  return { flows: { type: 'FeatureCollection', features: flows }, countries: { type: 'FeatureCollection', features: countries } }
}

/** Fill colour: displaced population per country (origin side), on a square-root ramp. */
export function displacementFill(snap: DisplacementSnapshot): mapboxgl.Expression {
  const match: unknown[] = ['match', ['get', 'iso_3166_1_alpha_3']]
  for (const c of snap.countries) if (c.displaced > 0) match.push(c.iso3, c.displaced)
  match.push(0)
  return ['interpolate', ['linear'], ['sqrt', match],
    0, 'rgba(0,0,0,0)',
    Math.sqrt(50_000), 'rgba(239,68,68,0.06)',
    Math.sqrt(1_000_000), 'rgba(239,68,68,0.18)',
    Math.sqrt(5_000_000), 'rgba(239,68,68,0.26)',
    Math.sqrt(12_000_000), 'rgba(239,68,68,0.34)',
  ] as unknown as mapboxgl.Expression
}

// Moving dashes (Mapbox's "animate a line" sequence): reads as a stream heading origin → host.
const DASH_SEQUENCE = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
]

export function useDisplacementLayerData({ mapRef, layersReadyRef, mapReady }: MapHandle, visible: boolean) {
  const state = useDisplacement(visible)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = visible ? 'visible' : 'none'
    for (const id of DISPLACEMENT_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    const flows = map.getSource(FLOWS) as mapboxgl.GeoJSONSource | undefined
    const countries = map.getSource(COUNTRIES) as mapboxgl.GeoJSONSource | undefined
    if (!visible || state.status !== 'ok') {
      flows?.setData(EMPTY); countries?.setData(EMPTY)
      if (map.getLayer('displacement-fill')) map.setPaintProperty('displacement-fill', 'fill-color', 'rgba(0,0,0,0)')
      return
    }
    const geo = displacementGeoJSON(state.snap)
    flows?.setData(geo.flows)
    countries?.setData(geo.countries)
    if (map.getLayer('displacement-fill')) map.setPaintProperty('displacement-fill', 'fill-color', displacementFill(state.snap))
  }, [visible, mapReady, state])

  // Flowing dashes on the corridors and an expanding ring where displacement grew.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !visible || state.status !== 'ok') return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0, tick = -1
    const animate = (t: number) => {
      raf = requestAnimationFrame(animate)
      // ~16 updates a second is smooth enough and keeps style recalculation cheap
      const now = Math.floor(t / 60)
      if (now === tick) return
      tick = now
      if (map.getLayer('displacement-flows')) map.setPaintProperty('displacement-flows', 'line-dasharray', DASH_SEQUENCE[now % DASH_SEQUENCE.length])
      if (map.getLayer('displacement-origins-pulse')) {
        const phase = (t % 2400) / 2400
        map.setPaintProperty('displacement-origins-pulse', 'circle-radius', ['+', ['get', 'r'], phase * 14])
        map.setPaintProperty('displacement-origins-pulse', 'circle-stroke-opacity', 0.7 * (1 - phase))
      }
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [visible, mapReady, state])
}
