import { useRef, useState, useCallback } from 'react'
import type { CrisisEvent, PanelState, Flight } from '../../types'
import { PanelContent, PANEL_META, type PanelId } from '../panels/PanelContent'

interface Props {
  id: PanelId
  index: number
  crises: CrisisEvent[]
  flights: Flight[]
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
  onGeoSearch?: (q: string) => void
  onClose: () => void
}

export default function FloatingPanel({ id, index, crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, onGeoSearch, onClose }: Props) {
  const meta = PANEL_META[id]
  const [pos, setPos] = useState({ x: 60 + index * 24, y: 60 + index * 24 })
  const [size, setSize] = useState({ w: Math.max(280, meta.width), h: id === 'analyst' ? 620 : 260 })
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)
  const resRef  = useRef<{ startX: number; startY: number; ow: number; oh: number } | null>(null)

  const onDragDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y }
    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const { startX, startY, ox, oy } = dragRef.current
      setPos({ x: ox + me.clientX - startX, y: oy + me.clientY - startY })
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  const onResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    resRef.current = { startX: e.clientX, startY: e.clientY, ow: size.w, oh: size.h }
    const onMove = (me: MouseEvent) => {
      if (!resRef.current) return
      const { startX, startY, ow, oh } = resRef.current
      setSize({ w: Math.max(220, ow + me.clientX - startX), h: Math.max(120, oh + me.clientY - startY) })
    }
    const onUp = () => { resRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [size])

  return (
    <div style={{
      position: 'absolute', left: pos.x, top: pos.y, width: size.w, height: size.h,
      zIndex: 50, display: 'flex', flexDirection: 'column',
      border: '1px solid var(--border)', background: 'var(--surface)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {/* Header — draggable */}
      <div
        onMouseDown={onDragDown}
        style={{
          height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 10px', cursor: 'grab', userSelect: 'none',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
        }}
      >
        {meta.dotColor && <span className={`live-dot ${meta.dotColor}`} />}
        <span className="panel-title" style={{ flex: 1 }}>{meta.title}</span>
        <button
          onClick={onClose}
          title="Dock back to right panel"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, lineHeight: 1, padding: '2px 4px', borderRadius: 'var(--r-sm)', transition: 'color .12s, background .12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-soft)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, background: 'var(--surface)' }}>
        <PanelContent id={id} crises={crises} flights={flights} panelState={panelState} onToggleLayer={onToggleLayer} deepstateMode={deepstateMode} onDeepstateToggle={onDeepstateToggle} onGeoSearch={onGeoSearch} />
      </div>

      {/* Resize handle (bottom-right) */}
      <div
        onMouseDown={onResizeDown}
        style={{
          position: 'absolute', bottom: 0, right: 0, width: 14, height: 14,
          cursor: 'nwse-resize',
          background: 'linear-gradient(135deg, transparent 50%, var(--border-strong) 50%)',
          borderBottomRightRadius: 'var(--r-lg)',
        }}
      />
    </div>
  )
}
