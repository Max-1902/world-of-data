import { useRef, useState } from 'react'
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
  /** a dot on every observation, so single values can be picked out (the crosshair tooltip reads them) */
  markers?: boolean
}
/** A shaded range between two lines (e.g. a forecast interval), drawn as a 12% wash by default. */
export interface LineArea { key: string; label: string; color: string; points: { t: number; lo: number; hi: number }[]; opacity?: number }
export interface RefLine { v: number; label: string }
export interface Band { from: number; to: number; label: string; opacity?: number }

const M = { l: 44, r: 16, t: 10, b: 22 }
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
 * that reads every series at that date. Click or tap to pin a date; `x` is a year or UTC timestamp (`xKind`).
 */
export function LineChart({ series, areas = [], xKind, fmtY, fmtX, refLines = [], bands = [], forecastBoundary, observedLabel = 'Observed', projectedLabel = 'Forecast', height = 170, ariaLabel }: {
  series: LineSeries[]
  areas?: LineArea[]
  xKind: 'year' | 'time'
  fmtY: (v: number) => string
  fmtX?: (t: number) => string
  refLines?: RefLine[]
  bands?: Band[]
  /** X coordinate between the last observed point and the first forecast point. */
  forecastBoundary?: number
  /** Name for the data left of the boundary, matching how the panel's legend names its history. */
  observedLabel?: string
  /** Name for the data right of the boundary (e.g. 'Nowcast'). */
  projectedLabel?: string
  height?: number
  ariaLabel: string
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  // the Observed | Forecast labels sit in a strip above the plot so they never overlap the data
  const top = forecastBoundary === undefined ? M.t : 22
  const [active, setActive] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const all = [...series.flatMap(s => s.points), ...areas.flatMap(a => a.points.flatMap(p => [{ t: p.t, v: p.lo }, { t: p.t, v: p.hi }]))]
  const xs = [...new Set(all.map(p => p.t))].sort((a, b) => a - b)
  if (!xs.length) return <div ref={ref} className="viz-note">No data for this period.</div>

  const fx = fmtX ?? ((t: number) => (xKind === 'year' ? String(t) : new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })))
  const vs = [...all.map(p => p.v), ...refLines.map(r => r.v)]
  let lo = Math.min(...vs), hi = Math.max(...vs)
  if (lo === hi) { lo -= Math.abs(lo) * 0.1 || 1; hi += Math.abs(hi) * 0.1 || 1 }
  const pad = (hi - lo) * 0.06
  const ticks = niceTicks('linear', lo - pad, hi + pad)
  const yMin = Math.min(lo - pad, ticks[0]), yMax = Math.max(hi + pad, ticks[ticks.length - 1])
  const left = Math.max(M.l, Math.max(...ticks.map(t => textWidth(fmtY(t), TICK.fontSize))) + 10)
  const innerW = Math.max(40, width - left - M.r)
  const innerH = height - top - M.b
  const t0 = xs[0], t1 = xs[xs.length - 1]
  const span = Math.max(t1 - t0, xKind === 'year' ? 1 : YEAR_MS / 12)
  const x = (t: number) => left + ((t - t0) / span) * innerW
  const y = (v: number) => top + innerH - ((v - yMin) / (yMax - yMin)) * innerH
  const xTicks = yearTicks(t0, t1, innerW, xKind === 'year')
  const at = active === null ? null : xs[active]

  const nearest = (s: LineSeries, t: number) => {
    let best: LinePoint | null = null
    for (const p of s.points) if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p
    // only report a value that belongs to this date (same year / within half a month)
    const tol = xKind === 'year' ? 0.5 : YEAR_MS / 24
    return best && Math.abs(best.t - t) <= tol ? best : null
  }

  function nearestIndex(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const t = t0 + ((e.clientX - r.left) / r.width) * span
    let bi = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - t) < Math.abs(xs[bi] - t)) bi = i
    return bi
  }
  function onMove(e: React.PointerEvent<SVGRectElement>) {
    if (pinned && e.pointerType !== 'touch') return
    setActive(nearestIndex(e))
  }
  function togglePin(index: number) {
    if (pinned && active === index) { setPinned(false); setActive(null) }
    else { setActive(index); setPinned(true) }
  }
  function onPointerDown(e: React.PointerEvent<SVGRectElement>) {
    const index = nearestIndex(e)
    if (e.pointerType !== 'touch') { togglePin(index); return }
    touchStart.current = { x: e.clientX, y: e.clientY }
    setActive(index)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerUp(e: React.PointerEvent<SVGRectElement>) {
    const start = touchStart.current
    if (!start || e.pointerType !== 'touch') return
    touchStart.current = null
    const index = nearestIndex(e)
    // A tap toggles the pin; a drag across the chart leaves the date it ended on pinned, so the value just read stays up.
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 10) togglePin(index)
    else { setActive(index); setPinned(true) }
  }
  function onPointerCancel() {
    // the browser took the gesture for a vertical scroll
    touchStart.current = null
    if (!pinned) setActive(null)
  }
  function clear() { setActive(null); setPinned(false) }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') { setPinned(false); setActive(a => Math.max(0, (a ?? xs.length) - 1)) }
    else if (e.key === 'ArrowRight') { setPinned(false); setActive(a => Math.min(xs.length - 1, (a ?? -1) + 1)) }
    else if (e.key === 'Escape') clear()
    else return
    e.preventDefault()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {series.length > 1 && (
        <div className="viz-legend">
          {series.map(s => <span key={s.key}><i className={`sw line${s.dashed ? ' dashed' : ''}`} style={{ color: s.color }} />{s.label}</span>)}
          {areas.map(a => <span key={a.key}><i className="sw bar" style={{ background: a.color, opacity: 0.3 }} />{a.label}</span>)}
        </div>
      )}
      <svg width={width} height={height} role="img" tabIndex={0} onKeyDown={onKey} onBlur={clear}
        aria-label={`${ariaLabel}${forecastBoundary === undefined ? '' : ' A vertical rule separates observed data from the forecast.'} Use left and right arrow keys to read each date. Tap or click a point to pin its readout; press Escape to clear it.`}>
        {bands.map(b => (
          <rect key={`${b.from}-${b.to}`} x={x(Math.max(t0, b.from)) - (xKind === 'year' ? innerW / span / 2 : 0)} y={top}
            width={Math.max(2, x(Math.min(t1, b.to)) - x(Math.max(t0, b.from)) + (xKind === 'year' ? innerW / span : 0))} height={innerH}
            fill="var(--text3)" opacity={b.opacity ?? 0.12}><title>{b.label}</title></rect>
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
            <text x={width - M.r} y={y(r.v) - 4} textAnchor="end" fontSize={10.5} fill="var(--text2)">{r.label}</text>
          </g>
        ))}
        {xTicks.map(t => (
          <g key={t}>
            <line x1={crisp(x(t))} x2={crisp(x(t))} y1={top + innerH} y2={top + innerH + 3} stroke="var(--border-strong)" strokeWidth={1} />
            <text x={x(t)} y={height - 6} textAnchor="middle" {...TICK}>{xKind === 'year' ? t : new Date(t).getUTCFullYear()}</text>
          </g>
        ))}
        {areas.map(a => a.points.length > 1 && (
          <polygon key={a.key} fill={a.color} opacity={a.opacity ?? 0.12} stroke="none"
            points={[...a.points.map(p => `${x(p.t).toFixed(1)},${y(p.hi).toFixed(1)}`), ...[...a.points].reverse().map(p => `${x(p.t).toFixed(1)},${y(p.lo).toFixed(1)}`)].join(' ')} />
        ))}
        {series.map(s => segments(s.points).map((seg, i) => seg.length === 1
          ? <circle key={`${s.key}-${i}`} cx={x(seg[0].t)} cy={y(seg[0].v)} r={2.5} fill={s.color} />
          : <polyline key={`${s.key}-${i}`} points={seg.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />))}
        {series.map(s => s.markers
          ? s.points.map(p => (
              <circle key={`${s.key}-m-${p.t}`} cx={x(p.t)} cy={y(p.v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            ))
          : (() => {
              const last = s.points[s.points.length - 1]
              return last && !s.dashed && <circle key={`${s.key}-end`} cx={x(last.t)} cy={y(last.v)} r={3.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            })())}
        {forecastBoundary !== undefined && forecastBoundary >= t0 && forecastBoundary <= t1 && (
          <g aria-hidden="true" fontSize={10.5} fontWeight={600} fill="var(--text1)">
            <line x1={crisp(x(forecastBoundary))} x2={crisp(x(forecastBoundary))} y1={top - 14} y2={top + innerH} stroke="var(--text2)" strokeWidth={1.5} />
            <text x={x(forecastBoundary) - 6} y={top - 5} textAnchor="end">{observedLabel}</text>
            <text x={x(forecastBoundary) + 6} y={top - 5} textAnchor="start">{projectedLabel}</text>
          </g>
        )}
        {at !== null && <line x1={x(at)} x2={x(at)} y1={top} y2={top + innerH} stroke="var(--text3)" strokeWidth={1} />}
        {at !== null && series.map(s => { const p = nearest(s, at); return p && <circle key={`${s.key}-hover`} cx={x(p.t)} cy={y(p.v)} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> })}
        <rect x={left} y={top} width={innerW} height={innerH} fill="transparent" style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
          onPointerMove={onMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
          onPointerLeave={e => { if (!pinned && e.pointerType !== 'touch') setActive(null) }} />
      </svg>
      {at !== null && (
        <Tooltip x={x(at)} y={top + 14} width={width}>
          <div className="viz-tip-h">{fx(at)}</div>
          {pinned && <div className="viz-tip-m">Pinned</div>}
          {series.map(s => {
            const p = nearest(s, at)
            return <div key={s.key} className="viz-tip-r"><i className={`sw line${s.dashed ? ' dashed' : ''}`} style={{ color: s.color }} /><b>{p ? fmtY(p.v) : '—'}</b> {series.length > 1 ? s.label : ''}</div>
          })}
          {areas.map(a => {
            const p = a.points.find(q => Math.abs(q.t - at) <= (xKind === 'year' ? 0.5 : YEAR_MS / 24))
            return p && <div key={a.key} className="viz-tip-r"><i className="sw bar" style={{ background: a.color, opacity: 0.35 }} /><b>{fmtY(p.lo)} to {fmtY(p.hi)}</b> {a.label.replace(/\s*\(.*\)$/, '')}</div>
          })}
          {bands.filter(b => at >= b.from && at <= b.to).map(b => <div key={b.label} className="viz-tip-m">{b.label}</div>)}
        </Tooltip>
      )}
    </div>
  )
}
