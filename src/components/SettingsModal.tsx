import { useState } from 'react'
import type { MapViewMode, PanelState } from '../types'

const TABS = ['GENERAL', 'LAYERS', 'DATA SOURCES', 'API KEYS', 'DISPLAY', 'ABOUT'] as const
type Tab = typeof TABS[number]

// Data sources registry (from old InfoModal)
const DATA_SOURCES: { category: string; items: { label: string; source: string; notes: string }[] }[] = [
  {
    category: 'AIR DOMAIN',
    items: [
      { label: 'ADS-B positions', source: 'OpenSky Network', notes: 'Real-time transponder data, ~10s latency. 5000+ ground stations.' },
      { label: 'Flight classification', source: 'ICAO prefix / callsign heuristics', notes: 'PAX, MIL, CGO, PVT detection via hex ranges and callsign patterns.' },
    ],
  },
  {
    category: 'CONFLICT & SECURITY',
    items: [
      { label: 'Conflict events', source: 'ACLED', notes: 'Georeferenced political violence. 230+ countries. Weekly updates.' },
      { label: 'Crisis monitoring', source: 'International Crisis Group', notes: '70+ country monthly conflict tracker via CrisisWatch RSS.' },
    ],
  },
  {
    category: 'NETWORK',
    items: [
      { label: 'Outage detection', source: 'IODA (Georgia Tech)', notes: 'BGP routing + active probing + network telescope. No auth.' },
    ],
  },
  {
    category: 'SIGNALS / NEWS',
    items: [
      { label: 'Global articles', source: 'GDELT Project v2', notes: '65k+ sources, near real-time. English filter.' },
      { label: 'Wire services', source: 'BBC, Reuters, DW, Al Jazeera, France 24', notes: 'RSS feeds via proxy.' },
      { label: 'Premium feeds', source: 'NewsAPI, Guardian, NYT', notes: 'Requires API keys. Optional.' },
    ],
  },
  {
    category: 'FINANCIAL',
    items: [
      { label: 'Equities / ETFs', source: 'Yahoo Finance', notes: 'Real-time quotes. ~15 min delay for equities.' },
      { label: 'Crypto', source: 'CoinGecko / Yahoo', notes: 'BTC, ETH, major tokens.' },
    ],
  },
  {
    category: 'GEOSPATIAL',
    items: [
      { label: 'Basemap', source: 'Mapbox satellite-streets-v12', notes: 'Globe projection, 3D terrain.' },
      { label: 'Geocoding', source: 'Mapbox Geocoding API', notes: 'Place search, fly-to.' },
      { label: 'Ukraine frontline', source: 'DeepStateMap', notes: 'Iframe overlay, togglable.' },
      { label: 'Wildfires', source: 'NASA FIRMS', notes: 'MODIS/VIIRS thermal anomalies.' },
    ],
  },
  {
    category: 'GPS INTERFERENCE',
    items: [
      { label: 'Jamming zones', source: 'Eurocontrol / OPSGROUP / NATO', notes: '35+ zones, heatmap + radius circles.' },
      { label: 'Spoofing zones', source: 'C4ADS / US MARAD', notes: 'Areas with GPS position falsification.' },
    ],
  },
  {
    category: 'INFRASTRUCTURE',
    items: [
      { label: 'Military bases', source: 'Open-source geolocation databases', notes: 'Known military installations worldwide.' },
      { label: 'Nuclear facilities', source: 'IAEA PRIS / open sources', notes: 'Power plants, research reactors.' },
      { label: 'Energy infrastructure', source: 'EIA / OPEC / BP Statistical Review', notes: 'Oil/gas reserves, production, pipelines.' },
      { label: 'Live cameras', source: 'SkylineWebcams', notes: '190+ cameras across 75+ countries.' },
    ],
  },
  {
    category: 'AI ANALYSIS',
    items: [
      { label: 'LLM analyst', source: 'OpenRouter (free tier)', notes: 'Nemotron 30B, Trinity, Step Flash. Streaming.' },
    ],
  },
]

const LAYER_IDS: { id: keyof PanelState; label: string; desc: string }[] = [
  { id: 'flights', label: 'FLIGHTS', desc: 'ADS-B aircraft positions' },
  { id: 'crises', label: 'CRISES', desc: 'ACLED conflict events' },
  { id: 'news', label: 'NEWS', desc: 'GDELT article markers' },
  { id: 'stocks', label: 'MARKETS', desc: 'Financial hub markers' },
  { id: 'wildfires', label: 'WILDFIRES', desc: 'NASA FIRMS hotspots' },
  { id: 'military', label: 'MILITARY', desc: 'Known military bases' },
  { id: 'nuclear', label: 'NUCLEAR', desc: 'Nuclear facilities' },
  { id: 'sanctions', label: 'SANCTIONS', desc: 'Sanctioned countries' },
  { id: 'cameras', label: 'CAMERAS', desc: 'Live webcam feeds' },
  { id: 'infrastructure', label: 'INFRA', desc: 'Energy infrastructure' },
  { id: 'airspace', label: 'AIRSPACE', desc: 'FIR/NOTAM regions' },
  { id: 'humanitarian', label: 'HUMANITARIAN', desc: 'UNHCR displacement data' },
  { id: 'vessels', label: 'VESSELS', desc: 'AIS ship tracking' },
  { id: 'oilgas', label: 'OIL & GAS', desc: 'Reserves and production' },
  { id: 'gpsjam', label: 'GPS JAM', desc: 'Interference zones' },
]

const VIEW_MODES: { id: MapViewMode; label: string }[] = [
  { id: 'earth', label: 'Globe' },
  { id: 'dark', label: 'Dark' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'standard', label: 'Standard' },
  { id: 'city3d', label: '3D City' },
  { id: 'nightvision', label: 'Night Vision' },
  { id: 'bw', label: 'Black & White' },
  { id: 'infrared', label: 'Infrared' },
  { id: 'snow', label: 'Snow' },
  { id: 'thermal', label: 'Thermal' },
]

const API_KEYS = [
  { key: 'VITE_MAPBOX_TOKEN', label: 'Mapbox', required: true, desc: 'Map rendering and geocoding' },
  { key: 'VITE_OPENROUTER_KEY', label: 'OpenRouter', required: false, desc: 'AI analyst (free tier available)' },
  { key: 'VITE_GUARDIAN_KEY', label: 'The Guardian', required: false, desc: 'Guardian news API' },
  { key: 'VITE_NYT_KEY', label: 'New York Times', required: false, desc: 'NYT article search' },
  { key: 'VITE_FINNHUB_KEY', label: 'Finnhub', required: false, desc: 'Market data (alternative)' },
  { key: 'VITE_ACLED_KEY', label: 'ACLED', required: false, desc: 'Conflict event data' },
  { key: 'VITE_ACLED_EMAIL', label: 'ACLED Email', required: false, desc: 'ACLED account email' },
]

interface Props {
  open: boolean
  onClose: () => void
  viewMode: MapViewMode
  onViewMode: (m: MapViewMode) => void
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
}

const s = {
  label: { fontSize: 9, fontWeight: 400, letterSpacing: '.08em', color: '#6b6b6b', textTransform: 'uppercase' as const },
  value: { fontSize: 9, color: '#e8e8e8', fontFamily: 'JetBrains Mono, monospace' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e1e1e' },
  sectionTitle: { fontSize: 9, fontWeight: 500, letterSpacing: '.12em', color: '#e8e8e8', textTransform: 'uppercase' as const, marginBottom: 8, marginTop: 16 },
}

export default function SettingsModal({ open, onClose, viewMode, onViewMode, panelState, onToggleLayer, deepstateMode, onDeepstateToggle }: Props) {
  const [tab, setTab] = useState<Tab>('GENERAL')

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxWidth: '95vw', maxHeight: '85vh',
          background: '#0a0a0a',
          border: '1px solid #1e1e1e',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '8px 12px',
          borderBottom: '1px solid #1e1e1e',
        }}>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.14em', color: '#e8e8e8' }}>
            SETTINGS
          </span>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#3a3a3a', fontSize: 16, lineHeight: 1 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff3344' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#3a3a3a' }}
          >x</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e1e1e', flexShrink: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 12px',
                fontSize: 8, fontWeight: 400, letterSpacing: '.1em',
                color: tab === t ? '#e8e8e8' : '#3a3a3a',
                borderBottom: tab === t ? '1px solid #e8e8e8' : '1px solid transparent',
              }}
            >{t}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {tab === 'GENERAL' && <GeneralTab viewMode={viewMode} onViewMode={onViewMode} deepstateMode={deepstateMode} onDeepstateToggle={onDeepstateToggle} />}
          {tab === 'LAYERS' && <LayersTab panelState={panelState} onToggleLayer={onToggleLayer} />}
          {tab === 'DATA SOURCES' && <DataSourcesTab />}
          {tab === 'API KEYS' && <ApiKeysTab />}
          {tab === 'DISPLAY' && <DisplayTab />}
          {tab === 'ABOUT' && <AboutTab />}
        </div>
      </div>
    </div>
  )
}

function GeneralTab({ viewMode, onViewMode, deepstateMode, onDeepstateToggle }: { viewMode: MapViewMode; onViewMode: (m: MapViewMode) => void; deepstateMode: boolean; onDeepstateToggle: () => void }) {
  return (
    <div>
      <div style={s.sectionTitle}>MAP MODE</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {VIEW_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => onViewMode(m.id)}
            style={{
              padding: '4px 10px', fontSize: 8, letterSpacing: '.06em',
              border: '1px solid #1e1e1e', cursor: 'pointer',
              background: viewMode === m.id ? '#111111' : 'transparent',
              color: viewMode === m.id ? '#00ff88' : '#6b6b6b',
            }}
          >{m.label}</button>
        ))}
      </div>

      <div style={s.sectionTitle}>OVERLAYS</div>
      <div style={s.row}>
        <span style={s.label}>Ukraine frontline (DeepState)</span>
        <Toggle on={deepstateMode} onToggle={onDeepstateToggle} />
      </div>

      <div style={s.sectionTitle}>REFRESH RATES</div>
      {[
        { label: 'Flights (OpenSky)', value: '15s' },
        { label: 'Crises (ACLED)', value: '5 min' },
        { label: 'Market data', value: '60s' },
        { label: 'News feeds', value: 'On demand' },
        { label: 'Wildfires (FIRMS)', value: '5 min' },
        { label: 'Outages (IODA)', value: '5 min' },
      ].map(r => (
        <div key={r.label} style={s.row}>
          <span style={s.label}>{r.label}</span>
          <span style={s.value}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function LayersTab({ panelState, onToggleLayer }: { panelState: PanelState; onToggleLayer: (id: keyof PanelState) => void }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: '#6b6b6b', letterSpacing: '.06em', marginBottom: 12 }}>
        Toggle map data layers on or off.
      </div>
      {LAYER_IDS.map(l => (
        <div key={l.id} style={{ ...s.row, gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#e8e8e8', letterSpacing: '.08em' }}>{l.label}</div>
            <div style={{ fontSize: 8, color: '#3a3a3a', letterSpacing: '.04em', marginTop: 1 }}>{l.desc}</div>
          </div>
          <Toggle on={panelState[l.id]} onToggle={() => onToggleLayer(l.id)} />
        </div>
      ))}
    </div>
  )
}

function DataSourcesTab() {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div>
      <div style={{ fontSize: 8, color: '#6b6b6b', letterSpacing: '.06em', marginBottom: 12 }}>
        All collection is client-side via public OSINT APIs. No data is retained or transmitted externally.
      </div>
      {DATA_SOURCES.map(cat => (
        <div key={cat.category} style={{ marginBottom: 2 }}>
          <button
            onClick={() => setExpanded(expanded === cat.category ? null : cat.category)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: '1px solid #1e1e1e',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '.1em', color: '#e8e8e8' }}>{cat.category}</span>
            <span style={{ fontSize: 8, color: '#3a3a3a' }}>{cat.items.length} source{cat.items.length > 1 ? 's' : ''}</span>
          </button>
          {expanded === cat.category && (
            <div style={{ padding: '4px 0 8px' }}>
              {cat.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 160px 1fr', gap: 8, padding: '5px 0', borderBottom: '1px solid #111111' }}>
                  <span style={{ fontSize: 8, color: '#e8e8e8', letterSpacing: '.04em' }}>{item.label}</span>
                  <span style={{ fontSize: 8, color: '#6b6b6b', letterSpacing: '.03em' }}>{item.source}</span>
                  <span style={{ fontSize: 7, color: '#3a3a3a', letterSpacing: '.03em', lineHeight: 1.5 }}>{item.notes}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ApiKeysTab() {
  return (
    <div>
      <div style={{ fontSize: 8, color: '#6b6b6b', letterSpacing: '.06em', marginBottom: 12 }}>
        API keys are stored in .env file. Restart the dev server after changes.
      </div>
      {API_KEYS.map(k => {
        const val = (import.meta as any).env?.[k.key]
        const isSet = !!val
        return (
          <div key={k.key} style={{ ...s.row, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: '#e8e8e8', letterSpacing: '.06em' }}>{k.label}</span>
                {k.required && <span style={{ fontSize: 7, color: '#ff3344', letterSpacing: '.08em' }}>REQUIRED</span>}
              </div>
              <div style={{ fontSize: 7, color: '#3a3a3a', letterSpacing: '.04em', marginTop: 1 }}>{k.desc}</div>
              <div style={{ fontSize: 7, color: '#3a3a3a', letterSpacing: '.02em', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>{k.key}</div>
            </div>
            <span style={{ fontSize: 8, fontFamily: 'JetBrains Mono, monospace', color: isSet ? '#00ff88' : '#3a3a3a', letterSpacing: '.08em' }}>
              {isSet ? 'SET' : 'NOT SET'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function DisplayTab() {
  return (
    <div>
      <div style={s.sectionTitle}>TYPOGRAPHY</div>
      <div style={s.row}>
        <span style={s.label}>UI font</span>
        <span style={s.value}>Inter 400</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>Data font</span>
        <span style={s.value}>JetBrains Mono</span>
      </div>

      <div style={s.sectionTitle}>COLORS</div>
      {[
        { label: 'Background', value: '#0a0a0a' },
        { label: 'Surface', value: '#111111' },
        { label: 'Border', value: '#1e1e1e' },
        { label: 'Text primary', value: '#e8e8e8' },
        { label: 'Text secondary', value: '#6b6b6b' },
        { label: 'Accent', value: '#00ff88' },
      ].map(c => (
        <div key={c.label} style={s.row}>
          <span style={s.label}>{c.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, background: c.value, border: '1px solid #1e1e1e' }} />
            <span style={{ ...s.value, fontSize: 8 }}>{c.value}</span>
          </div>
        </div>
      ))}

      <div style={s.sectionTitle}>LAYOUT</div>
      <div style={s.row}>
        <span style={s.label}>Command panel</span>
        <span style={s.value}>Right side, resizable</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>Observe tray</span>
        <span style={s.value}>Bottom, 6 slots, resizable</span>
      </div>
    </div>
  )
}

function AboutTab() {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.14em', color: '#e8e8e8', marginBottom: 4 }}>
        WORLDVIEW
      </div>
      <div style={{ fontSize: 8, color: '#6b6b6b', letterSpacing: '.08em', marginBottom: 16 }}>
        GLOBAL SITUATIONAL AWARENESS PLATFORM
      </div>

      <div style={s.row}>
        <span style={s.label}>Stack</span>
        <span style={s.value}>Vite + React 18 + TypeScript + Tailwind</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>Map engine</span>
        <span style={s.value}>Mapbox GL v3</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>AI backend</span>
        <span style={s.value}>OpenRouter (free tier)</span>
      </div>

      <div style={{ marginTop: 16, fontSize: 8, color: '#3a3a3a', letterSpacing: '.04em', lineHeight: 1.7 }}>
        All collection is client-side via public OSINT APIs. No data is retained or transmitted to external servers beyond the API providers listed in Data Sources. Market feeds carry up to 15 min delay. ADS-B positions update every ~10s.
      </div>
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 32, height: 14, padding: 0,
        background: on ? '#111111' : '#0a0a0a',
        border: `1px solid ${on ? '#00ff88' : '#1e1e1e'}`,
        cursor: 'pointer', position: 'relative',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 8, height: 8, position: 'absolute', top: 2,
        left: on ? 20 : 2,
        background: on ? '#00ff88' : '#3a3a3a',
        transition: 'left 0.1s, background 0.1s',
      }} />
    </button>
  )
}
