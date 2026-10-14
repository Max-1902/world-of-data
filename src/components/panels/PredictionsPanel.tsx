import { useMemo, useState } from 'react'
import { AlertTriangle, MoveRight, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { useCountryLookup } from '../../hooks/useCountryLookup'
import { pointsOf } from '../../services/countryLookup'
import { arForecast, backtestForecast, median, naiveForecast, trendTest, type Forecast, type Pt } from '../../utils/econAnalysis'
import { ChartFrame } from '../charts/ChartFrame'
import { LineChart, type LinePoint } from '../charts/LineChart'
import { Kpi, Method, PERIODS, inPeriod, plain, toLine, type Period } from './countryLookup/shared'

const AR_ORDER = 2
const HORIZON = 3
const MIN_HISTORY = 15

/** `evidence`: what the cross-country evaluation found for this target (research/FINDINGS.md, 2026-10-14). */
interface Target { id: string; label: string; unit: string; evidence: string }
const TARGETS: Target[] = [
  { id: 'NY.GDP.MKTP.KD.ZG', label: 'Real GDP growth', unit: '%',
    evidence: 'Tested on 52 European and Asian economies (forecasts for 1990–2025): this model beat "repeat last year" in 42 of 52, but the IMF\'s October World Economic Outlook beat this model in 44 of 52 — average next-year error 1.9 pp vs 2.3 pp, even with the model given the full current year the IMF did not yet have.' },
  { id: 'FP.CPI.TOTL.ZG', label: 'Inflation (CPI)', unit: '%',
    evidence: 'Tested on 50 European and Asian economies (forecasts for 1990–2025): this model beat "repeat last year" in only 13 of 50 (average 1-year error 4.1 pp vs 2.0 pp). The IMF\'s October forecasts did about as well as "repeat last year" (2.1 pp each). For inflation, treat this forecast as weaker than assuming no change.' },
  { id: 'SL.UEM.TOTL.ZS', label: 'Unemployment', unit: '%',
    evidence: 'Tested on 52 European and Asian economies (forecasts for 2006–2025): this model beat "repeat last year" in 20 of 52; three years ahead its average error was about twice the naive one (3.8 vs 1.8 pp for forecasts made 2006–2014, 2.4 vs 1.2 pp since), mostly from non-stationary fits. No historical IMF unemployment forecasts were available to compare.' },
]

const tolerance = 1e-9

/** Recent-trend line: Sen slope through the median intercept, over the trend test's own window. */
function trendLine(series: Pt[], t: { from: number; to: number; slope: number }): LinePoint[] {
  const w = series.filter(p => p.x >= t.from && p.x <= t.to)
  const b0 = median(w.map(p => p.y - t.slope * p.x))
  return [{ t: t.from, v: b0 + t.slope * t.from }, { t: t.to, v: b0 + t.slope * t.to }]
}

function Direction({ dir, label }: { dir: 'up' | 'down' | 'flat'; label: string }) {
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : MoveRight
  return <b className="pred-dir"><Icon size={14} aria-hidden /> {label}</b>
}

function forecastLine(last: Pt, f: Forecast, pick: 'value' | 'lo' | 'hi'): LinePoint[] {
  return [{ t: last.x, v: last.y }, ...f.points.map(p => ({ t: p.year, v: p[pick] }))]
}

function Section({ target, series, period }: { target: Target; series: Pt[]; period: Period }) {
  const ar = useMemo(() => arForecast(series, AR_ORDER, HORIZON), [series])
  const naive = useMemo(() => naiveForecast(series, HORIZON), [series])
  const trend = useMemo(() => trendTest(series), [series])
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
  const end = ar.points[ar.points.length - 1]
  const delta = Math.round(end.value * 10) / 10 - Math.round(last.y * 10) / 10 // from the shown 1-dp values, so the sentence adds up
  const fcDir = Math.abs(delta) < tolerance ? 'flat' : delta > 0 ? 'up' : 'down'
  const noChangeInside = last.y >= end.lo && last.y <= end.hi
  const unstable = ar.longRun == null
  const shown = inPeriod(series, period)
  const u = target.unit

  return (
    <ChartFrame
      title={target.label}
      subtitle={`${ar.method} forecast vs. a "no change" baseline, next ${HORIZON} years`}
      table={{
        columns: ['Year', 'Actual', `AR(${AR_ORDER}) forecast`, '95% interval', 'Naive (last value)'],
        rows: [
          ...[...ar.points].reverse().map(p => [String(p.year), '—', `${plain(p.value)}${u}`, `${plain(p.lo)} to ${plain(p.hi)}${u}`, `${plain(naive.points[p.year - last.x - 1].value)}${u}`]),
          ...[...series].reverse().map(p => [String(p.x), `${plain(p.y)}${u}`, '', '', '']),
        ],
      }}
      footer={<>
        <div className="viz-kpis">
          <Kpi label={`${last.x} (latest)`} value={`${plain(last.y)}${target.unit}`} detail={`n = ${ar.n} years`} />
          <Kpi label={`${ar.points[0].year} forecast`} value={`${plain(ar.points[0].value)}${target.unit}`} detail={`95% CI ${plain(ar.points[0].lo)} to ${plain(ar.points[0].hi)}${target.unit}`} />
          <Kpi label="Backtest MAE, this model" value={backtest?.mae != null ? `${plain(backtest.mae, 2)} pp` : '—'} detail={backtest ? `${backtest.folds} one-year-ahead folds` : 'not enough folds'} />
          <Kpi label="Backtest MAE, naive baseline" value={backtest?.baselineMae != null ? `${plain(backtest.baselineMae, 2)} pp` : '—'} detail="repeat last known value" />
        </div>
        <div className="pred-dirs">
          <p>
            <span className="pred-dir-k">Forecast direction</span>
            <Direction dir={fcDir} label={fcDir === 'up' ? 'Rising' : fcDir === 'down' ? 'Falling' : 'Flat'} />{' '}
            {plain(last.y)}{u} ({last.x}) → {plain(end.value)}{u} ({end.year}), {delta >= 0 ? '+' : '−'}{plain(Math.abs(delta))} pp.{' '}
            {noChangeInside
              ? <>The {end.year} 95% interval ({plain(end.lo)} to {plain(end.hi)}{u}) includes the {last.x} value, so "no change" is still inside the model's own range.</>
              : <>The {end.year} 95% interval ({plain(end.lo)} to {plain(end.hi)}{u}) excludes the {last.x} value — a clear direction under the model's assumptions, which the backtest below qualifies.</>}
          </p>
          <p>
            <span className="pred-dir-k">Recent trend</span>
            {trend == null
              ? <>not enough recent years to test.</>
              : <><Direction dir={trend.direction} label={trend.direction === 'up' ? 'Upward' : trend.direction === 'down' ? 'Downward' : 'No significant trend'} />{' '}
                  {trend.from}–{trend.to}: {trend.slope >= 0 ? '+' : '−'}{plain(Math.abs(trend.slope), 2)} pp per year (Sen slope), {trend.p < 0.001 ? 'p < 0.001' : `p = ${trend.p.toFixed(3)}`} (Mann–Kendall, autocorrelation-corrected){trend.direction === 'flat' ? ' — no trend line drawn.' : '.'}</>}
          </p>
        </div>
        {unstable && (
          <p className="viz-verdict pred-warn" role="note">
            <AlertTriangle size={14} aria-hidden /> <b>Unstable fit.</b> The fitted AR({AR_ORDER}) is non-stationary: iterated forward its forecast runs away instead of settling, so the multi-year numbers are not meaningful. In the cross-country backtest such fits were off by about 32 pp on average three years ahead (unemployment).
          </p>
        )}
        <p className="viz-verdict">
          {backtest == null
            ? `Not enough history to backtest this series out of sample.`
            : beatsBaseline
              ? <>On {backtest.folds} historical one-year-ahead tests, the AR({AR_ORDER}) model's average error ({plain(backtest.mae!, 2)} pp) was lower than just repeating the last known value ({plain(backtest.baselineMae!, 2)} pp).</>
              : <>On {backtest.folds} historical one-year-ahead tests, the AR({AR_ORDER}) model did <b>not</b> beat the naive baseline of repeating the last known value ({plain(backtest.mae ?? NaN, 2)} pp vs {plain(backtest.baselineMae ?? NaN, 2)} pp). The forecast above is shown anyway, for transparency — but the honest reading is that recent history predicts next year about as well as any model tried here.</>}
          {ar.longRun != null && <> Iterated forward, the forecast converges toward {plain(ar.longRun)}{target.unit}, a level set by the whole {last.x - ar.n + 1}–{last.x} history. If the economy has changed structurally since (e.g. a boom-era growth rate that no longer applies), that pull is an assumption of the model, not evidence.</>}
        </p>
        <p className="viz-verdict">{target.evidence}</p>
        <Method caveats={`A point forecast ${HORIZON} years out on an annual series this short carries a wide, genuine interval — shown, not hidden. The backtest only ever fits on data before the year it is scored against (no look-ahead), but it reuses the same historical events the live model will have also seen, so a model that merely fits recent history well can still look good here without truly generalising. The 95% interval assumes past error spread holds and ignores uncertainty in the fitted coefficients, so it can hold the real outcome less often than 95%: for real GDP growth across 52 European and Asian economies, forecasts made for 2005–2025 landed inside it about 90% of the time one year ahead (research/FINDINGS.md).`}>
          Low-order autoregression (AR{AR_ORDER}) fit by ordinary least squares on the most recent unbroken run of years; forecast iterated forward using the model's own prior steps; 95% interval from the residual standard error (n − p − 1 degrees of freedom), widened with the horizon by the model's own ψ-weights (the standard AR forecast-error variance). Baseline: next year equals the last observed value (random walk). Backtest: for every possible cutoff year with at least {MIN_HISTORY} years before it, refit on data up to that year only and score the 1-year-ahead forecast against what actually happened next.
        </Method>
      </>}>
      <LineChart ariaLabel={`${target.label}, ${shown[0]?.x ?? last.x}–${last.x}, with a ${HORIZON}-year forecast ${fcDir === 'up' ? 'rising' : fcDir === 'down' ? 'falling' : 'flat'} to ${plain(end.value)}${u}.`}
        xKind="year" height={250} fmtY={v => `${plain(v, 1)}${u}`} refLines={u === '%' ? [{ v: 0, label: '0' }] : undefined}
        bands={[{ from: ar.points[0].year, to: end.year, label: 'Forecast period' }]}
        areas={[{ key: 'ci', label: '95% interval', color: 'var(--series-2)', points: [{ t: last.x, lo: last.y, hi: last.y }, ...ar.points.map(p => ({ t: p.year, lo: p.lo, hi: p.hi }))] }]}
        series={[
          { key: 'hist', label: 'Actual', color: 'var(--series-1)', points: toLine(shown), markers: true },
          ...(trend && trend.direction !== 'flat' && trend.from >= (shown[0]?.x ?? -Infinity)
            ? [{ key: 'trend', label: `Trend ${trend.from}–${trend.to}`, color: 'var(--series-3)', points: trendLine(series, trend), dashed: true }]
            : []),
          { key: 'fc', label: `AR(${AR_ORDER}) forecast`, color: 'var(--series-2)', points: forecastLine(last, ar, 'value'), dashed: true, markers: true },
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
  const [period, setPeriod] = useState<Period>('2000')
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
        <div className="viz-toggle" role="group" aria-label="Years shown in charts (models always use the full history)">
          {PERIODS.map(p => <button key={p.id} className={period === p.id ? 'on' : ''} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
      </header>

      {c.status === 'loading' && <div className="viz-note" role="status">Loading {name}'s World Bank record…</div>}
      {c.status === 'error' && <div className="viz-note" role="status">Could not reach the World Bank ({c.error}). <button className="cy-btn" onClick={c.retry}><RefreshCw size={11} /> Retry</button></div>}

      {c.data && TARGETS.map(t => <Section key={t.id} target={t} series={pointsOf(c.data, t.id)} period={period} />)}

      <p className="viz-foot">
        Every forecast here is backtested out of sample against a naive baseline before you see it, and the comparison is shown whether the
        model wins or loses. This is a projection of a time series from its own past, computed entirely in your browser — not a prediction
        informed by news, policy, or anything the AI Analyst has said. Source: World Bank Open Data, free and keyless.
      </p>
    </div>
  )
}
