import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
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

function computeThreatLevel(crises: CrisisEvent[]): { level: number; label: string; color: string } {
  const critical = crises.filter((c) => c.severity === 'critical').length
  const high     = crises.filter((c) => c.severity === 'high').length
  const score    = critical * 4 + high * 2 + crises.length
  if (score > 500) return { level: 1, label: 'CRITICAL', color: '#ff0022' }
  if (score > 250) return { level: 2, label: 'ELEVATED', color: '#ff4400' }
  if (score > 100) return { level: 3, label: 'HIGH',     color: '#ff8800' }
  if (score > 40)  return { level: 4, label: 'MODERATE', color: '#ffcc00' }
  return               { level: 5, label: 'NORMAL',   color: '#00ff88' }
}

interface Props {
  viewMode: MapViewMode
  onViewMode: (m: MapViewMode) => void
  flightCount: number
  crises: CrisisEvent[]
  searchQuery: string
  onSearch: (q: string) => void
  onSettingsOpen?: () => void
}

export default function TopBar({ viewMode, onViewMode, flightCount, crises, searchQuery, onSearch, onSettingsOpen }: Props) {
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
    <div className="topbar" style={{ height: 32 }}>
      {/* left: branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ borderLeft: '2px solid #1e1e1e', paddingLeft: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.2em', color: '#e8e8e8', lineHeight: 1, fontFamily: 'Inter, -apple-system, sans-serif' }}>
            WORLDVIEW
          </div>
          <div style={{ fontSize: 7, letterSpacing: '.12em', color: '#6b6b6b', lineHeight: 1.3, fontFamily: 'Inter, -apple-system, sans-serif' }}>
            SITUATIONAL AWARENESS
          </div>
        </div>

        <span style={{ fontSize: 8, fontWeight: 400, letterSpacing: '.1em', color: '#00ff88', fontFamily: 'JetBrains Mono, monospace' }}>
          LIVE
        </span>

        <OSINTSearch />
      </div>

      <div className="hud-sep" />

      {/* center: stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, justifyContent: 'center' }}>
        <HudStat label="TRACKED" value={flightCount} />

        <div className="hud-sep" />

        <HudStat label="INCIDENTS" value={crises.length} />

        <div className="hud-sep" />

        {/* threat level */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '1px 8px',
          border: '1px solid #1e1e1e',
          fontSize: 9, letterSpacing: '.08em',
          fontFamily: 'JetBrains Mono, monospace',
          color: threat.color,
        }}>
          <span style={{ fontSize: 7, color: '#6b6b6b' }}>DEFCON</span>
          <span>{threat.level}</span>
          <span style={{ fontSize: 8 }}>{threat.label}</span>
        </div>

        <div className="hud-sep" />

        {/* UTC clock */}
        <div style={{ fontSize: 9, color: '#6b6b6b', letterSpacing: '.04em', fontVariantNumeric: 'tabular-nums', fontFamily: 'JetBrains Mono, monospace' }}>
          <span style={{ color: '#3a3a3a', marginRight: 4 }}>UTC</span>
          {utc}
        </div>
      </div>

      <div className="hud-sep" />

      {/* right: view modes + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid #1e1e1e', padding: 1 }}>
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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          border: `1px solid ${expanded || searchQuery ? '#1e1e1e' : '#1e1e1e'}`,
          padding: '2px 6px',
          minWidth: expanded ? 160 : 'auto',
        }}>
          <Search size={9} style={{ color: searchQuery ? '#00ff88' : '#6b6b6b', flexShrink: 0 }} />
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
                fontSize: 9, color: '#e8e8e8', fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '.04em', minWidth: 120,
              }}
            />
          ) : (
            <button
              onClick={() => setExpanded(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6b6b', fontSize: 9, letterSpacing: '.08em', padding: 0, fontFamily: 'Inter, -apple-system, sans-serif' }}
            >
              {searchQuery || 'LOCATE'}
            </button>
          )}
          {searchQuery && (
            <button onClick={clearSearch}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6b6b', display: 'flex', padding: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff3344' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b6b6b' }}
            >
              <X size={9} />
            </button>
          )}
        </div>

        <div className="hud-sep" />

        <button
          onClick={onSettingsOpen}
          title="Settings"
          style={{
            background: 'none', border: '1px solid #1e1e1e', cursor: 'pointer',
            color: '#6b6b6b', fontSize: 9, padding: '2px 8px',
            fontFamily: 'Inter, -apple-system, sans-serif', letterSpacing: '.08em',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e8e8e8' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b6b6b' }}
        >
          SETTINGS
        </button>
      </div>
    </div>
  )
}

function HudStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#e8e8e8', lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'JetBrains Mono, monospace' }}>
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 7, fontWeight: 400, letterSpacing: '.14em', color: '#3a3a3a', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        {label}
      </span>
    </div>
  )
}
