import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useCountryLookup } from '../../hooks/useCountryLookup'
import { pointsOf } from '../../services/countryLookup'
import { arForecast, backtestForecast, meanForecast, naiveForecast, type Forecast, type Pt } from '../../utils/econAnalysis'
import { ChartFrame } from '../charts/ChartFrame'
import { LineChart, type LinePoint } from '../charts/LineChart'
import { Kpi, Method, plain, toLine } from './countryLookup/shared'

const AR_ORDER = 2
const HORIZON = 3
const MIN_HISTORY = 15

interface Target { id: string; label: string; unit: string }
const TARGETS: Target[] = [
  { id: 'NY.GDP.MKTP.KD.ZG', label: 'Real GDP growth', unit: '%' },
  { id: 'FP.CPI.TOTL.ZG', label: 'Inflation (CPI)', unit: '%' },
  { id: 'SL.UEM.TOTL.ZS', label: 'Unemployment', unit: '%' },
]

function forecastLine(last: Pt, f: Forecast, pick: 'value' | 'lo' | 'hi'): LinePoint[] {
  return [{ t: last.x, v: last.y }, ...f.points.map(p => ({ t: p.year, v: p[pick] }))]
}

function Section({ target, series }: { target: Target; series: Pt[] }) {
  const ar = useMemo(() => arForecast(series, AR_ORDER, HORIZON), [series])
  const naive = useMemo(() => naiveForecast(series, HORIZON), [series])
  const flat = useMemo(() => meanForecast(series, HORIZON), [series])
  const backtest = useMemo(() => backtestForecast(series, s => arForecast(s, AR_ORDER, 1), MIN_HISTORY), [series])

  if (series.length < MIN_HISTORY || !ar || !naive) {
    return (
      <div className="viz-note">
        {target.label}: fewer than {MIN_HISTORY} years of data ({series.length} available) — not enough history for an honest forecast.
      </div>
    )
  }

  const last = series[series.length - 1]
  const beatsBaseline = backtest?.mae != null && backtest.baselineMae != null && backtest.mae < backtest.baselineMae

  return (
    <ChartFrame
      title={target.label}
      subtitle={`${ar.method} forecast vs. a "no change" baseline, next ${HORIZON} years`}
      table={{
        columns: ['Year', `AR(${AR_ORDER})`, '95% interval', 'Naive (last value)'],
        rows: ar.points.map((p, i) => [String(p.year), `${plain(p.value)}${target.unit}`, `${plain(p.lo)} to ${plain(p.hi)}${target.unit}`, `${plain(naive.points[i].value)}${target.unit}`]),
      }}
      footer={<>
        <div className="viz-kpis">
          <Kpi label={`${last.x} (latest)`} value={`${plain(last.y)}${target.unit}`} detail={`n = ${ar.n} years`} />
          <Kpi label={`${ar.points[0].year} forecast`} value={`${plain(ar.points[0].value)}${target.unit}`} detail={`95% CI ${plain(ar.points[0].lo)} to ${plain(ar.points[0].hi)}${target.unit}`} />
          <Kpi label="Backtest MAE, this model" value={backtest?.mae != null ? `${plain(backtest.mae)}${target.unit}` : '—'} detail={backtest ? `${backtest.folds} one-year-ahead folds` : 'not enough folds'} />
          <Kpi label="Backtest MAE, naive baseline" value={backtest?.baselineMae != null ? `${plain(backtest.baselineMae)}${target.unit}` : '—'} detail="repeat last known value" />
        </div>
        <p className="viz-verdict">
          {backtest == null
            ? `Not enough history to backtest this series out of sample.`
            : beatsBaseline
              ? <>On {backtest.folds} historical one-year-ahead tests, the AR({AR_ORDER}) model's average error ({plain(backtest.mae!)}{target.unit}) was lower than just repeating the last known value ({plain(backtest.baselineMae!)}{target.unit}).</>
              : <>On {backtest.folds} historical one-year-ahead tests, the AR({AR_ORDER}) model did <b>not</b> beat the naive baseline of repeating the last known value ({plain(backtest.mae ?? NaN)}{target.unit} vs {plain(backtest.baselineMae ?? NaN)}{target.unit}). The forecast above is shown anyway, for transparency — but the honest reading is that recent history predicts next year about as well as any model tried here.</>}
          {ar.longRun != null && <> Iterated forward, the forecast converges toward {plain(ar.longRun)}{target.unit}, a level set by the whole {last.x - ar.n + 1}–{last.x} history. If the economy has changed structurally since (e.g. a boom-era growth rate that no longer applies), that pull is an assumption of the model, not evidence.</>}
        </p>
        <Method caveats={`A point forecast ${HORIZON} years out on an annual series this short carries a wide, genuine interval — shown, not hidden. The backtest only ever fits on data before the year it is scored against (no look-ahead), but it reuses the same historical events the live model will have also seen, so a model that merely fits recent history well can still look good here without truly generalising. The 95% interval assumes past error spread holds and ignores uncertainty in the fitted coefficients, so it can hold the real outcome less often than 95%: for real GDP growth across 52 European and Asian economies, forecasts made for 2005–2025 landed inside it about 90% of the time one year ahead (research/FINDINGS.md).`}>
          Low-order autoregression (AR{AR_ORDER}) fit by ordinary least squares on the most recent unbroken run of years; forecast iterated forward using the model's own prior steps; 95% interval from the residual standard error (n − p − 1 degrees of freedom), widened with the horizon by the model's own ψ-weights (the standard AR forecast-error variance). Baseline: next year equals the last observed value (random walk). Backtest: for every possible cutoff year with at least {MIN_HISTORY} years before it, refit on data up to that year only and score the 1-year-ahead forecast against what actually happened next.
        </Method>
      </>}>
      <LineChart ariaLabel={`${target.label}, with forecast.`} xKind="year" fmtY={v => `${plain(v, 1)}${target.unit}`} refLines={target.unit === '%' ? [{ v: 0, label: '0' }] : undefined}
        series={[
          { key: 'hist', label: 'Actual', color: 'var(--series-1)', points: toLine(series) },
          { key: 'fc', label: `AR(${AR_ORDER}) forecast`, color: 'var(--series-2)', points: forecastLine(last, ar, 'value'), dashed: true },
          { key: 'lo', label: '95% low', color: 'var(--series-3)', points: forecastLine(last, ar, 'lo'), dashed: true },
          { key: 'hi', label: '95% high', color: 'var(--series-3)', points: forecastLine(last, ar, 'hi'), dashed: true },
          { key: 'naive', label: 'Naive baseline', color: 'var(--series-4)', points: forecastLine(last, naive, 'value'), dashed: true },
        ]} />
    </ChartFrame>
  )
}

/**
 * Predictions: statistical forecasts of a country's own macro series from its own history — AR(p) against a
 * random-walk baseline, each backtested out of sample before being shown. A home for this and future
 * forecasting work; see research/README.md for the parallel comparison on the Watchlist's crisis-trend flag
 * (src/research/mlTrend.ts), which runs as an offline research script rather than in this panel.
 */
export function PredictionsPanel() {
  const c = useCountryLookup()
  const [query, setQuery] = useState('')
  const current = c.countries.find(x => x.iso2 === c.iso2)
  const name = current?.name ?? c.data?.name ?? c.iso2
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return c.countries.filter(x => x.name.toLowerCase().includes(q) || x.iso2.toLowerCase() === q || x.iso3.toLowerCase() === q).slice(0, 8)
  }, [query, c.countries])

  return (
    <div className="viz-root cl-root">
      <div className="cl-search">
        <label className="viz-field" style={{ flex: 1 }}>
          <span>Country</span>
          <input className="viz-select" type="search" placeholder={c.countries.length ? `Search ${c.countries.length} economies…` : 'Loading country list…'} value={query}
            onChange={e => setQuery(e.target.value)} aria-label="Search for a country"
            onKeyDown={e => { if (e.key === 'Enter' && matches[0]) { c.setIso2(matches[0].iso2); setQuery('') } }} />
        </label>
        {matches.length > 0 && (
          <ul className="cl-matches" role="listbox" aria-label="Matching countries">
            {matches.map(m => (
              <li key={m.iso2}><button role="option" aria-selected={m.iso2 === c.iso2} onClick={() => { c.setIso2(m.iso2); setQuery('') }}>{m.name}<span>{m.region}</span></button></li>
            ))}
          </ul>
        )}
      </div>

      <header className="cl-head">
        <div>
          <h2 className="cl-name">{name}</h2>
          <p className="viz-sub">Statistical projections from {name}'s own World Bank history — not an AI forecast, and not a claim about what will happen.</p>
        </div>
      </header>

      {c.status === 'loading' && <div className="viz-note" role="status">Loading {name}'s World Bank record…</div>}
      {c.status === 'error' && <div className="viz-note" role="status">Could not reach the World Bank ({c.error}). <button className="cy-btn" onClick={c.retry}><RefreshCw size={11} /> Retry</button></div>}

      {c.data && TARGETS.map(t => <Section key={t.id} target={t} series={pointsOf(c.data, t.id)} />)}

      <p className="viz-foot">
        Every forecast here is backtested out of sample against a naive baseline before you see it, and the comparison is shown whether the
        model wins or loses. This is a projection of a time series from its own past, computed entirely in your browser — not a prediction
        informed by news, policy, or anything the AI Analyst has said. Source: World Bank Open Data, free and keyless.
      </p>
    </div>
  )
}
