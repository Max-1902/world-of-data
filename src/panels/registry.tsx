/**
 * Panel Registry — single source of truth for all panels.
 *
 * Adding a panel: add one entry here. The dock, observe tray, and settings
 * automatically pick it up via group/order.
 */
import type { PanelDef, PanelGroup } from './types'
import {
  NewsPanel, IntelPanel, LayersPanel, RiskPanel, ThreatPanel,
  OutagesPanel, CrisisWatchPanel, IntelBriefPanel, DrugTrafficPanel,
  SanctionsPanel, MilitaryPanel, NuclearPanel, AirspacePanel,
  CNNLivePanel, USWebcamsPanel, CryptoPanel, ForexPanel, ExchangesPanel,
  StockList, HumanitarianPanel, MarketsPanel, GlobalEconomyPanel, AIAnalystPanel,
  SECTORS,
} from '../components/panels/PanelContent'

/* ── Registry ──────────────────────────────────────────────────────────────── */

export const PANELS: PanelDef[] = [
  // ── INTEL ───────────────────────────────────────────────────────────────────
  {
    id: 'crisiswatch', title: 'Crisis Monitor', group: 'intel',
    dotColor: 'orange', desc: 'ICG conflict tracking — 70+ states',
    render: () => <CrisisWatchPanel />,
  },
  {
    id: 'intel', title: 'Incidents', group: 'intel',
    dotColor: 'red', desc: 'Active conflict & event tracking',
    render: (p) => <IntelPanel crises={p.crises} />,
  },
  {
    id: 'risk', title: 'Risk Matrix', group: 'intel',
    dotColor: 'red', desc: 'Country-level threat assessment',
    render: (p) => <RiskPanel crises={p.crises} />,
  },
  {
    id: 'threat', title: 'Threat Level', group: 'intel',
    dotColor: 'orange', desc: 'Composite global threat index',
    render: (p) => <ThreatPanel crises={p.crises} flights={p.flights} />,
  },
  {
    id: 'brief', title: 'Briefing', group: 'intel',
    dotColor: 'red', desc: 'Correlated intel for active query',
    render: (p) => <IntelBriefPanel query={p.searchQuery ?? ''} crises={p.crises} flights={p.flights} />,
  },
  {
    id: 'news', title: 'Signals', group: 'intel',
    dotColor: 'grn', desc: 'Aggregated open-source reporting',
    render: () => <NewsPanel />,
  },
  {
    id: 'outages', title: 'Connectivity', group: 'intel',
    dotColor: 'yellow', desc: 'Internet disruption monitoring',
    render: (p) => <OutagesPanel onGeoSearch={p.onGeoSearch} />,
  },

  // ── GEO ─────────────────────────────────────────────────────────────────────
  {
    id: 'humanitarian', title: 'Humanitarian', group: 'geo',
    dotColor: 'blue', desc: 'UNHCR displacement & border status',
    render: (p) => <HumanitarianPanel crises={p.crises} flights={p.flights} onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'drugs', title: 'Narcotics', group: 'geo',
    dotColor: 'red', desc: 'Trafficking routes & seizure data',
    render: () => <DrugTrafficPanel />,
  },
  {
    id: 'sanctions', title: 'Sanctions', group: 'geo',
    dotColor: 'red', desc: 'OFAC EU UN UK sanctions registry',
    render: () => <SanctionsPanel />,
  },
  {
    id: 'layers', title: 'Overlays', group: 'geo',
    dotColor: 'blue', desc: 'Map layer configuration',
    render: (p) => <LayersPanel panelState={p.panelState} onToggleLayer={p.onToggleLayer} deepstateMode={p.deepstateMode} onDeepstateToggle={p.onDeepstateToggle} />,
  },

  // ── MIL ─────────────────────────────────────────────────────────────────────
  {
    id: 'military', title: 'Installations', group: 'mil',
    dotColor: 'blue', desc: 'Military bases & force posture',
    render: (p) => <MilitaryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'nuclear', title: 'Nuclear', group: 'mil',
    dotColor: 'yellow', desc: 'Reactors & weapons storage sites',
    render: () => <NuclearPanel />,
  },
  {
    id: 'airspace', title: 'Airspace', group: 'mil',
    dotColor: 'red', desc: 'FIR status & NOTAM alerts',
    render: (p) => <AirspacePanel flights={p.flights} />,
  },
  {
    id: 'cnn', title: 'Live Feeds', group: 'mil',
    dotColor: 'red', desc: 'Regional surveillance streams',
    render: () => <CNNLivePanel />,
  },
  {
    id: 'webcams', title: 'US Webcams', group: 'mil',
    dotColor: 'grn', desc: 'SkylineWebcams & EarthCam — live US grid',
    render: () => <USWebcamsPanel />,
  },

  // ── FIN ─────────────────────────────────────────────────────────────────────
  {
    id: 'economy', title: 'Economy', group: 'fin',
    dotColor: 'blue', desc: 'Global trade profiles & World Bank data',
    render: (p) => <GlobalEconomyPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'markets', title: 'Markets', group: 'fin',
    dotColor: 'grn', desc: 'Consolidated financial data feed',
    render: () => <MarketsPanel />,
  },

  // ── AI ──────────────────────────────────────────────────────────────────────
  {
    id: 'analyst', title: 'Analysis', group: 'ai',
    dotColor: 'blue', desc: 'AI-assisted situational assessment',
    render: (p) => <AIAnalystPanel crises={p.crises} flights={p.flights} onGeoSearch={p.onGeoSearch} onCountryClick={p.onCountryClick} onToggleLayer={p.onToggleLayer} panelState={p.panelState} />,
  },
]

/* ── Lookup helpers ────────────────────────────────────────────────────────── */

/** Map from panel ID to its definition */
export const PANEL_MAP = new Map(PANELS.map(p => [p.id, p]))

/** Get all panels for a group, in registry order */
export function panelsForGroup(group: PanelGroup): PanelDef[] {
  return PANELS.filter(p => p.group === group)
}

/** All group IDs in display order */
export const GROUP_ORDER: { id: PanelGroup; label: string }[] = [
  { id: 'intel',  label: 'INTEL' },
  { id: 'geo',    label: 'GEO' },
  { id: 'mil',    label: 'MIL' },
  { id: 'fin',    label: 'FIN' },
  { id: 'ai',     label: 'AI' },
]

/** All panel IDs (for backwards compat) */
export const ALL_PANEL_IDS = PANELS.map(p => p.id)

// Re-export SECTORS for market sub-panels
export { SECTORS }
