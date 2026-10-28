import { Fragment, useState, useRef, useEffect } from 'react'
import type { CrisisEvent, PanelState, Flight } from '../../types'
import { GROUP_ORDER, GROUP_SECTIONS, panelsForGroup } from '../../panels/registry'
import type { PanelGroup, PanelProps } from '../../panels/types'
import PanelHost from '../PanelHost'
import PanelMapToggle from '../PanelMapToggle'
import CloseButton from '../CloseButton'
import { AskAnalyst, offersAnalyst } from './AskAnalyst'
import { PictureInPicture2 } from 'lucide-react'

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
  /** panels open as floating windows — not shown in the dock */
  poppedOut: Set<string>
  onPopOut: (id: string) => void
  /** pop every panel of the workspace out and tile them */
  onPopOutAll: (ids: string[]) => void
  activeGroup: PanelGroup
  /** Scroll to (and re-show, if closed) this panel; `n` changes on every request so picking the same panel twice still scrolls. */
  focusPanel?: { id: string; n: number } | null
  /** the map is hidden for this workspace (Analysis defaults to it): the dock fills the width, and shows a way to bring the map back */
  fullWidth?: boolean
  onShowMap?: () => void
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

export default function PanelDock({ crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, onGeoSearch, onCountryClick, searchQuery, poppedOut, onPopOut, onPopOutAll, activeGroup, focusPanel, fullWidth, onShowMap }: Props) {
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

  // Search / command palette picked a panel: un-hide it, then scroll it into view once it has rendered.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusPanel) return
    setHidden(prev => { if (!prev.has(focusPanel.id)) return prev; const next = new Set(prev); next.delete(focusPanel.id); return next })
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-panel-id="${focusPanel.id}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.remove('dock-panel-focus')
      void el.offsetWidth // restart the highlight animation
      el.classList.add('dock-panel-focus')
    })
    return () => cancelAnimationFrame(raf)
  }, [focusPanel])

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
        width: fullWidth ? '100%' : panelW, minWidth: MIN_W, height: '100%',
        display: 'flex', flexDirection: 'column', flexShrink: fullWidth ? undefined : 0,
        position: 'relative', borderLeft: fullWidth ? undefined : '1px solid var(--border)',
        background: 'var(--bg)', overflow: 'hidden',
      }}
    >
      {/* resize handle */}
      {!fullWidth && <div onMouseDown={onResizeDown} style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
        cursor: 'ew-resize', zIndex: 40,
      }} />}

      {/* panels — scrollable, each with proper min-height */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="dock-workspace-heading">
          <div>
            <div className="dock-workspace-eyebrow">WORKSPACE</div>
            <div className="dock-workspace-title">{groupLabel}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {onShowMap && (
              <button className="dock-restore" onClick={onShowMap} title="Show the map alongside this workspace">
                Show map
              </button>
            )}
            {visibleDefs.length} {visibleDefs.length === 1 ? 'panel' : 'panels'}
            {visibleDefs.length > 1 && (
              <button className="dock-restore" onClick={() => onPopOutAll(visibleDefs.map(d => d.id))} title="Open every panel of this workspace as a window, tiled across the screen">
                Pop out all
              </button>
            )}
            {closedInGroup.length > 0 && (
              <button className="dock-restore" onClick={restoreGroup} title="Show the panels you closed in this workspace">
                Restore {closedInGroup.length} closed
              </button>
            )}
          </span>
        </div>
        {visibleDefs.map((def, i) => {
          // A banner wherever a new section starts (sections with every panel closed get none)
          const sections = GROUP_SECTIONS[activeGroup]
          const section = def.section !== visibleDefs[i - 1]?.section ? sections.find(s => s.id === def.section) : undefined
          const step = section ? sections.indexOf(section) + 1 : 0
          // Give each panel a sensible min-height based on type
          const isAI = def.id === 'analyst'
          const isLarge = isAI || def.id === 'markets' || def.id === 'humanitarian'
          const minH = def.minHeight ?? (isAI ? 900 : isLarge ? 800 : 700)
          return (
            <Fragment key={def.id}>
            {section && (
              <section className="dock-section" aria-labelledby={`dock-section-${activeGroup}-${section.id}`}>
                <div className="dock-section-step" aria-hidden="true">{String(step).padStart(2, '0')}</div>
                <div>
                  <h2 className="dock-section-title" id={`dock-section-${activeGroup}-${section.id}`}>{section.title}</h2>
                  <p className="dock-section-desc">{section.desc}</p>
                </div>
                {offersAnalyst(activeGroup, section.id) && <AskAnalyst />}
              </section>
            )}
            <div
              className="dock-panel"
              data-panel-id={def.id}
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
                <PanelMapToggle map={def.map} panelState={panelState} onToggleLayer={onToggleLayer} />
                <button
                  type="button"
                  className="close-x"
                  aria-label={`Pop out ${def.title} as a window`}
                  title="Pop out as a window — or drag this header onto the map"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => onPopOut(def.id)}
                >
                  <PictureInPicture2 size={13} strokeWidth={2.25} />
                </button>
                <CloseButton onClick={() => closePanel(def.id)} label={`Close ${def.title} panel`} />
              </div>
              <div className="dock-body" style={{ flex: '1 1 0', minHeight: 0, overflow: 'auto' }}>
                <PanelHost label={def.title} sources={def.sources}>{def.render(panelProps)}</PanelHost>
              </div>
            </div>
            </Fragment>
          )
        })}

        {visibleDefs.length === 0 && (
          <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>No panels visible</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>
              {closedInGroup.length > 0 ? 'Use “Restore closed” above to bring them back' : 'Panels open as windows are listed in the taskbar under the map'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
