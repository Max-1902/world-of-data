import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS, SANCTIONS_BY_ISO2 } from '../../../services/sanctions'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addSanctionsLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Sanctions country fill layer ─────────────────────────────────────
  map.addSource('sanctions-countries', {
    type: 'vector',
    url:  'mapbox://mapbox.country-boundaries-v1',
  })
  map.addLayer({
    id: 'sanctions-fill', type: 'fill',
    source: 'sanctions-countries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': [
        'match', ['get', 'iso_3166_1'],
        ...SANCTIONED_COUNTRIES.flatMap(c => [c.iso2, SANCTION_COLORS[c.severity]]),
        'transparent',
      ],
      'fill-opacity': 0.28,
    },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.addLayer({
    id: 'sanctions-outline', type: 'line',
    source: 'sanctions-countries',
    'source-layer': 'country_boundaries',
    paint: {
      'line-color': [
        'match', ['get', 'iso_3166_1'],
        ...SANCTIONED_COUNTRIES.flatMap(c => [c.iso2, SANCTION_COLORS[c.severity]]),
        'transparent',
      ],
      'line-width': 1.2,
      'line-opacity': 0.6,
    },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])

  // Sanctions click popup (via map markers instead of vector tile click to get full data)
  map.on('click', 'sanctions-fill', (e) => {
    const iso2 = e.features?.[0]?.properties?.iso_3166_1 as string | undefined
    if (!iso2) return
    const c = SANCTIONS_BY_ISO2[iso2]
    if (!c) return
    const sevColor = SANCTION_COLORS[c.severity as keyof typeof SANCTION_COLORS] || '#888'
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:230px;max-width:280px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:13px;font-weight:800;color:#14161a;">${c.name}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${sevColor};border:1px solid ${sevColor}55;padding:1px 5px;">${c.severity.toUpperCase()}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.55;margin-bottom:7px;">${c.summary}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;">
        ${c.regimes.map((r: string) => `<span style="font-size:10px;border:1px solid #16a34a55;background:rgba(22,163,74,0.08);color:#16a34a;padding:0 4px;">${r}</span>`).join('')}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        ${c.categories.map((cat: string) => `<span style="font-size:10px;border:1px solid #ea580c55;background:rgba(234,88,12,0.08);color:#ea580c;padding:0 4px;">${cat.replace('_',' ')}</span>`).join('')}
      </div>
      ${c.since ? `<div style="margin-top:5px;font-size:10px;color:#9ca3af;">Since: ${c.since}${c.totalDesignations ? ` · ~${c.totalDesignations.toLocaleString()} designations` : ''}</div>` : ''}
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '300px', className: 'cy-popup' })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'sanctions-fill', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'sanctions-fill', () => { map.getCanvas().style.cursor = '' })
}

/** Sanctions layer visibility */
export function useSanctionsVisibility({ mapRef, layersReadyRef, mapReady }: MapHandle, { showSanctions }: Pick<MapViewProps, 'showSanctions'>) {
  // ── Sanctions layer visibility ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const vis = showSanctions ? 'visible' : 'none'
    if (map.getLayer('sanctions-fill'))    map.setLayoutProperty('sanctions-fill',    'visibility', vis)
    if (map.getLayer('sanctions-outline')) map.setLayoutProperty('sanctions-outline', 'visibility', vis)
  }, [showSanctions, mapReady])
}
