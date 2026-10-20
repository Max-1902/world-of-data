/**
 * Panel Registry — single source of truth for all panels.
 *
 * Adding a panel: add one entry here. The dock, observe tray, and settings
 * automatically pick it up via group/order.
 */
import { lazy } from 'react'
import type { PanelDef, PanelGroup, PanelSection } from './types'
import { AnalystSlot } from '../components/panels/aiAnalyst/AnalystWindow'
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
const GlobalEconomyPanel = lazy(() => import('../components/panels/EconomyPanels').then(m => ({ default: m.GlobalEconomyPanel })))
const ResourcesPanel = lazy(() => import('../components/panels/EconomyPanels').then(m => ({ default: m.ResourcesPanel })))
const MilitaryInstallationsByCountryPanel = lazy(() => import('../components/panels/CountryBrowserPanels').then(m => ({ default: m.MilitaryInstallationsByCountryPanel })))
const NuclearFacilitiesByCountryPanel = lazy(() => import('../components/panels/CountryBrowserPanels').then(m => ({ default: m.NuclearFacilitiesByCountryPanel })))
const InfrastructureByCountryPanel = lazy(() => import('../components/panels/CountryBrowserPanels').then(m => ({ default: m.InfrastructureByCountryPanel })))
const ResourcesByCountryPanel = lazy(() => import('../components/panels/CountryBrowserPanels').then(m => ({ default: m.ResourcesByCountryPanel })))
const TradePartnersByCountryPanel = lazy(() => import('../components/panels/CountryBrowserPanels').then(m => ({ default: m.TradePartnersByCountryPanel })))
const TradeProductsByCountryPanel = lazy(() => import('../components/panels/CountryBrowserPanels').then(m => ({ default: m.TradeProductsByCountryPanel })))
const MilitaryPersonnelPanel = lazy(() => import('../components/panels/RankingPanels').then(m => ({ default: m.MilitaryPersonnelPanel })))
const InfraIndicatorsPanel = lazy(() => import('../components/panels/RankingPanels').then(m => ({ default: m.InfraIndicatorsPanel })))
const OwidPanel = lazy(() => import('../components/panels/RankingPanels').then(m => ({ default: m.OwidPanel })))
const DataCentersPanel = lazy(() => import('../components/panels/RankingPanels').then(m => ({ default: m.DataCentersPanel })))
const HumanitarianPanel = lazy(() => import('../components/panels/HumanitarianPanel').then(m => ({ default: m.HumanitarianPanel })))
const DisasterAlertsPanel = lazy(() => import('../components/panels/DisasterAlertsPanel').then(m => ({ default: m.DisasterAlertsPanel })))
const CountryAnalyticsPanel = lazy(() => import('../components/panels/CountryAnalyticsPanel').then(m => ({ default: m.CountryAnalyticsPanel })))
const AnalyticsPanel = lazy(() => import('../components/panels/AnalyticsPanel').then(m => ({ default: m.AnalyticsPanel })))
const CountryLookupPanel = lazy(() => import('../components/panels/CountryLookupPanel').then(m => ({ default: m.CountryLookupPanel })))
const PredictionsPanel = lazy(() => import('../components/panels/PredictionsPanel').then(m => ({ default: m.PredictionsPanel })))
const GasStorageForecastPanel = lazy(() => import('../components/panels/GasStorageForecast').then(m => ({ default: m.GasStorageForecastPanel })))
const InventoriesPanel = lazy(() => import('../components/panels/InventoriesPanel').then(m => ({ default: m.InventoriesPanel })))
const WatchlistPanel = lazy(() => import('../components/panels/WatchlistPanel').then(m => ({ default: m.WatchlistPanel })))

/* ── Registry ──────────────────────────────────────────────────────────────── */

const PANELS: PanelDef[] = [
  // ── OVERVIEW ──────────────────────────────────────────────────────────────────
  {
    id: 'threat', title: 'Threat Level', group: 'overview', section: 'headline', map: ['crises'], minHeight: 300,
    dotColor: 'orange', desc: 'Composite global threat index',
    render: (p) => <ThreatPanel crises={p.crises} flights={p.flights} />,
  },
  {
    id: 'risk', title: 'Risk Matrix', group: 'overview', section: 'headline', map: ['crises'],
    dotColor: 'red', desc: 'Country-level threat assessment',
    render: (p) => <RiskPanel crises={p.crises} />,
  },
  {
    id: 'intel', title: 'Incidents', group: 'overview', section: 'events', map: ['crises'],
    dotColor: 'red', desc: 'Active conflict & event tracking',
    render: (p) => <IntelPanel crises={p.crises} />,
  },
  {
    id: 'crisiswatch', title: 'Crisis Monitor', group: 'overview', section: 'events', map: 'none',
    dotColor: 'orange', desc: 'ICG conflict tracking — 70+ states',
    render: () => <CrisisWatchPanel />,
  },
  {
    id: 'watchlist', title: 'Watchlist', group: 'overview', section: 'yours', map: ['crises'],
    dotColor: 'yellow', desc: 'Countries you watch — alerts on new events & rising trends',
    render: (p) => <WatchlistPanel crises={p.crises} onCountryClick={p.onCountryClick} />,
  },
  // ── ECONOMY ───────────────────────────────────────────────────────────────────
  {
    id: 'markets', title: 'Markets', group: 'markets', section: 'live', map: ['stocks'],
    dotColor: 'grn', desc: 'Consolidated financial data feed',
    render: () => <MarketsPanel />,
  },
  {
    id: 'inventories', title: 'Energy Inventories', group: 'markets', section: 'inventories', map: 'none', minHeight: 900,
    dotColor: 'amber', desc: 'Weekly US crude, gasoline, distillate and natural-gas stocks against the same week in the previous five years (EIA, free key)',
    render: () => <InventoriesPanel />,
  },
  {
    id: 'economy', title: 'Economy', group: 'markets', section: 'macro', map: 'inline',
    dotColor: 'blue', desc: 'Global trade profiles & World Bank data',
    render: (p) => <GlobalEconomyPanel onCountryClick={p.onCountryClick} panelState={p.panelState} onToggleLayer={p.onToggleLayer} />,
  },
  {
    id: 'owid', title: 'Global Trends', group: 'markets', section: 'macro', map: 'inline',
    dotColor: 'amber', desc: 'Agriculture, violence & war, energy & environment, innovation & tech (Our World in Data)',
    render: (p) => <OwidPanel onCountryClick={p.onCountryClick} panelState={p.panelState} onToggleLayer={p.onToggleLayer} />,
  },
  {
    id: 'tradePartnersByCountry', title: 'Trade Partners', group: 'markets', section: 'trade', map: ['tradeStats'],
    dotColor: 'grn', desc: 'Top export/import partner countries — click to fly to',
    render: (p) => <TradePartnersByCountryPanel onGeoSearch={p.onCountryClick} onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'tradeProductsByCountry', title: 'Trade Products', group: 'markets', section: 'trade', map: ['tradeStats'],
    dotColor: 'blue', desc: 'Top exported/imported product categories by country',
    render: (p) => <TradeProductsByCountryPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'resources', title: 'Resources', group: 'markets', section: 'resources', map: ['resources'],
    dotColor: 'amber', desc: 'Critical minerals, reserves & production by country',
    render: (p) => <ResourcesPanel onCountryClick={p.onCountryClick} />,
  },
  {
    id: 'resourcesByCountry', title: 'Resources by Country', group: 'markets', section: 'resources', map: ['resources'],
    dotColor: 'amber', desc: 'Critical minerals & commodities by country',
    render: (p) => <ResourcesByCountryPanel onGeoSearch={p.onCountryClick} onCountryClick={p.onCountryClick} />,
  },
  // ── FORECASTS & ANALYSIS ──────────────────────────────────────────────────────
  {
    id: 'predictions', title: 'Predictions', group: 'analysis', section: 'forecasts', map: 'none', minHeight: 900,
    dotColor: 'green', desc: 'GDP growth, inflation and unemployment forecast from a country’s own history — AR model vs. a naive baseline, backtested out of sample (World Bank)',
    render: () => <PredictionsPanel />,
  },
  {
    id: 'gasForecast', title: 'Gas Storage Forecast', group: 'analysis', section: 'forecasts', map: 'none', minHeight: 700,
    dotColor: 'green', desc: 'Next week’s change in US natural-gas storage — a seasonal model vs. the 5-year norm and last week, backtested week by week in time order (EIA, free key)',
    render: () => <GasStorageForecastPanel />,
  },
  {
    id: 'analyst', title: 'Analyst chat', group: 'analysis', section: 'ai', map: 'none',
    dotColor: 'blue', desc: 'AI-assisted situational assessment',
    // one shared analyst (AnalystWindowProvider in App) is moved into this slot, or into its pop-out window
    render: (p) => <AnalystSlot {...p} />,
  },
  {
    id: 'countryAnalytics', title: 'Country Analytics', group: 'analysis', section: 'explore', map: 'inline',
    dotColor: 'blue', desc: 'Compare any two country indicators (economy, population, military, society): trend, correlation, outliers and a map of the results (World Bank)',
    render: (p) => <CountryAnalyticsPanel panelState={p.panelState} onToggleLayer={p.onToggleLayer} onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'analytics', title: 'Hazard Analytics', group: 'analysis', section: 'explore', map: 'inline',
    dotColor: 'blue', desc: 'Earthquake and wildfire data analysed in the browser: trends, magnitude law, heatmaps — plotted as 3D hexagons on the map',
    render: (p) => <AnalyticsPanel panelState={p.panelState} onToggleLayer={p.onToggleLayer} onGeoSearch={p.onGeoSearch} />,
  },
  // ── COUNTRY LOOKUP ────────────────────────────────────────────────────────────
  {
    id: 'countryLookup', title: 'Country Lookup', group: 'country', section: 'profile', map: 'none',
    dotColor: 'blue', minHeight: 1400,
    desc: "One country's full World Bank record by category, ECB/Eurostat data for Europe, and an analysis of that economy's own history",
    render: () => <CountryLookupPanel />,
  },
  // ── SECURITY & DEFENSE ────────────────────────────────────────────────────────
  {
    id: 'airspace', title: 'Airspace', group: 'security', section: 'live', map: ['airspace'],
    dotColor: 'red', desc: 'FIR status & NOTAM alerts',
    render: (p) => <AirspacePanel flights={p.flights} />,
  },
  {
    id: 'sanctions', title: 'Sanctions', group: 'security', section: 'pressure', map: ['sanctions'],
    dotColor: 'red', desc: 'OFAC EU UN UK sanctions registry',
    render: () => <SanctionsPanel />,
  },
  {
    id: 'drugs', title: 'Narcotics', group: 'security', section: 'pressure', map: 'none',
    dotColor: 'red', desc: 'Trafficking routes & seizure data',
    render: () => <DrugTrafficPanel />,
  },
  {
    id: 'militaryPersonnel', title: 'Force Size', group: 'security', section: 'military', map: 'inline',
    dotColor: 'red', desc: 'Armed forces personnel ranked by country (World Bank)',
    render: (p) => <MilitaryPersonnelPanel onCountryClick={p.onCountryClick} panelState={p.panelState} onToggleLayer={p.onToggleLayer} />,
  },
  {
    id: 'military', title: 'Installations', group: 'security', section: 'military', map: ['military'],
    dotColor: 'blue', desc: 'Military bases & force posture',
    render: (p) => <MilitaryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'militaryInstallationsByCountry', title: 'Bases by Country', group: 'security', section: 'military', map: ['military'],
    dotColor: 'blue', desc: 'Military bases by country — click to fly to',
    render: (p) => <MilitaryInstallationsByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'nuclear', title: 'Nuclear', group: 'security', section: 'nuclear', map: ['nuclear'],
    dotColor: 'yellow', desc: 'Reactors & weapons storage sites',
    render: () => <NuclearPanel />,
  },
  {
    id: 'nuclearFacilitiesByCountry', title: 'Nuclear Sites by Country', group: 'security', section: 'nuclear', map: ['nuclear'],
    dotColor: 'yellow', desc: 'Reactors & weapons sites by country — click to fly to',
    render: (p) => <NuclearFacilitiesByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  // ── INFRASTRUCTURE ────────────────────────────────────────────────────────────
  {
    id: 'disasters', title: 'Disaster Alerts', group: 'geo', section: 'live', map: ['disasters'],
    dotColor: 'orange', desc: 'GDACS Orange/Red: quakes, cyclones, floods, volcanoes, drought',
    render: (p) => <DisasterAlertsPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'outages', title: 'Connectivity', group: 'geo', section: 'live', map: ['outages'],
    dotColor: 'yellow', desc: 'Internet disruption monitoring (IODA alerts, Cloudflare Radar verified outages)',
    render: (p) => <OutagesPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'humanitarian', title: 'Humanitarian', group: 'geo', section: 'people', map: ['humanitarian'],
    dotColor: 'blue', desc: 'UNHCR displacement & border status',
    render: (p) => <HumanitarianPanel crises={p.crises} flights={p.flights} onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'infraIndicators', title: 'Power Output', group: 'geo', section: 'capacity', map: 'inline',
    dotColor: 'blue', desc: 'Countries ranked by electricity generated, with source mix (Ember via Our World in Data)',
    render: (p) => <InfraIndicatorsPanel onCountryClick={p.onCountryClick} panelState={p.panelState} onToggleLayer={p.onToggleLayer} />,
  },
  {
    id: 'infrastructureByCountry', title: 'Infrastructure Sites', group: 'geo', section: 'capacity', map: ['infrastructure'],
    dotColor: 'amber', desc: 'Dams, pipelines, LNG, power plants by country — click to fly to',
    render: (p) => <InfrastructureByCountryPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'datacenters', title: 'Data Centers', group: 'geo', section: 'capacity', map: ['datacenters'],
    dotColor: 'blue', desc: 'Data center facilities worldwide (OpenStreetMap) — click to fly to',
    render: (p) => <DataCentersPanel onGeoSearch={p.onGeoSearch} />,
  },
  {
    id: 'layers', title: 'Overlays', group: 'geo', section: 'map', map: 'none',
    dotColor: 'blue', desc: 'Map layer configuration',
    render: (p) => <LayersPanel panelState={p.panelState} onToggleLayer={p.onToggleLayer} deepstateMode={p.deepstateMode} onDeepstateToggle={p.onDeepstateToggle} />,
  },
  // ── NEWS & MEDIA ──────────────────────────────────────────────────────────────
  {
    id: 'news', title: 'Signals', group: 'news', section: 'reporting', map: ['news'],
    dotColor: 'grn', desc: 'Aggregated open-source reporting',
    render: () => <NewsPanel />,
  },
  {
    id: 'brief', title: 'Briefing', group: 'news', section: 'reporting', map: 'none',
    dotColor: 'red', desc: 'Correlated intel for active query',
    render: (p) => <IntelBriefPanel query={p.searchQuery ?? ''} crises={p.crises} flights={p.flights} />,
  },
  {
    id: 'livefeed', title: 'Live Feed', group: 'news', section: 'video', map: 'none',
    dotColor: 'red', desc: 'Live news broadcasts — CNN, FOX, NBC, CBS, Euronews, DW, Sky News, France 24',
    render: () => <LiveFeedPanel />,
  },
  {
    id: 'webcams', title: 'US Webcams', group: 'news', section: 'video', map: ['cameras'],
    dotColor: 'grn', desc: 'SkylineWebcams & EarthCam — live US grid',
    render: () => <USWebcamsPanel />,
  },
]

/* ── Lookup helpers ────────────────────────────────────────────────────────── */

/** Map from panel ID to its definition */
export const PANEL_MAP = new Map(PANELS.map(p => [p.id, p]))

/**
 * Banners in the right-hand dock, per workspace, in display order. Each workspace reads top-down from the most
 * immediate or most aggregated view to the detail behind it; panels sit under the banner named by their `section`.
 */
export const GROUP_SECTIONS: Record<PanelGroup, PanelSection[]> = {
  overview: [
    { id: 'headline', title: 'Headline risk', desc: 'How tense the world looks right now: one composite score, then the countries driving it.' },
    { id: 'events', title: 'What is happening', desc: 'The live events behind those numbers: incidents by type and ICG\'s monthly conflict tracking.' },
    { id: 'yours', title: 'Your countries', desc: 'Countries you follow, with alerts on new events and rising trends.' },
  ],
  markets: [
    { id: 'live', title: 'Markets today', desc: 'The fastest-moving signal: index and asset prices from the live feed.' },
    { id: 'inventories', title: 'Inventories', desc: 'Weekly US stockpiles of crude oil, fuels and natural gas (EIA), against the same week in the previous five years.' },
    { id: 'macro', title: 'Macro indicators', desc: 'Slower, structural data per country: World Bank economic profiles and long-run global trends.' },
    { id: 'trade', title: 'Trade', desc: 'Who each country trades with, and what it exports and imports.' },
    { id: 'resources', title: 'Resources', desc: 'Critical minerals and commodities: reserves and production by country.' },
  ],
  analysis: [
    { id: 'forecasts', title: 'Forecasts', desc: 'Statistical projections computed in your browser and backtested out of sample. Evidence first: these numbers are measured, not generated.' },
    { id: 'ai', title: 'AI analyst', desc: 'A language model reasoning over the dashboard\'s live data. Inference, not evidence: its answers have not been systematically evaluated.' },
    { id: 'explore', title: 'Explore the data', desc: 'Open-ended analysis: compare any two country indicators, or study earthquake and wildfire patterns.' },
  ],
  country: [
    { id: 'profile', title: 'One country in depth', desc: 'A single country\'s full World Bank record by category, ECB/Eurostat data for Europe, and an analysis of its own history.' },
  ],
  security: [
    { id: 'live', title: 'Live alerts', desc: 'Low air traffic against hand-set references, updated continuously. Not NOTAMs.' },
    { id: 'pressure', title: 'Sanctions & illicit trade', desc: 'Economic pressure and criminal flows: sanctions registries and narcotics trafficking.' },
    { id: 'military', title: 'Military posture', desc: 'How large each armed force is, and where its installations are.' },
    { id: 'nuclear', title: 'Nuclear', desc: 'Reactors and weapons storage sites, worldwide and by country.' },
  ],
  geo: [
    { id: 'live', title: 'Live disruptions', desc: 'What is breaking right now: major natural disasters and internet outages.' },
    { id: 'people', title: 'Humanitarian impact', desc: 'Displacement and border status (UNHCR).' },
    { id: 'capacity', title: 'Energy & digital capacity', desc: 'Electricity generated per country, key infrastructure sites, and data centers.' },
    { id: 'map', title: 'Map layers', desc: 'Choose which of these datasets are drawn on the map.' },
  ],
  news: [
    { id: 'reporting', title: 'Reporting', desc: 'Aggregated open-source news, and a briefing filtered by your current search.' },
    { id: 'video', title: 'Live video', desc: 'Live news broadcasts and public webcams.' },
  ],
}

const sectionRank = (p: PanelDef) => GROUP_SECTIONS[p.group].findIndex(s => s.id === p.section)

/** Get all panels for a group, ordered by section, then by registry order within a section */
export function panelsForGroup(group: PanelGroup): PanelDef[] {
  return PANELS.filter(p => p.group === group).sort((a, b) => sectionRank(a) - sectionRank(b))
}

/** All group IDs in display order: the economic workflow first, then context domains, then raw sources. */
export const GROUP_ORDER: { id: PanelGroup; label: string }[] = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'markets',  label: 'ECONOMY' },
  { id: 'analysis', label: 'FORECASTS & ANALYSIS' },
  { id: 'country',  label: 'COUNTRY LOOKUP' },
  { id: 'security', label: 'SECURITY & DEFENSE' },
  { id: 'geo',      label: 'INFRASTRUCTURE' },
  { id: 'news',     label: 'NEWS & MEDIA' },
]

/** Sidebar headings: which workspaces sit under each, in GROUP_ORDER order. */
export const SIDEBAR_SECTIONS: { label: string; groups: PanelGroup[] }[] = [
  { label: 'START', groups: ['overview'] },
  { label: 'ECONOMY & FORECASTING', groups: ['markets', 'analysis', 'country'] },
  { label: 'CONTEXT', groups: ['security', 'geo'] },
  { label: 'SOURCES', groups: ['news'] },
]
