/**
 * Panel Registry — single source of truth for all panels.
 *
 * Adding a panel: add one entry here. The dock, observe tray, and settings
 * automatically pick it up via group/order.
 */
import { lazy } from 'react'
import type { PanelDef, PanelGroup } from './types'
// Every panel is code-split: its chunk (and the datasets it pulls in) loads only when the panel is first shown.
// PanelHost supplies the Suspense boundary.
const NewsPanel = lazy(() => import('../components/panels/NewsPanels').then(m => ({ default: m.NewsPanel })))
const CrisisWatchPanel = lazy(() => import('../components/panels/NewsPanels').then(m => ({ default: m.CrisisWatchPanel })))
const IntelBriefPanel = lazy(() => import('../components/panels/NewsPanels').then(m => ({ default: m.IntelBriefPanel })))
const IntelPanel = lazy(() => import('../components/panels/OverviewPanels').then(m => ({ default: m.IntelPanel })))
const LayersPanel = lazy(() => import('../components/panels/OverviewPanels').then(m => ({ default: m.LayersPanel })))
const RiskPanel = lazy(() => import('../components/panels/OverviewPanels').then(m => ({ default: m.RiskPanel })))
const ThreatPanel = lazy(() => import('../components/panels/OverviewPanels').then(m => ({ default: m.ThreatPanel })))
const MarketsPanel = lazy(() => import('../components/panels/MarketPanels').then(m => ({ default: m.MarketsPanel })))
const OutagesPanel = lazy(() => import('../components/panels/OutagesPanel').then(m => ({ default: m.OutagesPanel })))
const DrugTrafficPanel = lazy(() => import('../components/panels/SecurityPanels').then(m => ({ default: m.DrugTrafficPanel })))
const SanctionsPanel = lazy(() => import('../components/panels/SecurityPanels').then(m => ({ default: m.SanctionsPanel })))
const MilitaryPanel = lazy(() => import('../components/panels/SecurityPanels').then(m => ({ default: m.MilitaryPanel })))
const NuclearPanel = lazy(() => import('../components/panels/SecurityPanels').then(m => ({ default: m.NuclearPanel })))
const AirspacePanel = lazy(() => import('../components/panels/SecurityPanels').then(m => ({ default: m.AirspacePanel })))
const USWebcamsPanel = lazy(() => import('../components/panels/WebcamPanels').then(m => ({ default: m.USWebcamsPanel })))
const LiveFeedPanel = lazy(() => import('../components/panels/WebcamPanels').then(m => ({ default: m.LiveFeedPanel })))
const GlobalEconomyPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.GlobalEconomyPanel })))
const ResourcesPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.ResourcesPanel })))
const MilitaryInstallationsByCountryPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.MilitaryInstallationsByCountryPanel })))
const NuclearFacilitiesByCountryPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.NuclearFacilitiesByCountryPanel })))
const InfrastructureByCountryPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.InfrastructureByCountryPanel })))
const ResourcesByCountryPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.ResourcesByCountryPanel })))
const TradePartnersByCountryPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.TradePartnersByCountryPanel })))
const TradeProductsByCountryPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.TradeProductsByCountryPanel })))
const MilitaryPersonnelPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.MilitaryPersonnelPanel })))
const InfraIndicatorsPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.InfraIndicatorsPanel })))
const OwidPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.OwidPanel })))
const DataCentersPanel = lazy(() => import('../components/panels/CountryDataPanels').then(m => ({ default: m.DataCentersPanel })))
const AIAnalystPanel = lazy(() => import('../components/panels/AIAnalystPanel').then(m => ({ default: m.AIAnalystPanel })))
const HumanitarianPanel = lazy(() => import('../components/panels/HumanitarianPanel').then(m => ({ default: m.HumanitarianPanel })))
const DisasterAlertsPanel = lazy(() => import('../components/panels/DisasterAlertsPanel').then(m => ({ default: m.DisasterAlertsPanel })))
const CountryAnalyticsPanel = lazy(() => import('../components/panels/CountryAnalyticsPanel').then(m => ({ default: m.CountryAnalyticsPanel })))
const AnalyticsPanel = lazy(() => import('../components/panels/AnalyticsPanel').then(m => ({ default: m.AnalyticsPanel })))
const WatchlistPanel = lazy(() => import('../components/panels/WatchlistPanel').then(m => ({ default: m.WatchlistPanel })))

/* ── Registry ──────────────────────────────────────────────────────────────── */

const PANELS: PanelDef[] = [
  // ── OVERVIEW ────────────────────────────────────────────────────────────────
  {
    id: 'crisiswatch', title: 'Crisis Monitor', group: 'overview',
    dotColor: 'orange', desc: 'ICG conflict tracking — 70+ states',
    render: () => <CrisisWatchPanel />,
  },
  {
    id: 'watchlist', title: 'Watchlist', group: 'overview',
    dotColor: 'yellow', desc: 'Countries you watch — alerts on new events & rising trends',
    render: (p) => <WatchlistPanel crises={p.crises} onCountryClick={p.onCountryClick} />,
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

  // ── NEWS & MEDIA ────────────────────────────────────────────────────────────
  {
    id: 'news', title: 'Signals', group: 'news',
    dotColor: 'grn', desc: 'Aggregated open-source reporting',
    render: () => <NewsPanel />,
  },
  {
    id: 'webcams', title: 'US Webcams', group: 'news',
    dotColor: 'grn', desc: 'SkylineWebcams & EarthCam — live US grid',
    render: () => <USWebcamsPanel />,
  },
  {
    id: 'livefeed', title: 'Live Feed', group: 'news',
    dotColor: 'red', desc: 'Live news broadcasts — CNN, FOX, NBC, CBS, Euronews, DW, Sky News, France 24',
    render: () => <LiveFeedPanel />,
  },

  // ── INFRASTRUCTURE & HUMANITARIAN ───────────────────────────────────────────
  {
    id: 'outages', title: 'Connectivity', group: 'geo',
    dotColor: 'yellow', desc: 'Internet disruption monitoring',
    render: (p) => <OutagesPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'disasters', title: 'Disaster Alerts', group: 'geo',
    dotColor: 'orange', desc: 'GDACS Orange/Red: quakes, cyclones, floods, volcanoes, drought',
    render: (p) => <DisasterAlertsPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'humanitarian', title: 'Humanitarian', group: 'geo',
    dotColor: 'blue', desc: 'UNHCR displacement & border status',
    render: (p) => <HumanitarianPanel crises={p.crises} flights={p.flights} onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'infraIndicators', title: 'Power Output', group: 'geo',
    dotColor: 'blue', desc: 'Countries ranked by electricity generated, with source mix (Ember via Our World in Data)',
    render: (p) => <InfraIndicatorsPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'infrastructureByCountry', title: 'Infrastructure Sites', group: 'geo',
    dotColor: 'amber', desc: 'Dams, pipelines, LNG, power plants by country — click to fly to',
    render: (p) => <InfrastructureByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'datacenters', title: 'Data Centers', group: 'geo',
    dotColor: 'blue', desc: 'Data center facilities worldwide (OpenStreetMap) — click to fly to',
    render: (p) => <DataCentersPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'layers', title: 'Overlays', group: 'geo',
    dotColor: 'blue', desc: 'Map layer configuration',
    render: (p) => <LayersPanel panelState={p.panelState} onToggleLayer={p.onToggleLayer} deepstateMode={p.deepstateMode} onDeepstateToggle={p.onDeepstateToggle} />,
  },

  // ── SECURITY & DEFENSE ──────────────────────────────────────────────────────
  {
    id: 'sanctions', title: 'Sanctions', group: 'security',
    dotColor: 'red', desc: 'OFAC EU UN UK sanctions registry',
    render: () => <SanctionsPanel />,
  },
  {
    id: 'drugs', title: 'Narcotics', group: 'security',
    dotColor: 'red', desc: 'Trafficking routes & seizure data',
    render: () => <DrugTrafficPanel />,
  },
  {
    id: 'military', title: 'Installations', group: 'security',
    dotColor: 'blue', desc: 'Military bases & force posture',
    render: (p) => <MilitaryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'militaryInstallationsByCountry', title: 'Bases by Country', group: 'security',
    dotColor: 'blue', desc: 'Military bases by country — click to fly to',
    render: (p) => <MilitaryInstallationsByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'militaryPersonnel', title: 'Force Size', group: 'security',
    dotColor: 'red', desc: 'Armed forces personnel ranked by country (World Bank)',
    render: (p) => <MilitaryPersonnelPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'nuclear', title: 'Nuclear', group: 'security',
    dotColor: 'yellow', desc: 'Reactors & weapons storage sites',
    render: () => <NuclearPanel />,
  },
  {
    id: 'nuclearFacilitiesByCountry', title: 'Nuclear Sites by Country', group: 'security',
    dotColor: 'yellow', desc: 'Reactors & weapons sites by country — click to fly to',
    render: (p) => <NuclearFacilitiesByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'airspace', title: 'Airspace', group: 'security',
    dotColor: 'red', desc: 'FIR status & NOTAM alerts',
    render: (p) => <AirspacePanel flights={p.flights} />,
  },

  // ── ECONOMY (markets, trade, resources) ─────────────────────────────────────
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
    id: 'tradePartnersByCountry', title: 'Trade Partners', group: 'markets',
    dotColor: 'grn', desc: 'Top export/import partner countries — click to fly to',
    render: (p) => <TradePartnersByCountryPanel onGeoSearch={p.onCountryClick} onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'tradeProductsByCountry', title: 'Trade Products', group: 'markets',
    dotColor: 'blue', desc: 'Top exported/imported product categories by country',
    render: (p) => <TradeProductsByCountryPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'resources', title: 'Resources', group: 'markets',
    dotColor: 'amber', desc: 'Critical minerals, reserves & production by country',
    render: (p) => <ResourcesPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'resourcesByCountry', title: 'Resources by Country', group: 'markets',
    dotColor: 'amber', desc: 'Critical minerals & commodities by country',
    render: (p) => <ResourcesByCountryPanel onGeoSearch={p.onCountryClick} onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'owid', title: 'Global Trends', group: 'markets',
    dotColor: 'amber', desc: 'Agriculture, violence & war, energy & environment, innovation & tech (Our World in Data)',
    render: (p) => <OwidPanel onCountryClick={p.onCountryClick} />,
  },

  // ── ANALYSIS ────────────────────────────────────────────────────────────────
  {
    id: 'countryAnalytics', title: 'Country Analytics', group: 'analysis',
    dotColor: 'blue', desc: 'Compare any two country indicators (economy, population, military, society): trend, correlation, outliers and a map of the results (World Bank)',
    render: (p) => <CountryAnalyticsPanel panelState={p.panelState} onToggleLayer={p.onToggleLayer} onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'analytics', title: 'Hazard Analytics', group: 'analysis',
    dotColor: 'blue', desc: 'Earthquake and wildfire data analysed in the browser: trends, magnitude law, heatmaps — plotted as 3D hexagons on the map',
    render: (p) => <AnalyticsPanel panelState={p.panelState} onToggleLayer={p.onToggleLayer} onGeoSearch={p.onGeoSearch} />,
  },
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
  { id: 'security', label: 'SECURITY & DEFENSE' },
  { id: 'markets',  label: 'ECONOMY' },
  { id: 'geo',      label: 'INFRASTRUCTURE' },
  { id: 'analysis', label: 'ANALYSIS' },
]
