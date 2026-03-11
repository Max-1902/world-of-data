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
  const [size, setSize] = useState({ w: Math.max(280, meta.width), h: 260 })
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
      border: '1px solid var(--b2)', background: 'rgba(8,14,10,0.97)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px var(--pri10)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Header — draggable */}
      <div
        onMouseDown={onDragDown}
        style={{
          height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
          padding: '0 8px', cursor: 'grab', userSelect: 'none',
          borderBottom: '1px solid var(--b1)',
          background: 'linear-gradient(90deg, var(--pri06) 0%, transparent 70%)',
        }}
      >
        {meta.dotColor && <span className={`live-dot ${meta.dotColor}`} />}
        <span className="panel-title" style={{ flex: 1 }}>{meta.title}</span>
        <button
          onClick={onClose}
          title="Dock back to right panel"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', fontSize: 11, lineHeight: 1, padding: '0 2px', transition: 'color .12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff6666' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2a3e2e' }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <PanelContent id={id} crises={crises} flights={flights} panelState={panelState} onToggleLayer={onToggleLayer} deepstateMode={deepstateMode} onDeepstateToggle={onDeepstateToggle} onGeoSearch={onGeoSearch} />
      </div>

      {/* Resize handle (bottom-right) */}
      <div
        onMouseDown={onResizeDown}
        style={{
          position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
          cursor: 'nwse-resize',
          background: 'linear-gradient(135deg, transparent 50%, rgba(0,255,136,0.2) 50%)',
        }}
      />
    </div>
  )
}
