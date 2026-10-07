import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { RESOURCE_PROFILES, fetchResourceRents } from '../../../services/resources'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addResourcesLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Critical minerals / resources country fill layer ────────────────
  map.addSource('resources-countries', {
    type: 'vector',
    url:  'mapbox://mapbox.country-boundaries-v1',
  })
  map.addLayer({
    id: 'resources-fill', type: 'fill',
    source: 'resources-countries',
    'source-layer': 'country_boundaries',
    paint: {
      // Curated major-producer countries get an amber tint; every other
      // country still gets a faint fill so the whole globe is clickable
      // for the live World Bank resource-rent lookup.
      'fill-color': [
        'match', ['get', 'iso_3166_1'],
        ...RESOURCE_PROFILES.flatMap(p => [p.iso2, '#d97706']),
        '#94a3b8',
      ],
      'fill-opacity': [
        'match', ['get', 'iso_3166_1'],
        ...RESOURCE_PROFILES.flatMap(p => [p.iso2, 0.22]),
        0.08,
      ],
    },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.addLayer({
    id: 'resources-outline', type: 'line',
    source: 'resources-countries',
    'source-layer': 'country_boundaries',
    paint: {
      'line-color': [
        'match', ['get', 'iso_3166_1'],
        ...RESOURCE_PROFILES.flatMap(p => [p.iso2, '#d97706']),
        '#94a3b8',
      ],
      'line-width': 1.2,
      'line-opacity': [
        'match', ['get', 'iso_3166_1'],
        ...RESOURCE_PROFILES.flatMap(p => [p.iso2, 0.55]),
        0.25,
      ],
    },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])

  map.on('click', 'resources-fill', (e) => {
    const feat = e.features?.[0]
    const iso2 = feat?.properties?.iso_3166_1 as string | undefined
    if (!iso2) return
    const nameEn = (feat?.properties?.name_en as string | undefined) || iso2
    const p = RESOURCE_PROFILES.find(r => r.iso2 === iso2)

    const renderHtml = (rentRows: string) => `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:250px;max-width:320px;max-height:400px;overflow-y:auto;">
      <div style="font-size:13px;font-weight:800;color:#14161a;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">${p ? p.name : nameEn}</div>
      ${p ? `<div style="font-size:10px;font-weight:700;color:#92400e;letter-spacing:0.03em;margin-bottom:3px;">MAJOR PRODUCER — KNOWN COMMODITIES</div>
      ${p.resources.map(r => `<div style="font-size:11px;color:#374151;margin-bottom:2px;">◆ <b>${r.mineral}</b>${r.rank ? ` — #${r.rank} world${r.shareOfWorld ? ` (${r.shareOfWorld}% share)` : ''}` : ''}${r.note ? `<div style="font-size:10px;color:#6b7280;margin-left:14px;">${r.note}</div>` : ''}</div>`).join('')}
      ${p.strategic ? `<div style="margin:6px 0;font-size:10px;color:#6b7280;line-height:1.5;">${p.strategic}</div>` : ''}` : ''}
      <div style="font-size:10px;font-weight:700;color:#0f172a;letter-spacing:0.03em;margin:${p ? '8px' : '0'} 0 3px;padding-top:${p ? '6px' : '0'};${p ? 'border-top:1px solid #e5e7eb;' : ''}">RESOURCE RENTS (% OF GDP, WORLD BANK)</div>
      ${rentRows}
    </div>`

    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '340px', className: 'cy-popup' })
      .setLngLat(e.lngLat)
      .setHTML(renderHtml('<div style="font-size:11px;color:#9ca3af;">Loading live data…</div>'))
      .addTo(map)
    ;(map as any).__markFeatureClick?.()

    const clickedPopup = popupRef.current
    fetchResourceRents(iso2).then(rents => {
      if (popupRef.current !== clickedPopup) return // user clicked elsewhere while loading
      const rows = rents.length
        ? rents
            .sort((a, b) => b.value - a.value)
            .map(r => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#374151;margin-bottom:2px;"><span>${r.label.replace(' (% of GDP)', '')}</span><span style="font-weight:700;color:#0f172a;">${r.value.toFixed(2)}%</span></div><div style="font-size:9px;color:#9ca3af;margin:-2px 0 3px;">${r.year}</div>`)
            .join('')
        : '<div style="font-size:11px;color:#9ca3af;">No World Bank data available for this country.</div>'
      clickedPopup.setHTML(renderHtml(rows))
    }).catch(() => {
      if (popupRef.current !== clickedPopup) return
      clickedPopup.setHTML(renderHtml('<div style="font-size:11px;color:#9ca3af;">Failed to load data.</div>'))
    })
  })
  map.on('mouseenter', 'resources-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'resources-fill', () => { map.getCanvas().style.cursor = '' })
}

/** Resources layer visibility */
export function useResourcesVisibility({ mapRef, layersReadyRef, mapReady }: MapHandle, { showResources }: Pick<MapViewProps, 'showResources'>) {
  // ── Resources layer visibility ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showResources ? 'visible' : 'none'
    if (map.getLayer('resources-fill'))    map.setLayoutProperty('resources-fill',    'visibility', vis)
    if (map.getLayer('resources-outline')) map.setLayoutProperty('resources-outline', 'visibility', vis)
  }, [showResources, mapReady])
}
