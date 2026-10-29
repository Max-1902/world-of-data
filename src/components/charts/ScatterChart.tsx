import { useState } from 'react'
import type { Fit, Residual, Scale } from '../../utils/countryStats'
import { niceTicks } from '../../utils/countryStats'
import type { IndicatorMeta } from '../../services/countryIndicators'
import { useElementWidth } from './useElementWidth'
import { useHoverLeave } from './hoverLeave'
import { Tooltip } from './ChartFrame'
import { crisp, textWidth, TICK } from './format'

const H = 270
const M = { l: 46, r: 12, t: 16, b: 38 }
const HIT = 24
const LABEL_SIZE = 10

interface PlacedLabel { iso3: string; text: string; x: number; y: number; anchor: 'start' | 'end' }

/**
 * Direct labels for the named outliers, placed so they never overlap each other or leave the plot: each tries
 * above-right, above-left, below-right, below-left of its dot and is dropped (still coloured, still in the tooltip
 * and table) when none fits.
 */
function placeLabels(items: { iso3: string; name: string; cx: number; cy: number }[], box: { l: number; r: number; t: number; b: number }): PlacedLabel[] {
  const placed: (PlacedLabel & { x0: number; x1: number; y0: number; y1: number })[] = []
  for (const it of items) {
    const text = it.name.length > 18 ? it.name.slice(0, 17) + '…' : it.name
    const w = textWidth(text, LABEL_SIZE), h = LABEL_SIZE + 2
    const tries = [[7, -7, 'start'], [-7, -7, 'end'], [7, 14, 'start'], [-7, 14, 'end']] as const
    for (const [dx, dy, anchor] of tries) {
      const x = it.cx + dx, y = it.cy + dy
      const x0 = anchor === 'start' ? x : x - w, x1 = x0 + w, y0 = y - LABEL_SIZE, y1 = y0 + h
      if (x0 < box.l || x1 > box.r || y0 < box.t || y1 > box.b) continue
      if (placed.some(p => x0 < p.x1 + 3 && x1 > p.x0 - 3 && y0 < p.y1 && y1 > p.y0)) continue
      placed.push({ iso3: it.iso3, text, x, y, anchor, x0, x1, y0, y1 })
      break
    }
  }
  return placed
}

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
  const onLeave = useHoverLeave(ref, () => setHover(null))
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
  // interleave above/below so the strongest outlier on each side gets first pick of label space
  const named = [0, 1, 2].flatMap(i => [over[i], under[i]]).filter((p): p is Residual => !!p)
  const labels = placeLabels(named.map(p => ({ iso3: p.iso3, name: p.name, cx: px(p.tx), cy: py(p.ty) })), { l: M.l, r: width - M.r, t: M.t, b: M.t + innerH })
  // highlighted dots draw last so they sit on top of the cloud
  const ordered = [...points.filter(p => !overSet.has(p.iso3) && !underSet.has(p.iso3)), ...points.filter(p => overSet.has(p.iso3) || underSet.has(p.iso3))]

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
        <span><i className="sw bar" style={{ background: 'var(--series-2)', borderRadius: '50%' }} />Furthest above trend</span>
        <span><i className="sw bar" style={{ background: 'var(--series-3)', borderRadius: '50%' }} />Furthest below trend</span>
        <span><i className="sw line" style={{ background: 'var(--text2)' }} />Trend</span>
      </div>
      <svg width={width} height={H} role="img" aria-label={`Scatter of ${yMeta.label} against ${xMeta.label} for ${points.length} countries, with a fitted trend line. A table view lists every value.`}>
        {yTicks.map(v => (
          <g key={`y${v}`}>
            <line x1={M.l} x2={width - M.r} y1={crisp(py(ys.fwd(v)))} y2={crisp(py(ys.fwd(v)))} stroke="var(--border)" strokeWidth={1} />
            <text x={M.l - 6} y={py(ys.fwd(v)) + 3.5} textAnchor="end" {...TICK}>{yMeta.format(v)}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={`x${v}`}>
            <line x1={crisp(px(xs.fwd(v)))} x2={crisp(px(xs.fwd(v)))} y1={M.t} y2={M.t + innerH} stroke="var(--border)" strokeWidth={1} />
            <text x={px(xs.fwd(v))} y={M.t + innerH + 13} textAnchor="middle" {...TICK}>{xMeta.format(v)}</text>
          </g>
        ))}
        <text x={M.l - 6} y={9} fontSize={10} fill="var(--text2)">{yMeta.label} ↑</text>
        <text x={width - M.r} y={H - 4} textAnchor="end" fontSize={10} fill="var(--text2)">{xMeta.label} →</text>
        <line x1={px(x0)} y1={py(lineY(x0))} x2={px(x1)} y2={py(lineY(x1))} stroke="var(--text2)" strokeWidth={2} strokeLinecap="round" />
        {ordered.map(p => (
          <circle key={p.iso3} cx={px(p.tx)} cy={py(p.ty)} r={hover?.p.iso3 === p.iso3 ? 6 : 4}
            fill={color(p)} fillOpacity={overSet.has(p.iso3) || underSet.has(p.iso3) ? 1 : 0.7} stroke="var(--surface)" strokeWidth={2} />
        ))}
        {labels.map(l => (
          <text key={`l${l.iso3}`} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={LABEL_SIZE} fill="var(--text1)"
            stroke="var(--surface)" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{l.text}</text>
        ))}
        <rect x={M.l} y={M.t} width={innerW} height={innerH} fill="transparent" style={{ cursor: hover ? 'pointer' : 'default' }}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={onLeave} onClick={() => hover && onSelect?.(hover.p.iso3)} />
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
