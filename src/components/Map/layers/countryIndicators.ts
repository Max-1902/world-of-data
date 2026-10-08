import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { fetchMilitaryPersonnelRanking } from '../../../services/militaryPersonnel'
import { fetchInfraIndicatorRanking } from '../../../services/infraIndicators'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addCountryIndicatorLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef, militaryPersonnelRef, infraIndicatorsRef } = ctx
  // ── Armed forces personnel country fill layer (World Bank, live-ranked) ──
  // Colors/opacity are set once the ranking loads (see effect below) since
  // rank order depends on live data rather than a static curated list.
  map.addSource('military-personnel-countries', {
    type: 'vector',
    url:  'mapbox://mapbox.country-boundaries-v1',
  })
  map.addLayer({
    id: 'military-personnel-fill', type: 'fill',
    source: 'military-personnel-countries',
    'source-layer': 'country_boundaries',
    paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.08 },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.addLayer({
    id: 'military-personnel-outline', type: 'line',
    source: 'military-personnel-countries',
    'source-layer': 'country_boundaries',
    paint: { 'line-color': '#dc2626', 'line-width': 1.2, 'line-opacity': 0.25 },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'military-personnel-fill', (e) => {
    const feat = e.features?.[0]
    const iso2 = feat?.properties?.iso_3166_1 as string | undefined
    if (!iso2) return
    const nameEn = (feat?.properties?.name_en as string | undefined) || iso2
    const entry = militaryPersonnelRef.current.find(m => m.iso2 === iso2)
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:280px;">
      <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${entry?.country || nameEn}</div>
      ${entry
        ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">Rank: <b style="color:#dc2626;">#${entry.rank}</b> of ${militaryPersonnelRef.current.length} (world)</div>
           <div style="font-size:11px;color:#374151;">Armed forces personnel: <b>${entry.personnel.toLocaleString()}</b></div>
           <div style="font-size:9px;color:#9ca3af;margin-top:3px;">World Bank (IISS Military Balance), ${entry.year}</div>`
        : `<div style="font-size:11px;color:#9ca3af;">No World Bank armed-forces personnel data for this country.</div>`}
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
      .setLngLat(e.lngLat).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'military-personnel-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'military-personnel-fill', () => { map.getCanvas().style.cursor = '' })

  map.addSource('infra-indicators-countries', {
    type: 'vector',
    url:  'mapbox://mapbox.country-boundaries-v1',
  })
  map.addLayer({
    id: 'infra-indicators-fill', type: 'fill',
    source: 'infra-indicators-countries',
    'source-layer': 'country_boundaries',
    paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.08 },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.addLayer({
    id: 'infra-indicators-outline', type: 'line',
    source: 'infra-indicators-countries',
    'source-layer': 'country_boundaries',
    paint: { 'line-color': '#22d3ee', 'line-width': 1.2, 'line-opacity': 0.25 },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'infra-indicators-fill', (e) => {
    const feat = e.features?.[0]
    const iso2 = feat?.properties?.iso_3166_1 as string | undefined
    if (!iso2) return
    const nameEn = (feat?.properties?.name_en as string | undefined) || iso2
    const entry = infraIndicatorsRef.current.find(m => m.iso2 === iso2)
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:300px;">
      <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${entry?.country || nameEn}</div>
      ${entry
        ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">Access index rank: <b style="color:#22d3ee;">#${entry.rank}</b> of ${infraIndicatorsRef.current.length} (world)</div>
           <div style="font-size:11px;color:#374151;margin-bottom:4px;">Access index: <b>${entry.accessIndex === null ? 'n/a' : entry.accessIndex.toFixed(1) + '%'}</b> <span style="color:#9ca3af;">(avg of electricity, internet, water, sanitation)</span></div>
           ${entry.indicators.map(i => `<div style="font-size:10px;color:#6b7280;">${i.label}: <b style="color:#374151;">${i.value.toLocaleString()}</b> (${i.year})</div>`).join('')}
           <div style="font-size:9px;color:#9ca3af;margin-top:4px;">Source: World Bank (World Development Indicators)</div>`
        : `<div style="font-size:11px;color:#9ca3af;">No World Bank infrastructure data for this country.</div>`}
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
      .setLngLat(e.lngLat).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'infra-indicators-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'infra-indicators-fill', () => { map.getCanvas().style.cursor = '' })
}

/** Armed forces personnel layer visibility + live World Bank ranking */
export function useCountryIndicatorData({ mapRef, layersReadyRef, mapReady, militaryPersonnelRef, infraIndicatorsRef }: MapHandle, { showMilitaryPersonnel, showInfraIndicators }: Pick<MapViewProps, 'showMilitaryPersonnel' | 'showInfraIndicators'>) {
  // ── Armed forces personnel layer visibility + live World Bank ranking ────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showMilitaryPersonnel ? 'visible' : 'none'
    if (map.getLayer('military-personnel-fill'))    map.setLayoutProperty('military-personnel-fill',    'visibility', vis)
    if (map.getLayer('military-personnel-outline')) map.setLayoutProperty('military-personnel-outline', 'visibility', vis)
    if (!showMilitaryPersonnel || militaryPersonnelRef.current.length > 0) return

    fetchMilitaryPersonnelRanking().then(ranking => {
      militaryPersonnelRef.current = ranking
      const m = mapRef.current
      if (!m || !m.getLayer('military-personnel-fill')) return
      // Strongest militaries (by personnel) get the deepest red; opacity fades
      // out toward the rest of the ranked list rather than a hard cutoff.
      const top = ranking.slice(0, 30)
      const maxRank = top.length
      m.setPaintProperty('military-personnel-fill', 'fill-opacity', [
        'match', ['get', 'iso_3166_1'],
        ...top.flatMap((e, i) => [e.iso2, 0.55 - (i / maxRank) * 0.4]),
        0.05,
      ])
      m.setPaintProperty('military-personnel-outline', 'line-opacity', [
        'match', ['get', 'iso_3166_1'],
        ...top.flatMap(e => [e.iso2, 0.7]),
        0.15,
      ])
    }).catch(() => { /* live lookup unavailable; layer stays visible with base styling */ })
  }, [showMilitaryPersonnel, mapReady])

  // ── Infrastructure access indicators layer visibility + live World Bank data ─
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showInfraIndicators ? 'visible' : 'none'
    if (map.getLayer('infra-indicators-fill'))    map.setLayoutProperty('infra-indicators-fill',    'visibility', vis)
    if (map.getLayer('infra-indicators-outline')) map.setLayoutProperty('infra-indicators-outline', 'visibility', vis)
    if (!showInfraIndicators || infraIndicatorsRef.current.length > 0) return

    fetchInfraIndicatorRanking().then(ranking => {
      infraIndicatorsRef.current = ranking
      const m = mapRef.current
      if (!m || !m.getLayer('infra-indicators-fill')) return
      // Best electricity access gets the deepest cyan; opacity fades toward
      // lower-ranked countries rather than a hard cutoff.
      const top = ranking.slice(0, 30)
      const maxRank = top.length
      m.setPaintProperty('infra-indicators-fill', 'fill-opacity', [
        'match', ['get', 'iso_3166_1'],
        ...top.flatMap((e, i) => [e.iso2, 0.55 - (i / maxRank) * 0.4]),
        0.05,
      ])
      m.setPaintProperty('infra-indicators-outline', 'line-opacity', [
        'match', ['get', 'iso_3166_1'],
        ...top.flatMap(e => [e.iso2, 0.7]),
        0.15,
      ])
    }).catch(() => { /* live lookup unavailable; layer stays visible with base styling */ })
  }, [showInfraIndicators, mapReady])
}
