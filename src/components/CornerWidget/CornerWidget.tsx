import { useState, useRef, useEffect } from 'react'
import type { CrisisEvent, PanelState, Flight } from '../../types'
import { PanelContent, PANEL_META, DEFAULT_ORDER, type PanelId } from '../panels/PanelContent'

interface Props {
  position: 'left' | 'right'
  crises: CrisisEvent[]
  flights: Flight[]
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
  forcePanelId?: PanelId
  searchQuery?: string
  onGeoSearch?: (q: string) => void
  onCountryClick?: (country: string) => void
  onClose?: () => void
  defaultPos?: { x: number; y: number }
}

const MIN_W = 220
const MIN_H = 120
const SNAP  = 10

// All panels available to search/pin
const ALL_PANELS = DEFAULT_ORDER.map(id => ({ id, ...PANEL_META[id] }))

function snapN(v: number) { return Math.round(v / SNAP) * SNAP }

export default function CornerWidget({
  position, crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle,
  forcePanelId, searchQuery: externalQuery, onGeoSearch, onCountryClick, onClose, defaultPos,
}: Props) {
  const [selected, setSelected]       = useState<PanelId | null>(null)
  const [collapsed, setCollapsed]     = useState(false)
  const [panelSearch, setPanelSearch] = useState('')
  const [isDragOver, setIsDragOver]   = useState(false)
  const [showSearch, setShowSearch]   = useState(false)
  // Position (null = default corner, or use defaultPos for extra widgets)
  const [pos, setPos]   = useState<{ x: number; y: number } | null>(defaultPos ?? null)
  // Size state
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 240, h: 280 })

  const containerRef    = useRef<HTMLDivElement>(null)
  const dragOffsetRef   = useRef<{ x: number; y: number } | null>(null)
  const resizeStartRef  = useRef<{ mx: number; my: number; w: number; h: number } | null>(null)
  const inputRef        = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (forcePanelId && PANEL_META[forcePanelId]) {
      setSelected(forcePanelId)
      setCollapsed(false)
      setShowSearch(false)
    }
  }, [forcePanelId])

  const searchResults = panelSearch.trim()
    ? ALL_PANELS.filter(p =>
        p.title.toLowerCase().includes(panelSearch.toLowerCase()) ||
        p.desc.toLowerCase().includes(panelSearch.toLowerCase())
      )
    : ALL_PANELS

  useEffect(() => {
    if (showSearch) inputRef.current?.focus()
  }, [showSearch])

  // ── Drag to move ────────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button, input, a, [data-resize]')) return
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const onMove = (me: MouseEvent) => {
      if (!dragOffsetRef.current) return
      setPos({ x: me.clientX - dragOffsetRef.current.x, y: me.clientY - dragOffsetRef.current.y })
    }
    const onUp = (me: MouseEvent) => {
      if (dragOffsetRef.current) {
        const x = snapN(me.clientX - dragOffsetRef.current.x)
        const y = snapN(me.clientY - dragOffsetRef.current.y)
        setPos({ x, y })
      }
      dragOffsetRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Resize handle ───────────────────────────────────────────────────────────
  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h }
    const onMove = (me: MouseEvent) => {
      if (!resizeStartRef.current) return
      const { mx, my, w, h } = resizeStartRef.current
      setSize({
        w: Math.max(MIN_W, w + (me.clientX - mx)),
        h: Math.max(MIN_H, h + (me.clientY - my)),
      })
    }
    const onUp = (me: MouseEvent) => {
      if (resizeStartRef.current) {
        const { mx, my, w, h } = resizeStartRef.current
        setSize({
          w: Math.max(MIN_W, snapN(w + (me.clientX - mx))),
          h: Math.max(MIN_H, snapN(h + (me.clientY - my))),
        })
      }
      resizeStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const defaultPosStyle: React.CSSProperties = position === 'left'
    ? { left: 10, top: 52 }
    : { right: 54, top: 52 }
  const posStyle: React.CSSProperties = pos ? { left: pos.x, top: pos.y } : defaultPosStyle

  const resizeHandle = (
    <div
      data-resize="1"
      onMouseDown={onResizeMouseDown}
      style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 14, height: 14, cursor: 'se-resize', zIndex: 10,
        background: 'linear-gradient(135deg, transparent 50%, rgba(0,255,136,0.18) 50%)',
      }}
    />
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const panelId = e.dataTransfer.getData('panelId') as PanelId
    if (panelId && PANEL_META[panelId]) {
      setSelected(panelId)
      setCollapsed(false)
      setShowSearch(false)
    }
    setIsDragOver(false)
  }

  const contentProps = { crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, searchQuery: externalQuery, onGeoSearch, onCountryClick }

  // ── FILLED STATE ─────────────────────────────────────────────────────────
  if (selected) {
    const meta = PANEL_META[selected]
    return (
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute', zIndex: 25, ...posStyle,
          width: size.w,
          background: 'rgba(8,14,10,0.96)',
          border: '1px solid #141e16',
          borderLeft: `2px solid ${collapsed ? '#141e16' : 'rgba(0,255,136,0.3)'}`,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          maxHeight: collapsed ? 'auto' : size.h,
          transition: 'max-height 0.2s',
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {/* Header — drag area */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px',
          height: 24, flexShrink: 0,
          borderBottom: collapsed ? 'none' : '1px solid #141e16',
          background: 'linear-gradient(90deg, rgba(0,255,136,0.06) 0%, transparent 60%)',
          position: 'relative',
          cursor: 'grab',
        }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 36, height: 1, background: 'rgba(0,255,136,0.22)' }} />
          {meta.dotColor && <span className={`live-dot ${meta.dotColor}`} />}
          <span className="panel-title" style={{ flex: 1 }}>{meta.title}</span>
          <button onClick={() => setCollapsed(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', fontSize: 11, lineHeight: 1, padding: '0 2px', transition: 'color .12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8aac90' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2a3e2e' }}
          >{collapsed ? '+' : '−'}</button>
          <button
            onClick={() => { setSelected(null); setShowSearch(true); setPanelSearch('') }}
            title="Switch view"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', fontSize: 9, lineHeight: 1, padding: '0 2px', letterSpacing: '.05em', transition: 'color .12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00ff88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2a3e2e' }}
          >⇄</button>
          <button onClick={() => { if (onClose) { onClose() } else { setSelected(null); setShowSearch(false) } }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', fontSize: 13, lineHeight: 1, padding: '0 2px', transition: 'color .12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff1a3e' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2a3e2e' }}
          >×</button>
        </div>

        {/* Content */}
        {!collapsed && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <PanelContent id={selected} {...contentProps} />
          </div>
        )}

        {/* Resize handle */}
        {!collapsed && resizeHandle}
      </div>
    )
  }

  // ── EMPTY STATE (drop zone + search) ──────────────────────────────────────
  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute', zIndex: 25, ...posStyle,
        width: size.w,
        background: isDragOver ? 'rgba(0,255,136,0.06)' : 'rgba(8,14,10,0.88)',
        border: `1px solid ${isDragOver ? 'rgba(0,255,136,0.4)' : '#141e16'}`,
        borderLeft: `2px solid ${isDragOver ? '#00ff88' : 'rgba(0,255,136,0.15)'}`,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        transition: 'all .15s',
        cursor: 'default',
        userSelect: 'none',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
        borderBottom: '1px solid #141e16',
        background: 'linear-gradient(90deg, rgba(0,255,136,0.06) 0%, transparent 70%)',
      }}>
        <span style={{ fontSize: 8, color: isDragOver ? '#00ff88' : '#2a3e2e', letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700, flex: 1 }}>
          {isDragOver ? '◆ ASSIGN' : onClose ? '◆ EMPTY' : '◆ ' + (position === 'left' ? 'PRIMARY' : 'SECONDARY')}
        </span>
        {onClose && (
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', fontSize: 13, lineHeight: 1, padding: '0 2px', transition: 'color .12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff1a3e' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2a3e2e' }}
          >×</button>
        )}
      </div>

      <div style={{ padding: '5px 8px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(0,0,0,0.4)', border: '1px solid #141e16', padding: '3px 7px',
          marginBottom: 5, transition: 'border-color .12s',
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,255,136,0.25)' }}
          onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#141e16' }}
        >
          <span style={{ fontSize: 9, color: '#2a3e2e' }}>⌕</span>
          <input
            ref={inputRef}
            value={panelSearch}
            onChange={e => setPanelSearch(e.target.value)}
            onFocus={() => setShowSearch(true)}
            placeholder="filter views…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 9, color: '#c0dcc4', fontFamily: 'inherit', letterSpacing: '.03em',
            }}
          />
          {panelSearch && (
            <button onClick={() => setPanelSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', fontSize: 11 }}>×</button>
          )}
        </div>

        <div style={{ maxHeight: 190, overflowY: 'auto' }}>
          {searchResults.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelected(p.id); setShowSearch(false); setPanelSearch('') }}
              style={{
                width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '4px 6px', borderBottom: '1px solid #0d120e',
                borderLeft: '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all .1s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = 'rgba(0,255,136,0.05)'
                el.style.borderLeftColor = 'rgba(0,255,136,0.3)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = ''
                el.style.borderLeftColor = 'transparent'
              }}
            >
              {p.dotColor && <span className={`live-dot ${p.dotColor}`} style={{ flexShrink: 0 }} />}
              {!p.dotColor && <span style={{ width: 5, height: 5, flexShrink: 0, background: '#141e16', borderRadius: 1 }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#8aac90', letterSpacing: '.06em', textTransform: 'uppercase' }}>{p.title}</div>
                <div style={{ fontSize: '7.5px', color: '#2a3e2e', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {!isDragOver && (
        <div style={{ padding: '4px 10px 6px', borderTop: '1px solid #0d120e', fontSize: '7.5px', color: '#1a2e1e', letterSpacing: '.08em' }}>
          // drag from dock or select to assign
        </div>
      )}

      {/* Resize handle */}
      {resizeHandle}
    </div>
  )
}
