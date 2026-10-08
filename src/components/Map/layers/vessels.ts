import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { type Vessel, vesselTypeFromCode, detectVesselType, VESSEL_TYPE_COLORS } from '../../../services/aisstream'
import { addVesselImages } from '../vesselImages'
import type { LayerCtx } from './types'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

export function addVesselLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { popupRef } = ctx
  addVesselImages(map)

  // ── Vessels (AIS) — no clustering, per-type icons like flights ─────
  map.addSource('vessels', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  // Vessel icon layer — visible at ALL zoom levels, per-type icon + color
  map.addLayer({
    id: 'vessel-icons',
    type: 'symbol',
    source: 'vessels',
    layout: {
      'icon-image': ['match', ['get', 'vesselType'],
        'cargo',     'vessel-cargo',
        'tanker',    'vessel-tanker',
        'passenger', 'vessel-passenger',
        'fishing',   'vessel-fishing',
        'military',  'vessel-military',
        'tug',       'vessel-tug',
        'vessel-other',
      ],
      'icon-rotate':           ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      // Scale from tiny at globe view up to full-size at street zoom (match flights)
      'icon-size':             ['interpolate', ['linear'], ['zoom'],
        1, 0.14,
        3, 0.20,
        5, 0.32,
        7, 0.55,
        10, 0.82,
        13, 1.2,
      ],
      'icon-allow-overlap':    true,
      'icon-ignore-placement': true,
      // Vessel name label only at zoom ≥ 8
      'text-field':  ['step', ['zoom'], '', 8,
        ['case', ['==', ['get', 'name'], ''], '', ['get', 'name']],
      ],
      'text-font':   ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size':   ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 11],
      'text-offset': [0, 1.6],
      'text-optional':      true,
      'text-allow-overlap': false,
      visibility: 'none',
    } as Record<string, unknown>,
    paint: {
      'icon-color': ['match', ['get', 'vesselType'],
        'cargo',     VESSEL_TYPE_COLORS.cargo,
        'tanker',    VESSEL_TYPE_COLORS.tanker,
        'passenger', VESSEL_TYPE_COLORS.passenger,
        'fishing',   VESSEL_TYPE_COLORS.fishing,
        'military',  VESSEL_TYPE_COLORS.military,
        'tug',       VESSEL_TYPE_COLORS.tug,
        VESSEL_TYPE_COLORS.other,
      ],
      'icon-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.75, 4, 0.88, 7, 0.95],
      'text-color': '#c0dcc4',
      'text-halo-color': 'rgba(0,0,0,0.75)',
      'text-halo-width': 1.2,
    } as Record<string, unknown>,
  })

  // Vessel click popup
  map.on('click', 'vessel-icons', (e) => {
    if (!e.features?.[0]) return
    const p = e.features[0].properties as Record<string, string>
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
    const sog = parseFloat(p.sog || '0').toFixed(1)
    const cog = parseFloat(p.cog || '0').toFixed(0)
    const html = `<div style="padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
        <div style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></div>
        <span style="font-size:11px;font-weight:800;color:#14161a;">${p.name || 'UNKNOWN'}</span>
        <span style="font-size:10px;color:#9ca3af;margin-left:auto;">${p.vesselType?.toUpperCase()}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;line-height:1.6;">
        <div><span style="color:#9ca3af;">MMSI:</span> ${p.mmsi}</div>
        <div><span style="color:#9ca3af;">Speed:</span> <b style="color:#16a34a;">${sog} kn</b></div>
        <div><span style="color:#9ca3af;">Course:</span> ${cog}°</div>
        <div><span style="color:#9ca3af;">Heading:</span> ${p.heading}°</div>
        ${p.destination ? `<div><span style="color:#9ca3af;">Dest:</span> ${p.destination}</div>` : ''}
      </div>
      <div style="margin-top:5px;font-size:9px;color:#9ca3af;">SOURCE: AIS VESSEL TRACKING</div>
    </div>`
    if (popupRef.current) popupRef.current.remove()
    popupRef.current = new mapboxgl.Popup({ maxWidth: '290px', className: 'cy-popup' })
      .setLngLat(coords).setHTML(html).addTo(map)
    markFeatureClick(map)
  })
  map.on('mouseenter', 'vessel-icons', () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('mouseleave', 'vessel-icons', () => { map.getCanvas().style.cursor = '' })
}

/** Update vessel GeoJSON */
export function useVesselData({ mapRef, layersReadyRef, mapReady }: MapHandle, { vessels, showVessels }: Pick<MapViewProps, 'vessels' | 'showVessels'>) {
  // ── Update vessel GeoJSON ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !layersReadyRef.current) return
    const src = mapRef.current.getSource('vessels') as mapboxgl.GeoJSONSource 
    if (!src) return

    const vis = showVessels ? 'visible' : 'none'
    if (mapRef.current.getLayer('vessel-icons')) {
      mapRef.current.setLayoutProperty('vessel-icons', 'visibility', vis)
    }

    if (!showVessels) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    const features: GeoJSON.Feature[] = vessels.map(v => {
      const vt = v.shipType ? vesselTypeFromCode(v.shipType) : detectVesselType(v.name)
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
        properties: {
          mmsi: v.mmsi,
          name: v.name,
          sog: v.sog,
          cog: v.cog,
          heading: v.heading,
          navStatus: v.navStatus,
          vesselType: vt,
          color: VESSEL_TYPE_COLORS[vt],
          destination: v.destination || '',
        },
      }
    })
    src.setData({ type: 'FeatureCollection', features })
  }, [vessels, showVessels, mapReady])
}
