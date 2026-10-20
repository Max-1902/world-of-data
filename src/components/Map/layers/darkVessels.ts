import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { GFW_ATTRIBUTION, GFW_KIND_LABEL, type GfwEvent } from '../../../services/gfw'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { esc } from '../geoPopups'

export const GFW_COLORS = { gap: '#8b5cf6', encounter: '#f59e0b', risk: '#dc2626' } as const

/** Events currently drawn, by id — popups read the full event from here. */
const drawn = new Map<string, GfwEvent>()

const BOX = "padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:300px;font-size:11px;color:#14161a;line-height:1.5;"
const MUTED = 'color:#6b7280'
const row = (k: string, v: string) => `<div><span style="${MUTED}">${k}:</span> ${v}</div>`
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
const vesselLine = (v: GfwEvent['vessel']) =>
  `${esc(v.name || 'Unnamed vessel')}${v.flag ? ` · flag ${esc(v.flag)}` : ''}${v.type ? ` · ${esc(v.type)}` : ''}${v.ssvid ? ` <span style="${MUTED}">MMSI ${esc(v.ssvid)}</span>` : ''}`

export function gfwColor(e: GfwEvent): string {
  return e.kind === 'gaps' ? GFW_COLORS.gap : e.potentialRisk ? GFW_COLORS.risk : GFW_COLORS.encounter
}

/** Popup for one AIS-off or encounter event. Exported for tests. */
export function gfwPopupHtml(e: GfwEvent): string {
  const color = gfwColor(e)
  const where = e.highSeas ? 'High seas' : 'Inside a national EEZ'
  const shore = e.distanceFromShoreKm !== null ? `, ${Math.round(e.distanceFromShoreKm).toLocaleString('en-US')} km from shore` : ''
  const lines = e.kind === 'gaps'
    ? [
        row('Vessel', vesselLine(e.vessel)),
        row('AIS off', `${utc(e.start)}, for ${Math.round(e.durationHours)} h`),
        e.gapDistanceKm !== null ? row('Moved while dark', `${Math.round(e.gapDistanceKm).toLocaleString('en-US')} km (straight line)`) : '',
        row('Where', `${where}${shore}`),
        `<div style="${MUTED};margin-top:4px">Pin is where the signal stopped. GFW classes the gap as likely intentional disabling. That is a model output, not proof: vessels also go dark for security or because of faults.</div>`,
      ]
    : [
        row('Vessel', vesselLine(e.vessel)),
        e.other ? row('Met', vesselLine(e.other)) : '',
        row('When', `${utc(e.start)}, for ${Math.round(e.durationHours)} h`),
        e.encounterType ? row('Type', esc(e.encounterType)) : '',
        row('Where', `${where}${shore}`),
        e.potentialRisk
          ? `<div style="color:${GFW_COLORS.risk};margin-top:4px">GFW flag: potential risk. On the high seas or in an RFMO area, a vessel has no matching public authorisation.</div>`
          : `<div style="${MUTED};margin-top:4px">No authorisation flag from GFW. It only checks encounters outside EEZs, so no flag inside an EEZ means "not checked".</div>`,
      ]
  return `<div style="${BOX}">
    <div style="font-weight:700;color:${color};letter-spacing:.06em;font-size:10px">${esc(GFW_KIND_LABEL[e.kind].toUpperCase())}</div>
    ${lines.filter(Boolean).join('')}
    <div style="margin-top:6px;font-size:10px"><a href="${GFW_ATTRIBUTION.url}" target="_blank" rel="noopener noreferrer">${GFW_ATTRIBUTION.text}</a></div>
  </div>`
}

export function addDarkVesselLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Dark vessels (GFW AIS-off events) and encounters at sea ──
  map.addSource('gfw-events', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    attribution: `<a href="${GFW_ATTRIBUTION.url}" target="_blank" rel="noopener noreferrer">${GFW_ATTRIBUTION.text}</a>`,
  })
  map.addLayer({
    id: 'gfw-events-circles', type: 'circle', source: 'gfw-events',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['case', ['get', 'risk'], 4, 3], 7, ['case', ['get', 'risk'], 8, 6]],
      'circle-color': ['get', 'color'],
      // gaps are hollow rings (a vessel that vanished), encounters solid dots
      'circle-opacity': ['case', ['==', ['get', 'kind'], 'gaps'], 0.12, 0.85],
      'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'gaps'], 1.5, 0.75],
      'circle-stroke-color': ['case', ['==', ['get', 'kind'], 'gaps'], ['get', 'color'], 'rgba(255,255,255,0.6)'],
    },
    layout: { visibility: 'none', 'circle-sort-key': ['case', ['get', 'risk'], 2, ['==', ['get', 'kind'], 'gaps'], 1, 0] },
  })
  map.on('click', 'gfw-events-circles', (e) => {
    const f = e.features?.[0]
    const ev = f && drawn.get(String(f.properties?.id))
    if (!f || !ev) return
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
      .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
      .setHTML(gfwPopupHtml(ev)).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'gfw-events-circles', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'gfw-events-circles', () => { map.getCanvas().style.cursor = '' })
}

/** GeoJSON for the events. Exported for tests. */
export function gfwFeatures(events: GfwEvent[]): GeoJSON.Feature[] {
  return events.map(e => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
    properties: { id: `${e.kind}:${e.id}`, kind: e.kind, risk: e.potentialRisk, color: gfwColor(e) },
  }))
}

/** GFW events GeoJSON (refreshed hourly) */
export function useDarkVesselData({ mapRef, layersReadyRef, mapReady }: MapHandle, { gfwEvents, showDarkVessels }: Pick<MapViewProps, 'gfwEvents' | 'showDarkVessels'>) {
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('gfw-events') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    if (map.getLayer('gfw-events-circles')) map.setLayoutProperty('gfw-events-circles', 'visibility', showDarkVessels ? 'visible' : 'none')
    drawn.clear()
    if (!showDarkVessels) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    for (const e of gfwEvents) drawn.set(`${e.kind}:${e.id}`, e)
    src.setData({ type: 'FeatureCollection', features: gfwFeatures(gfwEvents) })
  }, [gfwEvents, showDarkVessels, mapReady])
}
