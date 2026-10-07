import { useMemo } from 'react'
import { format } from 'date-fns'
import { Map as MapIcon, RefreshCw } from 'lucide-react'
import { useConflictHistory } from '../../hooks/useConflictHistory'
import { HISTORY_DAYS } from '../../services/conflictHistory'
import {
  DAY_MS, backtestTrajectory, countryMatrix, dailySeries, describeBacktest, rateMovers, MIN_BIN_SAMPLES,
} from '../../utils/analytics'
import { ChartFrame } from '../charts/ChartFrame'
import { DailyChart } from '../charts/DailyChart'
import { HeatmapChart } from '../charts/HeatmapChart'
import { MoversChart, type Mover } from '../charts/MoversChart'
import { RateChart } from '../charts/RateChart'
import type { PanelState } from '../../types'

const SERIES_DAYS = 60
const HEAT_DAYS = 45
const HEAT_COUNTRIES = 12

const utcDay = (t: number) => format(new Date(t + new Date(t).getTimezoneOffset() * 60000), 'd MMM yyyy')
const pct = (v: number) => `${(v * 100).toFixed(0)}%`

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="viz-kpi">
      <div className="viz-kpi-l">{label}</div>
      <div className="viz-kpi-v">{value}</div>
      {detail && <div className="viz-kpi-d">{detail}</div>}
    </div>
  )
}

export function AnalyticsPanel({ panelState, onToggleLayer, onCountryClick }: {
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  onCountryClick?: (country: string) => void
}) {
  const h = useConflictHistory(true)
  const { events, endDay, status } = h

  const analysis = useMemo(() => {
    if (endDay === null || events.length === 0) return null
    const series = dailySeries(events, endDay, SERIES_DAYS)
    const matrix = countryMatrix(events, endDay, HEAT_DAYS, HEAT_COUNTRIES)
    const all = rateMovers(events, endDay)
    const movers: Mover[] = [
      ...all.filter(m => m.change > 0).slice(0, 6),
      ...all.filter(m => m.change < 0).reverse().slice(0, 4),
    ]
    const countries = new Set(events.map(e => e.country)).size
    const fatalities = events.reduce((s, e) => s + (e.fatalities ?? 0), 0)
    return { series, matrix, movers, backtest: backtestTrajectory(events, endDay), countries, fatalities, end: endDay }
  }, [events, endDay])

  const layerOn = panelState.analyticsHex
  const loading = status === 'loading' || status === 'idle'
  const lagDays = endDay === null ? 0 : Math.max(0, Math.round((Date.now() - endDay) / DAY_MS))

  if (!analysis) {
    return (
      <div className="viz-root">
        <div className="viz-note" role="status">
          {loading
            ? 'Loading the last 75 days of ACLED events…'
            : status === 'error'
              ? `The conflict history could not be loaded${h.error ? ` (${h.error})` : ''}. Try again in a moment.`
              : 'No ACLED events came back, so there is nothing to analyse. This panel needs the ACLED connection (credentials in .env). Check the source-health indicator in the top bar. Nothing here is estimated or filled in.'}
        </div>
        {!loading && <button className="cy-btn" onClick={() => void h.reload()} style={{ alignSelf: 'flex-start' }}><RefreshCw size={11} /> Retry</button>}
      </div>
    )
  }

  const { series, matrix, movers, backtest, countries, fatalities, end } = analysis
  const bt = backtest
  const hasBt = bt.insufficient === null

  return (
    <div className={`viz-root ${loading ? 'viz-stale' : ''}`}>
      <div className="viz-filters">
        <button className={`cy-btn ${layerOn ? 'active' : ''}`} aria-pressed={layerOn} onClick={() => onToggleLayer('analyticsHex')}
          title="Draw these results on the map as 3D hexagons — tilt the map to see heights">
          <MapIcon size={11} /> {layerOn ? 'On the map' : 'Show on map'}
        </button>
        {layerOn && (['intensity', 'change'] as const).map(m => (
          <button key={m} className={`cy-btn ${h.mapMode === m ? 'active' : ''}`} aria-pressed={h.mapMode === m} onClick={() => h.setMapMode(m)}
            title={m === 'intensity' ? 'Colour by activity in the latest 7 days' : 'Colour by change versus the 7 days before'}>
            {m === 'intensity' ? 'Intensity' : 'Change'}
          </button>
        ))}
        <button className="cy-btn" style={{ marginLeft: 'auto' }} onClick={() => void h.reload()} disabled={loading} title="Fetch the window again">
          <RefreshCw size={11} />
        </button>
      </div>

      <div className="viz-kpis">
        <Kpi label="Events analysed" value={events.length.toLocaleString()} detail={`${HISTORY_DAYS}-day ACLED window${h.truncated ? ' (incomplete)' : ''}`} />
        <Kpi label="Countries" value={countries.toLocaleString()} />
        <Kpi label="Reported fatalities" value={fatalities.toLocaleString()} />
        <Kpi label="Data through" value={utcDay(end).replace(/ \d{4}$/, '')}
          detail={lagDays === 0 ? 'today' : `${lagDays} day${lagDays === 1 ? '' : 's'} ago (reporting lag)`} />
      </div>
      {h.truncated && (
        <div className="viz-note" role="status">The window hit the request ceiling or a page failed to load, so the oldest days may be incomplete. Counts are a lower bound.</div>
      )}

      <ChartFrame
        title="Global activity by day"
        subtitle="Severity-weighted event score (critical 10 · high 6 · medium 3 · low 1), all countries."
        table={{ columns: ['Day (UTC)', 'Score', 'Events', 'Fatalities', '7-day avg'], rows: series.map(p => [utcDay(p.t), p.score, p.events, p.fatalities, p.avg7 === null ? '—' : p.avg7.toFixed(1)]) }}
      >
        <DailyChart points={series} />
      </ChartFrame>

      <ChartFrame
        title="Where activity is concentrated"
        subtitle={`Top ${matrix.countries.length} countries by score over ${HEAT_DAYS} days. Click a row to fly there.`}
        table={{ columns: ['Country', 'Total score', ...matrix.days.slice(-7).map(utcDay)], rows: matrix.countries.map((c, r) => [c, matrix.totals[r], ...matrix.cells[r].slice(-7)]) }}
        footer="Table shows the latest 7 days per country."
      >
        <HeatmapChart matrix={matrix} onCountryClick={onCountryClick} />
      </ChartFrame>

      <ChartFrame
        title="Biggest movers"
        subtitle="Change in average daily score: last 3 days versus the prior 7. Rates are compared, so steady activity reads as flat."
        table={{ columns: ['Country', 'Change / day', 'Last 3 days / day', 'Prior 7 days / day'], rows: movers.map(m => [m.country, (m.change > 0 ? '+' : '') + m.change.toFixed(1), m.recentRate.toFixed(1), m.priorRate.toFixed(1)]) }}
      >
        {movers.length > 0
          ? <MoversChart movers={movers} onCountryClick={onCountryClick} />
          : <div className="viz-note">No country moved beyond the flat band in this window.</div>}
      </ChartFrame>

      <ChartFrame
        title="Does the app's “rising” flag predict anything?"
        subtitle={`Walk-forward backtest of the Watchlist rule (3-day total beats the 7-day total before it): replayed on each past day using only data up to that day, then scored on the next ${bt.horizonDays} days.`}
        table={{
          columns: ['Group', 'Hit rate', 'Hits', 'Samples', '95% interval'],
          rows: [
            ['Flagged rising', pct(bt.flagged.rate), bt.flagged.hits, bt.flagged.n, `${pct(bt.flagged.ci[0])}–${pct(bt.flagged.ci[1])}`],
            ['Any active country', pct(bt.eligible.rate), bt.eligible.hits, bt.eligible.n, `${pct(bt.eligible.ci[0])}–${pct(bt.eligible.ci[1])}`],
            ...bt.bins.map(b => [`Velocity ${b.label}`, b.n < MIN_BIN_SAMPLES ? 'too few' : pct(b.rate), b.hits, b.n, b.n < MIN_BIN_SAMPLES ? '—' : `${pct(b.ci[0])}–${pct(b.ci[1])}`]),
          ],
        }}
        footer={hasBt
          ? `Hit = the next ${bt.horizonDays} days average a higher daily score than the trailing 10 days. Replays event counts only (no historical flight or news data exists to replay). Daily samples overlap, so intervals are optimistic. ${bt.firstEvalDay !== null && bt.lastEvalDay !== null ? `Evaluated ${utcDay(bt.firstEvalDay)} – ${utcDay(bt.lastEvalDay)}.` : ''}`
          : undefined}
      >
        {hasBt ? (
          <>
            <p className="viz-verdict" style={{ marginBottom: 6 }}>{describeBacktest(bt)}</p>
            <RateChart
              ariaLabel="Share of country-days followed by a busier week: flagged rising versus any active country"
              items={[{ label: 'Flagged rising', stat: bt.flagged, emphasis: true }, { label: 'Any active country', stat: bt.eligible }]}
            />
            <p className="viz-sub" style={{ margin: '8px 0 2px' }}>Hit rate by velocity score (50 = flat, higher = faster rise)</p>
            <RateChart
              ariaLabel="Share of country-days followed by a busier week, grouped by velocity score"
              items={bt.bins.map(b => ({ label: b.label, stat: b })) }
              reference={bt.eligible.rate} referenceLabel="Any active"
            />
          </>
        ) : <div className="viz-note">{describeBacktest(bt)}</div>}
      </ChartFrame>

      <div className="viz-note">
        Source: ACLED (free tier), conflict events with fatality counts. Severity weights are this app's own classification of ACLED event types, not ACLED's. ACLED publishes with a lag, so the newest days are usually undercounted.
      </div>
    </div>
  )
}
