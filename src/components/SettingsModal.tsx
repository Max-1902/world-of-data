import { sortByLayerSections } from '../utils/layerSections'
import { useState } from 'react'
import { X } from 'lucide-react'
import type { MapViewMode, PanelState } from '../types'
import { LAYER_IDS, VIEW_MODES } from './layerCatalogue'

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
    category: 'DISASTERS',
    items: [
      { label: 'Disaster alerts', source: 'GDACS (EU JRC / UN OCHA)', notes: 'Orange/Red quake, cyclone, flood, volcano, drought and wildfire alerts. Free, no key.' },
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
      { label: 'Keyword search', source: 'Google News', notes: 'No key. Searches Reuters, AP, BBC, Guardian and more.' },
      { label: 'Premium feeds', source: 'NewsAPI, NYT', notes: 'Requires API keys. Optional.' },
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
      { label: 'Interference cells', source: 'GPSJAM.org (airplanes.live, ADS-B Exchange)', notes: 'Daily ADS-B aggregate, shown for the latest published UTC day. Share of aircraft reporting degraded GPS accuracy per ~22 km hex.' },
    ],
  },
  {
    category: 'INFRASTRUCTURE',
    items: [
      { label: 'Military bases', source: 'Open-source geolocation databases', notes: 'Known military installations worldwide.' },
      { label: 'Nuclear facilities', source: 'IAEA PRIS / open sources', notes: 'Power plants, research reactors.' },
      { label: 'Energy infrastructure', source: 'EIA / OPEC / BP Statistical Review', notes: 'Oil/gas reserves and production.' },
      { label: 'Oil & gas pipelines', source: 'OpenStreetMap contributors (ODbL) via Overpass', notes: 'Real route geometry: world snapshot of long-distance lines, live per-segment detail when zoomed in.' },
      { label: 'Live cameras', source: 'SkylineWebcams', notes: '190+ cameras across 75+ countries.' },
      { label: 'Shipping', source: 'NOAA / NCEAS / ICOADS via Resource Watch (com.012)', notes: 'Oct 2004–Oct 2005 position reports from 3,374 voluntary-observing ships (~11% of ships at sea). Historical, not live; busy lanes under-counted. Free, keyless; RW lists license as "Restrictions Apply".' },
    ],
  },
  {
    category: 'AI ANALYSIS',
    items: [
      { label: 'LLM analyst', source: 'OpenRouter (free tier)', notes: 'Nemotron 30B, Trinity, Step Flash. Streaming.' },
    ],
  },
]

// Layer and view-mode catalogues live in layerCatalogue.ts so CommandPalette can use them without pulling
// this (lazy-loaded) modal into the main bundle.
export { LAYER_IDS, VIEW_MODES }

// Client-visible keys — Vite bundles these, so their status can be read directly.
// NOTE: each `isSet` is a static `import.meta.env.VITE_X` reference (not a dynamic
// `env[key]` lookup) so Vite's build-time replacement only inlines these specific
// booleans, not the entire .env object (a dynamic lookup would bundle every
// VITE_-prefixed value, including ones never meant to reach the client).
const CLIENT_API_KEYS = [
  { label: 'Mapbox', required: true, desc: 'Map rendering and geocoding', isSet: !!import.meta.env.VITE_MAPBOX_TOKEN },
  { label: 'NewsAPI', required: false, desc: 'General news search', isSet: !!import.meta.env.VITE_NEWSAPI_KEY },
  { label: 'AISStream', required: false, desc: 'Live vessel tracking (WebSocket)', isSet: !!import.meta.env.VITE_AISSTREAM_KEY },
]

// Server-only keys — held by api/*.ts serverless functions, never bundled into
// the client, so their configured status can't be checked from here.
const SERVER_API_KEYS = [
  { label: 'OpenRouter', desc: 'AI analyst (free tier available)' },
  { label: 'New York Times', desc: 'NYT article search' },
  { label: 'Finnhub', desc: 'Market data' },
  { label: 'ACLED', desc: 'Conflict event data (email + password)' },
  { label: 'OpenSky', desc: 'Live flight tracking (OAuth client credentials)' },
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
  reticleColor?: string
  onReticleColor?: (color: string) => void
}

const s = {
  label: { fontSize: 11, fontWeight: 500, color: 'var(--text2)' },
  value: { fontSize: 11, color: 'var(--text1)', fontFamily: 'Inter, -apple-system, sans-serif' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--text1)', textTransform: 'uppercase' as const, marginBottom: 10, marginTop: 20 },
}

export default function SettingsModal({ open, onClose, viewMode, onViewMode, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, reticleColor, onReticleColor }: Props) {
  const [tab, setTab] = useState<Tab>('GENERAL')

  if (!open) return null

  return (
    <div
      className="settings-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,18,25,0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        className="settings-dialog"
        onClick={e => e.stopPropagation()}
        style={{
          width: 720, maxWidth: '95vw', maxHeight: '85vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>
            Settings
          </span>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 4, borderRadius: 'var(--r-sm)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-soft)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          ><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto', padding: '0 10px', gap: 2 }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 12px',
                fontSize: 11, fontWeight: 600, letterSpacing: '.01em',
                color: tab === t ? 'var(--accent)' : 'var(--text2)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >{t}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
          {tab === 'GENERAL' && <GeneralTab viewMode={viewMode} onViewMode={onViewMode} deepstateMode={deepstateMode} onDeepstateToggle={onDeepstateToggle} />}
          {tab === 'LAYERS' && <LayersTab panelState={panelState} onToggleLayer={onToggleLayer} />}
          {tab === 'DATA SOURCES' && <DataSourcesTab />}
          {tab === 'API KEYS' && <ApiKeysTab />}
          {tab === 'DISPLAY' && <DisplayTab reticleColor={reticleColor} onReticleColor={onReticleColor} />}
          {tab === 'ABOUT' && <AboutTab />}
        </div>
      </div>
    </div>
  )
}

function GeneralTab({ viewMode, onViewMode, deepstateMode, onDeepstateToggle }: { viewMode: MapViewMode; onViewMode: (m: MapViewMode) => void; deepstateMode: boolean; onDeepstateToggle: () => void }) {
  return (
    <div>
      <div style={s.sectionTitle}>Map mode</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {VIEW_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => onViewMode(m.id)}
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 500,
              border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', cursor: 'pointer',
              background: viewMode === m.id ? 'var(--accent-soft)' : 'var(--surface2)',
              color: viewMode === m.id ? 'var(--accent)' : 'var(--text2)',
              borderColor: viewMode === m.id ? 'var(--accent)' : 'var(--border)',
            }}
          >{m.label}</button>
        ))}
      </div>

      <div style={s.sectionTitle}>Overlays</div>
      <div style={s.row}>
        <span style={s.label}>Ukraine frontline (DeepState)</span>
        <Toggle on={deepstateMode} onToggle={onDeepstateToggle} />
      </div>

      <div style={s.sectionTitle}>Refresh rates</div>
      {[
        { label: 'Flights (OpenSky)', value: '15s' },
        { label: 'Crises (ACLED)', value: '5 min' },
        { label: 'Market data', value: '60s' },
        { label: 'News feeds', value: 'On demand' },
        { label: 'Wildfires (FIRMS)', value: '5 min' },
        { label: 'Outages (IODA)', value: '5 min' },
        { label: 'Disaster alerts (GDACS)', value: '15 min' },
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
      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 12, marginBottom: 8 }}>
        Toggle map data layers on or off.
      </div>
      {sortByLayerSections(LAYER_IDS, l => l.id).map(l => (
        <div key={l.id} style={{ ...s.row, gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{l.label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>{l.desc}</div>
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
      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 12, marginBottom: 10 }}>
        All collection is client-side via public OSINT APIs. No data is retained or transmitted externally.
      </div>
      {DATA_SOURCES.map(cat => (
        <div key={cat.category} style={{ marginBottom: 2 }}>
          <button
            onClick={() => setExpanded(expanded === cat.category ? null : cat.category)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>{cat.category}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{cat.items.length} source{cat.items.length > 1 ? 's' : ''}</span>
          </button>
          {expanded === cat.category && (
            <div style={{ padding: '6px 4px 10px' }}>
              {cat.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 170px 1fr', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text1)' }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{item.source}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.5 }}>{item.notes}</span>
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
      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 12, marginBottom: 10 }}>
        Client-visible keys are stored in .env (VITE_ prefix). Server-only keys are
        held by the api/*.ts serverless functions and configured in your deploy
        host's environment variables — see .env.example.
      </div>
      {CLIENT_API_KEYS.map(k => (
        <div key={k.label} style={{ ...s.row, gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{k.label}</span>
              {k.required && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', background: 'var(--red-soft)', padding: '1px 6px', borderRadius: 'var(--r-pill)' }}>REQUIRED</span>}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>{k.desc}</div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
            color: k.isSet ? 'var(--green)' : 'var(--text3)',
            background: k.isSet ? 'var(--green-soft)' : 'var(--surface2)',
            padding: '3px 9px', borderRadius: 'var(--r-pill)',
          }}>
            {k.isSet ? 'SET' : 'NOT SET'}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.04em', marginTop: 16, marginBottom: 4 }}>
        SERVER-SIDE (status not visible to the client)
      </div>
      {SERVER_API_KEYS.map(k => (
        <div key={k.label} style={{ ...s.row, gap: 14 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{k.label}</span>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>{k.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const RETICLE_COLORS = [
  { id: '#16a34a', label: 'GREEN' },
  { id: '#dc2626', label: 'RED' },
  { id: '#2563eb', label: 'BLUE' },
]

function DisplayTab({ reticleColor, onReticleColor }: { reticleColor?: string; onReticleColor?: (c: string) => void }) {
  return (
    <div>
      <div style={s.sectionTitle}>Reticle</div>
      <div style={{ ...s.row, gap: 8 }}>
        <span style={s.label}>Color</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {RETICLE_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => onReticleColor?.(c.id)}
              style={{
                width: 56, height: 26,
                background: reticleColor === c.id ? c.id + '18' : 'var(--surface2)',
                border: `1px solid ${reticleColor === c.id ? c.id : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)',
                color: reticleColor === c.id ? c.id : 'var(--text2)',
                fontSize: 9, fontWeight: 600,
                letterSpacing: '.02em', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.id, flexShrink: 0 }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={s.sectionTitle}>Typography</div>
      <div style={s.row}>
        <span style={s.label}>UI font</span>
        <span style={s.value}>Inter</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>Data font</span>
        <span style={s.value}>Inter (tabular figures)</span>
      </div>

      <div style={s.sectionTitle}>Colors</div>
      {[
        { label: 'Background', token: '--bg' },
        { label: 'Surface', token: '--surface' },
        { label: 'Border', token: '--border' },
        { label: 'Text primary', token: '--text1' },
        { label: 'Text secondary', token: '--text2' },
        { label: 'Accent', token: '--accent' },
      ].map(c => (
        <div key={c.label} style={s.row}>
          <span style={s.label}>{c.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: 'var(--r-sm)', background: `var(${c.token})`, border: '1px solid var(--border)' }} />
            <span style={{ ...s.value, fontSize: 10.5 }}>{c.token}</span>
          </div>
        </div>
      ))}

      <div style={s.sectionTitle}>Layout</div>
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
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginTop: 12, marginBottom: 3 }}>
        MUNDUS DATORUM
      </div>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 18 }}>
        Live world monitor
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

      <div style={{ marginTop: 18, fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
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
        width: 38, height: 20, padding: 0,
        background: on ? 'var(--accent)' : 'var(--border-strong)',
        border: 'none', borderRadius: 'var(--r-pill)',
        cursor: 'pointer', position: 'relative',
        flexShrink: 0, transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 16, height: 16, position: 'absolute', top: 2,
        left: on ? 20 : 2,
        background: '#fff', borderRadius: '50%',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 0.15s',
      }} />
    </button>
  )
}
