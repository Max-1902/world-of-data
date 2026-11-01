import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownToLine, Expand, ExternalLink, Minus, Shrink } from 'lucide-react'
import { PANEL_MAP } from '../../panels/registry'
import type { PanelProps } from '../../panels/types'
import PanelHost from '../PanelHost'
import PanelMapToggle from '../PanelMapToggle'
import CloseButton from '../CloseButton'
import { prepareWindow, watchPopup } from '../../utils/popupWindow'
import { linkedEdges, magnetMove, resizeLinked, snapZone, type Placed, type Rect, type ResizeDir, type SnapZone } from './geometry'
import { workspaceBounds, type PanelWin, type WindowActions } from './useWindowLayout'

/** Open separate browser windows by panel id, so the taskbar can bring one forward. */
export const popups = new Map<string, Window>()

const DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

interface Props {
  win: PanelWin
  z: number
  top: boolean
  panelProps: PanelProps
  actions: WindowActions
  /** the other visible, in-dashboard windows, topmost first */
  getPlaced: (selfId: string) => Placed[]
  onZone: (zone: SnapZone | null) => void
}

/** Write a rect straight to a window's frame — live feedback while dragging without re-rendering its panel. */
function paint(id: string, r: Rect) {
  const el = document.querySelector<HTMLElement>(`.pw[data-win-id="${id}"]`)
  if (!el) return
  el.style.left = `${r.x}px`; el.style.top = `${r.y}px`; el.style.width = `${r.w}px`; el.style.height = `${r.h}px`
}

/** Track a mouse drag on window; iframes (webcams) stop swallowing the pointer while it runs. */
function track(onMove: (e: MouseEvent) => void, onUp: (e: MouseEvent) => void) {
  document.body.classList.add('pw-dragging')
  const up = (e: MouseEvent) => {
    document.body.classList.remove('pw-dragging')
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', up)
    onUp(e)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', up)
}

function PanelWindow({ win, z, top, panelProps, actions, getPlaced, onZone }: Props) {
  const { id } = win
  const def = PANEL_MAP.get(id)
  const [popup, setPopup] = useState<Window | null>(null)
  const [notice, setNotice] = useState('')
  const rectRef = useRef(win.rect)
  rectRef.current = win.rect

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(''), 6000)
    return () => window.clearTimeout(t)
  }, [notice])

  // Closing the separate window brings the panel back into the dashboard (closing it there returns it to the dock).
  useEffect(() => {
    if (!popup) return
    popups.set(id, popup)
    const stop = watchPopup(popup, () => { setPopup(null); actions.setExternal(id, false) })
    return () => { popups.delete(id); stop() }
  }, [popup, id, actions])

  const body = useMemo(
    () => (def ? <PanelHost label={def.title} sources={def.sources}>{def.render(panelProps)}</PanelHost> : null),
    [def, panelProps],
  )
  if (!def) return null

  function openSeparate() {
    // Straight from the click, so the browser counts it as a user-initiated pop-up.
    const r = rectRef.current
    const w = window.open('', `wod-panel-${id}`,
      `popup,width=${Math.round(r.w)},height=${Math.round(r.h)},left=${Math.round(window.screenX + r.x)},top=${Math.round(window.screenY + r.y)}`)
    if (!w) { setNotice('Pop-up blocked — allow pop-ups for this site'); return }
    prepareWindow(w, `${def!.title} — World of Data`)
    setPopup(w)
    actions.setExternal(id, true)
    w.focus()
  }

  function onHeaderDown(e: React.MouseEvent) {
    if (e.button !== 0 || (e.target as Element).closest('button, select, input, a, label')) return
    e.preventDefault()
    const b = workspaceBounds()
    const grabX = e.clientX, grabY = e.clientY
    let start: Rect = win.maximized ? b : win.rect
    let moved = false, zone: SnapZone | null = null, cur = start
    const others = getPlaced(id)
    track(me => {
      if (!moved) {
        if (Math.abs(me.clientX - grabX) + Math.abs(me.clientY - grabY) < 4) return
        moved = true
        // Dragging a maximised window: come off the edge at its normal size, still under the pointer.
        if (win.maximized) {
          const fx = (grabX - b.x) / b.w
          start = { ...win.rect, x: grabX - win.rect.w * fx, y: grabY - 18 }
        }
      }
      let r = { ...start, x: start.x + me.clientX - grabX, y: start.y + me.clientY - grabY }
      // Shift: place freely, no snapping
      zone = me.shiftKey ? null : snapZone({ x: me.clientX, y: me.clientY }, b, others)
      if (!zone && !me.shiftKey) r = magnetMove(r, b, others.map(o => o.rect))
      // keep the title bar reachable
      r.x = Math.min(b.x + b.w - 80, Math.max(b.x + 80 - r.w, r.x))
      r.y = Math.min(b.y + b.h - 30, Math.max(b.y, r.y))
      cur = r
      paint(id, r)
      onZone(zone)
    }, () => {
      onZone(null)
      if (!moved) return
      const rects = new Map<string, Rect>()
      if (zone) {
        rects.set(id, zone.preview)
        if (zone.kind === 'split') rects.set(zone.targetId, zone.targetRect)
      } else rects.set(id, cur)
      actions.setRects(rects)
    })
  }

  const onResizeDown = (dir: ResizeDir) => (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    actions.focus(id)
    const b = workspaceBounds()
    const start = win.rect
    const placed = getPlaced(id)
    // windows sharing the dragged edge (split partners) resize with it
    const links = linkedEdges(start, dir, placed)
    const startRects = new Map(placed.map(p => [p.id, p.rect]))
    let out: Map<string, Rect> | null = null
    track(me => {
      out = resizeLinked(id, start, dir, me.clientX - e.clientX, me.clientY - e.clientY, b, links, startRects)
      for (const [k, r] of out) paint(k, r)
    }, () => { if (out) actions.setRects(out) })
  }

  const dot = def.id === 'analyst' ? <span className="ai-pulse-dot" /> : def.dotColor ? <span className={`live-dot ${def.dotColor}`} /> : null
  const mapToggle = <PanelMapToggle map={def.map} panelState={panelProps.panelState} onToggleLayer={panelProps.onToggleLayer} />
  const dockBtn = <CloseButton onClick={() => actions.close(id)} label={`Return ${def.title} to the dock`} />

  if (popup) {
    return createPortal(
      <div className="dashboard ai-window-shell pw-external">
        <div className="pw-head">
          {dot}
          <span className="panel-title pw-title">{def.title}</span>
          {mapToggle}
          <button className="pw-btn wide" onClick={() => { setPopup(null); actions.setExternal(id, false) }} title="Move back into the dashboard as a floating window">
            <ArrowDownToLine size={13} /> Back to dashboard
          </button>
          {dockBtn}
        </div>
        <div className="pw-body">{body}</div>
      </div>,
      popup.document.body,
    )
  }

  const r = win.maximized ? workspaceBounds() : win.rect
  return (
    <div
      className={`pw${top ? ' top' : ''}${win.maximized ? ' maximized' : ''}`}
      data-win-id={id}
      role="dialog"
      aria-label={`${def.title} window`}
      style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z, display: win.minimized ? 'none' : undefined }}
      onMouseDownCapture={() => actions.focus(id)}
    >
      <div className="pw-head" onMouseDown={onHeaderDown} onDoubleClick={e => { if (!(e.target as Element).closest('button')) actions.toggleMaximize(id) }}>
        <span className="dock-grip" aria-hidden="true" />
        {dot}
        <span className="panel-title pw-title">{def.title}</span>
        {notice && <small className="pw-notice" role="status">{notice}</small>}
        {mapToggle}
        <button className="pw-btn" onClick={() => actions.toggleMinimize(id)} aria-label="Minimise" title="Minimise (restore from the taskbar)"><Minus size={13} /></button>
        <button className="pw-btn" onClick={() => actions.toggleMaximize(id)} aria-label={win.maximized ? 'Restore size' : 'Fill the screen'} title={win.maximized ? 'Restore size' : 'Fill the screen'}>
          {win.maximized ? <Shrink size={13} /> : <Expand size={13} />}
        </button>
        <button className="pw-btn" onClick={openSeparate} aria-label="Open in a separate window" title="Open in a separate browser window (e.g. a second monitor)"><ExternalLink size={13} /></button>
        {dockBtn}
      </div>
      <div className="pw-body">{body}</div>
      {!win.maximized && DIRS.map(d => <div key={d} className={`pw-rs pw-rs-${d}`} onMouseDown={onResizeDown(d)} aria-hidden="true" />)}
    </div>
  )
}

export default memo(PanelWindow)
