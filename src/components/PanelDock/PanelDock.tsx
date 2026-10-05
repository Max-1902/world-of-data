import { useState, useRef, useEffect } from 'react'
import type { CrisisEvent, PanelState, Flight } from '../../types'
import { GROUP_ORDER, panelsForGroup } from '../../panels/registry'
import type { PanelGroup, PanelProps } from '../../panels/types'
import PanelHost from '../PanelHost'
import CloseButton from '../CloseButton'

interface Props {
  crises: CrisisEvent[]
  flights: Flight[]
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
  onGeoSearch?: (q: string) => void
  onCountryClick?: (country: string) => void
  searchQuery?: string
  poppedOut: Set<string>
  onPopOut: (id: string) => void
  onPopIn:  (id: string) => void
  activeGroup: PanelGroup
}

const MIN_W = 320
const LS_KEY_WIDTH  = 'ws-right-width'
const LS_KEY_HIDDEN = 'ws-hidden-panels'

function loadHidden(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY_HIDDEN) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])
  } catch { return new Set() }
}

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(LS_KEY_WIDTH)
    if (raw) { const w = Number(raw); if (w >= MIN_W) return w }
  } catch {}
  return Math.round(window.innerWidth * 0.28)
}

export default function PanelDock({ crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, onGeoSearch, onCountryClick, searchQuery, poppedOut, activeGroup }: Props) {
  const [panelW, setPanelW] = useState(loadWidth)
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null)
  // Panels the user closed with ✕; remembered across reloads and restorable from the workspace heading.
  const [hidden, setHidden] = useState<Set<string>>(loadHidden)

  // Derive visible panels from registry
  const groupPanels = panelsForGroup(activeGroup)
  const visibleDefs = groupPanels.filter(p => !poppedOut.has(p.id) && !hidden.has(p.id))
  const closedInGroup = groupPanels.filter(p => hidden.has(p.id))
  const groupLabel = GROUP_ORDER.find(group => group.id === activeGroup)?.label ?? activeGroup

  // Shared props for all panels
  const panelProps: PanelProps = { crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, onGeoSearch, onCountryClick, searchQuery }

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

  useEffect(() => { try { localStorage.setItem(LS_KEY_WIDTH, String(panelW)) } catch {} }, [panelW])
  useEffect(() => { try { localStorage.setItem(LS_KEY_HIDDEN, JSON.stringify([...hidden])) } catch {} }, [hidden])

  const closePanel = (id: string) => setHidden(prev => new Set(prev).add(id))
  const restoreGroup = () => setHidden(prev => {
    const next = new Set(prev)
    for (const p of closedInGroup) next.delete(p.id)
    return next
  })

  return (
    <div
      className="right-panel"
      style={{
        width: panelW, minWidth: MIN_W, height: '100%',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'relative', borderLeft: '1px solid var(--border)',
        background: 'var(--bg)', overflow: 'hidden',
      }}
    >
      {/* resize handle */}
      <div onMouseDown={onResizeDown} style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
        cursor: 'ew-resize', zIndex: 40,
      }} />

      {/* panels — scrollable, each with proper min-height */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="dock-workspace-heading">
          <div>
            <div className="dock-workspace-eyebrow">WORKSPACE</div>
            <div className="dock-workspace-title">{groupLabel}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {visibleDefs.length} {visibleDefs.length === 1 ? 'panel' : 'panels'}
            {closedInGroup.length > 0 && (
              <button className="dock-restore" onClick={restoreGroup} title="Show the panels you closed in this workspace">
                Restore {closedInGroup.length} closed
              </button>
            )}
          </span>
        </div>
        {visibleDefs.map((def) => {
          // Give each panel a sensible min-height based on type
          const isAI = def.id === 'analyst'
          const isLarge = isAI || def.id === 'markets' || def.id === 'humanitarian'
          const minH = isAI ? 900 : isLarge ? 800 : 700
          return (
            <div
              key={def.id}
              className="dock-panel"
              style={{
                height: isAI ? minH : undefined,
                minHeight: minH,
                display: 'flex', flexDirection: 'column',
              }}
            >
              <div
                className="dock-header"
                draggable
                onDragStart={e => { e.dataTransfer.setData('panelId', def.id); e.dataTransfer.effectAllowed = 'move' }}
                style={{ cursor: 'grab' }}
              >
                <span className="dock-grip" aria-hidden="true" />
                {isAI ? <span className="ai-pulse-dot" /> : def.dotColor && <span className={`live-dot ${def.dotColor}`} />}
                <span className="panel-title" style={{ flex: 1 }}>{def.title}</span>
                <CloseButton onClick={() => closePanel(def.id)} label={`Close ${def.title} panel`} />
              </div>
              <div className="dock-body" style={{ flex: '1 1 0', minHeight: 0, overflow: 'auto' }}>
                <PanelHost label={def.title}>{def.render(panelProps)}</PanelHost>
              </div>
            </div>
          )
        })}

        {visibleDefs.length === 0 && (
          <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>No panels visible</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>
              {closedInGroup.length > 0 ? 'Use “Restore closed” above to bring them back' : 'Drag from the observe tray to restore'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
