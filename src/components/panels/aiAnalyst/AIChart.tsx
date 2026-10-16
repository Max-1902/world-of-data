import { ChartFrame, type TableData } from '../../charts/ChartFrame'
import { LineChart } from '../../charts/LineChart'
import { RankChart } from '../../charts/RankChart'
import { compact } from '../../charts/format'
import type { ToolResult } from '../../../services/aiTools'

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']

const fmtNum = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? compact(a) : a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a.toFixed(2)
  return v < 0 ? `−${s}` : s
}
const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10)

/**
 * A chart of one tool result, drawn from the result's own data. The model only chooses where it goes ([CHART:R2]);
 * it cannot supply or alter a value, so every mark traces back to a fetched or locally computed number.
 */
export function AIChart({ result }: { result: ToolResult }) {
  const c = result.chart
  if (!c) return null
  const footer = <>{result.id} · {result.source}</>

  if (c.kind === 'rank') {
    const table: TableData = { columns: ['', c.unit], rows: c.items.map(i => [i.label, i.text]) }
    return (
      <ChartFrame title={result.title} subtitle={c.unit} table={table} footer={footer}>
        <RankChart ariaLabel={`${result.title}: ${c.items.slice(0, 3).map(i => `${i.label} ${i.text}`).join(', ')}`} items={c.items.map((i, k) => ({ key: `${k}-${i.label}`, ...i }))} />
      </ChartFrame>
    )
  }

  const fx = c.xKind === 'year' ? (t: number) => String(t) : fmtDate
  const xs = [...new Set(c.series.flatMap(s => s.points.map(p => p.t)))].sort((a, b) => a - b)
  if (!xs.length) return null
  const table: TableData = {
    columns: [c.xKind === 'year' ? 'Year' : 'Date', ...c.series.map(s => s.label)],
    rows: xs.slice(-60).reverse().map(t => [fx(t), ...c.series.map(s => { const p = s.points.find(q => q.t === t); return p ? fmtNum(p.v) : '–' })]),
  }
  return (
    <ChartFrame title={result.title} subtitle={c.unit} table={table} footer={footer}>
      <LineChart
        ariaLabel={`${result.title}, ${fx(xs[0])} to ${fx(xs[xs.length - 1])}`}
        xKind={c.xKind}
        fmtY={fmtNum}
        fmtX={c.xKind === 'time' ? (t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })) : undefined}
        series={c.series.map((s, i) => ({ key: `${i}-${s.label}`, label: s.label, color: s.dashed ? 'var(--accent)' : SERIES[i % SERIES.length], points: s.points, dashed: s.dashed, markers: s.points.length <= 20 }))}
        areas={c.area?.points.length ? [{ key: 'area', label: c.area.label, color: 'var(--accent)', points: c.area.points }] : []}
      />
    </ChartFrame>
  )
}
