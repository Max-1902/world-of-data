import { useEffect } from 'react'
import type { MapHandle, MapViewProps } from '../types'

/** Keep the canvas the size of its container: Mapbox only follows window resizes, not a dock being dragged or closed. */
function useContainerResize({ mapRef, containerRef, mapReady }: MapHandle) {
  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { map.resize() })
    })
    ro.observe(container)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [mapReady])
}

/** Resize Mapbox when deepstate split activates / deactivates */
export function useMapResize(handle: MapHandle, { deepstateMode }: Pick<MapViewProps, 'deepstateMode'>) {
  const { mapRef, containerRef } = handle
  useContainerResize(handle)
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
