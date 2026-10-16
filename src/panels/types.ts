/**
 * Shared panel types — the foundation of the panel registry system.
 */
import type { CrisisEvent, PanelState, Flight } from '../types'

/** Every prop a panel might need. Panels destructure only what they use. */
export interface PanelProps {
  crises: CrisisEvent[]
  flights: Flight[]
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
  searchQuery?: string
  onGeoSearch?: (q: string) => void
  onCountryClick?: (country: string) => void
}

export type PanelGroup = 'overview' | 'news' | 'geo' | 'security' | 'markets' | 'analysis' | 'country'

export interface PanelDef {
  id: string
  title: string
  group: PanelGroup
  dotColor?: string
  desc: string
  /** which banner section of its workspace it sits under (an id from GROUP_SECTIONS[group]) */
  section: string
  /** dock height for long, research-style panels (default 700px) */
  minHeight?: number
  /**
   * How this panel's data reaches the map. Required, so every panel decides:
   * - a list of map layers: the layers that draw this panel's data; the panel header gets the standard
   *   "Show on map" toggle for them (`PanelMapToggle`)
   * - 'inline': the panel has its own, more specific map control in its body (e.g. which indicator shades the globe)
   * - 'none': nothing in the panel has a map layer to show it on
   */
  map: (keyof PanelState)[] | 'inline' | 'none'
  /** Render function — receives all props, panel uses what it needs */
  render: (props: PanelProps) => React.ReactNode
}

/** A banner in the right-hand dock: groups panels inside a workspace and says what they are for. */
export interface PanelSection { id: string; title: string; desc: string }
