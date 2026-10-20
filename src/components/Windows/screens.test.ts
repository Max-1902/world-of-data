import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PANEL_MAP } from '../../panels/registry'
import { installLocalStorage } from '../../test/helpers'
import { BUILTIN_SCREENS, fromFractions, loadUserScreens, screenLayers, toFractions, MAX_NAME } from './screens'
import { GAP, linkedEdges, type Rect } from './geometry'
import { MAX_WINDOWS } from './useWindowLayout'

const B: Rect = { x: 72, y: 80, w: 1500, h: 840 }

describe('built-in screens', () => {
  it('have unique ids and names, and only name panels that exist', () => {
    expect(new Set(BUILTIN_SCREENS.map(s => s.id)).size).toBe(BUILTIN_SCREENS.length)
    expect(new Set(BUILTIN_SCREENS.map(s => s.name)).size).toBe(BUILTIN_SCREENS.length)
    for (const s of BUILTIN_SCREENS) {
      expect(s.wins.length).toBeLessThanOrEqual(MAX_WINDOWS)
      expect(new Set(s.wins.map(w => w.id)).size).toBe(s.wins.length)
      for (const w of s.wins) expect(PANEL_MAP.has(w.id), `${s.name}: ${w.id}`).toBe(true)
    }
  })

  it('tile the workspace exactly: in range, no overlaps, nothing left empty', () => {
    for (const s of BUILTIN_SCREENS.filter(x => x.wins.length)) {
      let area = 0
      for (const { f } of s.wins) {
        for (const n of [f.x, f.y, f.w, f.h]) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(1) }
        expect(f.x + f.w).toBeLessThanOrEqual(1 + 1e-9)
        expect(f.y + f.h).toBeLessThanOrEqual(1 + 1e-9)
        area += f.w * f.h
      }
      expect(area, s.name).toBeCloseTo(1, 6)
      for (let i = 0; i < s.wins.length; i++) for (let j = i + 1; j < s.wins.length; j++) {
        const a = s.wins[i].f, b = s.wins[j].f
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        expect(ox > 1e-9 && oy > 1e-9, `${s.name}: ${s.wins[i].id} overlaps ${s.wins[j].id}`).toBe(false)
      }
    }
  })

  it('place neighbours one gap apart, so their shared borders resize together', () => {
    const crisis = BUILTIN_SCREENS.find(s => s.id === 'b-crisis')!
    const rects = new Map(crisis.wins.map(w => [w.id, fromFractions(w.f, B, true)]))
    const threat = rects.get('threat')!, risk = rects.get('risk')!, intel = rects.get('intel')!
    expect(threat.x).toBe(B.x + GAP)
    expect(threat.y).toBe(B.y + GAP)
    expect(risk.y - (threat.y + threat.h)).toBeLessThanOrEqual(GAP + 1)
    const placed = [...rects].filter(([id]) => id !== 'threat').map(([id, rect]) => ({ id, rect }))
    expect(linkedEdges(threat, 'e', placed).map(l => l.id)).toContain('intel')
    expect(intel.x - (threat.x + threat.w)).toBeLessThanOrEqual(GAP + 1)
  })

  it('switch on the layers their panels draw, without turning others off', () => {
    const crisis = screenLayers(BUILTIN_SCREENS.find(s => s.id === 'b-crisis')!)
    expect(crisis.exact).toBe(false)
    expect(crisis.layers).toEqual(expect.arrayContaining(['crises', 'disasters', 'news']))
    expect(screenLayers(BUILTIN_SCREENS.find(s => s.id === 'b-map')!)).toEqual({ layers: [], exact: false })
    expect(screenLayers({ id: 'u', name: 'x', wins: [], layers: ['flights'] })).toEqual({ layers: ['flights'], exact: true })
  })
})

describe('fractions', () => {
  it('round-trip a window to within a pixel on the same workspace', () => {
    const r = { x: 300, y: 200, w: 640, h: 410 }
    const back = fromFractions(toFractions(r, B), B, false)
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(back[k] - r[k])).toBeLessThanOrEqual(1)
  })
  it('scale with the workspace', () => {
    const f = toFractions({ x: B.x, y: B.y, w: B.w / 2, h: B.h }, B)
    expect(fromFractions(f, { x: 0, y: 0, w: 3000, h: 1600 }, false)).toEqual({ x: 0, y: 0, w: 1500, h: 1600 })
  })
  it('clamp a window hanging off the workspace', () => {
    const f = toFractions({ x: B.x - 100, y: B.y + B.h - 50, w: 400, h: 400 }, B)
    expect(f.x).toBe(0)
    expect(f.y + f.h).toBeLessThanOrEqual(1)
  })
})

describe('loadUserScreens', () => {
  let store: Map<string, string>
  beforeEach(() => { store = installLocalStorage().store })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps valid screens and drops what it cannot trust', () => {
    const good = { id: 'u-1', name: 'Oil watch', wins: [{ id: 'markets', f: { x: 0, y: 0, w: 0.5, h: 1 } }, { id: 'inventories', f: { x: 0.5, y: 0, w: 0.5, h: 1 }, minimized: true }], layers: ['stocks', 7] }
    store.set('ws-screens', JSON.stringify([
      good,
      { id: 'u-1', name: 'duplicate id', wins: [] },
      { id: 'b-crisis', name: 'shadows a built-in', wins: [] },
      { id: 'u-2', name: '   ', wins: [] },
      { id: 'u-3', name: 'bad windows', wins: [
        { id: 'not-a-panel', f: { x: 0, y: 0, w: 1, h: 1 } },
        { id: 'risk', f: { x: 0, y: 0, w: 2, h: 1 } },
        { id: 'threat', f: { x: 0, y: 0, w: 0, h: 1 } },
        { id: 'intel', f: { x: 0, y: 0, w: 0.5, h: 0.5 } },
        { id: 'intel', f: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
      ] },
      { id: 'u-4', name: 'x'.repeat(100), wins: [] },
      null, 'junk',
    ]))
    const out = loadUserScreens()
    expect(out.map(s => s.id)).toEqual(['u-1', 'u-3', 'u-4'])
    expect(out[0]).toEqual({ ...good, layers: ['stocks'] })
    expect(out[1].wins).toEqual([{ id: 'intel', f: { x: 0, y: 0, w: 0.5, h: 0.5 } }])
    expect(out[2].name).toHaveLength(MAX_NAME)
  })

  it('returns nothing for corrupt storage', () => {
    store.set('ws-screens', '{nope')
    expect(loadUserScreens()).toEqual([])
    store.set('ws-screens', '{"a":1}')
    expect(loadUserScreens()).toEqual([])
  })
})
