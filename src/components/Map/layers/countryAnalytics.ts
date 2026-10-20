import { useEffect, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import { esc } from '../geoPopups'
import { useCountryAnalytics } from '../../../hooks/useCountryAnalytics'
import { countryColors } from '../../../utils/countryStats'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addCountryAnalyticsLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef, countryAnalyticsRef } = ctx
  // ── Country analytics (Country Analytics panel): countries shaded by the compared indicators ─────
  map.addSource('country-analytics-countries', { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' })
  map.addLayer({
    id: 'country-analytics-fill', type: 'fill',
    source: 'country-analytics-countries', 'source-layer': 'country_boundaries',
    paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0.78 },
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
    const name = yRow?.name ?? pt?.name ?? (feat?.properties?.name_en as string | undefined) ?? iso3
    const row = (k: string, v: string) => `<span style="color:#9ca3af;">${esc(k)}</span><span style="color:#14161a;">${v}</span>`
    const body = [
      yRow ? row(info.yShort, `<b>${esc(info.yFormat(yRow.value))}</b> (${esc(yRow.year)})`) : '',
      pt ? row(info.xShort, `${esc(info.xFormat(pt.x))} (${esc(pt.xYear)})`) : '',
      pt ? row('Trend expects', esc(info.yFormat(pt.expected))) : '',
      pt ? row('Vs trend', `<b style="color:${pt.z >= 0 ? '#c0392b' : '#256abf'};">${pt.z >= 0 ? '+' : '−'}${Math.abs(pt.z).toFixed(1)} σ</b>`) : '',
    ].join('')
    const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:230px;">
      <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${esc(name)}</div>
      ${body ? `<div style="display:grid;grid-template-columns:100px 1fr;gap:3px 8px;font-size:11px;">${body}</div>` : `<div style="font-size:11px;color:#9ca3af;">No data for this country in the selected indicators.</div>`}
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: WORLD BANK OPEN DATA · LATEST YEAR SINCE 2010</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' }).setLngLat(e.lngLat).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'country-analytics-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'country-analytics-fill', () => { map.getCanvas().style.cursor = '' })
}

/** Country analytics update (countries shaded by the compared indicators) */
export function useCountryAnalyticsLayer({ mapRef, layersReadyRef, mapReady, countryAnalyticsRef }: MapHandle, { showCountryAnalytics }: Pick<MapViewProps, 'showCountryAnalytics'>) {
  // ── Country analytics update (countries shaded by the compared indicators) ────
  const countryData = useCountryAnalytics(showCountryAnalytics)
  const countryShading = useMemo(
    () => countryColors(countryData.state.mapMode, countryData.ySlice.rows, countryData.ys, countryData.analysis),
    [countryData.state.mapMode, countryData.ySlice.rows, countryData.ys, countryData.analysis],
  )
  countryAnalyticsRef.current = {
    yRows: new Map(countryData.ySlice.rows.map(r => [r.iso3, r])),
    points: new Map((countryData.analysis?.points ?? []).map(p => [p.iso3, p])),
    xShort: countryData.xMeta.short, yShort: countryData.yMeta.short,
    xFormat: countryData.xMeta.format, yFormat: countryData.yMeta.format,
  }
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showCountryAnalytics ? 'visible' : 'none'
    for (const id of ['country-analytics-fill', 'country-analytics-outline']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    if (!showCountryAnalytics || !map.getLayer('country-analytics-fill')) return
    const entries = Object.entries(countryShading.colors)
    // a `match` expression needs at least one label/output pair, so an empty result is a plain transparent fill
    map.setPaintProperty('country-analytics-fill', 'fill-color', entries.length
      ? ['match', ['get', 'iso_3166_1_alpha_3'], ...entries.flat(), 'rgba(0,0,0,0)']
      : 'rgba(0,0,0,0)')
  }, [showCountryAnalytics, countryShading, mapReady])
  return { countryData, countryShading }
}
