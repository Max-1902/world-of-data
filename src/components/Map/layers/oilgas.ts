import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { OIL_GAS_DATA, getMaxValue, formatValue, getRegionTotals, METRIC_COLORS, METRIC_LABELS, type OilGasMetric } from '../../../services/oilgas'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addOilGasLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  // ── Oil & Gas 3D extruded bars (separate layers, side by side) ────
  for (const kind of ['oil', 'gas'] as const) {
    map.addSource(`${kind}-bars`, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    map.addLayer({
      id: `${kind}-extrusion`,
      type: 'fill-extrusion',
      source: `${kind}-bars`,
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.82,
      },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: `${kind}-labels`,
      type: 'symbol',
      source: `${kind}-bars`,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 7, 6, 9, 10, 11],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 0],
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-optional': true,
        visibility: 'none',
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(0,0,0,0.9)',
        'text-halo-width': 1.5,
      },
    })
  }

  // Click handler for oil or gas bars (shared popup showing all 4 metrics)
  function oilgasClickHandler(e: mapboxgl.MapLayerMouseEvent) {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, unknown>
    const country = OIL_GAS_DATA.find(c => c.iso2 === p.iso2)
    if (!country) return

    const metrics: OilGasMetric[] = ['oilReserves', 'gasReserves', 'oilProduction', 'gasProduction']
    const maxVals = metrics.map(m => getMaxValue(m))
    const bars = metrics.map((m, i) => {
      const val = country[m]
      const pct = maxVals[i] > 0 ? Math.max(1, (val / maxVals[i]) * 100) : 0
      const rank = [...OIL_GAS_DATA].sort((a, b) => b[m] - a[m]).findIndex(c => c.iso2 === country.iso2) + 1
      return `
        <div style="margin:3px 0;">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:1px;">
            <span style="color:${METRIC_COLORS[m]};font-weight:700;">${METRIC_LABELS[m]}</span>
            <span style="color:#9ca3af;">#${rank} of ${OIL_GAS_DATA.filter(c => c[m] > 0).length}</span>
          </div>
          <div style="background:#fafbfc;height:10px;position:relative;border:1px solid #e5e7eb;">
            <div style="position:absolute;top:0;left:0;height:100%;width:${pct}%;background:${METRIC_COLORS[m]};opacity:0.7;"></div>
            <span style="position:absolute;right:3px;top:0;font-size:10px;color:#14161a;line-height:10px;">${formatValue(val, m)}</span>
          </div>
        </div>`
    }).join('')

    const regionTotals = getRegionTotals('oilReserves')
    const regionRank = regionTotals.findIndex(r => r.region === country.region) + 1

    const html = `<div style="font-family:'Inter',-apple-system,sans-serif;padding:10px 12px;min-width:260px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:700;color:#ea580c;letter-spacing:.08em;">${country.name}</span>
        <span style="font-size:10px;color:#6b7280;border:1px solid #e5e7eb;padding:0 4px;letter-spacing:.1em;">${country.iso2}</span>
      </div>
      <div style="font-size:10px;color:#9ca3af;letter-spacing:.12em;margin-bottom:6px;">${country.region.toUpperCase()} · REGION RANK #${regionRank}</div>
      ${bars}
      <div style="margin-top:6px;font-size:9px;color:#9ca3af;letter-spacing:.08em;">SOURCE: EIA / OPEC / BP STATISTICAL REVIEW 2023</div>
    </div>`

    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '320px', className: 'cy-popup' })
      .setLngLat([country.lng, country.lat]).setHTML(html).addTo(map)
    markFeatureClick(map)
  }
  map.on('click', 'oil-extrusion', oilgasClickHandler)
  map.on('click', 'gas-extrusion', oilgasClickHandler)
  map.on('mouseenter', 'oil-extrusion', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'oil-extrusion', () => { map.getCanvas().style.cursor = '' })
  map.on('mouseenter', 'gas-extrusion', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'gas-extrusion', () => { map.getCanvas().style.cursor = '' })
}

/** Oil & Gas 3D bars update (separate layers, side by side) */
export function useOilGasData({ mapRef, layersReadyRef, mapReady }: MapHandle, { showOil, showGas }: Pick<MapViewProps, 'showOil' | 'showGas'>) {
  // ── Oil & Gas 3D bars update (separate layers, side by side) ─────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return

    const eitherOn = showOil || showGas

    // Toggle visibility per layer
    for (const kind of ['oil', 'gas'] as const) {
      const on = kind === 'oil' ? showOil : showGas
      const vis = on ? 'visible' : 'none'
      if (map.getLayer(`${kind}-extrusion`)) map.setLayoutProperty(`${kind}-extrusion`, 'visibility', vis)
      if (map.getLayer(`${kind}-labels`)) map.setLayoutProperty(`${kind}-labels`, 'visibility', vis)
      if (!on) {
        const src = map.getSource(`${kind}-bars`) as mapboxgl.GeoJSONSource | undefined
        if (src) src.setData({ type: 'FeatureCollection', features: [] })
      }
    }

    if (!eitherOn) return

    // fill-extrusion doesn't render on globe projection — switch to mercator
    if ((map.getProjection?.()?.name ?? map.getProjection?.()) === 'globe') {
      map.setProjection('mercator')
    }
    // Tilt map for 3D view
    if (map.getPitch() < 30) {
      map.easeTo({ pitch: 45, duration: 800 })
    }

    // Both bars shown side-by-side need to know if the other is also on
    const bothOn = showOil && showGas
    // Offset: when both are on, shift oil left and gas right by 0.45°
    const offset = bothOn ? 0.45 : 0

    function buildFeatures(metric: OilGasMetric, side: 'left' | 'right' | 'center'): GeoJSON.Feature[] {
      const maxVal = getMaxValue(metric)
      if (maxVal === 0) return []
      const barWidth = bothOn ? 0.3 : 0.4
      const lngShift = side === 'left' ? -offset : side === 'right' ? offset : 0

      return OIL_GAS_DATA
        .filter(c => c[metric] > 0)
        .map(c => {
          const val = c[metric]
          const normalised = Math.log10(val + 1) / Math.log10(maxVal + 1)
          const height = normalised * 500000
          const lng = c.lng + lngShift
          const lat = c.lat
          const s = barWidth
          const ring: [number, number][] = [
            [lng - s, lat - s], [lng + s, lat - s],
            [lng + s, lat + s], [lng - s, lat + s],
            [lng - s, lat - s],
          ]
          return {
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [ring] },
            properties: {
              iso2: c.iso2, name: c.name, value: val, height,
              color: METRIC_COLORS[metric],
              label: `${c.iso2} ${formatValue(val, metric)}`,
              region: c.region,
            },
          }
        })
    }

    if (showOil) {
      const src = map.getSource('oil-bars') as mapboxgl.GeoJSONSource | undefined
      if (src) src.setData({ type: 'FeatureCollection', features: buildFeatures('oilReserves', bothOn ? 'left' : 'center') })
    }
    if (showGas) {
      const src = map.getSource('gas-bars') as mapboxgl.GeoJSONSource | undefined
      if (src) src.setData({ type: 'FeatureCollection', features: buildFeatures('gasReserves', bothOn ? 'right' : 'center') })
    }
  }, [showOil, showGas, mapReady])
}
