import { useEffect, useRef, type RefObject } from 'react'

/**
 * `onPointerLeave` for a chart readout that also works on touch. A finger lifting fires pointerleave at once, which would
 * close the readout the tap just opened, so touch ignores it and the readout stays until a tap lands outside the chart.
 */
export function useHoverLeave(ref: RefObject<HTMLElement | null>, clear: () => void) {
  const latest = useRef(clear)
  latest.current = clear
  useEffect(() => {
    const el = ref.current
    const doc = el?.ownerDocument
    if (!el || !doc) return
    const away = (e: PointerEvent) => { if (e.pointerType === 'touch' && !el.contains(e.target as Node)) latest.current() }
    doc.addEventListener('pointerdown', away)
    return () => doc.removeEventListener('pointerdown', away)
  }, [ref])
  return (e: React.PointerEvent) => { if (e.pointerType !== 'touch') latest.current() }
}
