/**
 * Shareable view state in the URL hash: `#v=dark&l=flights,crises&g=security&c=Ukraine`.
 *
 * Only what defines "what I'm looking at" is encoded — map style, enabled layers, dock
 * group and selected country. Everything is validated against caller-supplied allow-lists,
 * so a hand-edited or stale link can never inject an unknown layer/mode into app state.
 */
import type { MapViewMode, PanelState } from '../types'

/** Exhaustive by construction: adding a MapViewMode without listing it here fails typecheck. */
const VIEW_MODE_SET: Record<MapViewMode, true> = {
  earth: true, standard: true, dark: true, satellite: true, nightvision: true,
  bw: true, infrared: true, snow: true, thermal: true, city3d: true,
}

export const isViewMode = (v: string | null | undefined): v is MapViewMode =>
  !!v && Object.prototype.hasOwnProperty.call(VIEW_MODE_SET, v)

export interface SharedState {
  viewMode: MapViewMode
  /** Keys of every layer that is switched on. */
  layers: (keyof PanelState)[]
  group: string
  country: string | null
}

export interface DecodedState {
  viewMode?: MapViewMode
  /** Present (possibly empty) only when the link carried an `l=` param. */
  layers?: (keyof PanelState)[]
  group?: string
  country?: string
}

export function encodeHash(s: SharedState): string {
  const p = new URLSearchParams()
  p.set('v', s.viewMode)
  p.set('l', s.layers.join(','))
  p.set('g', s.group)
  if (s.country) p.set('c', s.country)
  return '#' + p.toString()
}

export function decodeHash(
  hash: string,
  validLayers: readonly string[],
  validGroups: readonly string[],
): DecodedState {
  const out: DecodedState = {}
  const p = new URLSearchParams(hash.replace(/^#/, ''))

  const v = p.get('v')
  if (isViewMode(v)) out.viewMode = v

  const l = p.get('l')
  if (l !== null) {
    const allowed = new Set(validLayers)
    out.layers = [...new Set(l.split(',').filter(id => allowed.has(id)))] as (keyof PanelState)[]
  }

  const g = p.get('g')
  if (g && validGroups.includes(g)) out.group = g

  const c = p.get('c')
  if (c && c.length <= 80) out.country = c

  return out
}

/** Turn a decoded layer list into a full PanelState: listed layers on, everything else off. */
export function layersToPanelState(base: PanelState, layers: readonly (keyof PanelState)[]): PanelState {
  const on = new Set<string>(layers)
  const next = { ...base }
  for (const k of Object.keys(next) as (keyof PanelState)[]) next[k] = on.has(k)
  return next
}

export function enabledLayers(state: PanelState): (keyof PanelState)[] {
  return (Object.keys(state) as (keyof PanelState)[]).filter(k => state[k])
}

/**
 * Screenshot / demo mode (`?demo=1` or `?screenshot=1`): live third-party headlines are not shown, so a screenshot
 * can't carry an unmoderated headline the owner hasn't seen. Read from the query string, not the share hash.
 */
export function isDemoMode(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  const p = new URLSearchParams(search)
  return ['demo', 'screenshot'].some(k => p.has(k) && p.get(k) !== '0' && p.get(k) !== 'false')
}
