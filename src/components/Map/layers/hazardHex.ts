import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { useAnalyticsData } from '../../../hooks/useAnalyticsData'
import { analyticsData } from '../../../services/analyticsData'
import { HEIGHT_SCALE } from '../../../utils/hexbin'
import { sequentialColor } from '../../../utils/vizPalette'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'

export function addHazardHexLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Hazard hex (Hazard Analytics panel): wildfire / earthquake points binned into H3 cells, extruded by activity ─────
  map.addSource('analytics-hex', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'analytics-hex-extrusion',
    type: 'fill-extrusion',
    source: 'analytics-hex',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.88,
    },
    layout: { visibility: 'none' },
  })
  map.on('click', 'analytics-hex-extrusion', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, unknown>
    const fires = p.source === 'fires'
    const n = (v: unknown) => Number(v).toLocaleString()
    const rows = fires
      ? `<span style="color:#9ca3af;">Detections</span><span style="color:#14161a;font-weight:700;">${n(p.count)}</span>
         <span style="color:#9ca3af;">Total fire power</span><span style="color:#14161a;">${n(Math.round(Number(p.value)))} MW</span>
         <span style="color:#9ca3af;">Strongest fire</span><span style="color:#14161a;">${n(Math.round(Number(p.peak)))} MW</span>`
      : `<span style="color:#9ca3af;">Earthquakes</span><span style="color:#14161a;font-weight:700;">${n(p.count)}</span>
         <span style="color:#9ca3af;">Strongest</span><span style="color:#14161a;">M${Number(p.peak).toFixed(1)}</span>`
    const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:220px;">
      <div style="font-size:12px;font-weight:700;color:#14161a;margin-bottom:2px;">${fires ? 'WILDFIRE DETECTIONS' : 'EARTHQUAKES'}</div>
      <div style="font-size:10px;color:#9ca3af;letter-spacing:.1em;margin-bottom:6px;">${fires ? 'LAST 24 H · ~22 KM CELL' : 'M4.5+ · LAST 7 DAYS · ~60 KM CELL'}</div>
      <div style="display:grid;grid-template-columns:120px 1fr;gap:3px 8px;font-size:11px;">${rows}</div>
      <div style="margin-top:6px;font-size:10px;color:#6b7280;line-height:1.5;">${fires ? 'Satellite detections in this cell; height and colour follow the summed fire radiative power.' : 'Height and colour follow the number of quakes in this cell.'}</div>
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: ${fires ? 'NASA FIRMS (VIIRS)' : 'USGS'}</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '310px', className: 'cy-popup' }).setLngLat(e.lngLat).setHTML(html).addTo(map)
    ;(map as any).__markFeatureClick?.()
  })
  map.on('mouseenter', 'analytics-hex-extrusion', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'analytics-hex-extrusion', () => { map.getCanvas().style.cursor = '' })
}

/** Analytics hexagons (wildfires / earthquakes) update */
export function useHazardHexLayer({ mapRef, layersReadyRef, mapReady }: MapHandle, { showAnalyticsHex }: Pick<MapViewProps, 'showAnalyticsHex'>) {
  // ── Analytics hexagons (wildfires / earthquakes) update ───────────────────────
  const analytics = useAnalyticsData({})
  useEffect(() => {
    if (!showAnalyticsHex) return
    const load = () => { void analyticsData.load(analytics.hexSource) }
    load()
    const timer = window.setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [showAnalyticsHex, analytics.hexSource])
  const hexSlice = analytics[analytics.hexSource]
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('analytics-hex') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    if (map.getLayer('analytics-hex-extrusion')) map.setLayoutProperty('analytics-hex-extrusion', 'visibility', showAnalyticsHex ? 'visible' : 'none')
    if (!showAnalyticsHex) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    src.setData({
      type: 'FeatureCollection',
      features: hexSlice.cells.map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [c.ring] },
        // the map ramp starts above the chart ramp's darkest step so low cells don't vanish into satellite imagery
        properties: { source: analytics.hexSource, color: sequentialColor(0.3 + 0.7 * c.intensity), height: c.intensity * HEIGHT_SCALE + 15000, value: c.value, count: c.count, peak: c.peak },
      })),
    })
  }, [showAnalyticsHex, hexSlice.cells, analytics.hexSource, mapReady])
  return { analytics, hexSlice }
}
