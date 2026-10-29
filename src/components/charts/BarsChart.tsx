import { useState } from 'react'
import { useElementWidth } from './useElementWidth'
import { useHoverLeave } from './hoverLeave'
import { Tooltip } from './ChartFrame'
import { compact, crisp, niceAxis, tickLabel, TICK } from './format'
import { topRounded } from './marks'

export interface BarItem { label: string; value: number; detail?: string }

const H = 160
const M = { l: 34, r: 8, t: 14, b: 22 }

/**
 * Single-series columns. With few bars the value sits on each cap; with many it lives in the hover readout and the
 * table view. `tickEvery` thins the x labels for long axes (e.g. 24 hours).
 */
export function BarsChart({ items, ariaLabel, unit, tickEvery = 1 }: { items: BarItem[]; ariaLabel: string; unit: string; tickEvery?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const onLeave = useHoverLeave(ref, () => setHover(null))
  const place = (i: number, e: React.PointerEvent) => { const b = ref.current!.getBoundingClientRect(); setHover({ i, x: e.clientX - b.left, y: e.clientY - b.top }) }
  const innerW = Math.max(40, width - M.l - M.r)
  const innerH = H - M.t - M.b
  const { max, ticks } = niceAxis(Math.max(1, ...items.map(i => i.value)))
  const band = innerW / Math.max(1, items.length)
  const barW = Math.max(2, Math.min(24, band - 2))
  const x = (i: number) => M.l + band * i + band / 2
  const y = (v: number) => M.t + innerH - (v / max) * innerH
  const labelValues = items.length <= 10
  const hi = hover ? items[hover.i] : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={H} role="img" aria-label={ariaLabel}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={M.l} x2={width - M.r} y1={crisp(y(t))} y2={crisp(y(t))} stroke={t === 0 ? 'var(--border-strong)' : 'var(--border)'} strokeWidth={1} />
            <text x={M.l - 6} y={y(t) + 3.5} textAnchor="end" {...TICK}>{tickLabel(t)}</text>
          </g>
        ))}
        {items.map((it, i) => (
          <g key={it.label} onPointerMove={e => place(i, e)} onPointerDown={e => place(i, e)} onPointerLeave={onLeave}>
            <rect x={x(i) - band / 2} y={M.t} width={band} height={innerH + M.b} fill="transparent" />
            {it.value > 0 && <path d={topRounded(x(i) - barW / 2, y(it.value), barW, y(0) - y(it.value), 4)} fill="var(--series-1)" opacity={hover && hover.i !== i ? 0.5 : 1} />}
            {labelValues && it.value > 0 && <text x={x(i)} y={y(it.value) - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text1)" style={{ fontVariantNumeric: 'tabular-nums' }}>{compact(it.value)}</text>}
            {i % tickEvery === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" {...TICK}>{it.label}</text>}
          </g>
        ))}
      </svg>
      {hi && hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">{hi.label}</div>
          <div className="viz-tip-r"><b>{hi.value.toLocaleString()}</b> {unit}</div>
          {hi.detail && <div className="viz-tip-m">{hi.detail}</div>}
        </Tooltip>
      )}
    </div>
  )
}
