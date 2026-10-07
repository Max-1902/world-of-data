import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { TRADE_PROFILES } from '../../../services/tradeStats'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addTradeStatsLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Trade statistics country fill layer ──────────────────────────────
  map.addSource('tradestats-countries', {
    type: 'vector',
    url:  'mapbox://mapbox.country-boundaries-v1',
  })
  map.addLayer({
    id: 'tradestats-fill', type: 'fill',
    source: 'tradestats-countries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': [
        'match', ['get', 'iso_3166_1'],
        ...TRADE_PROFILES.flatMap(p => [p.iso2, '#0891b2']),
        'transparent',
      ],
      'fill-opacity': 0.2,
    },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.addLayer({
    id: 'tradestats-outline', type: 'line',
    source: 'tradestats-countries',
    'source-layer': 'country_boundaries',
    paint: {
      'line-color': [
        'match', ['get', 'iso_3166_1'],
        ...TRADE_PROFILES.flatMap(p => [p.iso2, '#0891b2']),
        'transparent',
      ],
      'line-width': 1.2,
      'line-opacity': 0.55,
    },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'tradestats-fill', (e) => {
    const iso2 = e.features?.[0]?.properties?.iso_3166_1 as string | undefined
    if (!iso2) return
    const p = TRADE_PROFILES.find(t => t.iso2 === iso2)
    if (!p) return
    const topExp = p.topExportPartners.slice(0, 3).map(x => `${x.country} (${x.pct}%)`).join(', ')
    const topImp = p.topImportPartners.slice(0, 3).map(x => `${x.country} (${x.pct}%)`).join(', ')
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:300px;">
      <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${p.name}</div>
      <div style="font-size:11px;color:#374151;margin-bottom:3px;">Exports to: ${topExp}</div>
      <div style="font-size:11px;color:#374151;margin-bottom:3px;">Imports from: ${topImp}</div>
      ${p.tradeBalance != null ? `<div style="font-size:11px;color:#374151;">Trade balance: <b style="color:${p.tradeBalance >= 0 ? '#16a34a' : '#dc2626'}">${p.tradeBalance >= 0 ? '+' : ''}$${p.tradeBalance}B</b></div>` : ''}
      ${p.dependencies?.length ? `<div style="margin-top:6px;font-size:10px;color:#6b7280;line-height:1.5;">${p.dependencies.join(' · ')}</div>` : ''}
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
      .setLngLat(e.lngLat).setHTML(html).addTo(map)
    ;(map as any).__markFeatureClick?.()
  })
  map.on('mouseenter', 'tradestats-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'tradestats-fill', () => { map.getCanvas().style.cursor = '' })
}

/** Trade stats layer visibility */
export function useTradeStatsVisibility({ mapRef, layersReadyRef, mapReady }: MapHandle, { showTradeStats }: Pick<MapViewProps, 'showTradeStats'>) {
  // ── Trade stats layer visibility ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showTradeStats ? 'visible' : 'none'
    if (map.getLayer('tradestats-fill'))    map.setLayoutProperty('tradestats-fill',    'visibility', vis)
    if (map.getLayer('tradestats-outline')) map.setLayoutProperty('tradestats-outline', 'visibility', vis)
  }, [showTradeStats, mapReady])
}
