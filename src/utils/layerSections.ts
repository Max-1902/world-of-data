import type { PanelState } from '../types'

/**
 * How map layers are grouped and ordered everywhere they are listed (overlay dropdown, settings, layers panel).
 * Economic themes first, in the order a shock travels: country data, then markets & trade, energy & resources,
 * then the security, event and live-tracking context around them.
 */
export const LAYER_SECTIONS = [
  { title: 'COUNTRY DATA',           keys: ['countryAnalytics'] },
  { title: 'MARKETS & TRADE',        keys: ['stocks', 'tradeStats', 'chokepoints', 'ports', 'shippingDensity', 'vessels'] },
  { title: 'ENERGY & RESOURCES',     keys: ['oil', 'gas', 'pipelines', 'infrastructure', 'resources', 'supplychain', 'datacenters'] },
  { title: 'SECURITY & SANCTIONS',   keys: ['sanctions', 'military', 'nuclear', 'airspace'] },
  { title: 'EVENTS & DISRUPTIONS',   keys: ['crises', 'disasters', 'outages', 'humanitarian', 'gpsjam', 'wildfires', 'analyticsHex', 'news'] },
  { title: 'LIVE TRACKING & VIDEO',  keys: ['flights', 'cameras'] },
] as const satisfies readonly { title: string; keys: readonly (keyof PanelState)[] }[]

/**
 * Layers whose data is only drawn: no brief, trend, ranking, hex, drawer lookup or analyst tool reads it (checked
 * 2026-10-16 by import: each is used only by its own layer, or by a panel that lists the same points). They sit in
 * their theme but carry a "map only" tag, so a reader knows nothing on the dashboard computes from them.
 */
export const MAP_ONLY: ReadonlySet<keyof PanelState> = new Set<keyof PanelState>(['vessels', 'cameras', 'supplychain', 'pipelines', 'datacenters', 'shippingDensity'])
export const MAP_ONLY_NOTE = 'Map only: plotted, not analysed. Nothing on the dashboard computes from this layer.'

// Compile-time guarantee: adding a layer to PanelState without placing it in a section is a type error.
type Placed = (typeof LAYER_SECTIONS)[number]['keys'][number]
export const ALL_LAYERS_PLACED: Exclude<keyof PanelState, Placed> extends never ? true : never = true

const RANK = new Map<string, number>(LAYER_SECTIONS.flatMap(s => s.keys).map((k, i) => [k, i]))

/** Stable-sorts layer entries into section order (unknown keys last). */
export function sortByLayerSections<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const rank = (i: T) => RANK.get(keyOf(i)) ?? Number.MAX_SAFE_INTEGER
  return [...items].sort((a, b) => rank(a) - rank(b))
}
