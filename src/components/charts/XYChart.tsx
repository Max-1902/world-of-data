import { useState } from 'react'
import { niceTicks } from '../../utils/countryStats'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'
import { crisp, textWidth, TICK } from './format'

export interface XYPoint { key: string; x: number; y: number; label: string }

const H = 220
const M = { l: 40, r: 12, t: 10, b: 34 }

/**
 * Scatter of one country's own observations (one dot per year) with the fitted OLS line. The most recent year is
 * labelled; every dot has a hover readout.
 */
export function XYChart({ points, fit, xLabel, yLabel, fmtX, fmtY, ariaLabel }: {
  points: XYPoint[]
  fit?: { slope: number; intercept: number }
  xLabel: string
  yLabel: string
  fmtX: (v: number) => string
  fmtY: (v: number) => string
  ariaLabel: string
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<XYPoint | null>(null)
  if (!points.length) return <div ref={ref} className="viz-note">No overlapping years.</div>
  const pad = (lo: number, hi: number) => { const d = (hi - lo) * 0.08 || 1; return [lo - d, hi + d] as const }
  const [x0, x1] = pad(Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x)))
  const [y0, y1] = pad(Math.min(...points.map(p => p.y)), Math.max(...points.map(p => p.y)))
  const xt = niceTicks('linear', x0, x1), yt = niceTicks('linear', y0, y1)
  const left = Math.max(M.l, Math.max(...yt.map(t => textWidth(fmtY(t), 10))) + 10)
  const innerW = Math.max(40, width - left - M.r), innerH = H - M.t - M.b
  const sx = (v: number) => left + ((v - x0) / (x1 - x0)) * innerW
  const sy = (v: number) => M.t + innerH - ((v - y0) / (y1 - y0)) * innerH
  const latest = points.reduce((a, b) => (b.key > a.key ? b : a))
  const clipY = (v: number) => Math.max(y0, Math.min(y1, v))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={H} role="img" aria-label={ariaLabel}>
        {yt.map(t => (
          <g key={`y${t}`}>
            <line x1={left} x2={width - M.r} y1={crisp(sy(t))} y2={crisp(sy(t))} stroke={t === 0 ? 'var(--border-strong)' : 'var(--border)'} strokeWidth={1} />
            <text x={left - 6} y={sy(t) + 3.5} textAnchor="end" {...TICK}>{fmtY(t)}</text>
          </g>
        ))}
        {xt.map(t => (
          <g key={`x${t}`}>
            <line x1={crisp(sx(t))} x2={crisp(sx(t))} y1={M.t} y2={M.t + innerH} stroke={t === 0 ? 'var(--border-strong)' : 'var(--border)'} strokeWidth={1} />
            <text x={sx(t)} y={M.t + innerH + 13} textAnchor="middle" {...TICK}>{fmtX(t)}</text>
          </g>
        ))}
        <text x={left + innerW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--text2)">{xLabel}</text>
        <text x={12} y={M.t + innerH / 2} textAnchor="middle" fontSize={10} fill="var(--text2)" transform={`rotate(-90 12 ${M.t + innerH / 2})`}>{yLabel}</text>
        {fit && <line x1={sx(x0)} x2={sx(x1)} y1={sy(clipY(fit.intercept + fit.slope * x0))} y2={sy(clipY(fit.intercept + fit.slope * x1))} stroke="var(--series-2)" strokeWidth={2} />}
        {points.map(p => (
          <circle key={p.key} cx={sx(p.x)} cy={sy(p.y)} r={p === latest ? 5 : 4} fill="var(--series-1)" fillOpacity={hover && hover !== p ? 0.35 : 0.8}
            stroke="var(--surface)" strokeWidth={1.5} onPointerEnter={() => setHover(p)} onPointerLeave={() => setHover(null)} />
        ))}
        <text x={sx(latest.x) + 7} y={sy(latest.y) - 6} fontSize={10} fill="var(--text1)">{latest.label}</text>
      </svg>
      {hover && (
        <Tooltip x={sx(hover.x)} y={sy(hover.y)} width={width}>
          <div className="viz-tip-h">{hover.label}</div>
          <div className="viz-tip-r">{xLabel}: <b>{fmtX(hover.x)}</b></div>
          <div className="viz-tip-r">{yLabel}: <b>{fmtY(hover.y)}</b></div>
        </Tooltip>
      )}
    </div>
  )
}
