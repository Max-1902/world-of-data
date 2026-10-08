import { useState } from 'react'
import { niceTicks } from '../../utils/countryStats'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'
import { crisp, textWidth, TICK } from './format'

export interface LinePoint { t: number; v: number }
export interface LineSeries {
  key: string
  label: string
  /** a CSS colour token, e.g. var(--series-1); assign in fixed order */
  color: string
  points: LinePoint[]
  dashed?: boolean
}
export interface RefLine { v: number; label: string }
export interface Band { from: number; to: number; label: string }

const M = { l: 44, r: 12, t: 10, b: 22 }
const YEAR_MS = 365.25 * 86_400_000

/** Gap threshold: a jump of more than 1.5× the series' typical step breaks the line instead of bridging missing data. */
function segments(pts: LinePoint[]): LinePoint[][] {
  if (pts.length < 2) return pts.length ? [pts] : []
  const steps = pts.slice(1).map((p, i) => p.t - pts[i].t).sort((a, b) => a - b)
  const step = steps[Math.floor(steps.length / 2)]
  const out: LinePoint[][] = [[pts[0]]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].t - pts[i - 1].t > step * 1.5) out.push([])
    out[out.length - 1].push(pts[i])
  }
  return out
}

/** Year ticks at a 1/2/5/10/20/25/50 step that fits the width. */
function yearTicks(t0: number, t1: number, width: number, isYear: boolean): number[] {
  const y0 = isYear ? t0 : new Date(t0).getUTCFullYear()
  const y1 = isYear ? t1 : new Date(t1).getUTCFullYear()
  const room = Math.max(1, Math.floor(width / 46))
  const step = [1, 2, 5, 10, 20, 25, 50].find(s => (y1 - y0) / s <= room) ?? 50
  const out: number[] = []
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
    const t = isYear ? y : Date.UTC(y, 0, 1)
    if (t >= t0 && t <= t1) out.push(t)
  }
  return out
}

/**
 * Time-series lines on one shared y-axis (never two). Missing periods break the line rather than being bridged.
 * Optional reference lines (a target, zero) and shaded bands (e.g. recessions). Hover or arrow keys move a crosshair
 * that reads every series at that date. `x` is either a calendar year or a UTC timestamp (`xKind`).
 */
export function LineChart({ series, xKind, fmtY, fmtX, refLines = [], bands = [], height = 170, ariaLabel }: {
  series: LineSeries[]
  xKind: 'year' | 'time'
  fmtY: (v: number) => string
  fmtX?: (t: number) => string
  refLines?: RefLine[]
  bands?: Band[]
  height?: number
  ariaLabel: string
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const all = series.flatMap(s => s.points)
  const xs = [...new Set(all.map(p => p.t))].sort((a, b) => a - b)
  if (!xs.length) return <div ref={ref} className="viz-note">No data for this period.</div>

  const fx = fmtX ?? ((t: number) => (xKind === 'year' ? String(t) : new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })))
  const vs = [...all.map(p => p.v), ...refLines.map(r => r.v)]
  let lo = Math.min(...vs), hi = Math.max(...vs)
  if (lo === hi) { lo -= Math.abs(lo) * 0.1 || 1; hi += Math.abs(hi) * 0.1 || 1 }
  const pad = (hi - lo) * 0.06
  const ticks = niceTicks('linear', lo - pad, hi + pad)
  const yMin = Math.min(lo - pad, ticks[0]), yMax = Math.max(hi + pad, ticks[ticks.length - 1])
  const left = Math.max(M.l, Math.max(...ticks.map(t => textWidth(fmtY(t), 10))) + 10)
  const innerW = Math.max(40, width - left - M.r)
  const innerH = height - M.t - M.b
  const t0 = xs[0], t1 = xs[xs.length - 1]
  const span = Math.max(t1 - t0, xKind === 'year' ? 1 : YEAR_MS / 12)
  const x = (t: number) => left + ((t - t0) / span) * innerW
  const y = (v: number) => M.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH
  const xTicks = yearTicks(t0, t1, innerW, xKind === 'year')
  const at = active === null ? null : xs[active]

  const nearest = (s: LineSeries, t: number) => {
    let best: LinePoint | null = null
    for (const p of s.points) if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p
    // only report a value that belongs to this date (same year / within half a month)
    const tol = xKind === 'year' ? 0.5 : YEAR_MS / 24
    return best && Math.abs(best.t - t) <= tol ? best : null
  }

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const t = t0 + ((e.clientX - r.left) / r.width) * span
    let bi = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - t) < Math.abs(xs[bi] - t)) bi = i
    setActive(bi)
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setActive(a => Math.max(0, (a ?? xs.length) - 1))
    else if (e.key === 'ArrowRight') setActive(a => Math.min(xs.length - 1, (a ?? -1) + 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {series.length > 1 && (
        <div className="viz-legend">
          {series.map(s => <span key={s.key}><i className="sw line" style={{ background: s.color, opacity: s.dashed ? 0.7 : 1 }} />{s.label}</span>)}
        </div>
      )}
      <svg width={width} height={height} role="img" tabIndex={0} onKeyDown={onKey} onBlur={() => setActive(null)}
        aria-label={`${ariaLabel} Use left and right arrow keys to read each date.`}>
        {bands.map(b => (
          <rect key={`${b.from}-${b.to}`} x={x(Math.max(t0, b.from)) - (xKind === 'year' ? innerW / span / 2 : 0)} y={M.t}
            width={Math.max(2, x(Math.min(t1, b.to)) - x(Math.max(t0, b.from)) + (xKind === 'year' ? innerW / span : 0))} height={innerH}
            fill="var(--text3)" opacity={0.12}><title>{b.label}</title></rect>
        ))}
        {ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={width - M.r} y1={crisp(y(t))} y2={crisp(y(t))} stroke={t === 0 ? 'var(--border-strong)' : 'var(--border)'} strokeWidth={1} />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end" {...TICK}>{fmtY(t)}</text>
          </g>
        ))}
        {refLines.map(r => (
          <g key={r.label}>
            <line x1={left} x2={width - M.r} y1={crisp(y(r.v))} y2={crisp(y(r.v))} stroke="var(--text2)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={width - M.r} y={y(r.v) - 4} textAnchor="end" fontSize={9.5} fill="var(--text2)">{r.label}</text>
          </g>
        ))}
        {xTicks.map(t => (
          <g key={t}>
            <line x1={crisp(x(t))} x2={crisp(x(t))} y1={M.t + innerH} y2={M.t + innerH + 3} stroke="var(--border-strong)" strokeWidth={1} />
            <text x={x(t)} y={height - 6} textAnchor="middle" {...TICK}>{xKind === 'year' ? t : new Date(t).getUTCFullYear()}</text>
          </g>
        ))}
        {series.map(s => segments(s.points).map((seg, i) => seg.length === 1
          ? <circle key={`${s.key}-${i}`} cx={x(seg[0].t)} cy={y(seg[0].v)} r={2.5} fill={s.color} />
          : <polyline key={`${s.key}-${i}`} points={seg.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />))}
        {series.map(s => {
          const last = s.points[s.points.length - 1]
          return last && !s.dashed && <circle key={`${s.key}-end`} cx={x(last.t)} cy={y(last.v)} r={3.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
        })}
        {at !== null && <line x1={x(at)} x2={x(at)} y1={M.t} y2={M.t + innerH} stroke="var(--text3)" strokeWidth={1} />}
        {at !== null && series.map(s => { const p = nearest(s, at); return p && <circle key={`${s.key}-hover`} cx={x(p.t)} cy={y(p.v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> })}
        <rect x={left} y={M.t} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
      </svg>
      {at !== null && (
        <Tooltip x={x(at)} y={M.t + 14} width={width}>
          <div className="viz-tip-h">{fx(at)}</div>
          {series.map(s => {
            const p = nearest(s, at)
            return <div key={s.key} className="viz-tip-r"><i className="sw line" style={{ background: s.color }} /><b>{p ? fmtY(p.v) : '—'}</b> {series.length > 1 ? s.label : ''}</div>
          })}
          {bands.filter(b => at >= b.from && at <= b.to).map(b => <div key={b.label} className="viz-tip-m">{b.label}</div>)}
        </Tooltip>
      )}
    </div>
  )
}
