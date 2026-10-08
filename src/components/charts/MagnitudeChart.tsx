import { useState } from 'react'
import type { GutenbergRichter } from '../../utils/dataAnalytics'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'
import { crisp, TICK } from './format'

const H = 190
const M = { l: 40, r: 12, t: 10, b: 24 }

/**
 * Gutenberg–Richter plot: cumulative number of quakes at or above each magnitude on a log axis. A straight line
 * means a steady power law; the fitted line has slope −b and is anchored at the observed total.
 */
export function MagnitudeChart({ gr }: { gr: GutenbergRichter }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const pts = gr.points
  if (pts.length < 2) return <div className="viz-note">Too few earthquakes to plot a magnitude–frequency curve.</div>
  const innerW = Math.max(40, width - M.l - M.r)
  const innerH = H - M.t - M.b
  const mMin = pts[0].m
  const mMax = pts[pts.length - 1].m
  const decades = Math.max(1, Math.ceil(Math.log10(gr.n)))
  const x = (m: number) => M.l + ((m - mMin) / Math.max(0.1, mMax - mMin)) * innerW
  const y = (count: number) => M.t + innerH - (Math.log10(Math.max(1, count)) / decades) * innerH
  const fit = gr.b === null ? null : [mMin, mMax].map(m => [x(m), y(gr.n * 10 ** (-gr.b! * (m - gr.mc)))] as const)
  const hi = hover ? pts[hover.i] : null
  const xStep = (mMax - mMin) / 0.5 * 34 > innerW ? 1 : 0.5   // ~34px per label; widen the step when they'd touch
  const xTicks = Array.from({ length: Math.floor((mMax - mMin) / xStep) + 1 }, (_, i) => Math.round((mMin + i * xStep) * 10) / 10)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="viz-legend">
        <span><i className="sw bar" style={{ background: 'var(--series-1)', borderRadius: '50%' }} />Observed (cumulative)</span>
        {fit && <span><i className="sw line" style={{ background: 'var(--series-2)' }} />Fit, slope −b</span>}
      </div>
      <svg width={width} height={H} role="img" aria-label={`Cumulative earthquake count by minimum magnitude on a log scale, ${gr.n} quakes from magnitude ${gr.mc}`}>
        {Array.from({ length: decades + 1 }, (_, d) => 10 ** d).map(v => (
          <g key={v}>
            <line x1={M.l} x2={width - M.r} y1={crisp(y(v))} y2={crisp(y(v))} stroke={v === 1 ? 'var(--border-strong)' : 'var(--border)'} strokeWidth={1} />
            <text x={M.l - 6} y={y(v) + 3.5} textAnchor="end" {...TICK}>{v.toLocaleString()}</text>
          </g>
        ))}
        {xTicks.map(m => <text key={m} x={x(m)} y={H - 7} textAnchor="middle" {...TICK}>{m.toFixed(1)}</text>)}
        {pts.map((p, i) => (
          <g key={p.m} onPointerMove={e => { const b = ref.current!.getBoundingClientRect(); setHover({ i, x: e.clientX - b.left, y: e.clientY - b.top }) }} onPointerLeave={() => setHover(null)}>
            <circle cx={x(p.m)} cy={y(p.cumulative)} r={12} fill="transparent" />
            <circle cx={x(p.m)} cy={y(p.cumulative)} r={hover?.i === i ? 5 : 4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        ))}
        {/* the fit sits above the dots: drawn beneath, 30 ringed markers chop it into dashes */}
        {fit && <line x1={fit[0][0]} y1={fit[0][1]} x2={fit[1][0]} y2={fit[1][1]} stroke="var(--series-2)" strokeWidth={2} strokeLinecap="round" style={{ pointerEvents: 'none' }} />}
      </svg>
      {hi && hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">Magnitude ≥ {hi.m.toFixed(1)}</div>
          <div className="viz-tip-r"><b>{hi.cumulative.toLocaleString()}</b> quakes</div>
        </Tooltip>
      )}
    </div>
  )
}
