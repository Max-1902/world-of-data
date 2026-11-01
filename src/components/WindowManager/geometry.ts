/**
 * Pure geometry for the floating panel windows: snapping to screen edges, splitting a window with another,
 * magnetic edges, linked resizing of split neighbours and the tile layouts. No DOM, no React — unit-tested.
 */

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }
export interface Placed { id: string; rect: Rect }

export const MIN_W = 280
export const MIN_H = 160
/** how close (px) the pointer must be to a workspace edge to snap there */
export const EDGE = 24
/** near an edge and this close to a corner → quarter of the screen */
export const CORNER = 90
/** window edges closer than this pull together while moving/resizing */
export const MAGNET = 10
/** gap between tiled windows */
export const GAP = 6

/** Where a drag would land if released now: snapped to a screen region, or splitting another window. */
export type SnapZone =
  | { kind: 'edge'; preview: Rect }
  | { kind: 'split'; preview: Rect; targetId: string; targetRect: Rect }

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const inside = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

/** Keep a window on screen: never larger than the workspace and with its title bar reachable. */
export function clampRect(r: Rect, b: Rect): Rect {
  const w = Math.max(Math.min(MIN_W, b.w), Math.min(r.w, b.w))
  const h = Math.max(Math.min(MIN_H, b.h), Math.min(r.h, b.h))
  return {
    w, h,
    x: Math.min(Math.max(b.x, r.x), b.x + b.w - w),
    y: Math.min(Math.max(b.y, r.y), b.y + b.h - h),
  }
}

/** The two halves of `r` along the side the pointer is nearest: [the half on that side, the other half]. */
export function splitHalves(r: Rect, side: 'left' | 'right' | 'top' | 'bottom'): [Rect, Rect] {
  const g = GAP / 2
  if (side === 'left' || side === 'right') {
    const lw = Math.round(r.w / 2)
    const left = { x: r.x, y: r.y, w: lw - g, h: r.h }
    const right = { x: r.x + lw + g, y: r.y, w: r.w - lw - g, h: r.h }
    return side === 'left' ? [left, right] : [right, left]
  }
  const th = Math.round(r.h / 2)
  const top = { x: r.x, y: r.y, w: r.w, h: th - g }
  const bottom = { x: r.x, y: r.y + th + g, w: r.w, h: r.h - th - g }
  return side === 'top' ? [top, bottom] : [bottom, top]
}

/**
 * Where releasing at `p` would put the dragged window. Screen edges win (left/right/bottom half, top = fill,
 * corners = quarters); otherwise, over another window, the side of it nearest the pointer — the dragged window
 * takes that half and the other window keeps the rest. `others` is front-to-back order (topmost first).
 */
export function snapZone(p: Point, b: Rect, others: Placed[]): SnapZone | null {
  if (!inside(p, { x: b.x - EDGE, y: b.y - EDGE, w: b.w + 2 * EDGE, h: b.h + 2 * EDGE })) return null
  const nearL = p.x <= b.x + EDGE, nearR = p.x >= b.x + b.w - EDGE
  const nearT = p.y <= b.y + EDGE, nearB = p.y >= b.y + b.h - EDGE
  const hw = Math.round(b.w / 2), hh = Math.round(b.h / 2)
  const half = {
    left:   { x: b.x, y: b.y, w: hw, h: b.h },
    right:  { x: b.x + hw, y: b.y, w: b.w - hw, h: b.h },
    top:    { x: b.x, y: b.y, w: b.w, h: hh },
    bottom: { x: b.x, y: b.y + hh, w: b.w, h: b.h - hh },
  }
  const quarter = (right: boolean, bottom: boolean): Rect =>
    ({ x: right ? b.x + hw : b.x, y: bottom ? b.y + hh : b.y, w: right ? b.w - hw : hw, h: bottom ? b.h - hh : hh })
  const nearTop = p.y <= b.y + CORNER, nearBottom = p.y >= b.y + b.h - CORNER
  const nearLeft = p.x <= b.x + CORNER, nearRight = p.x >= b.x + b.w - CORNER

  if (nearL || nearR) {
    if (nearTop) return { kind: 'edge', preview: quarter(nearR, false) }
    if (nearBottom) return { kind: 'edge', preview: quarter(nearR, true) }
    return { kind: 'edge', preview: nearL ? half.left : half.right }
  }
  if (nearT || nearB) {
    if (nearLeft) return { kind: 'edge', preview: quarter(false, nearB) }
    if (nearRight) return { kind: 'edge', preview: quarter(true, nearB) }
    return { kind: 'edge', preview: nearT ? b : half.bottom }
  }

  const target = others.find(o => inside(p, o.rect))
  if (!target) return null
  const r = target.rect
  const fx = (p.x - r.x) / r.w, fy = (p.y - r.y) / r.h
  const dist = { left: fx, right: 1 - fx, top: fy, bottom: 1 - fy }
  const side = (Object.keys(dist) as (keyof typeof dist)[]).reduce((a, s) => (dist[s] < dist[a] ? s : a))
  const [preview, rest] = splitHalves(r, side)
  return { kind: 'split', preview, targetId: target.id, targetRect: rest }
}

/** Pull a moving window's edges onto nearby window edges and the workspace edges (within MAGNET px). */
export function magnetMove(r: Rect, b: Rect, others: Rect[]): Rect {
  const xs = [b.x, b.x + b.w], ys = [b.y, b.y + b.h]
  for (const o of others) {
    xs.push(o.x, o.x + o.w, o.x - GAP, o.x + o.w + GAP)
    ys.push(o.y, o.y + o.h, o.y - GAP, o.y + o.h + GAP)
  }
  const pull = (lo: number, size: number, lines: number[]) => {
    let best = 0, bestD = MAGNET + 1
    for (const l of lines) {
      for (const d of [l - lo, l - (lo + size)]) if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = d }
    }
    return bestD <= MAGNET ? best : 0
  }
  return { ...r, x: r.x + pull(r.x, r.w, xs), y: r.y + pull(r.y, r.h, ys) }
}

/** A window edge another window's edge touches; `edge` is which edge of the neighbour moves. */
export interface LinkedEdge { id: string; edge: 'left' | 'right' | 'top' | 'bottom' }

const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0

/**
 * Neighbours that share the edge(s) being dragged — split partners, tiled windows — so they resize with it and
 * the shared border moves as one, like a terminal's split panes. Edges count as shared within GAP + 2 px.
 */
export function linkedEdges(self: Rect, dir: ResizeDir, others: Placed[]): LinkedEdge[] {
  const tol = GAP + 2
  const out: LinkedEdge[] = []
  for (const o of others) {
    const r = o.rect
    const vOverlap = overlaps(self.y, self.y + self.h, r.y, r.y + r.h)
    const hOverlap = overlaps(self.x, self.x + self.w, r.x, r.x + r.w)
    if (dir.includes('e') && vOverlap && Math.abs(r.x - (self.x + self.w)) <= tol) out.push({ id: o.id, edge: 'left' })
    if (dir.includes('w') && vOverlap && Math.abs(r.x + r.w - self.x) <= tol) out.push({ id: o.id, edge: 'right' })
    if (dir.includes('s') && hOverlap && Math.abs(r.y - (self.y + self.h)) <= tol) out.push({ id: o.id, edge: 'top' })
    if (dir.includes('n') && hOverlap && Math.abs(r.y + r.h - self.y) <= tol) out.push({ id: o.id, edge: 'bottom' })
  }
  return out
}

/**
 * Resize `start` by the pointer delta from handle `dir`, then move every linked neighbour's edge by the same
 * amount. The delta is limited so neither this window nor any neighbour drops below the minimum size, and this
 * window never leaves the workspace. Returns the new rects by id (`selfId` included).
 */
export function resizeLinked(
  selfId: string, start: Rect, dir: ResizeDir, dx: number, dy: number, b: Rect,
  links: LinkedEdge[], startRects: Map<string, Rect>,
): Map<string, Rect> {
  const e = dir.includes('e'), w = dir.includes('w'), s = dir.includes('s'), n = dir.includes('n')
  // horizontal delta limits
  let lo = -Infinity, hi = Infinity
  if (e) { lo = Math.max(lo, MIN_W - start.w); hi = Math.min(hi, b.x + b.w - (start.x + start.w)) }
  if (w) { hi = Math.min(hi, start.w - MIN_W); lo = Math.max(lo, b.x - start.x) }
  let vlo = -Infinity, vhi = Infinity
  if (s) { vlo = Math.max(vlo, MIN_H - start.h); vhi = Math.min(vhi, b.y + b.h - (start.y + start.h)) }
  if (n) { vhi = Math.min(vhi, start.h - MIN_H); vlo = Math.max(vlo, b.y - start.y) }
  for (const l of links) {
    const r = startRects.get(l.id)
    if (!r) continue
    if (l.edge === 'left') hi = Math.min(hi, r.w - MIN_W)       // its left edge moves right → it shrinks
    if (l.edge === 'right') lo = Math.max(lo, MIN_W - r.w)
    if (l.edge === 'top') vhi = Math.min(vhi, r.h - MIN_H)
    if (l.edge === 'bottom') vlo = Math.max(vlo, MIN_H - r.h)
  }
  const cdx = e || w ? Math.min(hi, Math.max(lo, dx)) : 0
  const cdy = s || n ? Math.min(vhi, Math.max(vlo, dy)) : 0

  const out = new Map<string, Rect>()
  const me = { ...start }
  if (e) me.w += cdx
  if (w) { me.x += cdx; me.w -= cdx }
  if (s) me.h += cdy
  if (n) { me.y += cdy; me.h -= cdy }
  out.set(selfId, me)
  for (const l of links) {
    const r0 = startRects.get(l.id)
    if (!r0) continue
    const r = { ...(out.get(l.id) ?? r0) }
    if (l.edge === 'left') { r.x += cdx; r.w -= cdx }
    if (l.edge === 'right') r.w += cdx
    if (l.edge === 'top') { r.y += cdy; r.h -= cdy }
    if (l.edge === 'bottom') r.h += cdy
    out.set(l.id, r)
  }
  return out
}

export type TileMode = 'grid' | 'columns' | 'rows'

/**
 * Evenly fill the workspace with `n` windows. Grid: near-square; the last row's windows widen to fill it.
 * No tile is ever smaller than MIN_W × MIN_H (a smaller window would not survive a reload): the columns or
 * rows a mode asks for are capped to what fits, and when `n` windows cannot all fit at that size the
 * layout falls back to an overlapping cascade.
 */
export function tileLayout(n: number, b: Rect, mode: TileMode): Rect[] {
  if (n <= 0) return []
  const maxCols = Math.max(1, Math.floor((b.w - GAP) / (MIN_W + GAP)))
  const maxRows = Math.max(1, Math.floor((b.h - GAP) / (MIN_H + GAP)))
  if (n > maxCols * maxRows) return cascadeLayout(n, b)
  let cols = mode === 'columns' ? n : mode === 'rows' ? 1 : Math.ceil(Math.sqrt(n))
  cols = Math.min(cols, maxCols)
  if (Math.ceil(n / cols) > maxRows) cols = Math.ceil(n / maxRows)
  const rows = Math.ceil(n / cols)
  const out: Rect[] = []
  const rowH = (b.h - GAP * (rows + 1)) / rows
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(cols, n - row * cols)
    const colW = (b.w - GAP * (inRow + 1)) / inRow
    for (let c = 0; c < inRow; c++) {
      out.push({
        x: Math.round(b.x + GAP + c * (colW + GAP)),
        y: Math.round(b.y + GAP + row * (rowH + GAP)),
        w: Math.round(colW),
        h: Math.round(rowH),
      })
    }
  }
  return out
}

/** Overlapping, offset windows — each title bar stays visible. */
export function cascadeLayout(n: number, b: Rect): Rect[] {
  const w = Math.min(560, Math.max(MIN_W, Math.round(b.w * 0.45)))
  const h = Math.min(460, Math.max(MIN_H, Math.round(b.h * 0.6)))
  const step = 32
  const fit = Math.max(1, Math.floor(Math.min(b.w - w, b.h - h) / step) + 1)
  return Array.from({ length: n }, (_, i) => clampRect({ x: b.x + 24 + (i % fit) * step, y: b.y + 16 + (i % fit) * step, w, h }, b))
}

/** Where a newly opened window goes: centred on the drop point when there is one, else the next cascade slot. */
export function placeNew(b: Rect, existing: number, at?: Point): Rect {
  const w = Math.min(520, Math.max(MIN_W, Math.round(b.w * 0.36)))
  const h = Math.min(440, Math.max(MIN_H, Math.round(b.h * 0.55)))
  if (at) return clampRect({ x: at.x - w / 2, y: at.y - 16, w, h }, b)
  return cascadeLayout(existing + 1, b)[existing]
}
