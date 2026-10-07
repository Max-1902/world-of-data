import { useState } from 'react'
import { FALLING, RISING } from '../../utils/vizPalette'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'

export interface Mover { country: string; change: number; recentRate: number; priorRate: number; recentEvents: number; priorEvents: number }

const ROW_H = 20
const LABEL_W = 92

/**
 * Diverging bars around zero: right/red = activity rising versus the prior week, left/blue = falling.
 * Direction is also carried by a +/− sign and arrow, never by colour alone.
 */
export function MoversChart({ movers, onCountryClick }: { movers: Mover[]; onCountryClick?: (country: string) => void }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const maxAbs = Math.max(0.1, ...movers.map(m => Math.abs(m.change)))
  const valueRoom = 52
  const plotW = Math.max(40, width - LABEL_W - valueRoom * 2)
  const cx = LABEL_W + valueRoom + plotW / 2
  const half = plotW / 2
  const height = movers.length * ROW_H + 6
  const hm = hover ? movers[hover.i] : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" aria-label="Countries with the largest change in average daily score, last 3 days versus the prior 7 days">
        <line x1={cx} x2={cx} y1={0} y2={height} stroke="var(--border-strong)" strokeWidth={1} />
        {movers.map((m, i) => {
          const y = 3 + i * ROW_H
          const w = (Math.abs(m.change) / maxAbs) * half
          const rising = m.change > 0
          const x = rising ? cx : cx - w
          const r = Math.min(4, w / 2)
          const label = `${rising ? '▲ +' : '▼ −'}${Math.abs(m.change).toFixed(1)}`
          return (
            <g key={m.country} style={{ cursor: onCountryClick ? 'pointer' : 'default' }}
              onClick={() => onCountryClick?.(m.country)}
              onPointerMove={e => { const b = ref.current!.getBoundingClientRect(); setHover({ i, x: e.clientX - b.left, y: e.clientY - b.top }) }}
              onPointerLeave={() => setHover(null)}>
              <rect x={0} y={y - 2} width={width} height={ROW_H} fill="transparent" />
              <text x={LABEL_W - 8} y={y + ROW_H / 2 - 1} textAnchor="end" fontSize={10} fill="var(--text2)">{m.country.length > 14 ? m.country.slice(0, 13) + '…' : m.country}</text>
              <rect x={x} y={y + 2} width={Math.max(2, w)} height={ROW_H - 8} rx={r}
                fill={rising ? RISING : FALLING} opacity={hover && hover.i !== i ? 0.55 : 1} />
              <text x={rising ? cx + Math.max(2, w) + 5 : cx - Math.max(2, w) - 5} y={y + ROW_H / 2 - 1} textAnchor={rising ? 'start' : 'end'} fontSize={9.5} fill="var(--text1)" fontWeight={600}>{label}</text>
            </g>
          )
        })}
      </svg>
      <div className="viz-legend" style={{ justifyContent: 'center', marginTop: 2 }}>
        <span><i className="sw bar" style={{ background: FALLING }} />Falling</span>
        <span><i className="sw bar" style={{ background: RISING }} />Rising</span>
      </div>
      {hm && hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">{hm.country}</div>
          <div className="viz-tip-r"><b>{hm.recentRate.toFixed(1)}</b> / day, last 3 days ({hm.recentEvents} events)</div>
          <div className="viz-tip-r"><b>{hm.priorRate.toFixed(1)}</b> / day, prior 7 days ({hm.priorEvents} events)</div>
        </Tooltip>
      )}
    </div>
  )
}
