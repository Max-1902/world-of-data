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
    // the element's own window: a chart can live in the analyst's separate browser window
    const RO = el.ownerDocument.defaultView?.ResizeObserver ?? (typeof ResizeObserver === 'undefined' ? undefined : ResizeObserver)
    if (!RO) return
    const ro = new RO(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}
