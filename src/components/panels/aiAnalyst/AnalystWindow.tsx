/**
 * Lets the Analyst leave the dock: a large floating window over the dashboard, or a separate browser window
 * (for a second monitor). There is only ever one Analyst: it is rendered once, by the provider, into a detached
 * element that is moved between the dock slot, the floating window and the separate window. Moving it never
 * remounts it, so a running investigation, the thread and the chosen model survive every move — and the
 * conversation keeps running while the user switches workspaces.
 */
import { createContext, lazy, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Maximize2, Minimize2, Minus, Plus, Shrink, Expand, MessageSquare } from 'lucide-react'
import PanelHost from '../../PanelHost'
import type { PanelProps } from '../../../panels/types'
import { prepareWindow, watchPopup } from '../../../utils/popupWindow'

const AIAnalystPanel = lazy(() => import('../AIAnalystPanel').then(m => ({ default: m.AIAnalystPanel })))

export type AnalystMode = 'dock' | 'float' | 'window'

/** Reading sizes in the popped-out views (1 = the pop-out's base size, already larger than the dock's). */
export const TEXT_SCALES = [0.9, 1, 1.15, 1.3, 1.5, 1.75]
const LS_SCALE = 'ai-text-scale'
const LS_RECT = 'ai-float-rect'
const WINDOW_NAME = 'mundus-analyst'

interface AnalystWindowApi {
  mode: AnalystMode
  /** open the floating window over the dashboard */
  popOut: () => void
  /** open a separate browser window; falls back to the floating window if the browser blocks pop-ups */
  openWindow: () => void
  dock: () => void
  /** bring the popped-out analyst to the front */
  reveal: () => void
  notice: string
}

interface Internal extends AnalystWindowApi { setDockSlot: (el: HTMLElement | null) => void }

const Ctx = createContext<Internal | null>(null)

/** The pop-out controls, or null when the Analyst is rendered without the provider (tests, standalone use). */
export function useAnalystWindow(): AnalystWindowApi | null {
  return useContext(Ctx)
}

interface Rect { x: number; y: number; w: number; h: number }

function defaultRect(): Rect {
  const w = Math.min(1040, window.innerWidth - 80)
  const h = Math.max(360, window.innerHeight - 100)
  return { x: Math.max(8, Math.round((window.innerWidth - w) / 2)), y: 50, w, h }
}

function loadRect(): Rect {
  try {
    const r = JSON.parse(localStorage.getItem(LS_RECT) ?? 'null')
    if (r && [r.x, r.y, r.w, r.h].every(n => typeof n === 'number' && Number.isFinite(n)) && r.w >= 420 && r.h >= 360) {
      // keep it reachable if the viewport shrank since it was saved
      const w = Math.min(r.w, window.innerWidth - 16), h = Math.min(r.h, window.innerHeight - 16)
      return { w, h, x: Math.min(Math.max(8, r.x), window.innerWidth - w - 8), y: Math.min(Math.max(8, r.y), window.innerHeight - h - 8) }
    }
  } catch {}
  return defaultRect()
}

function loadScale(): number {
  try { const v = Number(localStorage.getItem(LS_SCALE)); if (TEXT_SCALES.includes(v)) return v } catch {}
  return 1
}

export function AnalystWindowProvider({ panelProps, children }: { panelProps: PanelProps; children: ReactNode }) {
  // The one element the Analyst lives in; it is moved, never re-rendered elsewhere.
  const [host] = useState(() => { const d = document.createElement('div'); d.className = 'ai-host'; return d })
  const [mode, setMode] = useState<AnalystMode>('dock')
  const [win, setWin] = useState<Window | null>(null)
  const [dockSlot, setDockSlot] = useState<HTMLElement | null>(null)
  const [floatSlot, setFloatSlot] = useState<HTMLElement | null>(null)
  const [windowSlot, setWindowSlot] = useState<HTMLElement | null>(null)
  const [scale, setScale] = useState(loadScale)
  const [notice, setNotice] = useState('')
  // Mounted on first need (dock slot rendered or popped out), so the panel's chunk stays lazy.
  const [wanted, setWanted] = useState(false)
  useEffect(() => { if (dockSlot || mode !== 'dock') setWanted(true) }, [dockSlot, mode])

  useEffect(() => { try { localStorage.setItem(LS_SCALE, String(scale)) } catch {} }, [scale])

  useLayoutEffect(() => {
    const target = mode === 'dock' ? dockSlot : mode === 'float' ? floatSlot : windowSlot
    if (target && host.parentNode !== target) target.appendChild(host)
    host.classList.toggle('ai-large', mode !== 'dock')
    host.style.setProperty('--ai-text', String(scale))
  }, [mode, dockSlot, floatSlot, windowSlot, host, scale])

  // The separate window: dock back when the user closes it; close it when the dashboard goes away or we dock.
  useEffect(() => {
    if (!win) return
    return watchPopup(win, () => { setWin(null); setMode(m => (m === 'window' ? 'dock' : m)) })
  }, [win])

  const popOut = useCallback(() => { setNotice(''); setWin(null); setMode('float') }, [])
  const dock = useCallback(() => { setNotice(''); setWin(null); setMode('dock') }, [])
  const openWindow = useCallback(() => {
    // Called straight from the click so the browser counts it as a user-initiated pop-up.
    const w = window.open('', WINDOW_NAME, `popup,width=${Math.min(1200, screen.availWidth)},height=${Math.min(960, screen.availHeight)}`)
    if (!w) {
      setNotice('The browser blocked the separate window — opened it here instead. Allow pop-ups for this site to use a second window.')
      setMode('float')
      return
    }
    prepareWindow(w, 'Analyst — World of Data')
    setNotice('')
    setWin(w)
    setMode('window')
    w.focus()
  }, [])
  const reveal = useCallback(() => { if (mode === 'window') win?.focus() }, [mode, win])

  const api = useMemo<Internal>(() => ({ mode, popOut, openWindow, dock, reveal, notice, setDockSlot }), [mode, popOut, openWindow, dock, reveal, notice])
  const bar = { mode, scale, setScale, onDock: dock, onPopOut: popOut, onWindow: openWindow, notice }

  return (
    <Ctx.Provider value={api}>
      {children}
      {wanted && createPortal(<PanelHost label="Analyst chat"><AIAnalystPanel {...panelProps} /></PanelHost>, host)}
      {mode === 'float' && <FloatingWindow onSlot={setFloatSlot} bar={bar} />}
      {mode === 'window' && win && createPortal(
        <div className="dashboard ai-window-shell">
          <WindowBar {...bar} />
          <div ref={setWindowSlot} className="ai-float-body" />
        </div>,
        win.document.body,
      )}
    </Ctx.Provider>
  )
}

interface BarProps {
  mode: AnalystMode
  scale: number
  setScale: (s: number) => void
  onDock: () => void
  onPopOut: () => void
  onWindow: () => void
  notice?: string
  maximized?: boolean
  onMaximize?: () => void
  onDragStart?: (e: React.MouseEvent) => void
}

function WindowBar({ mode, scale, setScale, onDock, onPopOut, onWindow, notice, maximized, onMaximize, onDragStart }: BarProps) {
  const i = TEXT_SCALES.indexOf(scale)
  return (
    <div className="ai-winbar" onMouseDown={onDragStart} onDoubleClick={e => { if (!(e.target as Element).closest('button')) onMaximize?.() }}>
      <span className="ai-winbar-title">
        <MessageSquare size={14} color="var(--accent)" />
        Analyst
        <small className={notice ? 'warn' : undefined} title={notice || undefined}>{notice || (mode === 'window' ? 'Separate window — keeps running alongside the dashboard' : 'Keeps running while you use the dashboard')}</small>
      </span>
      <span className="ai-winbar-group" role="group" aria-label="Text size">
        <button className="ai-winbar-btn icon" onClick={() => setScale(TEXT_SCALES[Math.max(0, i - 1)])} disabled={i <= 0} aria-label="Smaller text" title="Smaller text"><Minus size={13} /></button>
        <span className="ai-winbar-size" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button className="ai-winbar-btn icon" onClick={() => setScale(TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, i + 1)])} disabled={i >= TEXT_SCALES.length - 1} aria-label="Larger text" title="Larger text"><Plus size={13} /></button>
      </span>
      {mode === 'float' && onMaximize && (
        <button className="ai-winbar-btn icon" onClick={onMaximize} aria-label={maximized ? 'Restore size' : 'Fill the screen'} title={maximized ? 'Restore size' : 'Fill the screen'}>
          {maximized ? <Shrink size={13} /> : <Expand size={13} />}
        </button>
      )}
      {mode === 'float'
        ? <button className="ai-winbar-btn" onClick={onWindow} title="Move to a separate browser window (e.g. a second monitor)"><ExternalLink size={13} /> Separate window</button>
        : <button className="ai-winbar-btn" onClick={onPopOut} title="Move back into the dashboard as a floating window"><Maximize2 size={13} /> Float in dashboard</button>}
      <button className="ai-winbar-btn" onClick={onDock} title="Put the analyst back in the right-hand dock"><Minimize2 size={13} /> Dock</button>
    </div>
  )
}

function FloatingWindow({ onSlot, bar }: { onSlot: (el: HTMLElement | null) => void; bar: Omit<BarProps, 'maximized' | 'onMaximize' | 'onDragStart'> }) {
  const [rect, setRect] = useState(loadRect)
  const [maximized, setMaximized] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => { try { localStorage.setItem(LS_RECT, JSON.stringify(rect)) } catch {} }, [rect])

  // CSS `resize: both` sizes the frame; mirror it into state so a re-render never undoes the user's resize.
  useEffect(() => {
    const el = frameRef.current
    if (!el || maximized || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth, h = el.offsetHeight
      if (w && h) setRect(r => (r.w === w && r.h === h ? r : { ...r, w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maximized])

  function onDragStart(e: React.MouseEvent) {
    if (maximized || e.button !== 0 || (e.target as Element).closest('button, select, input')) return
    e.preventDefault()
    const start = { mx: e.clientX, my: e.clientY, x: rect.x, y: rect.y }
    const onMove = (me: MouseEvent) => setRect(r => ({
      ...r,
      x: Math.min(window.innerWidth - 120, Math.max(120 - r.w, start.x + me.clientX - start.mx)),
      y: Math.min(window.innerHeight - 40, Math.max(0, start.y + me.clientY - start.my)),
    }))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const style: React.CSSProperties = maximized
    ? { left: 12, top: 12, width: 'calc(100vw - 24px)', height: 'calc(100vh - 24px)' }
    : { left: rect.x, top: rect.y, width: rect.w, height: rect.h }

  return (
    <div ref={frameRef} className={`ai-float${maximized ? ' maximized' : ''}`} style={style} role="dialog" aria-label="Analyst (pop-out)">
      <WindowBar {...bar} maximized={maximized} onMaximize={() => setMaximized(m => !m)} onDragStart={onDragStart} />
      <div ref={onSlot} className="ai-float-body" />
    </div>
  )
}

/**
 * What the dock (or the observe tray) renders for the Analyst. With the provider it is a slot the shared Analyst
 * is moved into, or a note while the Analyst is popped out; without it, the panel renders directly.
 */
export function AnalystSlot(props: PanelProps) {
  const ctx = useContext(Ctx)
  const ref = useRef<HTMLDivElement>(null)
  const setDockSlot = ctx?.setDockSlot
  useLayoutEffect(() => {
    const el = ref.current
    if (!setDockSlot || !el) return
    setDockSlot(el)
    return () => setDockSlot(null)
  }, [setDockSlot])

  if (!ctx) return <AIAnalystPanel {...props} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* The slot stays mounted (and childless in React's eyes) so moving the Analyst in and out never fights React. */}
      <div ref={ref} className="ai-slot" style={{ display: ctx.mode === 'dock' ? 'flex' : 'none' }} />
      {ctx.mode !== 'dock' && (
        <div className="ai-docked-note">
          <MessageSquare size={18} color="var(--accent)" />
          <div className="ai-docked-note-title">The analyst is open in {ctx.mode === 'window' ? 'a separate window' : 'a pop-out window'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ctx.mode === 'window' && <button className="ai-winbar-btn" onClick={ctx.reveal}><ExternalLink size={13} /> Show it</button>}
            <button className="ai-winbar-btn" onClick={ctx.dock}><Minimize2 size={13} /> Dock it here</button>
          </div>
        </div>
      )}
    </div>
  )
}
