import { describe, it, expect } from 'vitest'
import {
  cascadeLayout, clampRect, linkedEdges, magnetMove, placeNew, resizeLinked, snapZone, splitHalves, tileLayout,
  GAP, MIN_H, MIN_W, type Rect,
} from './geometry'

const B: Rect = { x: 0, y: 50, w: 1200, h: 800 }

describe('clampRect', () => {
  it('pulls an off-screen window back and caps its size to the workspace', () => {
    expect(clampRect({ x: -500, y: -500, w: 400, h: 300 }, B)).toEqual({ x: 0, y: 50, w: 400, h: 300 })
    expect(clampRect({ x: 1100, y: 800, w: 400, h: 300 }, B)).toEqual({ x: 800, y: 550, w: 400, h: 300 })
    expect(clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, B)).toEqual(B)
  })
  it('enforces the minimum size', () => {
    const r = clampRect({ x: 10, y: 60, w: 10, h: 10 }, B)
    expect(r.w).toBe(MIN_W)
    expect(r.h).toBe(MIN_H)
  })
})

describe('snapZone', () => {
  it('returns null in open space with no window under the pointer', () => {
    expect(snapZone({ x: 600, y: 400 }, B, [])).toBeNull()
  })
  it('left and right edges snap to halves, the top edge fills the screen', () => {
    expect(snapZone({ x: 2, y: 400 }, B, [])).toEqual({ kind: 'edge', preview: { x: 0, y: 50, w: 600, h: 800 } })
    expect(snapZone({ x: 1199, y: 400 }, B, [])).toEqual({ kind: 'edge', preview: { x: 600, y: 50, w: 600, h: 800 } })
    expect(snapZone({ x: 600, y: 52 }, B, [])).toEqual({ kind: 'edge', preview: B })
    expect(snapZone({ x: 600, y: 848 }, B, [])).toEqual({ kind: 'edge', preview: { x: 0, y: 450, w: 1200, h: 400 } })
  })
  it('corners snap to quarters', () => {
    expect(snapZone({ x: 2, y: 60 }, B, [])?.preview).toEqual({ x: 0, y: 50, w: 600, h: 400 })
    expect(snapZone({ x: 1199, y: 845 }, B, [])?.preview).toEqual({ x: 600, y: 450, w: 600, h: 400 })
    expect(snapZone({ x: 1150, y: 52 }, B, [])?.preview).toEqual({ x: 600, y: 50, w: 600, h: 400 })
  })
  it('ignores a pointer far outside the workspace', () => {
    expect(snapZone({ x: 600, y: 0 }, B, [])).toBeNull()
  })
  it('over another window, splits it on the side nearest the pointer', () => {
    const target = { x: 200, y: 200, w: 400, h: 300 }
    const z = snapZone({ x: 560, y: 350 }, B, [{ id: 'a', rect: target }])
    expect(z?.kind).toBe('split')
    if (z?.kind !== 'split') return
    expect(z.targetId).toBe('a')
    // dragged window takes the right half, target keeps the left; together they fill the original rect
    expect(z.preview.x).toBeGreaterThan(z.targetRect.x)
    expect(z.targetRect.x).toBe(200)
    expect(z.preview.x + z.preview.w).toBe(600)
    expect(z.preview.x - (z.targetRect.x + z.targetRect.w)).toBe(GAP)
  })
  it('splits top/bottom when the pointer is nearer a horizontal edge', () => {
    const z = snapZone({ x: 400, y: 210 }, B, [{ id: 'a', rect: { x: 200, y: 200, w: 400, h: 300 } }])
    expect(z && z.kind === 'split' && z.preview.y).toBe(200)
    expect(z && z.kind === 'split' && z.targetRect.y).toBeGreaterThan(300)
  })
  it('uses the topmost window when windows overlap', () => {
    const r = { x: 200, y: 200, w: 400, h: 300 }
    const z = snapZone({ x: 400, y: 350 }, B, [{ id: 'front', rect: r }, { id: 'back', rect: r }])
    expect(z && z.kind === 'split' && z.targetId).toBe('front')
  })
})

describe('splitHalves', () => {
  it('halves cover the rect with one gap between them', () => {
    const r = { x: 0, y: 0, w: 401, h: 300 }
    const [a, b] = splitHalves(r, 'left')
    expect(a.x).toBe(0)
    expect(a.w + b.w + GAP).toBe(401)
    expect(b.x + b.w).toBe(401)
  })
})

describe('magnetMove', () => {
  it('pulls an edge onto a nearby window edge (with the tiling gap)', () => {
    const other = { x: 100, y: 100, w: 300, h: 300 }
    const r = magnetMove({ x: 410, y: 104, w: 200, h: 200 }, B, [other])
    expect(r.x).toBe(400 + GAP)
    expect(r.y).toBe(100)
  })
  it('pulls onto the workspace edge and leaves far windows alone', () => {
    expect(magnetMove({ x: 7, y: 300, w: 200, h: 200 }, B, []).x).toBe(0)
    expect(magnetMove({ x: 500, y: 300, w: 200, h: 200 }, B, [])).toEqual({ x: 500, y: 300, w: 200, h: 200 })
  })
})

describe('linked resizing', () => {
  const left = { x: 0, y: 50, w: 600 - GAP / 2, h: 800 }
  const right = { x: 600 + GAP / 2, y: 50, w: 600 - GAP / 2, h: 800 }

  it('finds the split partner on the dragged edge only', () => {
    expect(linkedEdges(left, 'e', [{ id: 'r', rect: right }])).toEqual([{ id: 'r', edge: 'left' }])
    expect(linkedEdges(left, 'w', [{ id: 'r', rect: right }])).toEqual([])
    expect(linkedEdges(left, 's', [{ id: 'r', rect: right }])).toEqual([])
  })

  it('moves the shared border for both windows', () => {
    const links = linkedEdges(left, 'e', [{ id: 'r', rect: right }])
    const out = resizeLinked('l', left, 'e', 100, 0, B, links, new Map([['r', right]]))
    expect(out.get('l')!.w).toBe(left.w + 100)
    expect(out.get('r')!.x).toBe(right.x + 100)
    expect(out.get('r')!.w).toBe(right.w - 100)
    // the gap between them is unchanged
    expect(out.get('r')!.x - (out.get('l')!.x + out.get('l')!.w)).toBe(GAP)
  })

  it('stops before either window drops below the minimum size', () => {
    const links = linkedEdges(left, 'e', [{ id: 'r', rect: right }])
    const out = resizeLinked('l', left, 'e', 5000, 0, B, links, new Map([['r', right]]))
    expect(out.get('r')!.w).toBe(MIN_W)
    const shrink = resizeLinked('l', left, 'e', -5000, 0, B, links, new Map([['r', right]]))
    expect(shrink.get('l')!.w).toBe(MIN_W)
  })

  it('never resizes past the workspace edge', () => {
    const r = { x: 100, y: 100, w: 400, h: 300 }
    expect(resizeLinked('a', r, 'nw', -1000, -1000, B, [], new Map()).get('a')).toEqual({ x: 0, y: 50, w: 500, h: 350 })
  })
})

describe('layouts', () => {
  it('grid tiles fill the workspace without overlap', () => {
    for (const n of [1, 2, 3, 4, 5, 7, 12]) {
      const rects = tileLayout(n, B, 'grid')
      expect(rects).toHaveLength(n)
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(B.x)
        expect(r.y).toBeGreaterThanOrEqual(B.y)
        expect(r.x + r.w).toBeLessThanOrEqual(B.x + B.w)
        expect(r.y + r.h).toBeLessThanOrEqual(B.y + B.h)
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = rects[i], b = rects[j]
        const overlap = Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)
        expect(overlap).toBe(false)
      }
    }
  })
  it('columns put everything side by side, rows stack', () => {
    expect(new Set(tileLayout(3, B, 'columns').map(r => r.y)).size).toBe(1)
    expect(new Set(tileLayout(3, B, 'rows').map(r => r.x)).size).toBe(1)
    expect(tileLayout(0, B, 'grid')).toEqual([])
  })
  it('cascade and new windows stay on screen', () => {
    for (const r of [...cascadeLayout(12, B), placeNew(B, 3), placeNew(B, 0, { x: 1199, y: 849 })]) {
      expect(clampRect(r, B)).toEqual(r)
    }
  })
})
