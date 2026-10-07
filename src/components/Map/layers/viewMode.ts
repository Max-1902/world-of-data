import { useEffect } from 'react'
import { CANVAS_FILTERS, VISION_OVERLAYS } from '../viewModes'
import type { MapHandle, MapViewProps } from '../types'

/** Vision mode → CSS filter on canvas + multi-layer overlays + 3D city */
export function useViewMode({ mapRef, containerRef, layersReadyRef, mapReady }: MapHandle, { viewMode }: Pick<MapViewProps, 'viewMode'>) {
  // ── Vision mode → CSS filter on canvas + multi-layer overlays + 3D city ───
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const canvas = map.getCanvas()
    if (canvas) canvas.style.filter = CANVAS_FILTERS[viewMode] || ''

    const container = containerRef.current
    if (container) {
      // Clean up previous overlays
      container.querySelectorAll('.sv-vision-overlay, .sv-scanlines, .sv-noise').forEach(el => {
        const raf = (el as HTMLElement).dataset.raf
        if (raf) cancelAnimationFrame(Number(raf))
        el.remove()
      })

      const cfg = VISION_OVERLAYS[viewMode]
      if (cfg) {
        // Stack multiple overlay layers for realistic composite
        for (const layer of cfg.layers) {
          const el = document.createElement('div')
          el.className = 'sv-vision-overlay'
          el.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:5;transition:opacity .3s;`
          if (layer.background) el.style.background = layer.background
          if (layer.boxShadow)  el.style.boxShadow = layer.boxShadow
          if (layer.mixBlendMode) el.style.mixBlendMode = layer.mixBlendMode
          el.style.opacity = String(layer.opacity ?? 1)
          container.appendChild(el)
        }

        // CRT phosphor scan lines (nightvision)
        if (cfg.scanlines) {
          const sl = document.createElement('div')
          sl.className = 'sv-scanlines'
          sl.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:6;
            background:repeating-linear-gradient(
              to bottom,
              transparent 0px, transparent 1.5px,
              rgba(0,20,0,0.15) 1.5px, rgba(0,20,0,0.15) 3px
            );opacity:0.6;`
          container.appendChild(sl)
        }

        // Animated sensor noise grain
        if (cfg.noise) {
          const ns = document.createElement('div')
          ns.className = 'sv-noise'
          ns.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:7;
            opacity:${cfg.noise.opacity};mix-blend-mode:${cfg.noise.blend};
            background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
            background-size:128px 128px;`
          let frame = 0
          const animNoise = () => {
            frame = (frame + 1) % 128
            ns.style.backgroundPosition = `${frame}px ${(frame * 0.7) | 0}px`
            ns.dataset.raf = String(requestAnimationFrame(animNoise))
          }
          animNoise()
          container.appendChild(ns)
        }
      }
    }

    // 3D city view: tilt + show building extrusions
    if (viewMode === 'city3d') {
      map.easeTo({ pitch: 55, duration: 800 })
      if (map.getLayer('3d-buildings')) {
        map.setLayoutProperty('3d-buildings', 'visibility', 'visible')
      }
    } else {
      map.easeTo({ pitch: 0, duration: 600 })
      if (map.getLayer('3d-buildings')) {
        map.setLayoutProperty('3d-buildings', 'visibility', 'none')
      }
    }

    return () => {
      // Cleanup animated noise RAF
      if (container) {
        container.querySelectorAll('.sv-noise').forEach(el => {
          const raf = (el as HTMLElement).dataset.raf
          if (raf) cancelAnimationFrame(Number(raf))
        })
        container.querySelectorAll('.sv-vision-overlay, .sv-scanlines, .sv-noise').forEach(el => el.remove())
      }
    }
  }, [viewMode, mapReady])
}
