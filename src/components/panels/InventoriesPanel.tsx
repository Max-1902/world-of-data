import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useEiaInventories } from '../../hooks/useEiaInventories'
import { EIA_SERIES, type EiaSeriesDef, type WeeklyPoint } from '../../services/eia'
import { seasonal5y, summarize } from '../../utils/inventory'
import { ChartFrame } from '../charts/ChartFrame'
import { LineChart } from '../charts/LineChart'
import { Kpi, Method } from './countryLookup/shared'
import { GasStorageForecast } from './GasStorageForecast'

type Range = '1y' | '2y' | '5y'
const RANGES: { id: Range; label: string; years: number }[] = [
  { id: '1y', label: '1 year', years: 1 }, { id: '2y', label: '2 years', years: 2 }, { id: '5y', label: '5 years', years: 5 },
]

/** Display scale: EIA's thousand barrels → million barrels; Bcf kept as Bcf. */
function scaleFor(unit: string): { div: number; unit: string } {
  if (/thousand barrels|^mbbl$/i.test(unit.trim())) return { div: 1000, unit: 'M bbl' }
  if (/billion cubic feet|^bcf$/i.test(unit.trim())) return { div: 1, unit: 'Bcf' }
  return { div: 1, unit }
}

const dateFmt = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function SeriesCard({ def, points, unitRaw, range }: { def: EiaSeriesDef; points: WeeklyPoint[]; unitRaw: string; range: Range }) {
  const { div, unit } = scaleFor(unitRaw)
  const fmt = (v: number) => `${(v / div).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: div === 1 ? 0 : 1 })} ${unit}`
  // changes get one more decimal than levels, so a small build or draw doesn't round to zero
  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${(Math.abs(v) / div).toLocaleString('en-US', { maximumFractionDigits: div === 1 ? 1 : 2, minimumFractionDigits: div === 1 ? 0 : 2 })} ${unit}`
  const sum = useMemo(() => summarize(points), [points])
  const years = RANGES.find(r => r.id === range)!.years
  const shown = useMemo(() => {
    const from = new Date(points[points.length - 1].t); from.setUTCFullYear(from.getUTCFullYear() - years)
    return points.filter(p => p.t > from.getTime())
  }, [points, years])
  const bands = useMemo(() => shown.map(p => ({ p, s: seasonal5y(points, p.t) })), [shown, points])
  if (!sum) return null
  const withSeason = bands.filter(b => b.s)

  return (
    <ChartFrame
      title={def.label}
      subtitle={`Week ending ${dateFmt(sum.latest.t)} · EIA ${def.report}`}
      table={{
        columns: ['Week ending', 'Level', '5-yr average (same week)', '5-yr range'],
        rows: [...bands].reverse().map(({ p, s }) => [dateFmt(p.t), fmt(p.value), s ? fmt(s.avg) : '—', s ? `${fmt(s.min)} to ${fmt(s.max)}` : '—']),
      }}
      footer={
        <div className="viz-kpis">
          <Kpi label="Latest" value={fmt(sum.latest.value)} detail={`week ending ${dateFmt(sum.latest.t)}`} />
          <Kpi label="vs previous week" value={sum.weekChange == null ? '—' : signed(sum.weekChange)} detail={sum.weekChange == null ? 'previous week not reported' : sum.weekChange > 0 ? 'build' : sum.weekChange < 0 ? 'draw' : 'unchanged'} />
          <Kpi label="vs a year earlier" value={sum.yearChange == null ? '—' : signed(sum.yearChange)} detail="same week last year" />
          <Kpi label="vs 5-yr average" value={sum.vsSeasonalPct == null ? '—' : `${sum.vsSeasonalPct >= 0 ? '+' : '−'}${Math.abs(sum.vsSeasonalPct).toFixed(1)}%`}
            detail={sum.seasonal ? `range ${fmt(sum.seasonal.min)} to ${fmt(sum.seasonal.max)}` : 'fewer than 5 earlier years'} />
        </div>
      }>
      <LineChart ariaLabel={`${def.label}, weekly, last ${years === 1 ? 'year' : `${years} years`}, against the five-year range for the same week.`}
        xKind="time" height={210} fmtY={fmt} fmtX={dateFmt}
        areas={withSeason.length > 1 ? [{ key: 'range', label: '5-yr range (same week)', color: 'var(--series-3)', points: withSeason.map(b => ({ t: b.p.t, lo: b.s!.min, hi: b.s!.max })) }] : []}
        series={[
          { key: 'level', label: 'Level', color: 'var(--series-1)', points: shown.map(p => ({ t: p.t, v: p.value })) },
          ...(withSeason.length > 1 ? [{ key: 'avg', label: '5-yr average', color: 'var(--series-3)', dashed: true, points: withSeason.map(b => ({ t: b.p.t, v: b.s!.avg })) }] : []),
        ]} />
    </ChartFrame>
  )
}

/**
 * Energy inventories: EIA's weekly US stocks of crude oil, gasoline, distillate and natural gas, each against
 * the same week in the previous five years — the comparison markets read these reports by.
 */
export function InventoriesPanel() {
  const { results, retry } = useEiaInventories()
  const [range, setRange] = useState<Range>('1y')
  const all = EIA_SERIES.map(s => ({ def: s, r: results[s.id] }))
  const notConfigured = all.some(x => x.r?.status === 'not_configured')
  const loading = all.some(x => x.r === null)

  if (notConfigured) {
    return (
      <div className="viz-root">
        <div className="viz-note" role="status">
          <b>Not measured: no EIA API key on this deployment.</b> The weekly inventory data needs a free key from the US Energy
          Information Administration (no billing exists). Register at <a href="https://www.eia.gov/opendata/register.php" target="_blank" rel="noreferrer">eia.gov/opendata/register.php</a>,
          put the emailed key in <code>.env</code> as <code>EIA_API_KEY=…</code> (or in Vercel's environment variables), then restart the dev server.
        </div>
      </div>
    )
  }

  return (
    <div className="viz-root">
      <div className="viz-toggle" role="group" aria-label="Weeks shown in charts">
        {RANGES.map(r => <button key={r.id} className={range === r.id ? 'on' : ''} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}
      </div>
      {loading && <div className="viz-note" role="status">Loading EIA weekly reports…</div>}
      {all.map(({ def, r }) => {
        if (!r || r.status === 'not_configured') return null
        if (r.status === 'error') {
          return (
            <div key={def.id} className="viz-note" role="status">
              {def.label}: {r.message} <button className="cy-btn" onClick={retry}><RefreshCw size={11} /> Retry</button>
            </div>
          )
        }
        const card = <SeriesCard key={def.id} def={def} points={r.points} unitRaw={r.unit ?? def.unit} range={range} />
        return def.key === 'gas' ? [card, <GasStorageForecast key={`${def.id}-forecast`} points={r.points} />] : card
      })}
      <Method caveats="The 5-year average and range are computed here from EIA's own history, matching each week to the same calendar week in each of the five previous years; EIA's printed 5-year figures align weeks by its own report calendar and can differ slightly. Recent weeks are sometimes revised by EIA after first release.">
        Weekly levels from the US Energy Information Administration (Open Data API v2): commercial crude oil excluding the Strategic Petroleum Reserve, total motor gasoline and distillate fuel oil (Weekly Petroleum Status Report), working natural gas in underground storage for the Lower 48 (Weekly Natural Gas Storage Report), and the SPR. A rise from one week to the next is a build, a fall a draw.
      </Method>
    </div>
  )
}
