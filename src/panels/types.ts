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
  /** dock height for long, research-style panels (default 700px) */
  minHeight?: number
  /** Render function — receives all props, panel uses what it needs */
  render: (props: PanelProps) => React.ReactNode
}
