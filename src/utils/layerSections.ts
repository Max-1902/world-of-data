import type { PanelState } from '../types'

/**
 * How map layers are grouped and ordered everywhere they are listed (overlay dropdown, settings, layers panel).
 * The themes mirror the sidebar workspaces, so a layer sits in the same family as its panels.
 */
export const LAYER_SECTIONS = [
  { title: 'LIVE TRACKING',        keys: ['flights', 'vessels', 'cameras'] },
  { title: 'EVENTS & HAZARDS',     keys: ['crises', 'analyticsHex', 'news', 'wildfires', 'humanitarian', 'gpsjam', 'outages', 'disasters'] },
  { title: 'SECURITY & DEFENSE',   keys: ['military', 'militaryPersonnel', 'nuclear', 'sanctions', 'airspace'] },
  { title: 'ECONOMY',              keys: ['stocks', 'tradeStats', 'resources', 'oil', 'gas', 'supplychain', 'countryAnalytics'] },
  { title: 'INFRASTRUCTURE',       keys: ['infrastructure', 'infraIndicators', 'datacenters', 'pipelines', 'ports', 'chokepoints', 'shippingDensity'] },
] as const satisfies readonly { title: string; keys: readonly (keyof PanelState)[] }[]

// Compile-time guarantee: adding a layer to PanelState without placing it in a section is a type error.
type Placed = (typeof LAYER_SECTIONS)[number]['keys'][number]
export const ALL_LAYERS_PLACED: Exclude<keyof PanelState, Placed> extends never ? true : never = true

const RANK = new Map<string, number>(LAYER_SECTIONS.flatMap(s => s.keys).map((k, i) => [k, i]))

/** Stable-sorts layer entries into section order (unknown keys last). */
export function sortByLayerSections<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const rank = (i: T) => RANK.get(keyOf(i)) ?? Number.MAX_SAFE_INTEGER
  return [...items].sort((a, b) => rank(a) - rank(b))
}
