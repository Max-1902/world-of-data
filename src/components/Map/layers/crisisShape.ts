/**
 * Crisis markers: the type is told by shape as well as colour (colour alone separates war from conflict from disaster
 * poorly for colour-blind viewers, and not at all on pale imagery). Severity stays on size.
 */
export const CRISIS_COLORS: Record<string, string> = {
  war: '#ff1a2e', conflict: '#ff6600', terrorism: '#cc0033',
  protest: '#ffcc00', political: '#aa44ff', disaster: '#ff8800',
}

/** `glyph` is the matching shape name in markShapes.ts, so the map key draws the same silhouette. */
export const CRISIS_SHAPES: Record<string, { name: string; clip: string; glyph: string }> = {
  war: { name: 'circle', glyph: 'circle', clip: 'circle(50%)' },
  conflict: { name: 'diamond', glyph: 'diamond', clip: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' },
  terrorism: { name: 'triangle', glyph: 'triangle', clip: 'polygon(50% 0, 100% 100%, 0 100%)' },
  protest: { name: 'square', glyph: 'square', clip: 'polygon(8% 8%, 92% 8%, 92% 92%, 8% 92%)' },
  political: { name: 'inverted triangle', glyph: 'triangle-down', clip: 'polygon(0 0, 100% 0, 50% 100%)' },
  disaster: { name: 'cross', glyph: 'plus', clip: 'polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%)' },
}
const FALLBACK = CRISIS_SHAPES.conflict

export const SEV_SIZE: Record<string, number> = { critical: 18, high: 13, medium: 10, low: 8 }

const TYPE_LABEL: Record<string, string> = { war: 'War', conflict: 'Conflict', terrorism: 'Terrorism', protest: 'Protest', political: 'Political', disaster: 'Disaster' }
export const crisisTypeLabel = (type: string) => TYPE_LABEL[type] ?? type

/**
 * One marker element: a white-haloed shape in the type's colour. Archived (year-old) events are drawn hollow with no
 * glow, so they never read as live events.
 */
export function crisisMarkerEl(opts: { type: string; severity: string; archived?: boolean; label: string }): HTMLElement {
  const color = CRISIS_COLORS[opts.type] || '#ff6600'
  const shape = CRISIS_SHAPES[opts.type] ?? FALLBACK
  const size = SEV_SIZE[opts.severity] || 10
  const el = document.createElement('div')
  // the halo is a drop-shadow on the wrapper because clip-path would cut off a border
  el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;filter:drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff);${opts.archived ? 'opacity:.75;' : ''}`
  const body = document.createElement('div')
  body.style.cssText = `width:100%;height:100%;background:${color};clip-path:${shape.clip};`
  el.appendChild(body)
  if (opts.archived) {
    const hole = document.createElement('div')
    hole.style.cssText = `position:absolute;left:25%;top:25%;width:50%;height:50%;background:#0b1520;clip-path:${shape.clip};`
    el.appendChild(hole)
  }
  el.dataset.crisisShape = shape.name
  keyboardReachable(el, `${crisisTypeLabel(opts.type)} (${shape.name}), ${opts.severity} severity${opts.archived ? ', archived' : ''}: ${opts.label}`)
  return el
}

/** Make a map marker a labelled tab stop that opens its popup on Enter or Space, like a click. */
export function keyboardReachable(el: HTMLElement, label: string): void {
  el.setAttribute('role', 'button')
  el.tabIndex = 0
  el.setAttribute('aria-label', label)
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click() } })
}
