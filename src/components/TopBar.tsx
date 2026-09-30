import { useState, useRef, useEffect } from 'react'
import { Search, X, RefreshCw, Globe2 } from 'lucide-react'
import type { MapViewMode, CrisisEvent } from '../types'
import OSINTSearch from './OSINTSearch'

const VIEW_MODES: { id: MapViewMode; label: string }[] = [
  { id: 'earth',       label: 'EARTH' },
  { id: 'dark',        label: 'DARK' },
  { id: 'satellite',   label: 'SAT' },
  { id: 'standard',    label: 'STD' },
  { id: 'city3d',      label: '3D' },
  { id: 'nightvision', label: 'NV' },
  { id: 'bw',          label: 'BW' },
  { id: 'infrared',    label: 'IR' },
  { id: 'snow',        label: 'SNOW' },
  { id: 'thermal',     label: 'HEAT' },
]

function computeThreatLevel(crises: CrisisEvent[]): { level: number; label: string; color: string; soft: string } {
  const critical = crises.filter((c) => c.severity === 'critical').length
  const high     = crises.filter((c) => c.severity === 'high').length
  const score    = critical * 4 + high * 2 + crises.length
  if (score > 500) return { level: 1, label: 'CRITICAL', color: 'var(--red)',   soft: 'var(--red-soft)' }
  if (score > 250) return { level: 2, label: 'ELEVATED', color: 'var(--red)',   soft: 'var(--red-soft)' }
  if (score > 100) return { level: 3, label: 'HIGH',     color: 'var(--amber)', soft: 'var(--amber-soft)' }
  if (score > 40)  return { level: 4, label: 'MODERATE', color: 'var(--amber)', soft: 'var(--amber-soft)' }
  return               { level: 5, label: 'NORMAL',   color: 'var(--green)', soft: 'var(--green-soft)' }
}

interface Props {
  viewMode: MapViewMode
  onViewMode: (m: MapViewMode) => void
  flightCount: number
  crises: CrisisEvent[]
  searchQuery: string
  onSearch: (q: string) => void
  onSettingsOpen?: () => void
  onReloadAll?: () => void
  reloading?: boolean
}

export default function TopBar({ viewMode, onViewMode, flightCount, crises, searchQuery, onSearch, onSettingsOpen, onReloadAll, reloading }: Props) {
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const threat = computeThreatLevel(crises)
  const now = new Date()
  const utc = now.toUTCString().replace(/ GMT$/, '').split(' ').slice(1, 5).join(' ')

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onSearch(''); setExpanded(false) }
    if (e.key === 'Enter')  { setExpanded(false) }
  }

  function clearSearch() { onSearch(''); setExpanded(false) }

  return (
    <div className="topbar" style={{ height: 52 }}>
      {/* left: branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg,#e2bb78,#bd8747)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Globe2 size={15} color="#111820" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.02em', color: 'var(--text1)', lineHeight: 1.1, fontFamily: 'Inter, -apple-system, sans-serif' }}>
              WORLDVIEW
            </div>
            <div style={{ fontSize: 8.5, letterSpacing: '.06em', color: 'var(--text3)', lineHeight: 1.3, fontFamily: 'Inter, -apple-system, sans-serif' }}>
              GLOBAL INTELLIGENCE
            </div>
          </div>
        </div>

        <span className="live-badge">LIVE</span>

        <OSINTSearch />
      </div>

      <div className="hud-sep" />

      {/* center: stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, justifyContent: 'center' }}>
        <HudStat label="TRACKED" value={flightCount} />

        <div className="hud-sep" />

        <HudStat label="INCIDENTS" value={crises.length} />

        <div className="hud-sep" />

        {/* threat level */}
        <div className="defcon-badge" style={{ color: threat.color, borderColor: threat.color, background: threat.soft }}>
          <span style={{ fontSize: 8, color: 'var(--text3)' }}>DEFCON</span>
          <span>{threat.level}</span>
          <span style={{ fontSize: 9 }}>{threat.label}</span>
        </div>

        <div className="hud-sep" />

        {/* UTC clock */}
        <div style={{ fontSize: 10, color: 'var(--text2)', letterSpacing: '.02em', fontVariantNumeric: 'tabular-nums', fontFamily: 'IBM Plex Mono, monospace' }}>
          <span style={{ color: 'var(--text3)', marginRight: 5 }}>UTC</span>
          {utc}
        </div>
      </div>

      <div className="hud-sep" />

      {/* right: view modes + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--surface2)', borderRadius: 'var(--r-md)', padding: 2 }}>
          {VIEW_MODES.map(({ id, label }) => (
            <button
              key={id}
              title={id}
              onClick={() => onViewMode(id)}
              className={`vm-btn${viewMode === id ? ' active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="hud-sep" />

        {/* search */}
        <div className="search-wrap" style={{ minWidth: expanded ? 180 : 'auto' }}>
          <Search size={13} style={{ color: searchQuery ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }} />
          {expanded ? (
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={e => onSearch(e.target.value)}
              onKeyDown={handleKey}
              onBlur={() => { if (!searchQuery) setExpanded(false) }}
              placeholder="location, coordinates..."
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 11, color: 'var(--text1)', fontFamily: 'Inter, -apple-system, sans-serif',
                minWidth: 130,
              }}
            />
          ) : (
            <button
              onClick={() => setExpanded(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 11, padding: 0, fontFamily: 'Inter, -apple-system, sans-serif' }}
            >
              {searchQuery || 'Locate'}
            </button>
          )}
          {searchQuery && (
            <button onClick={clearSearch}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)' }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="hud-sep" />

        <button
          onClick={onReloadAll}
          disabled={reloading}
          title="Reload all data"
          className="cy-btn"
          style={{ color: reloading ? 'var(--accent)' : 'var(--text2)' }}
        >
          <RefreshCw size={11} className={reloading ? 'animate-spin' : ''} />
          Reload
        </button>

        <button
          onClick={onSettingsOpen}
          title="Settings"
          className="cy-btn"
        >
          Settings
        </button>
      </div>
    </div>
  )
}

function HudStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'IBM Plex Mono, monospace' }}>
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: '.08em', color: 'var(--text3)', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        {label}
      </span>
    </div>
  )
}
