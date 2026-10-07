import { useState } from 'react'
import { format } from 'date-fns'
import type { DailyPoint } from '../../utils/analytics'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'

const H = 150
const M = { l: 34, r: 10, t: 8, b: 20 }

function niceMax(v: number): number {
  if (v <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(v))
  const f = v / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
}
const compact = (n: number) => n >= 1000 ? `${+(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(Math.round(n))
const dayLabel = (t: number) => format(new Date(t + new Date(t).getTimezoneOffset() * 60000), 'd MMM')

/** Daily weighted severity as columns with a 7-day mean line. Hover or arrow keys read any day. */
export function DailyChart({ points }: { points: DailyPoint[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const n = points.length
  const innerW = Math.max(10, width - M.l - M.r)
  const innerH = H - M.t - M.b
  const max = niceMax(Math.max(...points.map(p => p.score), ...points.map(p => p.avg7 ?? 0)))
  const band = innerW / Math.max(1, n)
  const barW = Math.max(1, Math.min(24, band - 2))
  const x = (i: number) => M.l + band * i + band / 2
  const y = (v: number) => M.t + innerH - (v / max) * innerH
  const avgPts = points.map((p, i) => p.avg7 === null ? null : [x(i), y(p.avg7)] as const).filter((p): p is readonly [number, number] => p !== null)
  const last = avgPts[avgPts.length - 1]
  const ticks = [0, max / 2, max]
  const ap = active === null ? null : points[active]

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
      <div className="viz-legend">
        <span><i className="sw bar" style={{ background: 'var(--series-1)' }} />Daily severity score</span>
        <span><i className="sw line" style={{ background: 'var(--series-2)' }} />7-day average</span>
      </div>
      <svg width={width} height={H} role="img" tabIndex={0} onKeyDown={onKey} onBlur={() => setActive(null)}
        aria-label={`Daily weighted severity score over ${n} days, with a 7-day average. Use left and right arrow keys to read each day.`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={M.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="var(--text3)">{compact(t)}</text>
          </g>
        ))}
        {points.map((p, i) => p.score > 0 && (
          <rect key={p.t} x={x(i) - barW / 2} y={y(p.score)} width={barW} height={Math.max(0, y(0) - y(p.score))}
            rx={barW > 5 ? 2 : 0} fill="var(--series-1)" opacity={active === null || active === i ? 0.9 : 0.45} />
        ))}
        {avgPts.length > 1 && <polyline points={avgPts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {last && <circle cx={last[0]} cy={last[1]} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />}
        {[0, Math.floor((n - 1) / 2), n - 1].map(i => (
          <text key={i} x={x(i)} y={H - 5} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={9} fill="var(--text3)">{dayLabel(points[i].t)}</text>
        ))}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={M.t} y2={M.t + innerH} stroke="var(--text3)" strokeWidth={1} />}
        {active !== null && ap?.avg7 != null && <circle cx={x(active)} cy={y(ap.avg7)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />}
        <rect x={M.l} y={M.t} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
      </svg>
      {ap && active !== null && (
        <Tooltip x={x(active)} y={M.t + 14} width={width}>
          <div className="viz-tip-h">{dayLabel(ap.t)}</div>
          <div className="viz-tip-r"><i className="sw bar" style={{ background: 'var(--series-1)' }} /><b>{ap.score.toLocaleString()}</b> score · {ap.events.toLocaleString()} events</div>
          {ap.avg7 !== null && <div className="viz-tip-r"><i className="sw line" style={{ background: 'var(--series-2)' }} /><b>{ap.avg7.toFixed(0)}</b> 7-day avg</div>}
          <div className="viz-tip-m">{ap.fatalities.toLocaleString()} reported fatalities</div>
        </Tooltip>
      )}
    </div>
  )
}
