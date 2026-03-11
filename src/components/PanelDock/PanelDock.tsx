import { useState, useRef, useEffect } from 'react'
import type { CrisisEvent, PanelState, Flight } from '../../types'
import { PanelContent, PANEL_META, type PanelId } from '../panels/PanelContent'

/* ── Panel groups — logical categories ─────────────────────────────────────── */
const GROUPS: { id: string; label: string; panels: PanelId[] }[] = [
  {
    id: 'intel',
    label: 'INTEL',
    panels: ['crisiswatch', 'intel', 'risk', 'threat', 'brief', 'news', 'outages'],
  },
  {
    id: 'geo',
    label: 'GEO',
    panels: ['humanitarian', 'drugs', 'sanctions', 'layers'],
  },
  {
    id: 'mil',
    label: 'MIL',
    panels: ['military', 'nuclear', 'airspace', 'cnn'],
  },
  {
    id: 'markets',
    label: 'FIN',
    panels: ['markets'],
  },
  {
    id: 'ai',
    label: 'AI',
    panels: ['analyst'],
  },
]

interface Props {
  crises: CrisisEvent[]
  flights: Flight[]
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
  onGeoSearch?: (q: string) => void
  onCountryClick?: (country: string) => void
  poppedOut: Set<string>
  onPopOut: (id: string) => void
  onPopIn:  (id: string) => void
}

const MIN_W = 280
const LS_KEY_WIDTH  = 'ws-right-width'
const LS_KEY_GROUP  = 'ws-dock-group'
const LS_KEY_SPLITS = 'ws-dock-splits'

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(LS_KEY_WIDTH)
    if (raw) { const w = Number(raw); if (w >= MIN_W) return w }
  } catch {}
  return Math.round(window.innerWidth * 0.28)
}

function loadGroup(): string {
  try { return localStorage.getItem(LS_KEY_GROUP) || 'intel' } catch { return 'intel' }
}

function loadSplits(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_KEY_SPLITS)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export default function PanelDock({ crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, onGeoSearch, onCountryClick, poppedOut }: Props) {
  const [panelW, setPanelW] = useState(loadWidth)
  const [activeGroup, setActiveGroup] = useState(loadGroup)
  const [panelSplits, setPanelSplits] = useState<Record<string, number>>(loadSplits)
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null)

  const group = GROUPS.find(g => g.id === activeGroup) || GROUPS[0]
  const visiblePanels = group.panels.filter(id => !poppedOut.has(id))

  // Resize dock width
  function onResizeDown(e: React.MouseEvent) {
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startW: panelW }
    const onMove = (me: MouseEvent) => {
      if (!resizeRef.current) return
      const { startX, startW } = resizeRef.current
      const maxW = Math.round(window.innerWidth * 0.55)
      setPanelW(Math.min(maxW, Math.max(MIN_W, startW + (startX - me.clientX))))
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Vertical divider drag between panels
  function onSplitDown(e: React.MouseEvent, idx: number, containerEl: HTMLElement) {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerEl.getBoundingClientRect()
    const n = visiblePanels.length
    const onMove = (me: MouseEvent) => {
      const frac = (me.clientY - rect.top) / rect.height
      const minFrac = (idx + 1) * 0.08
      const maxFrac = 1 - (n - idx - 1) * 0.08
      const clamped = Math.min(maxFrac, Math.max(minFrac, frac))
      setPanelSplits(prev => ({ ...prev, [`${activeGroup}-${idx}`]: clamped }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Compute flex values
  function getPanelFlexes(): number[] {
    const n = visiblePanels.length
    if (n <= 1) return [1]
    const cumFracs: number[] = []
    for (let i = 0; i < n - 1; i++) {
      cumFracs.push(panelSplits[`${activeGroup}-${i}`] ?? (i + 1) / n)
    }
    const flexes: number[] = []
    for (let i = 0; i < n; i++) {
      const start = i === 0 ? 0 : cumFracs[i - 1]
      const end = i === n - 1 ? 1 : cumFracs[i]
      flexes.push(Math.max(0.05, end - start))
    }
    return flexes
  }

  useEffect(() => { try { localStorage.setItem(LS_KEY_WIDTH, String(panelW)) } catch {} }, [panelW])
  useEffect(() => { try { localStorage.setItem(LS_KEY_GROUP, activeGroup) } catch {} }, [activeGroup])
  useEffect(() => { try { localStorage.setItem(LS_KEY_SPLITS, JSON.stringify(panelSplits)) } catch {} }, [panelSplits])

  const contentProps = { crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, onGeoSearch, onCountryClick }
  const flexes = getPanelFlexes()

  return (
    <div
      className="right-panel"
      style={{
        width: panelW,
        minWidth: MIN_W,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        borderLeft: '1px solid #1e1e1e',
        background: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      {/* resize handle */}
      <div
        onMouseDown={onResizeDown}
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
          cursor: 'ew-resize', zIndex: 40,
        }}
      />

      {/* group tabs */}
      <div style={{
        height: 26, flexShrink: 0,
        display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid #1e1e1e',
        background: '#0a0a0a',
        overflow: 'hidden',
      }}>
        {GROUPS.map(g => {
          const isActive = g.id === activeGroup
          const count = g.panels.filter(id => !poppedOut.has(id)).length
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              style={{
                flex: '1 1 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                background: isActive ? '#111111' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '1px solid #00ff88' : '1px solid transparent',
                borderRight: '1px solid #1e1e1e',
                cursor: 'pointer',
                padding: '0 2px',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#0d0d0d' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <span style={{
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: 8, fontWeight: 500, letterSpacing: '.1em',
                color: isActive ? '#e8e8e8' : '#3a3a3a',
              }}>
                {g.label}
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 7, color: isActive ? '#6b6b6b' : '#2a2a2a',
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* panels container */}
      <div
        className="dock-panels-container"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}
      >
        {visiblePanels.map((panelId, i) => {
          const meta = PANEL_META[panelId]
          const flex = flexes[i] ?? 1
          return (
            <div
              key={panelId}
              className="dock-panel"
              style={{
                flex: `${flex} 1 0%`,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                borderBottom: '1px solid #1e1e1e',
                overflow: 'hidden',
              }}
            >
              <div
                className="dock-header"
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('panelId', panelId)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                style={{ cursor: 'grab' }}
              >
                <span style={{ fontSize: 8, color: '#3a3a3a', marginRight: 2 }}>::</span>
                {meta.dotColor && <span className={`live-dot ${meta.dotColor}`} />}
                <span className="panel-title" style={{ flex: 1 }}>{meta.title}</span>
              </div>

              <div className="dock-body" style={{ flex: 1, minHeight: 0, maxHeight: 'none', overflow: 'auto' }}>
                <PanelContent id={panelId} {...contentProps} />
              </div>
            </div>
          )
        })}

        {/* Resize dividers between panels */}
        {visiblePanels.length > 1 && (() => {
          const cumFlexes: number[] = []
          let sum = 0
          for (let i = 0; i < flexes.length; i++) {
            sum += flexes[i]
            cumFlexes.push(sum)
          }
          const total = sum
          return visiblePanels.slice(0, -1).map((_pid, i) => (
            <div
              key={`split-${i}`}
              onMouseDown={e => {
                const container = e.currentTarget.parentElement
                if (container) onSplitDown(e, i, container)
              }}
              style={{
                position: 'absolute',
                top: `calc(${(cumFlexes[i] / total) * 100}% - 2px)`,
                left: 0, right: 0, height: 5,
                cursor: 'ns-resize', zIndex: 10,
              }}
            />
          ))
        })()}

        {visiblePanels.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 6,
          }}>
            <span style={{ fontSize: 8, color: '#3a3a3a', letterSpacing: '.12em' }}>
              NO PANELS VISIBLE
            </span>
            <span style={{ fontSize: 7, color: '#2a2a2a', fontFamily: 'JetBrains Mono, monospace' }}>
              drag from observe tray to restore
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
