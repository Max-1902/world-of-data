/**
 * Screens: named window layouts you switch between in one click (taskbar tabs, Alt+1–9, Cmd+K) — "Crisis",
 * "Markets", or your own. Positions are stored as fractions of the workspace, so a screen saved on a laptop
 * fills a large monitor the same way. Built-in screens only arrange existing registry panels; they add no data.
 */
import type { PanelState } from '../../types'
import { PANEL_MAP } from '../../panels/registry'
import { GAP, type Rect } from './geometry'

export interface ScreenWin {
  id: string
  /** position and size as fractions (0–1) of the workspace */
  f: Rect
  minimized?: boolean
}

export interface Screen {
  id: string
  name: string
  desc?: string
  wins: ScreenWin[]
  /**
   * Map layers. Your screens store the exact set that was on when saved and restore exactly that;
   * built-in screens store none and instead switch on the layers their panels draw (leaving others alone).
   */
  layers?: (keyof PanelState)[]
  builtin?: boolean
}

const w = (id: string, x: number, y: number, fw: number, fh: number): ScreenWin => ({ id, f: { x, y, w: fw, h: fh } })

export const BUILTIN_SCREENS: Screen[] = [
  { id: 'b-map', name: 'Map', builtin: true, desc: 'Just the map — every window back in the dock', wins: [] },
  {
    id: 'b-crisis', name: 'Crisis', builtin: true, desc: 'Threat level, risk by country, live incidents, ICG tracking, disasters and reporting',
    wins: [
      w('threat', 0, 0, 0.22, 0.4), w('risk', 0, 0.4, 0.22, 0.6),
      w('intel', 0.22, 0, 0.42, 0.6), w('disasters', 0.22, 0.6, 0.42, 0.4),
      w('crisiswatch', 0.64, 0, 0.36, 0.5), w('news', 0.64, 0.5, 0.36, 0.5),
    ],
  },
  {
    id: 'b-markets', name: 'Markets', builtin: true, desc: 'Live prices, energy inventories, macro data, trade and resources',
    wins: [
      w('markets', 0, 0, 0.38, 0.6), w('inventories', 0, 0.6, 0.38, 0.4),
      w('economy', 0.38, 0, 0.34, 0.6), w('tradePartnersByCountry', 0.38, 0.6, 0.34, 0.4),
      w('owid', 0.72, 0, 0.28, 0.5), w('resources', 0.72, 0.5, 0.28, 0.5),
    ],
  },
  {
    id: 'b-security', name: 'Security', builtin: true, desc: 'Force size, installations, sanctions, airspace and nuclear sites',
    wins: [
      w('militaryPersonnel', 0, 0, 0.3, 0.5), w('military', 0, 0.5, 0.3, 0.5),
      w('sanctions', 0.3, 0, 0.4, 0.5), w('airspace', 0.3, 0.5, 0.4, 0.5),
      w('nuclear', 0.7, 0, 0.3, 1),
    ],
  },
  {
    id: 'b-disruptions', name: 'Disruptions', builtin: true, desc: 'Disasters, internet outages, displacement and power output',
    wins: [
      w('disasters', 0, 0, 0.5, 0.5), w('outages', 0.5, 0, 0.5, 0.5),
      w('humanitarian', 0, 0.5, 0.5, 0.5), w('infraIndicators', 0.5, 0.5, 0.5, 0.5),
    ],
  },
  {
    id: 'b-news', name: 'Newsroom', builtin: true, desc: 'Headlines, live broadcasts, the briefing and incidents',
    wins: [
      w('news', 0, 0, 0.34, 1), w('livefeed', 0.34, 0, 0.4, 0.6), w('brief', 0.34, 0.6, 0.4, 0.4), w('intel', 0.74, 0, 0.26, 1),
    ],
  },
  {
    id: 'b-analysis', name: 'Analysis', builtin: true, desc: 'The analyst next to the forecasts and the indicator explorer',
    wins: [
      w('analyst', 0, 0, 0.44, 1), w('predictions', 0.44, 0, 0.56, 0.55), w('countryAnalytics', 0.44, 0.55, 0.56, 0.45),
    ],
  },
]

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** A window's rect as fractions of the workspace. */
export function toFractions(r: Rect, b: Rect): Rect {
  const x = clamp01((r.x - b.x) / b.w), y = clamp01((r.y - b.y) / b.h)
  return { x, y, w: Math.min(1 - x, Math.max(0, r.w / b.w)), h: Math.min(1 - y, Math.max(0, r.h / b.h)) }
}

/**
 * Fractions back to pixels. `gaps` (built-in screens, which are written edge to edge) leaves GAP px between
 * neighbours and at the workspace edge — neighbours stay within linked-resize range of each other.
 * Saved screens already contain their gaps, so they are restored as-is.
 */
export function fromFractions(f: Rect, b: Rect, gaps: boolean): Rect {
  const x0 = b.x + f.x * b.w, y0 = b.y + f.y * b.h
  const x1 = x0 + f.w * b.w, y1 = y0 + f.h * b.h
  if (!gaps) return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) }
  const edge = (atEdge: boolean) => (atEdge ? GAP : GAP / 2)
  const l = x0 + edge(f.x <= 0.001), r = x1 - edge(f.x + f.w >= 0.999)
  const t = y0 + edge(f.y <= 0.001), btm = y1 - edge(f.y + f.h >= 0.999)
  return { x: Math.round(l), y: Math.round(t), w: Math.round(r - l), h: Math.round(btm - t) }
}

/** The layers a screen turns on, and whether it replaces the current set (saved screens) or adds to it (built-in). */
export function screenLayers(s: Screen): { layers: (keyof PanelState)[]; exact: boolean } {
  if (s.layers) return { layers: s.layers, exact: true }
  const set = new Set<keyof PanelState>()
  for (const win of s.wins) {
    const map = PANEL_MAP.get(win.id)?.map
    if (Array.isArray(map)) for (const l of map) set.add(l)
  }
  return { layers: [...set], exact: false }
}

export const MAX_NAME = 40
const LS_SCREENS = 'ws-screens'

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const isFrac = (n: unknown): n is number => isNum(n) && n >= 0 && n <= 1

/** Your saved screens; anything malformed (or naming panels that no longer exist) is dropped, not guessed at. */
export function loadUserScreens(): Screen[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SCREENS) ?? '[]')
    if (!Array.isArray(raw)) return []
    const out: Screen[] = []
    const ids = new Set<string>()
    for (const s of raw) {
      if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || !s.name.trim() || ids.has(s.id) || !Array.isArray(s.wins)) continue
      if (BUILTIN_SCREENS.some(b => b.id === s.id)) continue
      const wins: ScreenWin[] = []
      for (const x of s.wins) {
        const f = x?.f
        if (!x || typeof x.id !== 'string' || !PANEL_MAP.has(x.id) || wins.some(y => y.id === x.id)) continue
        if (!f || ![f.x, f.y, f.w, f.h].every(isFrac) || f.w <= 0 || f.h <= 0) continue
        wins.push({ id: x.id, f: { x: f.x, y: f.y, w: f.w, h: f.h }, ...(x.minimized === true ? { minimized: true } : {}) })
      }
      const layers = Array.isArray(s.layers) ? s.layers.filter((l: unknown): l is keyof PanelState => typeof l === 'string') : undefined
      ids.add(s.id)
      out.push({ id: s.id, name: s.name.slice(0, MAX_NAME), wins, ...(layers ? { layers } : {}) })
    }
    return out
  } catch { return [] }
}

export function saveUserScreens(screens: Screen[]) {
  try { localStorage.setItem(LS_SCREENS, JSON.stringify(screens.map(({ id, name, wins, layers }) => ({ id, name, wins, layers })))) } catch {}
}
