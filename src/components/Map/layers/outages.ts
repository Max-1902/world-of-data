import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import type { OutageEvent, OutageSeverity } from '../../../services/outages'
import { RADAR_UNREST_CAUSES, type RadarOutage } from '../../../services/radarOutages'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { OUTAGE_COLORS, OUTAGE_CONFIRMED_COLORS, outageCountryPopupHtml } from '../incidentPopups'

/**
 * Internet outages as shaded countries, not pins. Fill = IODA's measured drop for the country's worst ongoing
 * outage (strong when IODA reports it country-wide, light when only a region or network inside it is affected).
 * Outline = an open outage Cloudflare Radar has confirmed, red when the cause it states is deliberate or
 * conflict-driven. Recovered IODA events and network alerts with no country are left to the panel.
 */
export interface OutageCountry {
  iso2: string
  /** worst ongoing IODA severity, null when only Radar reports something */
  severity: OutageSeverity | null
  /** true when IODA has an ongoing country-wide alert; false = only regions/networks inside the country */
  countryWide: boolean
  /** ongoing IODA events in the country, worst first */
  events: OutageEvent[]
  /** open Radar outages listing the country */
  confirmed: RadarOutage[]
  /** a confirmed outage's stated cause is deliberate or conflict-driven */
  deliberate: boolean
}

const RANK: Record<OutageSeverity, number> = { severe: 3, major: 2, minor: 1 }

/** Groups ongoing IODA events and open Radar outages by country. Exported for tests. */
export function outageCountries(outages: OutageEvent[], radar: RadarOutage[]): Map<string, OutageCountry> {
  const by = new Map<string, OutageCountry>()
  const get = (iso2: string) => {
    let c = by.get(iso2)
    if (!c) by.set(iso2, c = { iso2, severity: null, countryWide: false, events: [], confirmed: [], deliberate: false })
    return c
  }
  for (const o of outages) {
    if (o.status !== 'ongoing' || !o.countryCode) continue
    const c = get(o.countryCode)
    c.events.push(o)
    if (!c.severity || RANK[o.severity] > RANK[c.severity]) c.severity = o.severity
    if (o.entityType === 'country') c.countryWide = true
  }
  for (const r of radar) {
    if (r.end !== null) continue
    for (const { code } of r.countries) {
      const c = get(code)
      c.confirmed.push(r)
      if (RADAR_UNREST_CAUSES.has(r.cause)) c.deliberate = true
    }
  }
  for (const c of by.values()) c.events.sort((a, b) => b.dropPct - a.dropPct)
  return by
}

/** Mapbox `match` on the ISO2 code; `fallback` for every other country. */
function byCountry(countries: Map<string, OutageCountry>, value: (c: OutageCountry) => string | number | null, fallback: string | number): unknown {
  const pairs = [...countries.values()].flatMap(c => { const v = value(c); return v === null ? [] : [c.iso2, v] })
  return pairs.length ? ['match', ['get', 'iso_3166_1'], ...pairs, fallback] : fallback
}

type Paint<T> = mapboxgl.DataDrivenPropertyValueSpecification<T>

/** Paint values for the current data. Exported for tests. */
export function outagePaint(countries: Map<string, OutageCountry>) {
  return {
    fillColor: byCountry(countries, c => (c.severity ? OUTAGE_COLORS[c.severity] : null), 'rgba(0,0,0,0)') as Paint<string>,
    fillOpacity: byCountry(countries, c => (c.severity ? (c.countryWide ? 0.5 : 0.24) : null), 0) as Paint<number>,
    lineColor: byCountry(countries, c =>
      c.confirmed.length ? (c.deliberate ? OUTAGE_CONFIRMED_COLORS.deliberate : OUTAGE_CONFIRMED_COLORS.other)
        : c.severity ? OUTAGE_COLORS[c.severity] : null, 'rgba(0,0,0,0)') as Paint<string>,
    lineWidth: byCountry(countries, c => (c.confirmed.length ? 2 : c.severity ? 0.8 : null), 0) as Paint<number>,
  }
}

/** Countries currently drawn, by ISO2 — the popup reads them from here. */
let drawn = new Map<string, OutageCountry>()

const FILL = 'outages-fill'
const LINE = 'outages-outline'

export function addOutageLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  map.addSource('outages-countries', { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' })
  map.addLayer({
    id: FILL, type: 'fill', source: 'outages-countries', 'source-layer': 'country_boundaries',
    paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0 },
    layout: { visibility: 'none' },
  } as Parameters<typeof map.addLayer>[0])
  map.addLayer({
    id: LINE, type: 'line', source: 'outages-countries', 'source-layer': 'country_boundaries',
    paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 0, 'line-opacity': 0.9 },
    layout: { visibility: 'none', 'line-join': 'round' },
  } as Parameters<typeof map.addLayer>[0])
  map.on('click', FILL, (e) => {
    const iso2 = e.features?.[0]?.properties?.iso_3166_1 as string | undefined
    const c = iso2 ? drawn.get(iso2) : undefined
    if (!c) return
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '340px', className: 'cy-popup' })
      .setLngLat(e.lngLat).setHTML(outageCountryPopupHtml(c)).addTo(map)
    markFeatureClick(map)
  })
  map.on('mousemove', FILL, (e) => {
    const iso2 = e.features?.[0]?.properties?.iso_3166_1 as string | undefined
    map.getCanvas().style.cursor = iso2 && drawn.has(iso2) ? 'pointer' : ''
  })
  map.on('mouseleave', FILL, () => { map.getCanvas().style.cursor = '' })
}

/** Outage shading (live) */
export function useOutageData({ mapRef, layersReadyRef, mapReady }: MapHandle, { outages, radarOutages, showOutages }: Pick<MapViewProps, 'outages' | 'radarOutages' | 'showOutages'>) {
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current || !map.getLayer(FILL)) return
    const vis = showOutages ? 'visible' : 'none'
    for (const id of [FILL, LINE]) map.setLayoutProperty(id, 'visibility', vis)
    drawn = showOutages ? outageCountries(outages, radarOutages) : new Map()
    const p = outagePaint(drawn)
    map.setPaintProperty(FILL, 'fill-color', p.fillColor)
    map.setPaintProperty(FILL, 'fill-opacity', p.fillOpacity)
    map.setPaintProperty(LINE, 'line-color', p.lineColor)
    map.setPaintProperty(LINE, 'line-width', p.lineWidth)
  }, [outages, radarOutages, showOutages, mapReady])
}
