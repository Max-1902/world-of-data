import { useState, useCallback, useEffect } from 'react'
import type { MapViewMode, PanelState, Flight, CrisisEvent } from './types'
import type { PanelGroup } from './panels/types'
import { useFlights }     from './hooks/useFlights'
import { useCrises }      from './hooks/useCrises'
import { useNews }        from './hooks/useNews'
import { useStocks }      from './hooks/useStocks'
import { useEarthquakes } from './hooks/useEarthquakes'
import { useWildfires }   from './hooks/useWildfires'
import { useVessels }    from './hooks/useVessels'
import { useOutages }    from './hooks/useOutages'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import MapView      from './components/Map/MapView'
import TopBar       from './components/TopBar'
import Sidebar      from './components/Sidebar'
import PanelDock    from './components/PanelDock/PanelDock'
import ObserveTray  from './components/PanelDock/ObserveTray'
import SettingsModal from './components/SettingsModal'
import CountryDrawer from './components/CountryDrawer'
import NewsTicker   from './components/NewsTicker'
import OutlookCard from './components/OutlookCard'
import { triggerGlobalReload } from './utils/reloadBus'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

const DEFAULT_PANEL_STATE: PanelState = {
  flights: true, crises: true, news: false, stocks: true, wildfires: true,
  military: false, nuclear: false, sanctions: false, cameras: false,
  infrastructure: false, airspace: false, humanitarian: false, vessels: false,
  oil: false, gas: false, gpsjam: false, ports: false, pipelines: false,
  chokepoints: false, supplychain: false, shippingRoutes: false,
  outages: false, resources: false, tradeStats: false,
}

function loadPanelState(): PanelState {
  try {
    const raw = localStorage.getItem('ws-panel-state')
    if (raw) return { ...DEFAULT_PANEL_STATE, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_PANEL_STATE
}

function loadViewMode(): MapViewMode {
  try {
    const v = localStorage.getItem('ws-view-mode')
    if (v) return v as MapViewMode
  } catch {}
  return 'earth'
}

function loadGroup(): PanelGroup {
  const oldGroupMap: Record<string, PanelGroup> = {
    intel: 'overview',
    mil: 'security',
    fin: 'markets',
    ai: 'analysis',
  }
  try {
    const saved = localStorage.getItem('ws-dock-group')
    if (saved && ['overview', 'news', 'geo', 'security', 'markets', 'analysis'].includes(saved)) return saved as PanelGroup
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
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reticleColor, setReticleColor] = useState(() => {
    try { return localStorage.getItem('ws-reticle-color') || '#00ff88' } catch { return '#00ff88' }
  })

  // Panels popped out to the bottom-left observe tray (up to 6)
  const [observeIds, setObserveIds] = useState<string[]>([])
  const poppedOut = new Set(observeIds)
  const handlePopOut = useCallback((id: string) => {
    setObserveIds(prev => prev.includes(id) ? prev : prev.length >= 6 ? prev : [...prev, id])
  }, [])
  const handlePopIn = useCallback((id: string) => {
    setObserveIds(prev => prev.filter(x => x !== id))
  }, [])

  const { flights, refresh: refreshFlights }         = useFlights(panelState.flights)
  const { crises, refresh: refreshCrises }           = useCrises(panelState.crises)
  const { articles, loadHeadlines: refreshNews }     = useNews()
  const { stocks, refresh: refreshStocks }           = useStocks(panelState.stocks)
  const { earthquakes, refresh: refreshEarthquakes } = useEarthquakes(panelState.crises)
  const { fires, refresh: refreshFires }             = useWildfires(panelState.wildfires)
  const { vessels, refresh: refreshVessels }         = useVessels(panelState.vessels)
  const { outages, refresh: refreshOutages }         = useOutages(panelState.outages)

  void stocks

  const [reloading, setReloading] = useState(false)
  const handleReloadAll = useCallback(() => {
    setReloading(true)
    refreshFlights()
    refreshCrises()
    refreshNews()
    refreshStocks()
    refreshEarthquakes()
    refreshFires()
    refreshVessels()
    refreshOutages()
    triggerGlobalReload()
    window.setTimeout(() => setReloading(false), 900)
  }, [refreshFlights, refreshCrises, refreshNews, refreshStocks, refreshEarthquakes, refreshFires, refreshVessels, refreshOutages])

  // Persist preferences
  useEffect(() => { try { localStorage.setItem('ws-panel-state', JSON.stringify(panelState)) } catch {} }, [panelState])
  useEffect(() => { try { localStorage.setItem('ws-view-mode', viewMode) } catch {} }, [viewMode])
  useEffect(() => { try { localStorage.setItem('ws-dock-group', activeGroup) } catch {} }, [activeGroup])

  const toggleLayer = useCallback((layer: keyof PanelState) => {
    setPanelState((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }, [])

  useKeyboardShortcuts({
    onViewMode: setViewMode,
    onToggleLayer: toggleLayer,
    onSettingsOpen: () => setSettingsOpen(true),
    onCloseDrawer: () => { setSelectedCountry(null); setSettingsOpen(false) },
  })

  const handleFlightSelect = useCallback((_f: Flight) => {}, [])
  const handleCrisisSelect = useCallback((_c: CrisisEvent) => {}, [])

  const handleGeoSearch = useCallback((q: string) => {
    setGeoFlyTo(q + '\u0000' + Date.now())
  }, [])

  const cornerProps = {
    crises, flights, panelState,
    onToggleLayer: toggleLayer,
    deepstateMode,
    onDeepstateToggle: () => setDeepstateMode(v => !v),
    onGeoSearch: handleGeoSearch,
    onCountryClick: setSelectedCountry,
  }

  if (!TOKEN) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 12, flexDirection: 'column', gap: 12, padding: 24 }}>
        <div style={{ color: 'var(--text1)', fontSize: 14, fontWeight: 600 }}>Mapbox token required</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)', padding: 14, fontSize: 11, maxWidth: 400, width: '100%', fontFamily: 'IBM Plex Mono, monospace' }}>
          <div style={{ color: 'var(--text2)', marginBottom: 6 }}># Add to .env:</div>
          <div style={{ color: 'var(--text1)' }}>VITE_MAPBOX_TOKEN=pk.ey...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <TopBar
        viewMode={viewMode}
        onViewMode={setViewMode}
        flightCount={flights.length}
        crises={crises}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onSettingsOpen={() => setSettingsOpen(true)}
        onReloadAll={handleReloadAll}
        reloading={reloading}
      />

      <NewsTicker />

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
            newsArticles={articles}
            earthquakes={earthquakes}
            showFlights={panelState.flights}
            showCrises={panelState.crises}
            showNews={panelState.news}
            showStocks={panelState.stocks}
            deepstateMode={deepstateMode}
            onFlightClick={handleFlightSelect}
            onCrisisClick={handleCrisisSelect}
            fires={fires}
            showWildfires={panelState.wildfires}
            showMilitary={panelState.military}
            showNuclear={panelState.nuclear}
            showSanctions={panelState.sanctions}
            showCameras={panelState.cameras}
            showInfrastructure={panelState.infrastructure}
            showAirspace={panelState.airspace}
            showHumanitarian={panelState.humanitarian}
            vessels={vessels}
            showVessels={panelState.vessels}
            showOil={panelState.oil}
            showGas={panelState.gas}
            showGPSJam={panelState.gpsjam}
            showPorts={panelState.ports}
            showPipelines={panelState.pipelines}
            showChokepoints={panelState.chokepoints}
            showSupplyChain={panelState.supplychain}
            showShippingRoutes={panelState.shippingRoutes}
            outages={outages}
            showOutages={panelState.outages}
            showResources={panelState.resources}
            showTradeStats={panelState.tradeStats}
            flyToQuery={searchQuery}
            geoFlyTo={geoFlyTo}
            onCountryClick={setSelectedCountry}
            reticleColor={reticleColor}
            panelState={panelState}
            onToggleLayer={toggleLayer}
          />
          </div>
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
          <OutlookCard crises={crises} flights={flights} onOpen={() => setActiveGroup('analysis')} />
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

          {/* ── Bottom-left observation tray (up to 6 panels) ──────── */}
          <ObserveTray
            ids={observeIds}
            crises={crises}
            flights={flights}
            panelState={panelState}
            onToggleLayer={toggleLayer}
            deepstateMode={deepstateMode}
            onDeepstateToggle={() => setDeepstateMode(v => !v)}
            onGeoSearch={handleGeoSearch}
            onCountryClick={setSelectedCountry}
            onClose={handlePopIn}
            onAdd={handlePopOut}
          />
        </div>

        {/* ── Right command panel ──────────────────────────────────── */}
        <PanelDock
          {...cornerProps}
          poppedOut={poppedOut}
          onPopOut={handlePopOut}
          onPopIn={handlePopIn}
          activeGroup={activeGroup}
        />
      </div>
    </div>
  )
}
