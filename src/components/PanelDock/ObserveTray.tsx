import { useState, useRef } from 'react'
import type { CrisisEvent, PanelState, Flight } from '../../types'
import { PANEL_MAP } from '../../panels/registry'
import type { PanelProps } from '../../panels/types'
import PanelHost from '../PanelHost'

const MAX_SLOTS = 6
const MIN_H     = 80
const DEFAULT_H = 260
const MAX_H     = 700
const LS_KEY_H  = 'ws-observe-h'

function loadH(): number {
  try { const v = Number(localStorage.getItem(LS_KEY_H)); if (v >= MIN_H) return v } catch {}
  return DEFAULT_H
}

interface Props {
  ids: string[]
  crises: CrisisEvent[]
  flights: Flight[]
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
  onGeoSearch?: (q: string) => void
  onCountryClick?: (country: string) => void
  onClose: (id: string) => void
  onAdd: (id: string) => void
}

export default function ObserveTray({ ids, crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, onGeoSearch, onCountryClick, onClose, onAdd }: Props) {
  const [h, setH] = useState(loadH)
  const resRef = useRef<{ startY: number; startH: number } | null>(null)
  const [dragHover, setDragHover] = useState(false)
  const [splits, setSplits] = useState<Record<number, number>>({})
  const [rowSplits, setRowSplits] = useState<Record<string, number>>({})

  const slots = ids.slice(0, MAX_SLOTS)
  const contentProps = { crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, onGeoSearch, onCountryClick }

  // Build rows: 2 per row, only rows with content
  const filledRows: [string, string | null][] = []
  for (let i = 0; i < slots.length; i += 2) {
    filledRows.push([slots[i], slots[i + 1] ?? null])
  }

  // Row flex computation
  function getRowFlexes(): number[] {
    const n = filledRows.length
    if (n <= 1) return [1]
    if (n === 2) {
      const s = rowSplits['0-1'] ?? 0.5
      return [s, 1 - s]
    }
    const s01 = rowSplits['0-1'] ?? (1 / 3)
    const s12 = rowSplits['1-2'] ?? (2 / 3)
    const top = Math.max(0.1, s01)
    const mid = Math.max(0.1, s12 - s01)
    const bot = Math.max(0.1, 1 - s12)
    const total = top + mid + bot
    return [top / total, mid / total, bot / total]
  }

  function onResizeDown(e: React.MouseEvent) {
    e.preventDefault()
    resRef.current = { startY: e.clientY, startH: h }
    const onMove = (me: MouseEvent) => {
      if (!resRef.current) return
      const { startY, startH } = resRef.current
      setH(Math.min(MAX_H, Math.max(MIN_H, startH + (startY - me.clientY))))
    }
    const onUp = () => {
      try { localStorage.setItem(LS_KEY_H, String(h)) } catch {}
      resRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function onSplitDown(e: React.MouseEvent, rowIdx: number, containerEl: HTMLElement) {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerEl.getBoundingClientRect()
    const onMove = (me: MouseEvent) => {
      const frac = Math.min(0.85, Math.max(0.15, (me.clientX - rect.left) / rect.width))
      setSplits(prev => ({ ...prev, [rowIdx]: frac }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function onRowSplitDown(e: React.MouseEvent, key: string, containerEl: HTMLElement) {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerEl.getBoundingClientRect()
    const n = filledRows.length
    const onMove = (me: MouseEvent) => {
      const frac = Math.min(0.9, Math.max(0.1, (me.clientY - rect.top) / rect.height))
      setRowSplits(prev => {
        const next = { ...prev, [key]: frac }
        if (n === 3) {
          if (key === '0-1' && next['1-2'] !== undefined && frac >= next['1-2'] - 0.1) next[key] = next['1-2'] - 0.1
          if (key === '1-2' && next['0-1'] !== undefined && frac <= next['0-1'] + 0.1) next[key] = next['0-1'] + 0.1
        }
        return next
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const panelProps: PanelProps = contentProps as PanelProps

  function renderSlot(id: string) {
    const def = PANEL_MAP.get(id)
    if (!def) return null
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
        <div style={{
          height: 30, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 10px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
          userSelect: 'none',
        }}>
          {def.dotColor && <span className={`live-dot ${def.dotColor}`} />}
          <span className="panel-title" style={{ flex: 1 }}>{def.title}</span>
          <button
            onClick={() => onClose(id)}
            title="Return to dock"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, lineHeight: 1, padding: '2px 4px', borderRadius: 'var(--r-sm)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-soft)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            x
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <PanelHost label={def.title}>{def.render(panelProps)}</PanelHost>
        </div>
      </div>
    )
  }

  const rowFlexes = getRowFlexes()
  const hasSlots = slots.length > 0

  return (
    <div
      className="observe-tray"
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragHover(true) }}
      onDragLeave={() => setDragHover(false)}
      onDrop={e => {
        e.preventDefault(); setDragHover(false)
        const id = e.dataTransfer.getData('panelId')
        if (id && slots.length < MAX_SLOTS && !ids.includes(id)) onAdd(id)
      }}
      style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        zIndex: 30,
        height: hasSlots ? h : 26,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        borderTop: dragHover ? '1px solid var(--accent)' : '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        transition: hasSlots ? 'none' : 'height 0.15s',
      }}
    >
      {/* resize handle */}
      {hasSlots && (
        <div
          onMouseDown={onResizeDown}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 4,
            cursor: 'ns-resize', zIndex: 40,
          }}
        />
      )}

      {/* header */}
      <div style={{
        height: 26, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px',
        borderBottom: hasSlots ? '1px solid var(--border)' : 'none',
        background: 'var(--surface)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', color: 'var(--text3)' }}>
          OBSERVE
        </span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>
          {slots.length}/{MAX_SLOTS}
        </span>
        {!hasSlots && dragHover && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginLeft: 'auto' }}>
            DROP HERE
          </span>
        )}
      </div>

      {/* rows */}
      {hasSlots && (
        <div
          className="observe-rows"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}
        >
          {filledRows.map((row, ri) => {
            const hasRight = row[1] !== null
            const split = splits[ri] ?? 0.5
            const flex = rowFlexes[ri] ?? 1

            return (
              <div
                key={ri}
                style={{ flex: `${flex} 1 0%`, minHeight: 0, display: 'flex', position: 'relative', borderBottom: '1px solid var(--border)', padding: 4, gap: 4 }}
              >
                {/* left panel */}
                <div style={{
                  width: hasRight ? `${split * 100}%` : '100%',
                  display: 'flex',
                }}>
                  {renderSlot(row[0])}
                </div>

                {/* horizontal split handle */}
                {hasRight && (
                  <div
                    onMouseDown={e => {
                      const container = e.currentTarget.parentElement
                      if (container) onSplitDown(e, ri, container)
                    }}
                    style={{
                      position: 'absolute',
                      left: `calc(${split * 100}% - 2px)`,
                      top: 0, bottom: 0, width: 5,
                      cursor: 'col-resize', zIndex: 10,
                      borderRadius: 'var(--r-sm)',
                    }}
                  />
                )}

                {/* right panel */}
                {hasRight && (
                  <div style={{ flex: 1, display: 'flex' }}>
                    {renderSlot(row[1]!)}
                  </div>
                )}
              </div>
            )
          })}

          {/* Row border resize handles */}
          {filledRows.length >= 2 && (
            <div
              onMouseDown={e => {
                const container = e.currentTarget.parentElement
                if (container) onRowSplitDown(e, '0-1', container)
              }}
              style={{
                position: 'absolute',
                top: `calc(${(rowFlexes[0] / rowFlexes.reduce((a, b) => a + b, 0)) * 100}% - 2px)`,
                left: 0, right: 0, height: 5,
                cursor: 'ns-resize', zIndex: 10,
              }}
            />
          )}
          {filledRows.length >= 3 && (
            <div
              onMouseDown={e => {
                const container = e.currentTarget.parentElement
                if (container) onRowSplitDown(e, '1-2', container)
              }}
              style={{
                position: 'absolute',
                top: `calc(${((rowFlexes[0] + rowFlexes[1]) / rowFlexes.reduce((a, b) => a + b, 0)) * 100}% - 2px)`,
                left: 0, right: 0, height: 5,
                cursor: 'ns-resize', zIndex: 10,
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
