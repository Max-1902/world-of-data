import { useState } from 'react'

interface Section {
  title: string
  color: string
  rows: { label: string; source: string; notes: string }[]
}

const SECTIONS: Section[] = [
  {
    title: 'AIR DOMAIN',
    color: '#00ff88',
    rows: [
      { label: 'ADS-B positions', source: 'OpenSky Network', notes: 'Real-time transponder data from 5000+ ground stations, ~10s latency. OAuth2 authenticated. Airborne only.' },
      { label: 'Flight types', source: 'ICAO prefix / callsign heuristics', notes: 'PAX = airline patterns (e.g. DLH, BAW), MIL = ICAO military prefixes, CGO = cargo airlines, PVT = others.' },
    ],
  },
  {
    title: 'CONFLICT & SECURITY',
    color: '#ff1a3e',
    rows: [
      { label: 'Live conflict events', source: 'ACLED (Armed Conflict Location & Event Data)', notes: 'Georeferenced political violence events updated weekly. Covers 230+ countries.' },
      { label: 'Crisis monitoring', source: 'International Crisis Group — CrisisWatch', notes: '70+ country monthly conflict tracker. Trend detection via RSS feeds (crisisgroup.org).' },
    ],
  },
  {
    title: 'NETWORK INFRASTRUCTURE',
    color: '#ffcc00',
    rows: [
      { label: 'Outage alerts', source: 'IODA — Internet Outage Detection and Analysis (Georgia Tech)', notes: 'BGP routing, Active Probing, and UCSD Network Telescope signals. /outages/alerts endpoint, 24h lookback. No auth required.' },
      { label: 'Severity score', source: 'Computed', notes: '% drop from historical baseline × severity multiplier (critical=5, warning=2). Higher = worse outage.' },
    ],
  },
  {
    title: 'OPEN-SOURCE SIGNALS',
    color: '#aa44ff',
    rows: [
      { label: 'Global articles', source: 'GDELT Project v2 Doc API', notes: '65k+ global sources, near real-time. English-language filter applied (sourcelang:english). Free, no auth.' },
      { label: 'World news', source: 'BBC, Reuters, DW, Al Jazeera, France 24 (RSS)', notes: 'Major international English-language broadcasters via RSS proxy (rss2json.com).' },
      { label: 'Premium news', source: 'NewsAPI, The Guardian, New York Times', notes: 'Requires API keys in .env. English-only. Falls back silently if keys absent.' },
    ],
  },
  {
    title: 'FINANCIAL INDICATORS',
    color: '#00ff88',
    rows: [
      { label: 'Equities / ETFs / Crypto / Forex / Bonds', source: 'Yahoo Finance (unofficial API)', notes: 'Real-time quotes via query2.finance.yahoo.com. Tickers: SPY, QQQ, DIA, IWM, EEM, VGK + sector ETFs, BTC-USD, EURUSD=X, ^TNX, etc. ~15 min delay for equities.' },
    ],
  },
  {
    title: 'GEOSPATIAL',
    color: '#4da6ff',
    rows: [
      { label: 'Satellite basemap', source: 'Mapbox — satellite-streets-v12', notes: 'Globe projection, 3D terrain enabled. Requires VITE_MAPBOX_TOKEN.' },
      { label: 'Address / place lookup', source: 'Mapbox Geocoding API', notes: 'Supports countries, regions, places, addresses, POIs, postcodes. Fly-to animation on search.' },
      { label: 'Conflict map overlay', source: 'DeepStateMap (deepstatemap.live)', notes: 'Ukraine frontline overlay — iframe embed, togglable.' },
    ],
  },
  {
    title: 'THREAT ASSESSMENT',
    color: '#ff6600',
    rows: [
      { label: 'Country risk scores', source: 'Derived from ACLED event density + recency', notes: 'Conflicts aggregated by country, scored by count and recency. Normalized 0–100.' },
      { label: 'Global threat index', source: 'Computed composite', notes: 'Weighted average of active conflicts, internet outages, and high-severity news mentions.' },
    ],
  },
  {
    title: 'ENERGY RESOURCES',
    color: '#ff8800',
    rows: [
      { label: 'Oil reserves by country', source: 'EIA / OPEC / BP Statistical Review 2023', notes: 'Proven crude oil reserves in billion barrels (Gbbl). 98 countries mapped. 3D extruded bars on globe.' },
      { label: 'Gas reserves by country', source: 'EIA / BP Statistical Review 2023', notes: 'Proven natural gas reserves in trillion cubic metres (Tcm). Full global coverage.' },
      { label: 'Oil production', source: 'EIA / OPEC Monthly Oil Market Report', notes: 'Daily crude production in million bbl/day. Includes OPEC and non-OPEC producers.' },
      { label: 'Gas production', source: 'EIA / IEA Gas Market Report', notes: 'Annual natural gas output in billion m³/year. Covers all producing nations.' },
    ],
  },
  {
    title: 'GPS INTERFERENCE',
    color: '#ff2244',
    rows: [
      { label: 'Jamming zones', source: 'Eurocontrol / OPSGROUP / NATO NOTAMs', notes: 'Known persistent GPS denial zones. Heatmap + radius circles. 35+ zones globally.' },
      { label: 'Spoofing zones', source: 'C4ADS "Above Us Only Stars" / US MARAD', notes: 'Areas where GPS positions are falsified. Aircraft/ships report incorrect coordinates.' },
      { label: 'Severity levels', source: 'Computed from ADS-B accuracy reports', notes: 'High (>10% interference), Medium (2-10%), Low (<2%). Color-coded red/orange/yellow.' },
    ],
  },
]

export default function InfoModal() {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        title="Data sources & methodology"
        style={{
          position: 'absolute', bottom: 32, right: 10, zIndex: 40,
          width: 26, height: 26,
          background: 'rgba(8,14,10,0.92)',
          border: '1px solid rgba(0,255,136,0.2)',
          color: 'rgba(0,255,136,0.7)',
          fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
          transition: 'all .15s',
          lineHeight: 1,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.background = 'rgba(0,255,136,0.1)'
          el.style.borderColor = 'rgba(0,255,136,0.5)'
          el.style.color = '#00ff88'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.background = 'rgba(8,14,10,0.92)'
          el.style.borderColor = 'rgba(0,255,136,0.2)'
          el.style.color = 'rgba(0,255,136,0.7)'
        }}
      >?</button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 700, maxWidth: '95vw', maxHeight: '85vh',
              background: 'rgba(8,14,10,0.98)',
              border: '1px solid rgba(0,255,136,0.2)',
              borderTop: '2px solid rgba(0,255,136,0.4)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 80px rgba(0,0,0,0.9)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', padding: '10px 16px',
              borderBottom: '1px solid #141e16',
              background: 'linear-gradient(90deg, rgba(0,255,136,0.06) 0%, transparent 60%)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#00ff88', letterSpacing: '.15em', textTransform: 'uppercase' }}>
                  SOURCE REGISTRY
                </div>
                <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.1em', marginTop: 2 }}>
                  DATA FEEDS — COLLECTION METHODS — ATTRIBUTION
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', fontSize: 18, lineHeight: 1, transition: 'color .12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff1a3e' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2a3e2e' }}
              >×</button>
            </div>

            {/* Section tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #141e16', overflowX: 'auto', flexShrink: 0 }}>
              <button
                onClick={() => setActiveSection(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '7px 12px',
                  fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap',
                  color: activeSection === null ? '#00ff88' : '#2a3e2e',
                  borderBottom: activeSection === null ? '1px solid #00ff88' : '1px solid transparent',
                  transition: 'color .12s',
                }}
              >ALL</button>
              {SECTIONS.map(s => (
                <button
                  key={s.title}
                  onClick={() => setActiveSection(s.title === activeSection ? null : s.title)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '7px 12px',
                    fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap',
                    color: activeSection === s.title ? s.color : '#2a3e2e',
                    borderBottom: activeSection === s.title ? `1px solid ${s.color}` : '1px solid transparent',
                    transition: 'color .12s',
                  }}
                >{s.title}</button>
              ))}
            </div>

            {/* Content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
              {(activeSection ? SECTIONS.filter(s => s.title === activeSection) : SECTIONS).map(section => (
                <div key={section.title} style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase',
                    color: section.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{ height: 1, width: 20, background: section.color, opacity: 0.4 }} />
                    {section.title}
                    <div style={{ height: 1, flex: 1, background: section.color, opacity: 0.1 }} />
                  </div>
                  {section.rows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid', gridTemplateColumns: '160px 160px 1fr',
                        gap: 12, padding: '7px 0',
                        borderBottom: '1px solid #0d120e',
                        alignItems: 'start',
                      }}
                    >
                      <div style={{ fontSize: 9, color: '#8aac90', fontWeight: 600, letterSpacing: '.04em' }}>{row.label}</div>
                      <div style={{ fontSize: 9, color: section.color, opacity: 0.85, letterSpacing: '.03em' }}>{row.source}</div>
                      <div style={{ fontSize: 8, color: '#4a6a50', letterSpacing: '.03em', lineHeight: 1.5 }}>{row.notes}</div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Footer */}
              <div style={{
                marginTop: 12, padding: '10px 0', borderTop: '1px solid #0d120e',
                fontSize: 7.5, color: '#1a2535', letterSpacing: '.08em', lineHeight: 1.6,
              }}>
                All collection is client-side via public OSINT APIs. No data is retained or transmitted externally.
                Market feeds carry up to 15 min delay. ADS-B positions update every ~10s.
                Signal and connectivity feeds auto-refresh at 5–30 min intervals.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
