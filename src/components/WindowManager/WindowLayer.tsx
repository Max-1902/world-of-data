/**
 * Floating panel windows over the whole dashboard — a multi-window terminal layout. Any registry panel can be
 * popped out of the dock, dragged, resized, snapped to a screen edge or quarter, split with another window by
 * dropping onto it, tiled, minimised to the taskbar, or moved to a separate browser window for a second monitor.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { PANEL_MAP } from '../../panels/registry'
import type { PanelProps } from '../../panels/types'
import PanelWindow from './PanelWindow'
import { snapZone, type Placed, type SnapZone } from './geometry'
import { MAX_WINDOWS, workspaceBounds, type WindowLayout } from './useWindowLayout'

const sameZone = (a: SnapZone | null, b: SnapZone | null) => JSON.stringify(a) === JSON.stringify(b)
/** a dock header being dragged (PanelDock sets this data type) */
const isPanelDrag = (e: DragEvent | React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('panelid')

export default function WindowLayer({ layout, panelProps }: { layout: WindowLayout; panelProps: PanelProps }) {
  const { wins, actions, full } = layout
  const [zone, setZone] = useState<SnapZone | null>(null)
  const onZone = useCallback((z: SnapZone | null) => setZone(prev => (sameZone(prev, z) ? prev : z)), [])

  const winsRef = useRef(wins)
  winsRef.current = wins
  const getPlaced = useCallback((selfId?: string): Placed[] => {
    const b = workspaceBounds()
    return winsRef.current
      .filter(w => w.id !== selfId && !w.minimized && !w.external)
      .map(w => ({ id: w.id, rect: w.maximized ? b : w.rect }))
      .reverse()
  }, [])

  // A dock header is being dragged: cover the workspace with a drop target that previews where it would land.
  const [panelDrag, setPanelDrag] = useState(false)
  useEffect(() => {
    // deferred: changing the DOM inside dragstart can cancel the drag in some browsers
    const start = (e: DragEvent) => { if (isPanelDrag(e)) window.setTimeout(() => setPanelDrag(true), 0) }
    const end = () => { setPanelDrag(false); setZone(null) }
    document.addEventListener('dragstart', start)
    document.addEventListener('dragend', end)
    return () => { document.removeEventListener('dragstart', start); document.removeEventListener('dragend', end) }
  }, [])

  function onDragOver(e: React.DragEvent) {
    if (!isPanelDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    onZone(full ? null : snapZone({ x: e.clientX, y: e.clientY }, workspaceBounds(), getPlaced()))
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setPanelDrag(false)
    setZone(null)
    const id = e.dataTransfer.getData('panelId')
    if (!id || full) return
    const z = snapZone({ x: e.clientX, y: e.clientY }, workspaceBounds(), getPlaced())
    if (!z) { actions.open(id, { at: { x: e.clientX, y: e.clientY } }); return }
    actions.open(id, { rect: z.preview })
    if (z.kind === 'split') actions.setRects(new Map([[z.targetId, z.targetRect]]))
  }

  const b = panelDrag ? workspaceBounds() : null
  return (
    <>
      {wins.map((w, i) => (
        <PanelWindow
          key={w.id}
          win={w}
          z={100 + i}
          top={i === wins.length - 1}
          panelProps={panelProps}
          actions={actions}
          getPlaced={getPlaced}
          onZone={onZone}
        />
      ))}
      {zone && (
        <div className="pw-snap" style={{ left: zone.preview.x, top: zone.preview.y, width: zone.preview.w, height: zone.preview.h }}>
          <span>{zone.kind === 'split' ? `Split with ${PANEL_MAP.get(zone.targetId)?.title ?? 'window'}` : 'Snap here'}</span>
        </div>
      )}
      {b && (
        <div
          className="pw-dropzone"
          style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
          onDragOver={onDragOver}
          onDragLeave={e => { if (e.currentTarget === e.target) setZone(null) }}
          onDrop={onDrop}
        >
          <span className="pw-dropzone-hint">{full ? `Window limit reached (${MAX_WINDOWS})` : 'Drop to open as a window — on an edge to snap, on a window to split it'}</span>
        </div>
      )}
    </>
  )
}
