import type { PanelDef, PanelGroup } from './types'

/**
 * Which sidebar destination each dock panel belongs to. The Analysis and Economy workspaces hold panels for several
 * destinations; a destination shows only its own, and everything else sits under Explore (Analysis / Indicators).
 */

/** Forecasts: the GDP-growth forecast and the quarter's nowcast, each with its backtest. */
export const FORECAST_PANELS: ReadonlySet<string> = new Set(['predictions', 'nowcast'])
/** Drivers: the tested predictors, and the trade links a shock travels along. */
export const DRIVER_PANELS: ReadonlySet<string> = new Set(['drivers', 'exposure', 'tradePartnersByCountry', 'tradeProductsByCountry'])

export type DockView = 'forecasts' | 'drivers' | 'explore'

/** The destination a dock workspace opens on when no panel has been focused. */
export const DEFAULT_VIEW: Partial<Record<PanelGroup, DockView>> = { analysis: 'forecasts', markets: 'explore' }

/** The destination a panel in `group` belongs to; null where the workspace is a single destination. */
export function viewOf(group: PanelGroup, panelId: string): DockView | null {
  if (group === 'analysis') return FORECAST_PANELS.has(panelId) ? 'forecasts' : 'explore'
  if (group === 'markets') return DRIVER_PANELS.has(panelId) ? 'drivers' : 'explore'
  return null
}

/** The panels of `group` that a destination shows. */
export function panelsInView<T extends Pick<PanelDef, 'id'>>(group: PanelGroup, view: DockView | null, panels: T[]): T[] {
  if (!view || !DEFAULT_VIEW[group]) return panels
  return panels.filter(p => viewOf(group, p.id) === view)
}

/** The heading a dock destination carries (the workspace name where it is the whole workspace). */
export function viewTitle(group: PanelGroup, view: DockView | null, workspaceLabel: string): string {
  if (view === 'forecasts') return 'FORECASTS'
  if (view === 'drivers') return 'DRIVERS'
  if (view === 'explore') return group === 'analysis' ? 'EXPLORE · ANALYSIS' : 'EXPLORE · INDICATORS'
  return workspaceLabel
}
