import { useState } from 'react'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'
import { crisp, niceAxis, tickLabel, textWidth, TICK } from './format'
import { topRounded } from './marks'

export interface TimePoint {
  t: number
  value: number
  /** smoothed series; null until it has a full window */
  avg: number | null
  /** extra tooltip lines */
  lines?: string[]
}

const H = 150
const M = { l: 34, r: 10, t: 8, b: 20 }

const DAY = 86_400_000

/**
 * X ticks. Sub-daily buckets spanning 2+ days tick at UTC midnights (thinned to fit), so labels read "2 Oct 00:00"
 * rather than an arbitrary middle hour; otherwise first / middle / last.
 */
function timeTicks(points: TimePoint[], band: number, fmt: (t: number) => string): { i: number; anchor: 'start' | 'middle' | 'end' }[] {
  const n = points.length
  if (n === 0) return []
  const edge = (i: number) => (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') as 'start' | 'middle' | 'end'
  const step = n > 1 ? points[1].t - points[0].t : DAY
  if (step < DAY && points[n - 1].t - points[0].t >= 2 * DAY) {
    const room = textWidth(fmt(points[0].t), TICK.fontSize) + 16
    const every = Math.max(1, Math.ceil(room / (band * (DAY / step))))
    const mids = points.map((p, i) => (p.t % DAY === 0 ? i : -1)).filter(i => i >= 0).filter((_, k) => k % every === 0)
    // keep labels clear of the plot edges, where a centred label would hang outside the svg
    const cx = (i: number) => band * i + band / 2
    const fit = mids.filter(i => cx(i) >= room / 2 && cx(i) <= n * band - room / 2)
    if (fit.length >= 2) return fit.map(i => ({ i, anchor: 'middle' as const }))
  }
  return [...new Set([0, Math.floor((n - 1) / 2), n - 1])].map(i => ({ i, anchor: edge(i) }))
}

/** Columns for a per-bucket count with an optional trailing-mean line. Hover or arrow keys read any bucket. */
export function TimeSeriesChart({ points, valueLabel, avgLabel, fmtTick, fmtTitle, ariaLabel }: {
  points: TimePoint[]
  valueLabel: string
  avgLabel?: string
  fmtTick: (t: number) => string
  fmtTitle: (t: number) => string
  ariaLabel: string
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const n = points.length
  const innerW = Math.max(10, width - M.l - M.r)
  const innerH = H - M.t - M.b
  const { max, ticks } = niceAxis(Math.max(1, ...points.map(p => p.value), ...points.map(p => p.avg ?? 0)))
  const band = innerW / Math.max(1, n)
  const barW = band >= 4 ? Math.min(24, band - 2) : Math.max(1, band - 1)   // 2px surface gap once there is room
  const x = (i: number) => M.l + band * i + band / 2
  const y = (v: number) => M.t + innerH - (v / max) * innerH
  const avgPts = points.map((p, i) => p.avg === null ? null : [x(i), y(p.avg)] as const).filter((p): p is readonly [number, number] => p !== null)
  const last = avgPts[avgPts.length - 1]
  const ap = active === null ? null : points[active]
  const xTicks = timeTicks(points, band, fmtTick)

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setActive(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))))
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setActive(a => Math.max(0, (a ?? n) - 1))
    else if (e.key === 'ArrowRight') setActive(a => Math.min(n - 1, (a ?? -1) + 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {avgLabel && (
        <div className="viz-legend">
          <span><i className="sw bar" style={{ background: 'var(--series-1)' }} />{valueLabel}</span>
          <span><i className="sw line" style={{ background: 'var(--series-2)' }} />{avgLabel}</span>
        </div>
      )}
      <svg width={width} height={H} role="img" tabIndex={0} onKeyDown={onKey} onBlur={() => setActive(null)}
        aria-label={`${ariaLabel} Use left and right arrow keys to read each bar.`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={M.l} x2={width - M.r} y1={crisp(y(t))} y2={crisp(y(t))} stroke={t === 0 ? 'var(--border-strong)' : 'var(--border)'} strokeWidth={1} />
            <text x={M.l - 6} y={y(t) + 3.5} textAnchor="end" {...TICK}>{tickLabel(t)}</text>
          </g>
        ))}
        {points.map((p, i) => p.value > 0 && (
          <path key={p.t} d={topRounded(x(i) - barW / 2, y(p.value), barW, y(0) - y(p.value), 4)}
            fill="var(--series-1)" opacity={active === null || active === i ? 1 : 0.45} />
        ))}
        {avgPts.length > 1 && <polyline points={avgPts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {last && <circle cx={last[0]} cy={last[1]} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />}
        {xTicks.map(({ i, anchor }) => (
          <g key={i}>
            <line x1={crisp(x(i))} x2={crisp(x(i))} y1={M.t + innerH} y2={M.t + innerH + 3} stroke="var(--border-strong)" strokeWidth={1} />
            <text x={anchor === 'start' ? x(i) - band / 2 : anchor === 'end' ? x(i) + band / 2 : x(i)} y={H - 5} textAnchor={anchor} {...TICK}>{fmtTick(points[i].t)}</text>
          </g>
        ))}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={M.t} y2={M.t + innerH} stroke="var(--text3)" strokeWidth={1} />}
        {active !== null && ap?.avg != null && <circle cx={x(active)} cy={y(ap.avg)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />}
        <rect x={M.l} y={M.t} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
      </svg>
      {ap && active !== null && (
        <Tooltip x={x(active)} y={M.t + 14} width={width}>
          <div className="viz-tip-h">{fmtTitle(ap.t)}</div>
          <div className="viz-tip-r"><i className="sw bar" style={{ background: 'var(--series-1)' }} /><b>{ap.value.toLocaleString()}</b> {valueLabel.toLowerCase()}</div>
          {ap.avg !== null && avgLabel && <div className="viz-tip-r"><i className="sw line" style={{ background: 'var(--series-2)' }} /><b>{ap.avg.toFixed(1)}</b> {avgLabel.toLowerCase()}</div>}
          {ap.lines?.map(l => <div key={l} className="viz-tip-m">{l}</div>)}
        </Tooltip>
      )}
    </div>
  )
}
