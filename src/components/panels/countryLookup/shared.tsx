import type { ReactNode } from 'react'
import type { Pt } from '../../../utils/econAnalysis'
import type { LinePoint } from '../../charts/LineChart'

export function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="viz-kpi">
      <div className="viz-kpi-l">{label}</div>
      <div className="viz-kpi-v">{value}</div>
      {detail && <div className="viz-kpi-d">{detail}</div>}
    </div>
  )
}

/** "Result / Method / Caveats" block under an analysis, so every finding travels with how it was obtained. */
export function Method({ children, caveats }: { children: ReactNode; caveats?: ReactNode }) {
  return (
    <div className="cl-method">
      <div><b>Method.</b> {children}</div>
      {caveats && <div><b>Caveats.</b> {caveats}</div>}
    </div>
  )
}

export const fmtP = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`)
export const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`
export const pct = (v: number, d = 1) => `${signed(v, d)}%`
export const pp = (v: number, d = 1) => `${signed(v, d)} pp`
export const plain = (v: number, d = 1) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`

export const toLine = (pts: Pt[]): LinePoint[] => pts.map(p => ({ t: p.x, v: p.y }))

export type Period = 'all' | '1990' | '2000' | '2010'
export const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: 'All years' }, { id: '1990', label: 'Since 1990' }, { id: '2000', label: 'Since 2000' }, { id: '2010', label: 'Since 2010' },
]
export const fromYear = (p: Period) => (p === 'all' ? -Infinity : Number(p))
export const inPeriod = (pts: Pt[], p: Period) => pts.filter(x => x.x >= fromYear(p))
export const inPeriodT = <T extends { t: number }>(pts: T[], p: Period) => (p === 'all' ? pts : pts.filter(x => x.t >= Date.UTC(Number(p), 0, 1)))
