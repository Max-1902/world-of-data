import { useEffect, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import { esc } from '../geoPopups'
import { useCountryAnalytics } from '../../../hooks/useCountryAnalytics'
import { WB_ECONOMY_ISO3 } from '../../../services/economies'
import { countryColors, coverage, type Coverage } from '../../../utils/countryStats'
import { EVIDENCE } from '../../../utils/evidence'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

/** Fill for a World Bank economy with nothing to shade, so "no data" reads differently from "low value". */
export const NO_DATA_FILL = '#3a4752'
const FILL_OPACITY = 0.78
const STALE_OPACITY = 0.32
const NO_DATA_OPACITY = 0.55

export interface Shading {
  /** countries given a colour */
  shaded: number
  /** World Bank economies with no colour: no value since 2010, or none the scale can place (e.g. ≤ 0 on a log scale) */
  noData: string[]
  /** coverage of the shaded indicator (value mode) or of the compared pair (trend mode) */
  cover: Coverage
  /** shaded countries whose value — either value, in trend mode — is much older than the typical year */
  stale: ReadonlySet<string>
}

/** Mapbox paint for the fill: indicator colours, grey for economies without data, faded opacity for dated values. */
export function fillPaint(colors: Record<string, string>, noData: readonly string[], stale: ReadonlySet<string>) {
  const colorPairs = [...Object.entries(colors).flat(), ...noData.flatMap(c => [c, NO_DATA_FILL])]
  const opacityPairs = [...[...stale].filter(c => colors[c]).flatMap(c => [c, STALE_OPACITY]), ...noData.flatMap(c => [c, NO_DATA_OPACITY])]
  // a `match` expression needs at least one label/output pair, so an empty list is a plain value
  return {
    color: (colorPairs.length ? ['match', ['get', 'iso_3166_1_alpha_3'], ...colorPairs, 'rgba(0,0,0,0)'] : 'rgba(0,0,0,0)') as mapboxgl.ExpressionSpecification | string,
    opacity: (opacityPairs.length ? ['match', ['get', 'iso_3166_1_alpha_3'], ...opacityPairs, FILL_OPACITY] : FILL_OPACITY) as mapboxgl.ExpressionSpecification | number,
  }
}

export function addCountryAnalyticsLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef, countryAnalyticsRef } = ctx
  // ── Country colouring ("Colour countries by" control): countries shaded by one indicator, or by distance from a trend ──
  map.addSource('country-analytics-countries', { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' })
  map.addLayer({
    id: 'country-analytics-fill', type: 'fill',
    source: 'country-analytics-countries', 'source-layer': 'country_boundaries',
    paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': FILL_OPACITY },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.addLayer({
    id: 'country-analytics-outline', type: 'line',
    source: 'country-analytics-countries', 'source-layer': 'country_boundaries',
    paint: { 'line-color': '#e5ecef', 'line-width': 0.6, 'line-opacity': 0.35 },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.on('click', 'country-analytics-fill', (e) => {
    const feat = e.features?.[0]
    const iso3 = feat?.properties?.iso_3166_1_alpha_3 as string | undefined
    const info = countryAnalyticsRef.current
    if (!iso3 || !info) return
    const yRow = info.yRows.get(iso3)
    const pt = info.points.get(iso3)
    const trend = info.mode === 'trend'
    const name = yRow?.name ?? pt?.name ?? (feat?.properties?.name_en as string | undefined) ?? iso3
    const row = (k: string, v: string) => `<span style="color:#6b7280;">${esc(k)}</span><span style="color:#14161a;">${v}</span>`
    const dated = info.stale.has(iso3) && info.typicalYear !== null
    const derived = info.derived
    const body = [
      yRow ? row(info.yShort, `<b>${esc(info.yFormat(yRow.value))}</b> (${esc(yRow.year)})`) : '',
      trend && pt ? row(info.xShort, `${esc(info.xFormat(pt.x))} (${esc(pt.xYear)})`) : '',
      trend && pt ? row('Trend expects', esc(info.yFormat(pt.expected))) : '',
      trend && pt ? row('Vs trend', `<b style="color:${pt.z >= 0 ? '#c0392b' : '#256abf'};">${pt.z >= 0 ? '+' : '−'}${Math.abs(pt.z).toFixed(1)} σ</b>`) : '',
    ].join('')
    const kind = EVIDENCE[trend ? 'statistical' : 'observed']
    const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:230px;max-width:300px;">
      <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${esc(name)}</div>
      ${body ? `<div style="display:grid;grid-template-columns:100px 1fr;gap:3px 8px;font-size:11px;">${body}</div>` : `<div style="font-size:11px;color:#6b7280;">${derived ? 'Not computed for this country (not one of the economies with a UN Comtrade profile, or its share is only bounded).' : `No value for this country since 2010${trend ? ' in one or both compared indicators' : ''}.`}</div>`}
      ${dated ? `<div style="margin-top:5px;font-size:10px;color:#9a6700;">Dated: most countries report ${info.typicalYear}. Compare with care.</div>` : ''}
      <div style="margin-top:6px;font-size:10px;color:#4b5563;"><b style="text-transform:uppercase;letter-spacing:.06em;">${esc(kind.label)}</b>${trend ? ' · least-squares trend across countries, an association, not a cause' : derived ? ' · computed from reported figures' : ' · as reported'}</div>
      <div style="margin-top:3px;font-size:9px;color:#6b7280;">Source: ${esc(info.source)} · ${derived ? "each country's own reporting year" : "each country's latest year since 2010"}</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' }).setLngLat(e.lngLat).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'country-analytics-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'country-analytics-fill', () => { map.getCanvas().style.cursor = '' })
}

/** Country colouring update: colours, no-data grey, dated-value fading, and what the click popup reads */
export function useCountryAnalyticsLayer({ mapRef, layersReadyRef, mapReady, countryAnalyticsRef }: MapHandle, { showCountryAnalytics }: Pick<MapViewProps, 'showCountryAnalytics'>) {
  const countryData = useCountryAnalytics(showCountryAnalytics)
  const { mapMode } = countryData.state
  const countryShading = useMemo(
    () => countryColors(mapMode, countryData.ySlice.rows, countryData.ys, countryData.analysis),
    [mapMode, countryData.ySlice.rows, countryData.ys, countryData.analysis],
  )
  const shading = useMemo<Shading>(() => {
    let cover: Coverage
    let stale: Set<string>
    if (mapMode === 'trend') {
      const pts = countryData.analysis?.points ?? []
      cover = coverage(pts.map(p => ({ iso3: p.iso3, year: p.yYear })), WB_ECONOMY_ISO3)
      const xCover = coverage(pts.map(p => ({ iso3: p.iso3, year: p.xYear })), WB_ECONOMY_ISO3)
      stale = new Set([...cover.stale, ...xCover.stale])
    } else {
      cover = coverage(countryData.ySlice.rows, WB_ECONOMY_ISO3)
      stale = new Set(cover.stale)
    }
    const noData = [...WB_ECONOMY_ISO3].filter(c => !countryShading.colors[c])
    return { shaded: Object.keys(countryShading.colors).length, noData, cover, stale }
  }, [mapMode, countryData.analysis, countryData.ySlice.rows, countryShading])

  const { xMeta, yMeta } = countryData
  countryAnalyticsRef.current = {
    mode: mapMode,
    yRows: new Map(countryData.ySlice.rows.map(r => [r.iso3, r])),
    points: new Map((countryData.analysis?.points ?? []).map(p => [p.iso3, p])),
    xShort: xMeta.short, yShort: yMeta.short,
    xFormat: xMeta.format, yFormat: yMeta.format,
    source: mapMode === 'trend' && xMeta.source !== yMeta.source ? `${yMeta.source} and ${xMeta.source}` : yMeta.source,
    typicalYear: shading.cover.typicalYear,
    stale: shading.stale,
    derived: yMeta.id.startsWith('derived:') || (mapMode === 'trend' && xMeta.id.startsWith('derived:')),
  }
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showCountryAnalytics ? 'visible' : 'none'
    for (const id of ['country-analytics-fill', 'country-analytics-outline']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    if (!showCountryAnalytics || !map.getLayer('country-analytics-fill')) return
    // nothing is greyed while the data is still loading, so a slow request doesn't paint the world as "no data"
    const ready = countryData.ySlice.status === 'ready' && (mapMode === 'value' || countryData.xSlice.status === 'ready')
    const paint = fillPaint(countryShading.colors, ready ? shading.noData : [], shading.stale)
    map.setPaintProperty('country-analytics-fill', 'fill-color', paint.color)
    map.setPaintProperty('country-analytics-fill', 'fill-opacity', paint.opacity)
  }, [showCountryAnalytics, countryShading, shading, mapMode, countryData.ySlice.status, countryData.xSlice.status, mapReady])
  return { countryData, countryShading, shading }
}
