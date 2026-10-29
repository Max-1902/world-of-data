import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import type { DisasterAlert } from '../../../services/gdacs'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'
import { DISASTER_COLORS, disasterPopupHtml } from '../incidentPopups'

/** Alerts currently drawn, by id — popups read the full alert from here. */
const drawn = new Map<string, DisasterAlert>()

export function addDisasterLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── GDACS Orange/Red disaster alerts (live): one pin per event ──────────
  map.addSource('disasters', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'disasters-halo', type: 'circle', source: 'disasters',
    filter: ['==', ['get', 'alert'], 'Red'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 18, 6, 28],
      'circle-color': DISASTER_COLORS.Red,
      'circle-opacity': ['case', ['get', 'current'], 0.2, 0.08],
      'circle-blur': 0.5,
    },
    layout: { visibility: 'none' },
  })
  map.addLayer({
    id: 'disasters-pins', type: 'circle', source: 'disasters',
    paint: {
      // a Red alert is also a larger pin with a "!" after its type code, so Red and Orange differ by more than hue
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        2, ['case', ['==', ['get', 'alert'], 'Red'], 12, 9],
        6, ['case', ['==', ['get', 'alert'], 'Red'], 17, 13]],
      'circle-color': ['get', 'color'],
      'circle-opacity': ['case', ['get', 'current'], 0.95, 0.45],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
    layout: { visibility: 'none', 'circle-sort-key': ['get', 'rank'] },
  })
  // Event-type code inside the pin (EQ, TC, FL, VO, DR, WF) so a quake and a cyclone are told apart without clicking.
  map.addLayer({
    id: 'disasters-labels', type: 'symbol', source: 'disasters',
    layout: {
      visibility: 'none',
      'text-field': ['case', ['==', ['get', 'alert'], 'Red'], ['concat', ['get', 'type'], '!'], ['get', 'type']],
      'text-size': ['interpolate', ['linear'], ['zoom'], 2, 8, 6, 10],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#ffffff' },
  })
  for (const id of ['disasters-pins', 'disasters-labels']) {
    map.on('click', id, (e) => {
      const f = e.features?.[0]
      const a = f && drawn.get(String(f.properties?.id))
      if (!f || !a) return
      if (popupRef.current) popupRef.current.remove()
      popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
        .setLngLat([a.longitude, a.latitude])
        .setHTML(disasterPopupHtml(a)).addTo(map)
      markFeatureClick(map)
    })
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' })
  }
}

/** GeoJSON for the alerts. Exported for tests. */
export function disasterFeatures(alerts: DisasterAlert[]): GeoJSON.Feature[] {
  return alerts.map(a => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
    properties: {
      id: a.id,
      type: a.type,
      alert: a.alert,
      current: a.isCurrent,
      color: DISASTER_COLORS[a.alert],
      rank: (a.alert === 'Red' ? 2 : 1) + (a.isCurrent ? 2 : 0),
    },
  }))
}

/** Disaster alerts GeoJSON (live) */
export function useDisasterData({ mapRef, layersReadyRef, mapReady }: MapHandle, { disasterAlerts, showDisasters }: Pick<MapViewProps, 'disasterAlerts' | 'showDisasters'>) {
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('disasters') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const vis = showDisasters ? 'visible' : 'none'
    for (const id of ['disasters-halo', 'disasters-pins', 'disasters-labels']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    drawn.clear()
    if (!showDisasters) { src.setData({ type: 'FeatureCollection', features: [] }); return }
    for (const a of disasterAlerts) drawn.set(a.id, a)
    src.setData({ type: 'FeatureCollection', features: disasterFeatures(disasterAlerts) })
  }, [disasterAlerts, showDisasters, mapReady])
}
