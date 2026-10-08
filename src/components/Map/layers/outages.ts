import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import type { OutageEvent } from '../../../services/outages'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { OUTAGE_COLORS, outagePopupHtml } from '../incidentPopups'

/** Events currently drawn, by id — popups read the full event from here (feature properties flatten nested data). */
const drawn = new Map<string, OutageEvent>()

export function addOutageLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Internet outages (live, IODA): one pin per affected region / country ──
  map.addSource('outages', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  // Halo under ongoing severe outages so they stand out from minor ones at a glance.
  map.addLayer({
    id: 'outages-halo', type: 'circle', source: 'outages',
    filter: ['all', ['==', ['get', 'ongoing'], true], ['==', ['get', 'severity'], 'severe']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 11, 6, 18],
      'circle-color': OUTAGE_COLORS.severe,
      'circle-opacity': 0.18,
      'circle-blur': 0.4,
    },
    layout: { visibility: 'none' },
  })
  map.addLayer({
    id: 'outages-circles', type: 'circle', source: 'outages',
    paint: {
      // region pins are solid; country-wide ones are a larger, mostly hollow ring (less precise)
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        2, ['case', ['==', ['get', 'precision'], 'country'], 7, ['get', 'ongoing'], 4.5, 3],
        6, ['case', ['==', ['get', 'precision'], 'country'], 12, ['get', 'ongoing'], 8, 5]],
      'circle-color': ['get', 'color'],
      'circle-opacity': ['case', ['==', ['get', 'precision'], 'country'], 0.15, ['get', 'ongoing'], 0.9, 0.45],
      'circle-stroke-width': ['case', ['==', ['get', 'precision'], 'country'], 2, 1],
      'circle-stroke-color': ['case', ['==', ['get', 'precision'], 'country'], ['get', 'color'], 'rgba(255,255,255,0.55)'],
    },
    layout: { visibility: 'none', 'circle-sort-key': ['get', 'rank'] },
  })
  map.on('click', 'outages-circles', (e) => {
    const f = e.features?.[0]
    const ev = f && drawn.get(String(f.properties?.id))
    if (!f || !ev) return
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
      .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
      .setHTML(outagePopupHtml(ev)).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'outages-circles', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'outages-circles', () => { map.getCanvas().style.cursor = '' })
}

const RANK = { severe: 3, major: 2, minor: 1 } as const

/** GeoJSON for the placeable outages; network-only alerts (no location) are skipped. Exported for tests. */
export function outageFeatures(outages: OutageEvent[]): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = []
  for (const o of outages) {
    if (!o.location) continue
    const ongoing = o.status === 'ongoing'
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.location.lng, o.location.lat] },
      properties: {
        id: o.id,
        ongoing,
        severity: o.severity,
        precision: o.location.precision,
        color: ongoing ? OUTAGE_COLORS[o.severity] : OUTAGE_COLORS.recovered,
        rank: ongoing ? RANK[o.severity] : 0,   // drawn on top of lower ranks
      },
    })
  }
  return features
}

/** Outages GeoJSON (live) */
export function useOutageData({ mapRef, layersReadyRef, mapReady }: MapHandle, { outages, showOutages }: Pick<MapViewProps, 'outages' | 'showOutages'>) {
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('outages') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showOutages ? 'visible' : 'none'
    for (const id of ['outages-halo', 'outages-circles']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    drawn.clear()
    if (!showOutages) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    for (const o of outages) drawn.set(o.id, o)
    src.setData({ type: 'FeatureCollection', features: outageFeatures(outages) })
  }, [outages, showOutages, mapReady])
}
