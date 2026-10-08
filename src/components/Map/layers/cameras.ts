import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { EARTHCAM_CAMERAS, type LiveCamera } from '../../../services/earthcam'
import { registerUSWebcams } from '../../../services/usWebcams'
import type { MapHandle, MapViewProps } from '../types'
import { markFeatureClick } from './countryClick'

/** EarthCam CCTV camera markers */
export function useCameraMarkers({ mapRef, mapReady, popupRef }: MapHandle, { showCameras }: Pick<MapViewProps, 'showCameras'>) {
  // ── EarthCam CCTV camera markers ──────────────────────────────────────────
  const cameraMarkersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
    cameraMarkersRef.current.forEach(m => m.remove())
    cameraMarkersRef.current = []
    if (!showCameras) return

    // Wait for map to be ready
    const add = () => {
      const allCameras: LiveCamera[] = [...EARTHCAM_CAMERAS, ...registerUSWebcams()]
      allCameras.forEach(cam => {
        const el = document.createElement('div')
        el.title = `${cam.name} — ${cam.city}, ${cam.country}`
        el.style.cssText = [
          'width:18px', 'height:18px', 'cursor:pointer',
          'background:rgba(0,255,136,0.12)', 'border:1px solid #00ff8899',
          'border-radius:2px', 'display:flex', 'align-items:center',
          'justify-content:center', 'font-size:10px', 'line-height:1',
          'box-shadow:0 0 6px rgba(0,255,136,0.35)',
          'transition:all .15s',
        ].join(';')
        el.textContent = '◎'

        el.addEventListener('mouseenter', () => {
          el.style.background = 'rgba(0,255,136,0.28)'
          el.style.boxShadow  = '0 0 12px rgba(0,255,136,0.7)'
        })
        el.addEventListener('mouseleave', () => {
          el.style.background = 'rgba(0,255,136,0.12)'
          el.style.boxShadow  = '0 0 6px rgba(0,255,136,0.35)'
        })

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          markFeatureClick(map)
          // Fly to camera location
          map.flyTo({ center: [cam.lng, cam.lat], zoom: 14, pitch: 45, duration: 1500 })

          // Show camera info popup — opens live feed in new window (iframe blocked by source)
          const html = `<div style="padding:0;font-family:'Inter',-apple-system,sans-serif;width:260px;">
            <div style="padding:8px 10px;">
              <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:2px;">◎ ${cam.name}</div>
              <div style="font-size:10px;color:#6b7280;margin-bottom:6px;">${cam.city}, ${cam.country}</div>
              <div style="font-size:9px;color:#9ca3af;margin-bottom:8px;font-family:monospace;">${cam.lat.toFixed(4)}, ${cam.lng.toFixed(4)}</div>
              <a href="${cam.url}" target="_blank" rel="noopener"
                style="display:block;text-align:center;font-size:10px;font-weight:700;color:#16a34a;text-decoration:none;border:1px solid #16a34a44;padding:5px 0;background:rgba(22,163,74,0.08);letter-spacing:.06em;">
                OPEN LIVE FEED ↗
              </a>
            </div>
          </div>`
          if (popupRef.current) popupRef.current.remove()
          popupRef.current = new mapboxgl.Popup({ maxWidth: '400px', className: 'cy-popup cam-popup', closeButton: true })
            .setLngLat([cam.lng, cam.lat])
            .setHTML(html)
            .addTo(map)
        })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center', draggable: false })
          .setLngLat([cam.lng, cam.lat])
          .addTo(map)
        cameraMarkersRef.current.push(marker)
      })
    }

    if (map.loaded()) add()
    else map.once('load', add)

    return () => {
      cameraMarkersRef.current.forEach(m => m.remove())
      cameraMarkersRef.current = []
    }
  }, [showCameras, mapReady])
}
