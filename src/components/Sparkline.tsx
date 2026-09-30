import type { SeriesPoint } from '../services/history'

interface Props {
  points: SeriesPoint[]
  width?: number
  height?: number
  color?: string
  /** Accessible description, e.g. "Risk score, last 6 days". */
  label: string
}

/** Tiny trend line. Renders nothing until there are at least 2 real points — no invented trend. */
export default function Sparkline({ points, width = 56, height = 16, color = 'var(--accent)', label }: Props) {
  if (points.length < 2) return null
  const t0 = points[0].t
  const span = Math.max(1, points[points.length - 1].t - t0)
  const vs = points.map(p => p.v)
  const min = Math.min(...vs)
  const max = Math.max(...vs)
  const range = max - min || 1
  const pad = 2
  const xy = points.map(p => {
    const x = pad + ((p.t - t0) / span) * (width - pad * 2)
    const y = height - pad - ((p.v - min) / range) * (height - pad * 2)
    return [x, y] as const
  })
  const last = xy[xy.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} style={{ flexShrink: 0 }}>
      <title>{label}</title>
      <polyline points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="1.75" fill={color} />
    </svg>
  )
}
