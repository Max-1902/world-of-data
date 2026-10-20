import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
import type { MapViewMode, PanelState, Flight, CrisisEvent, SelectedPlace } from './types'
import type { PanelGroup } from './panels/types'
import { useFlights }     from './hooks/useFlights'
import { useCrises }      from './hooks/useCrises'
import { useNews }        from './hooks/useNews'
import { useGeoNews }     from './hooks/useGeoNews'
import { useStocks }      from './hooks/useStocks'
import { useEarthquakes } from './hooks/useEarthquakes'
import { useWildfires }   from './hooks/useWildfires'
import { useGPSJam }      from './hooks/useGPSJam'
import { useVessels }    from './hooks/useVessels'
import { useOutages }    from './hooks/useOutages'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useHistoryRecorder } from './hooks/useHistory'
import { useWatchEvaluator } from './hooks/useWatchlist'
import AlertToasts from './components/AlertToasts'
import MapView      from './components/Map/MapView'
import TopBar       from './components/TopBar'
import Sidebar      from './components/Sidebar'
import PanelDock    from './components/PanelDock/PanelDock'
import WindowLayer, { WindowTaskbar } from './components/Windows/WindowLayer'
import { useWindowLayout } from './components/Windows/useWindowLayout'
import CommandPalette from './components/CommandPalette'
import NewsTicker   from './components/NewsTicker'
import OutlookCard from './components/OutlookCard'
import { AnalystWindowProvider } from './components/panels/aiAnalyst/AnalystWindow'
import { triggerGlobalReload } from './utils/reloadBus'
import { clearNewsCaches } from './services/news'
import { summarizeKeyEvents } from './utils/keyEvents'
import { useDisasterAlerts } from './hooks/useDisasterAlerts'
import { GROUP_ORDER, PANEL_MAP } from './panels/registry'
import { decodeHash, encodeHash, enabledLayers, isViewMode, layersToPanelState, type DecodedState } from './utils/urlState'

// Rarely-open surfaces: keep their code (and the datasets CountryDrawer pulls in) out of the first load.
const SettingsModal = lazy(() => import('./components/SettingsModal'))
const CountryDrawer = lazy(() => import('./components/CountryDrawer'))

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

/** Layers that belong to the INFRA overlay — toggling INFRA switches all of them together. */
const INFRA_GROUP: (keyof PanelState)[] = ['nuclear', 'pipelines', 'datacenters', 'ports']

const DEFAULT_PANEL_STATE: PanelState = {
  flights: true, crises: true, news: false, stocks: true, wildfires: true,
  military: false, nuclear: false, sanctions: false, cameras: false,
  infrastructure: false, airspace: false, humanitarian: false, vessels: false,
  oil: false, gas: false, gpsjam: false, ports: false, pipelines: false,
  chokepoints: false, supplychain: false, shippingDensity: false,
  outages: false, disasters: true, resources: false, tradeStats: false,
  militaryPersonnel: false, datacenters: false, infraIndicators: false,
  analyticsHex: false, countryAnalytics: false,
}

/** A shared link (#v=…&l=…) wins over localStorage, so opening it shows exactly what was sent. */
function readHash(): DecodedState {
  return decodeHash(window.location.hash, Object.keys(DEFAULT_PANEL_STATE), GROUP_ORDER.map(g => g.id))
}

function loadPanelState(): PanelState {
  const fromLink = readHash().layers
  if (fromLink) return layersToPanelState(DEFAULT_PANEL_STATE, fromLink)
  try {
    const raw = localStorage.getItem('ws-panel-state')
    if (raw) return { ...DEFAULT_PANEL_STATE, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_PANEL_STATE
}

function loadViewMode(): MapViewMode {
  const fromLink = readHash().viewMode
  if (fromLink) return fromLink
  try {
    // a stale or hand-edited value would otherwise reach Mapbox as a style name
    const v = localStorage.getItem('ws-view-mode')
    if (isViewMode(v)) return v
  } catch {}
  return 'earth'
}

function loadGroup(): PanelGroup {
  const fromLink = readHash().group
  if (fromLink) return fromLink as PanelGroup
  // Workspaces that were folded into the six themed ones keep working for saved state and old links.
  const oldGroupMap: Record<string, PanelGroup> = {
    intel: 'overview', mil: 'security', fin: 'markets', ai: 'analysis',
    militaryInstallations: 'security', nuclearFacilities: 'security', forceSize: 'security',
    infrastructureSites: 'geo', datacenters: 'geo',
    resourcesByCountry: 'markets', tradePartnersByCountry: 'markets', tradeProductsByCountry: 'markets', economicData: 'markets',
  }
  try {
    const saved = localStorage.getItem('ws-dock-group')
    const validGroups: string[] = GROUP_ORDER.map(g => g.id)
    if (saved && validGroups.includes(saved)) return saved as PanelGroup
    return saved ? oldGroupMap[saved] ?? 'overview' : 'overview'
  } catch { return 'overview' }
}

export default function App() {
  const [viewMode, setViewMode] = useState<MapViewMode>(loadViewMode)
  const [activeGroup, setActiveGroup] = useState<PanelGroup>(loadGroup)
  const [panelState, setPanelState] = useState<PanelState>(loadPanelState)
  const [deepstateMode, setDeepstateMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [geoFlyTo, setGeoFlyTo] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() => readHash().country ?? null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [focusPanel, setFocusPanel] = useState<{ id: string; n: number } | null>(null)
  // Search bar / command palette picked a panel: switch to its workspace and scroll to it.
  const openPanel = useCallback((id: string) => {
    const group = PANEL_MAP.get(id)?.group
    if (!group) return
    setActiveGroup(group)
    setFocusPanel({ id, n: Date.now() })
  }, [])
  // Session-only: a closed ticker / outlook card returns on reload. The outlook card is dismissed per subject
  // (the regional outlook, or one country's brief), so picking another country shows it again.
  const [tickerHidden, setTickerHidden] = useState(false)
  const [dismissedCard, setDismissedCard] = useState<string | null>(null)
  // A picked city (map click) and a picked country are mutually exclusive; the city takes over the outlook card.
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  // The card keeps showing the last picked country's brief after the drawer closes; only its own ✕ (or picking a city) takes it away.
  const [briefCountry, setBriefCountry] = useState<string | null>(selectedCountry)
  useEffect(() => { if (selectedCountry) setBriefCountry(selectedCountry) }, [selectedCountry])
  const cardKey = selectedPlace ? `\u0000place:${selectedPlace.name}:${selectedPlace.lat}:${selectedPlace.lng}` : briefCountry ?? '\u0000outlook'
  // Any explicit pick (map click, search, toast) re-opens the outlook box, even for a country whose brief was closed earlier.
  const selectCountry = useCallback((country: string | null) => {
    if (country) setDismissedCard(null)
    setSelectedPlace(null)
    setSelectedCountry(country)
  }, [])
  const selectPlace = useCallback((place: SelectedPlace) => {
    setDismissedCard(null)
    setSelectedCountry(null)
    setBriefCountry(null)
    setSelectedPlace(place)
  }, [])
  const [reticleColor, setReticleColor] = useState(() => {
    try { return localStorage.getItem('ws-reticle-color') || '#16a34a' } catch { return '#16a34a' }
  })

  // Panels popped out of the dock into floating windows (Windows/WindowLayer)
  const windows = useWindowLayout()
  const poppedOut = windows.ids

  const { flights, refresh: refreshFlights }         = useFlights(panelState.flights)
  const { crises, refresh: refreshCrises } = useCrises(panelState.crises)
  const { articles, loadHeadlines: refreshNews }     = useNews()
  const { stocks, refresh: refreshStocks }           = useStocks(panelState.stocks)
  const { earthquakes, refresh: refreshEarthquakes } = useEarthquakes(panelState.crises)
  const { fires, refresh: refreshFires }             = useWildfires(panelState.wildfires)
  const { data: gpsJam }                             = useGPSJam(panelState.gpsjam)
  const { vessels, refresh: refreshVessels }         = useVessels(panelState.vessels)
  const { outages, refresh: refreshOutages }         = useOutages(panelState.outages)
  const { alerts: disasterAlerts } = useDisasterAlerts()
  const keyEvents = useMemo(() => summarizeKeyEvents(articles), [articles])

  const newsPins = useGeoNews(keyEvents.events, panelState.news)

  useHistoryRecorder(crises, flights, panelState.flights)
  useWatchEvaluator(crises, flights, articles)

  const [reloading, setReloading] = useState(false)
  const handleReloadAll = useCallback(async () => {
    setReloading(true)
    // Cached news responses live for 5–10 min; a manual reload must bypass them or it re-serves old headlines.
    clearNewsCaches()
    // disaster alerts listen on the reload bus themselves, so they aren't in this list
    triggerGlobalReload()
    await Promise.allSettled([
      refreshFlights, refreshCrises, refreshNews, refreshStocks,
      refreshEarthquakes, refreshFires, refreshVessels, refreshOutages,
    ].map(refresh => Promise.resolve(refresh())))
    setReloading(false)
  }, [refreshFlights, refreshCrises, refreshNews, refreshStocks, refreshEarthquakes, refreshFires, refreshVessels, refreshOutages])

  // Persist preferences
  useEffect(() => { try { localStorage.setItem('ws-panel-state', JSON.stringify(panelState)) } catch {} }, [panelState])
  useEffect(() => { try { localStorage.setItem('ws-view-mode', viewMode) } catch {} }, [viewMode])
  useEffect(() => { try { localStorage.setItem('ws-dock-group', activeGroup) } catch {} }, [activeGroup])

  // Mirror shareable state into the URL hash (replaceState: no history spam, no hashchange echo).
  useEffect(() => {
    const hash = encodeHash({ viewMode, layers: enabledLayers(panelState), group: activeGroup, country: selectedCountry })
    if (window.location.hash !== hash) history.replaceState(null, '', hash)
  }, [viewMode, panelState, activeGroup, selectedCountry])

  // A link pasted into the same tab only changes the hash — apply it without a reload.
  useEffect(() => {
    function onHashChange() {
      const d = readHash()
      if (d.viewMode) setViewMode(d.viewMode)
      if (d.layers) setPanelState(prev => layersToPanelState(prev, d.layers!))
      if (d.group) setActiveGroup(d.group as PanelGroup)
      setSelectedPlace(null)
      setSelectedCountry(d.country ?? null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Cmd/Ctrl+K opens the command palette from anywhere, including while typing in an input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleLayer = useCallback((layer: keyof PanelState) => {
    setPanelState((prev) => {
      const on = !prev[layer]
      // INFRA is a master switch: it turns on every layer that belongs to infrastructure
      // (nuclear, pipelines, data centers, ports) so all of its dots appear at once.
      if (layer === 'infrastructure') {
        const group = Object.fromEntries(INFRA_GROUP.map(k => [k, on])) as Partial<PanelState>
        return { ...prev, ...group, infrastructure: on }
      }
      return { ...prev, [layer]: on }
    })
  }, [])

  const clearLayers = useCallback(() => {
    setPanelState((prev) => Object.fromEntries(Object.keys(prev).map(k => [k, false])) as unknown as PanelState)
  }, [])

  // memoised so the key listener isn't re-registered on every render
  const shortcutHandlers = useMemo(() => ({
    onViewMode: setViewMode,
    onToggleLayer: toggleLayer,
    onSettingsOpen: () => setSettingsOpen(true),
    onCloseDrawer: () => { setSelectedCountry(null); setSelectedPlace(null); setSettingsOpen(false) },
  }), [toggleLayer])
  useKeyboardShortcuts(shortcutHandlers)

  const handleFlightSelect = useCallback((_f: Flight) => {}, [])
  const handleCrisisSelect = useCallback((_c: CrisisEvent) => {}, [])

  const handleGeoSearch = useCallback((q: string) => {
    setGeoFlyTo(q + '\u0000' + Date.now())
  }, [])

  const toggleDeepstate = useCallback(() => setDeepstateMode(v => !v), [])
  // memoised so floating windows only re-render their panel when the data actually changes
  const cornerProps = useMemo(() => ({
    crises, flights, panelState,
    onToggleLayer: toggleLayer,
    deepstateMode,
    onDeepstateToggle: toggleDeepstate,
    onGeoSearch: handleGeoSearch,
    onCountryClick: selectCountry,
    searchQuery,
  }), [crises, flights, panelState, toggleLayer, deepstateMode, toggleDeepstate, handleGeoSearch, selectCountry, searchQuery])

  if (!TOKEN) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 12, flexDirection: 'column', gap: 12, padding: 24 }}>
        <div style={{ color: 'var(--text1)', fontSize: 14, fontWeight: 600 }}>Mapbox token required</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)', padding: 14, fontSize: 11, maxWidth: 400, width: '100%', fontFamily: 'Inter, -apple-system, sans-serif' }}>
          <div style={{ color: 'var(--text2)', marginBottom: 6 }}># Add to .env:</div>
          <div style={{ color: 'var(--text1)' }}>VITE_MAPBOX_TOKEN=pk.ey...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* one shared Analyst: docked in the right panel, or popped out (see AnalystWindow) */}
      <AnalystWindowProvider panelProps={cornerProps}>
      <TopBar
        viewMode={viewMode}
        onViewMode={setViewMode}
        stocks={stocks}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onOpenPanel={openPanel}
        onToggleLayer={toggleLayer}
        onSettingsOpen={() => setSettingsOpen(true)}
        onReloadAll={handleReloadAll}
        reloading={reloading}
      />

      {!tickerHidden && <NewsTicker onClose={() => setTickerHidden(true)} />}

      {/* ── Main area: sidebar + map + command panel ──────────── */}
      <div className="dashboard-main" style={{ display: 'flex', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
        <Sidebar activeGroup={activeGroup} onGroupChange={setActiveGroup} poppedOut={poppedOut} />

        {/* Map area */}
        <div className="area-map" style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
          <div className="map-card">
          <MapView
            viewMode={viewMode}
            flights={flights}
            crises={crises}
            newsPins={newsPins}
            stocks={stocks}
            earthquakes={earthquakes}
            showFlights={panelState.flights}
            showCrises={panelState.crises}
            showNews={panelState.news}
            showStocks={panelState.stocks}
            deepstateMode={deepstateMode}
            onCloseDeepstate={() => setDeepstateMode(false)}
            onToggleDeepstate={() => setDeepstateMode(v => !v)}
            onFlightClick={handleFlightSelect}
            onCrisisClick={handleCrisisSelect}
            fires={fires}
            showWildfires={panelState.wildfires}
            showMilitary={panelState.military}
            showNuclear={panelState.nuclear}
            showSanctions={panelState.sanctions}
            showCameras={panelState.cameras}
            showInfrastructure={panelState.infrastructure}
            showDatacenters={panelState.datacenters}
            showAirspace={panelState.airspace}
            showHumanitarian={panelState.humanitarian}
            vessels={vessels}
            showVessels={panelState.vessels}
            showOil={panelState.oil}
            showGas={panelState.gas}
            showGPSJam={panelState.gpsjam}
            gpsJam={gpsJam}
            showPorts={panelState.ports}
            showPipelines={panelState.pipelines}
            showChokepoints={panelState.chokepoints}
            showSupplyChain={panelState.supplychain}
            showShippingDensity={panelState.shippingDensity}
            outages={outages}
            showOutages={panelState.outages}
            disasterAlerts={disasterAlerts}
            showDisasters={panelState.disasters}
            showResources={panelState.resources}
            showTradeStats={panelState.tradeStats}
            showMilitaryPersonnel={panelState.militaryPersonnel}
            showInfraIndicators={panelState.infraIndicators}
            showAnalyticsHex={panelState.analyticsHex}
            showCountryAnalytics={panelState.countryAnalytics}
            flyToQuery={searchQuery}
            geoFlyTo={geoFlyTo}
            onCountryClick={selectCountry}
            onPlaceClick={selectPlace}
            selectedCountry={selectedCountry}
            selectedPlace={selectedPlace}
            reticleColor={reticleColor}
            panelState={panelState}
            onToggleLayer={toggleLayer}
            onClearLayers={clearLayers}
          />
          </div>
          <Suspense fallback={null}>
            {selectedCountry && (
              <CountryDrawer
                country={selectedCountry}
                crises={crises}
                flights={flights}
                earthquakes={earthquakes}
                fires={fires}
                onClose={() => setSelectedCountry(null)}
                onFlyTo={handleGeoSearch}
              />
            )}
          </Suspense>
          <AlertToasts onSelectCountry={selectCountry} />
          {dismissedCard !== cardKey && (
            <OutlookCard crises={crises} flights={flights} articles={articles} earthquakes={earthquakes} fires={fires} selectedCountry={briefCountry} selectedPlace={selectedPlace} onSelectCountry={selectCountry} onClose={() => setDismissedCard(cardKey)} />
          )}
          <Suspense fallback={null}>
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            viewMode={viewMode}
            onViewMode={setViewMode}
            panelState={panelState}
            onToggleLayer={toggleLayer}
            deepstateMode={deepstateMode}
            onDeepstateToggle={() => setDeepstateMode(v => !v)}
            reticleColor={reticleColor}
            onReticleColor={(c: string) => { setReticleColor(c); try { localStorage.setItem('ws-reticle-color', c) } catch {} }}
          />
          </Suspense>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            panelState={panelState}
            onOpenPanel={openPanel}
            onToggleLayer={toggleLayer}
            onViewMode={setViewMode}
            onGeoSearch={handleGeoSearch}
          />

          {/* ── Bottom strip: open windows and the layout tools ──────── */}
          <WindowTaskbar layout={windows} />
        </div>

        {/* ── Right command panel ──────────────────────────────────── */}
        <PanelDock
          {...cornerProps}
          poppedOut={poppedOut}
          onPopOut={windows.actions.open}
          onPopOutAll={windows.actions.openMany}
          activeGroup={activeGroup}
          focusPanel={focusPanel}
        />
      </div>
      <WindowLayer layout={windows} panelProps={cornerProps} />
      </AnalystWindowProvider>
    </div>
  )
}
