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
  USWebcamsPanel, CryptoPanel, ForexPanel, ExchangesPanel,
  StockList, HumanitarianPanel, MarketsPanel, GlobalEconomyPanel, ResourcesPanel, MilitaryPersonnelPanel, InfraIndicatorsPanel, AIAnalystPanel,
  MilitaryInstallationsByCountryPanel, NuclearFacilitiesByCountryPanel, InfrastructureByCountryPanel,
  ResourcesByCountryPanel, TradePartnersByCountryPanel, TradeProductsByCountryPanel,
  DataCentersPanel,
  SECTORS,
} from '../components/panels/PanelContent'

/* ── Registry ──────────────────────────────────────────────────────────────── */

export const PANELS: PanelDef[] = [
  // ── INTEL ───────────────────────────────────────────────────────────────────
  {
    id: 'crisiswatch', title: 'Crisis Monitor', group: 'overview',
    dotColor: 'orange', desc: 'ICG conflict tracking — 70+ states',
    render: () => <CrisisWatchPanel />,
  },
  {
    id: 'intel', title: 'Incidents', group: 'overview',
    dotColor: 'red', desc: 'Active conflict & event tracking',
    render: (p) => <IntelPanel crises={p.crises} />,
  },
  {
    id: 'risk', title: 'Risk Matrix', group: 'overview',
    dotColor: 'red', desc: 'Country-level threat assessment',
    render: (p) => <RiskPanel crises={p.crises} />,
  },
  {
    id: 'threat', title: 'Threat Level', group: 'overview',
    dotColor: 'orange', desc: 'Composite global threat index',
    render: (p) => <ThreatPanel crises={p.crises} flights={p.flights} />,
  },
  {
    id: 'news', title: 'Signals', group: 'news',
    dotColor: 'grn', desc: 'Aggregated open-source reporting',
    render: () => <NewsPanel />,
  },

  // ── INFRASTRUCTURE ──────────────────────────────────────────────────────────
  {
    id: 'outages', title: 'Connectivity', group: 'geo',
    dotColor: 'yellow', desc: 'Internet disruption monitoring',
    render: (p) => <OutagesPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'humanitarian', title: 'Humanitarian', group: 'geo',
    dotColor: 'blue', desc: 'UNHCR displacement & border status',
    render: (p) => <HumanitarianPanel crises={p.crises} flights={p.flights} onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'layers', title: 'Overlays', group: 'geo',
    dotColor: 'blue', desc: 'Map layer configuration',
    render: (p) => <LayersPanel panelState={p.panelState} onToggleLayer={p.onToggleLayer} deepstateMode={p.deepstateMode} onDeepstateToggle={p.onDeepstateToggle} />,
  },

  // ── SECURITY & DEFENSE ──────────────────────────────────────────────────────
  {
    id: 'drugs', title: 'Narcotics', group: 'security',
    dotColor: 'red', desc: 'Trafficking routes & seizure data',
    render: () => <DrugTrafficPanel />,
  },
  {
    id: 'sanctions', title: 'Sanctions', group: 'security',
    dotColor: 'red', desc: 'OFAC EU UN UK sanctions registry',
    render: () => <SanctionsPanel />,
  },

  {
    id: 'military', title: 'Installations', group: 'security',
    dotColor: 'blue', desc: 'Military bases & force posture',
    render: (p) => <MilitaryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'nuclear', title: 'Nuclear', group: 'security',
    dotColor: 'yellow', desc: 'Reactors & weapons storage sites',
    render: () => <NuclearPanel />,
  },
  {
    id: 'airspace', title: 'Airspace', group: 'security',
    dotColor: 'red', desc: 'FIR status & NOTAM alerts',
    render: (p) => <AirspacePanel flights={p.flights} />,
  },
  {
    id: 'webcams', title: 'US Webcams', group: 'news',
    dotColor: 'grn', desc: 'SkylineWebcams & EarthCam — live US grid',
    render: () => <USWebcamsPanel />,
  },

  // ── ECONOMY ─────────────────────────────────────────────────────────────────
  {
    id: 'economy', title: 'Economy', group: 'markets',
    dotColor: 'blue', desc: 'Global trade profiles & World Bank data',
    render: (p) => <GlobalEconomyPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'markets', title: 'Markets', group: 'markets',
    dotColor: 'grn', desc: 'Consolidated financial data feed',
    render: () => <MarketsPanel />,
  },
  {
    id: 'resources', title: 'Resources', group: 'markets',
    dotColor: 'amber', desc: 'Critical minerals, reserves & production by country',
    render: (p) => <ResourcesPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'militaryPersonnel', title: 'Force Size', group: 'security',
    dotColor: 'red', desc: 'Armed forces personnel ranked by country (World Bank)',
    render: (p) => <MilitaryPersonnelPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'infraIndicators', title: 'Infra Access', group: 'security',
    dotColor: 'blue', desc: 'Electricity, internet, water/sanitation access by country (World Bank)',
    render: (p) => <InfraIndicatorsPanel onCountryClick={p.onCountryClick} />,
  },

  // ── AI ──────────────────────────────────────────────────────────────────────
  {
    id: 'analyst', title: 'Analyst chat', group: 'analysis',
    dotColor: 'blue', desc: 'AI-assisted situational assessment',
    render: (p) => <AIAnalystPanel crises={p.crises} flights={p.flights} onGeoSearch={p.onGeoSearch} onCountryClick={p.onCountryClick} onToggleLayer={p.onToggleLayer} panelState={p.panelState} />,
  },
  {
    id: 'brief', title: 'Briefing', group: 'analysis',
    dotColor: 'red', desc: 'Correlated intel for active query',
    render: (p) => <IntelBriefPanel query={p.searchQuery ?? ''} crises={p.crises} flights={p.flights} />,
  },

  // ── DEDICATED PER-CATEGORY WORKSPACES (country → items → fly to) ─────────────
  {
    id: 'militaryInstallationsByCountry', title: 'Installations', group: 'militaryInstallations',
    dotColor: 'blue', desc: 'Military bases by country — click to fly to',
    render: (p) => <MilitaryInstallationsByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'nuclearFacilitiesByCountry', title: 'Nuclear Facilities', group: 'nuclearFacilities',
    dotColor: 'yellow', desc: 'Reactors & weapons sites by country — click to fly to',
    render: (p) => <NuclearFacilitiesByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'infrastructureByCountry', title: 'Infrastructure', group: 'infrastructureSites',
    dotColor: 'amber', desc: 'Dams, pipelines, LNG, power plants by country — click to fly to',
    render: (p) => <InfrastructureByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'resourcesByCountry', title: 'Resources', group: 'resourcesByCountry',
    dotColor: 'amber', desc: 'Critical minerals & commodities by country',
    render: (p) => <ResourcesByCountryPanel onGeoSearch={p.onCountryClick} onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'forceSizeByCountry', title: 'Force Size', group: 'forceSize',
    dotColor: 'red', desc: 'Armed forces personnel ranked by country (World Bank)',
    render: (p) => <MilitaryPersonnelPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'tradePartnersByCountry', title: 'Trade Partners', group: 'tradePartnersByCountry',
    dotColor: 'grn', desc: 'Top export/import partner countries — click to fly to',
    render: (p) => <TradePartnersByCountryPanel onGeoSearch={p.onCountryClick} onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'tradeProductsByCountry', title: 'Trade Products', group: 'tradeProductsByCountry',
    dotColor: 'blue', desc: 'Top exported/imported product categories by country',
    render: (p) => <TradeProductsByCountryPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'economicDataByCountry', title: 'Economic Data', group: 'economicData',
    dotColor: 'blue', desc: 'World Bank indicators by country',
    render: (p) => <GlobalEconomyPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'datacenters', title: 'Data Centers', group: 'datacenters',
    dotColor: 'blue', desc: 'Data center facilities worldwide (OpenStreetMap) — click to fly to',
    render: (p) => <DataCentersPanel onGeoSearch={p.onGeoSearch} />,
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
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'news',     label: 'NEWS & MEDIA' },
  { id: 'geo',      label: 'INFRASTRUCTURE' },
  { id: 'security', label: 'SECURITY & DEFENSE' },
  { id: 'markets',  label: 'ECONOMY' },
  { id: 'analysis', label: 'ANALYSIS' },
  { id: 'militaryInstallations',   label: 'INSTALLATIONS' },
  { id: 'nuclearFacilities',       label: 'NUCLEAR FACILITIES' },
  { id: 'infrastructureSites',     label: 'INFRA SITES' },
  { id: 'resourcesByCountry',      label: 'RESOURCES' },
  { id: 'forceSize',               label: 'FORCE SIZE' },
  { id: 'tradePartnersByCountry',  label: 'TRADE PARTNERS' },
  { id: 'tradeProductsByCountry',  label: 'TRADE PRODUCTS' },
  { id: 'economicData',            label: 'ECON DATA' },
  { id: 'datacenters',             label: 'DATA CENTERS' },
]

/** All panel IDs (for backwards compat) */
export const ALL_PANEL_IDS = PANELS.map(p => p.id)

// Re-export SECTORS for market sub-panels
export { SECTORS }
