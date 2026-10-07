import { useState } from 'react'
import type { Fit, Residual, Scale } from '../../utils/countryStats'
import { niceTicks } from '../../utils/countryStats'
import type { IndicatorMeta } from '../../services/countryIndicators'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'

const H = 270
const M = { l: 46, r: 12, t: 16, b: 38 }
const HIT = 24

/**
 * Country scatter with the fitted trend line. Axes follow each indicator's scale (log for heavy-tailed positives).
 * The countries furthest above and below the trend are coloured and labelled; every point has a hover readout and
 * is clickable. The Table view carries every value.
 */
export function ScatterChart({ points, xs, ys, xMeta, yMeta, fit, over, under, onSelect }: {
  points: Residual[]
  xs: Scale
  ys: Scale
  xMeta: IndicatorMeta
  yMeta: IndicatorMeta
  fit: Fit
  over: Residual[]
  under: Residual[]
  onSelect?: (iso3: string) => void
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ p: Residual; x: number; y: number } | null>(null)
  const innerW = Math.max(60, width - M.l - M.r)
  const innerH = H - M.t - M.b

  const txs = points.map(p => p.tx), tys = points.map(p => p.ty)
  const padX = (Math.max(...txs) - Math.min(...txs)) * 0.04 || 1
  const padY = (Math.max(...tys) - Math.min(...tys)) * 0.06 || 1
  const x0 = Math.min(...txs) - padX, x1 = Math.max(...txs) + padX
  const y0 = Math.min(...tys) - padY, y1 = Math.max(...tys) + padY
  const px = (t: number) => M.l + ((t - x0) / (x1 - x0)) * innerW
  const py = (t: number) => M.t + innerH - ((t - y0) / (y1 - y0)) * innerH
  const xTicks = niceTicks(xs.kind, xs.inv(x0), xs.inv(x1)).filter(v => xs.valid(v))
  const yTicks = niceTicks(ys.kind, ys.inv(y0), ys.inv(y1)).filter(v => ys.valid(v))
  const overSet = new Set(over.map(p => p.iso3)), underSet = new Set(under.map(p => p.iso3))
  const color = (p: Residual) => overSet.has(p.iso3) ? 'var(--series-2)' : underSet.has(p.iso3) ? 'var(--series-3)' : 'var(--series-1)'
  const lineY = (t: number) => fit.intercept + fit.slope * t

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const b = ref.current!.getBoundingClientRect()
    const mx = e.clientX - b.left, my = e.clientY - b.top
    let best: Residual | null = null, bd = HIT
    for (const p of points) {
      const d = Math.hypot(px(p.tx) - mx, py(p.ty) - my)
      if (d < bd) { bd = d; best = p }
    }
    setHover(best ? { p: best, x: mx, y: my } : null)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="viz-legend">
        <span><i className="sw bar" style={{ background: 'var(--series-1)', borderRadius: '50%' }} />Country</span>
        <span><i className="sw bar" style={{ background: 'var(--series-2)', borderRadius: '50%' }} />Furthest above trend (top 3 named)</span>
        <span><i className="sw bar" style={{ background: 'var(--series-3)', borderRadius: '50%' }} />Furthest below</span>
        <span><i className="sw line" style={{ background: 'var(--text2)' }} />Trend</span>
      </div>
      <svg width={width} height={H} role="img" aria-label={`Scatter of ${yMeta.label} against ${xMeta.label} for ${points.length} countries, with a fitted trend line. A table view lists every value.`}>
        {yTicks.map(v => (
          <g key={`y${v}`}>
            <line x1={M.l} x2={width - M.r} y1={py(ys.fwd(v))} y2={py(ys.fwd(v))} stroke="var(--border)" strokeWidth={1} />
            <text x={M.l - 6} y={py(ys.fwd(v)) + 3} textAnchor="end" fontSize={9} fill="var(--text3)">{yMeta.format(v)}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={`x${v}`}>
            <line x1={px(xs.fwd(v))} x2={px(xs.fwd(v))} y1={M.t} y2={M.t + innerH} stroke="var(--border)" strokeWidth={1} />
            <text x={px(xs.fwd(v))} y={M.t + innerH + 12} textAnchor="middle" fontSize={9} fill="var(--text3)">{xMeta.format(v)}</text>
          </g>
        ))}
        <text x={M.l} y={10} fontSize={9.5} fill="var(--text2)">{yMeta.label}</text>
        <text x={M.l + innerW / 2} y={H - 4} textAnchor="middle" fontSize={9.5} fill="var(--text2)">{xMeta.label}</text>
        <line x1={px(x0)} y1={py(lineY(x0))} x2={px(x1)} y2={py(lineY(x1))} stroke="var(--text2)" strokeWidth={2} strokeLinecap="round" />
        {points.map(p => (
          <circle key={p.iso3} cx={px(p.tx)} cy={py(p.ty)} r={hover?.p.iso3 === p.iso3 ? 6 : 4}
            fill={color(p)} fillOpacity={overSet.has(p.iso3) || underSet.has(p.iso3) ? 1 : 0.7} stroke="var(--surface)" strokeWidth={1.5} />
        ))}
        {[...over.slice(0, 3), ...under.slice(0, 3)].map(p => {
          const right = px(p.tx) < M.l + innerW * 0.7
          return (
            <text key={`l${p.iso3}`} x={px(p.tx) + (right ? 7 : -7)} y={py(p.ty) - 6} textAnchor={right ? 'start' : 'end'} fontSize={9.5} fill="var(--text1)"
              stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" style={{ pointerEvents: 'none' }}>{p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name}</text>
          )
        })}
        <rect x={M.l} y={M.t} width={innerW} height={innerH} fill="transparent" style={{ cursor: hover ? 'pointer' : 'default' }}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={() => hover && onSelect?.(hover.p.iso3)} />
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">{hover.p.name}</div>
          <div className="viz-tip-r"><b>{xMeta.format(hover.p.x)}</b> {xMeta.short} <span style={{ color: 'var(--text3)' }}>({hover.p.xYear})</span></div>
          <div className="viz-tip-r"><b>{yMeta.format(hover.p.y)}</b> {yMeta.short} <span style={{ color: 'var(--text3)' }}>({hover.p.yYear})</span></div>
          <div className="viz-tip-m">Trend expects {yMeta.format(hover.p.expected)} · {hover.p.z >= 0 ? '+' : '−'}{Math.abs(hover.p.z).toFixed(1)} σ</div>
        </Tooltip>
      )}
    </div>
  )
}
