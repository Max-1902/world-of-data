import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { EIA_SERIES, fetchEiaSeries, type EiaResult, type WeeklyPoint } from '../../services/eia'
import { backtestGasStorage, forecastGasStorage, SEASON_WINDOW_DAYS, MIN_PAIRS, type GasBacktest } from '../../utils/gasStorage'
import { ChartFrame } from '../charts/ChartFrame'
import { LineChart } from '../charts/LineChart'
import { Kpi, Method } from './countryLookup/shared'

const dateFmt = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const bcf = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v)).toLocaleString('en-US')} Bcf`
const range = (lo: number, hi: number) => Number.isFinite(lo) && Number.isFinite(hi) ? `${bcf(lo)} to ${bcf(hi)}` : '—'
const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const dmLabel = (p: number) => p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`
const kind = (v: number) => v > 0 ? 'injection' : v < 0 ? 'withdrawal' : 'no change'

function Verdict({ bt }: { bt: GasBacktest }) {
  const { model, seasonal, last } = bt.score
  const headline = bt.modelWins ? 'model' : 'seasonal'
  const coverage = bt.coverageByMethod[headline]
  const gain = (1 - bt.relMae) * 100
  const losing = bt.byMonth.filter(m => m.n > 0 && m.model > m.seasonal).map(m => MONTHS[m.month])
  const years = `${new Date(bt.from).getUTCFullYear()}–${new Date(bt.to).getUTCFullYear()}`
  return (
    <>
      <p className="viz-verdict">
        In {bt.folds.length} weekly forecasts made in time order ({years}), each from earlier reports only, the model's average miss
        was <b>{model.mae.toFixed(1)} Bcf</b>, against {seasonal.mae.toFixed(1)} Bcf for the five-year seasonal norm and {last.mae.toFixed(1)} Bcf
        for repeating last week's change.{' '}
        {bt.relMae < 1
          ? <>That is {gain.toFixed(0)}% smaller than the seasonal norm{bt.dmVsSeasonal ? ` (52-week HAC Diebold–Mariano ${dmLabel(bt.dmVsSeasonal.p)})` : ''}{bt.modelWins ? ' — it also beat the norm in both time periods, so the model is the headline.' : ', but it did not clear the evidence rule for replacing the seasonal norm.'}</>
          : <>It did <b>not</b> beat the seasonal norm, so the seasonal norm is the headline.</>}
        {' '}Direction (injection vs withdrawal) was right {pct(model.directionHit)} of the time for the model and {pct(seasonal.directionHit)} for the seasonal norm.
      </p>
      <p className="viz-verdict">
        {bt.periods.length > 1 && <>By period: {bt.periods.map(p => `${p.label} ${p.model.toFixed(1)} vs ${p.seasonal.toFixed(1)} Bcf (${p.n} weeks)`).join('; ')}. </>}
        {losing.length
          ? <>Where it fails: in {losing.join(', ')} its average miss was larger than the norm's. </>
          : <>It beat the norm in every calendar month. </>}
        Largest misses: {bt.worst.slice(0, 3).map(w => `${dateFmt(w.t)} (reported ${bcf(w.actual)}, forecast ${bcf(w.forecast.model)})`).join('; ')}.
      </p>
      <p className="viz-verdict">
        Uncertainty: the headline method's 80% range held the reported change in {coverage.coverage80.n ? `${pct(coverage.coverage80.held / coverage.coverage80.n)} of ${coverage.coverage80.n} backtest weeks` : 'not enough same-season backtest weeks to measure coverage'}
        {coverage.coverage95.n ? ` and its 95% range in ${pct(coverage.coverage95.held / coverage.coverage95.n)} of ${coverage.coverage95.n} weeks` : ''}. It is calibrated by season; observed coverage is measured, not guaranteed.
      </p>
    </>
  )
}

/**
 * Next week's change in US gas storage, with the backtest that decides whether the model or the seasonal norm is shown.
 * Computes everything from the levels it is given; `GasStorageForecastPanel` loads them.
 */
export function GasStorageForecast({ points }: { points: WeeklyPoint[] }) {
  const bt = useMemo(() => backtestGasStorage(points), [points])
  const fc = useMemo(() => forecastGasStorage(points, bt), [points, bt])
  if (!bt || !fc) {
    return (
      <div className="viz-note" role="status">
        Next week's gas storage change: not enough history to forecast and backtest (needs five years of weekly reports for the seasonal norm plus {MIN_PAIRS} weeks to fit the model).
      </div>
    )
  }
  const recent = bt.folds.slice(-52)
  const head = fc.headline
  const headLabel = head === 'model' ? 'Model' : 'Seasonal norm'
  const other = head === 'model' ? { label: 'Seasonal norm', v: fc.value.seasonal } : { label: 'Model', v: fc.value.model }

  return (
    <ChartFrame
      title="Next week's natural-gas storage change"
      subtitle={`Forecast for the week ending ${dateFmt(fc.t)} · based on EIA reports to ${dateFmt(fc.basedOn.t)} · backtested on ${bt.folds.length} weeks`}
      table={{
        columns: ['Week ending', 'Reported change', 'Model', 'Seasonal norm', 'Last week', 'Model 80% range'],
        rows: [...recent].reverse().map(f => [dateFmt(f.t), bcf(f.actual), bcf(f.forecast.model), bcf(f.forecast.seasonal), bcf(f.forecast.last), f.lo80 == null ? '—' : range(f.lo80, f.hi80!)]),
      }}
      footer={
        <>
          <div className="viz-kpis">
            <Kpi label={`Forecast (${headLabel.toLowerCase()})`} value={bcf(fc.value[head])} detail={kind(fc.value[head])} />
            <Kpi label="80% range" value={range(fc.lo80, fc.hi80)} detail={`95%: ${range(fc.lo95, fc.hi95)}`} />
            <Kpi label={other.label} value={bcf(other.v)} detail={head === 'model' ? 'same week, previous 5 years' : `β = ${fc.beta.toFixed(2)}`} />
            <Kpi label="Last reported" value={bcf(fc.basedOn.value)} detail={`week ending ${dateFmt(fc.basedOn.t)}`} />
          </div>
          <Verdict bt={bt} />
          <Method caveats={<>The replay uses today's EIA history, including later revisions and reclassifications; it does not reconstruct exactly what was known at each historical forecast date. Only one model was tried, and the headline rule was set before its backtest. The interval rule was changed once after seeing the backtest: a version using the last three years of errors regardless of season held 52% of winter weeks in its "80%" range. Weather is left out: using the forecast week's actual weather would leak the answer, and a fair test needs weather forecasts as issued at the time. Market consensus estimates, which do use weather, are not compared here.</>}>
            Target: the change in Lower-48 working gas between consecutive weekly EIA reports. Seasonal norm: the average change in the same calendar week of the five previous years. Model: that norm plus β × last week's departure from its own norm, with β refit each week by least squares on all earlier weeks (needs {MIN_PAIRS}). Backtest: every week from the first with enough history is forecast from earlier data only. The model becomes the headline only if it has lower MAE than the norm overall and in both time periods, and a 52-week HAC Diebold–Mariano p below 0.05. Ranges: the split-conformal quantile of the headline method's earlier backtest misses within {SEASON_WINDOW_DAYS} days of the same calendar date. Errors overlap over time, so empirical coverage is measured in the backtest, not guaranteed.
          </Method>
        </>
      }>
      <LineChart ariaLabel="Reported weekly change in US gas storage over the last 52 weeks, against the model's forecast made one week earlier and its 80% range."
        xKind="time" height={200} fmtY={bcf} fmtX={dateFmt} refLines={[{ v: 0, label: 'no change' }]}
        areas={[{ key: 'r80', label: 'Model 80% range', color: 'var(--series-3)', points: recent.filter(f => f.lo80 != null).map(f => ({ t: f.t, lo: f.lo80!, hi: f.hi80! })) }]}
        series={[
          { key: 'actual', label: 'Reported change', color: 'var(--series-1)', points: recent.map(f => ({ t: f.t, v: f.actual })) },
          { key: 'model', label: 'Model (made a week earlier)', color: 'var(--series-2)', dashed: true, points: recent.map(f => ({ t: f.t, v: f.forecast.model })) },
        ]} />
    </ChartFrame>
  )
}

const GAS = EIA_SERIES.find(s => s.key === 'gas')!

/** Forecasts-section panel: loads EIA's weekly gas storage (shared cache with Energy Inventories) and shows the forecast. */
export function GasStorageForecastPanel() {
  const [attempt, setAttempt] = useState(0)
  const [r, setR] = useState<EiaResult | null>(null)
  useEffect(() => {
    let alive = true
    setR(null)
    fetchEiaSeries(GAS.id).then(res => { if (alive) setR(res) })
    return () => { alive = false }
  }, [attempt])

  return (
    <div className="viz-root">
      {r === null && <div className="viz-note" role="status">Loading EIA weekly gas storage…</div>}
      {r?.status === 'not_configured' && (
        <div className="viz-note" role="status">
          <b>Not measured: no EIA API key on this deployment.</b> This forecast needs EIA's weekly gas storage data, which needs a free key
          (no billing exists). Register at <a href="https://www.eia.gov/opendata/register.php" target="_blank" rel="noreferrer">eia.gov/opendata/register.php</a>,
          put the emailed key in <code>.env</code> as <code>EIA_API_KEY=…</code>, then restart the dev server.
        </div>
      )}
      {r?.status === 'error' && (
        <div className="viz-note" role="status">
          {GAS.label}: {r.message} <button className="cy-btn" onClick={() => setAttempt(a => a + 1)}><RefreshCw size={11} /> Retry</button>
        </div>
      )}
      {r?.status === 'ok' && <GasStorageForecast points={r.points} />}
    </div>
  )
}
