import { useEffect, useRef, useState } from 'react'

/** Tracks an element's content width so SVG charts can redraw at 1:1 pixels as the dock is resized. */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => { const w = Math.floor(el.getBoundingClientRect().width); if (w > 0) setWidth(w) }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}
