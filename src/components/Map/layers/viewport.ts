import { useEffect } from 'react'
import type { MapHandle, MapViewProps } from '../types'

/** Resize Mapbox when deepstate split activates / deactivates */
export function useMapResize({ mapRef, containerRef }: MapHandle, { deepstateMode }: Pick<MapViewProps, 'deepstateMode'>) {
  // ── Resize Mapbox when deepstate split activates / deactivates ───────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Resize multiple times during the 250ms flex transition so the canvas keeps up
    const timers = [0, 50, 150, 300].map(ms =>
      setTimeout(() => { map.resize() }, ms)
    )
    // Also listen for transitionend as a final resize
    const container = containerRef.current
    const onEnd = () => { map.resize() }
    container?.addEventListener('transitionend', onEnd)
    return () => {
      timers.forEach(clearTimeout)
      container?.removeEventListener('transitionend', onEnd)
    }
  }, [deepstateMode])
}
