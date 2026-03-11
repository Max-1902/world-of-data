import { useState, useCallback } from 'react'
import type { MapViewMode, PanelState, Flight, CrisisEvent } from './types'
import { useFlights }     from './hooks/useFlights'
import { useCrises }      from './hooks/useCrises'
import { useNews }        from './hooks/useNews'
import { useStocks }      from './hooks/useStocks'
import { useEarthquakes } from './hooks/useEarthquakes'
import { useWildfires }   from './hooks/useWildfires'
import { useVessels }    from './hooks/useVessels'
import MapView      from './components/Map/MapView'
import TopBar       from './components/TopBar'
import PanelDock    from './components/PanelDock/PanelDock'
import ObserveTray  from './components/PanelDock/ObserveTray'
import SettingsModal from './components/SettingsModal'
import CountryDrawer from './components/CountryDrawer'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

export default function App() {
  const [viewMode, setViewMode] = useState<MapViewMode>('earth')
  const [panelState, setPanelState] = useState<PanelState>({
    flights:   true,
    crises:    true,
    news:      false,
    stocks:    true,
    wildfires: true,
    military:  false,
    nuclear:   false,
    sanctions: false,
    cameras:        false,
    infrastructure: false,
    airspace:       false,
    humanitarian:   false,
    vessels:        false,
    oilgas:         false,
    gpsjam:         false,
  })
  const [deepstateMode, setDeepstateMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [geoFlyTo, setGeoFlyTo] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Panels popped out to the bottom-left observe tray (up to 6)
  const [observeIds, setObserveIds] = useState<string[]>([])
  const poppedOut = new Set(observeIds)
  const handlePopOut = useCallback((id: string) => {
    setObserveIds(prev => prev.includes(id) ? prev : prev.length >= 6 ? prev : [...prev, id])
  }, [])
  const handlePopIn = useCallback((id: string) => {
    setObserveIds(prev => prev.filter(x => x !== id))
  }, [])

  const { flights }     = useFlights(panelState.flights)
  const { crises }      = useCrises(panelState.crises)
  const { articles }    = useNews()
  const { stocks }      = useStocks(panelState.stocks)
  const { earthquakes } = useEarthquakes(panelState.crises)
  const { fires }       = useWildfires(panelState.wildfires)
  const { vessels }     = useVessels(panelState.vessels)

  void stocks

  const toggleLayer = useCallback((layer: keyof PanelState) => {
    setPanelState((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }, [])

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
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, flexDirection: 'column', gap: 12, padding: 24 }}>
        <div style={{ color: '#e8e8e8', fontSize: 13, letterSpacing: '.08em' }}>MAPBOX TOKEN REQUIRED</div>
        <div style={{ background: '#111111', border: '1px solid #1e1e1e', padding: 12, fontSize: 11, maxWidth: 400, width: '100%' }}>
          <div style={{ color: '#6b6b6b', marginBottom: 6 }}># Add to .env:</div>
          <div style={{ color: '#e8e8e8' }}>VITE_MAPBOX_TOKEN=pk.ey...</div>
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
      />

      {/* ── Main area: map (left) + command panel (right) ──────────── */}
      <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
        {/* Map area */}
        <div className="area-map" style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
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
            showOilGas={panelState.oilgas}
            showGPSJam={panelState.gpsjam}
            flyToQuery={searchQuery}
            geoFlyTo={geoFlyTo}
            onCountryClick={setSelectedCountry}
          />
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
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            viewMode={viewMode}
            onViewMode={setViewMode}
            panelState={panelState}
            onToggleLayer={toggleLayer}
            deepstateMode={deepstateMode}
            onDeepstateToggle={() => setDeepstateMode(v => !v)}
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
        />
      </div>
    </div>
  )
}
