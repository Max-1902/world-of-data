import { useMemo, useState } from 'react'
import { AlertTriangle, MoveRight, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { useCountryLookup } from '../../hooks/useCountryLookup'
import { pointsOf } from '../../services/countryLookup'
import { arForecast, backtestForecast, median, naiveForecast, trendTest, type DieboldMariano, type Forecast, type Pt } from '../../utils/econAnalysis'
import { INTERVAL_RECENT, coverageLabel, headlineForecast } from '../../utils/forecastPolicy'
import { ChartFrame } from '../charts/ChartFrame'
import { LineChart, type LinePoint } from '../charts/LineChart'
import { Kpi, Method, PERIODS, inPeriod, plain, toLine, type Period } from './countryLookup/shared'

const AR_ORDER = 2
const HORIZON = 3
const MIN_HISTORY = 15
/** An interval band wider than this many times the charted series' own range is stated in words, not drawn. */
const MAX_BAND_RATIO = 4

interface Target { id: string; label: string; unit: string }
const TARGETS: Target[] = [
  { id: 'NY.GDP.MKTP.KD.ZG', label: 'Real GDP growth', unit: '%' },
  { id: 'FP.CPI.TOTL.ZG', label: 'Inflation (CPI)', unit: '%' },
  { id: 'SL.UEM.TOTL.ZS', label: 'Unemployment', unit: '%' },
]

const tolerance = 1e-9

/** One sentence on whether the backtest gap could be chance: Diebold–Mariano with the HLN small-sample correction. */
export function significance(dm: DieboldMariano | null): string {
  if (!dm) return 'Too few folds to test whether the difference is more than chance.'
  const p = dm.p < 0.001 ? '< 0.001' : `= ${dm.p.toFixed(2)}`
  return dm.p < 0.05
    ? `The difference is statistically significant (Diebold–Mariano test, small-sample corrected, p ${p}, ${dm.n} folds).`
    : `The difference is not statistically significant (Diebold–Mariano test, small-sample corrected, p ${p}, ${dm.n} folds): on this record the two cannot be told apart.`
}

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
  const hf = useMemo(() => headlineForecast(target.id, series, HORIZON), [target.id, series])
  const naive = useMemo(() => naiveForecast(series, HORIZON), [series])
  const trend = useMemo(() => trendTest(series), [series])
  const backtest = useMemo(() => backtestForecast(series, s => arForecast(s, AR_ORDER, 1), MIN_HISTORY), [series])

  if (series.length < MIN_HISTORY || !hf || !hf.ar || !naive) {
    return (
      <div className="viz-note">
        {target.label}: fewer than {MIN_HISTORY} years of data ({series.length} available) — not enough history for an honest forecast.
      </div>
    )
  }

  const { forecast: fc, headline, ar, policy, fallbackHorizons } = hf
  const isAr = headline === 'ar'
  const fcLabel = isAr ? `AR(${AR_ORDER}) forecast` : 'No-change forecast'
  const last = series[series.length - 1]
  const beatsBaseline = backtest?.mae != null && backtest.baselineMae != null && backtest.mae < backtest.baselineMae
  const end = fc.points[fc.points.length - 1]
  const delta = Math.round(end.value * 10) / 10 - Math.round(last.y * 10) / 10 // from the shown 1-dp values, so the sentence adds up
  const fcDir = Math.abs(delta) < tolerance ? 'flat' : delta > 0 ? 'up' : 'down'
  const noChangeInside = last.y >= end.lo && last.y <= end.hi
  const unstable = isAr && ar!.longRun == null
  const shown = inPeriod(series, period)
  const u = target.unit
  const shownYs = shown.map(p => p.y)
  const range = Math.max(Math.max(...shownYs, last.y) - Math.min(...shownYs, last.y), 1)
  const drawBand = fc.points.every(p => Number.isFinite(p.lo) && p.hi - p.lo <= MAX_BAND_RATIO * range)
  const intervalHow = isAr && policy?.interval === 'empirical'
    ? `set from AR(${AR_ORDER})'s own last ${INTERVAL_RECENT} out-of-sample errors on this country${fallbackHorizons.length ? ` (${fallbackHorizons.map(h => `${h}-year`).join(', ')}: too few past errors, textbook interval shown instead)` : ''}`
    : isAr ? 'the textbook AR interval' : "from the spread of this country's past year-to-year changes"
  const scaled = policy ? `, then ${policy.scale.map(k => `×${k.toFixed(2)}`).join(' / ')} at 1 / 2 / 3 years so it held 95% of outcomes on forecasts made before 2010` : ''
  const ciLabel = (h: number) => coverageLabel(policy, h)

  return (
    <ChartFrame
      title={target.label}
      subtitle={isAr ? `${fc.method} forecast vs. a "no change" baseline, next ${HORIZON} years` : `"No change" forecast, next ${HORIZON} years — it beat the AR(${AR_ORDER}) model in the cross-country backtest`}
      table={{
        columns: isAr ? ['Year', 'Actual', fcLabel, 'Interval', 'Naive (last value)'] : ['Year', 'Actual', fcLabel, 'Interval'],
        rows: [
          ...[...fc.points].reverse().map(p => [String(p.year), '—', `${plain(p.value)}${u}`, `${plain(p.lo)} to ${plain(p.hi)}${u}`, ...(isAr ? [`${plain(naive.points[p.year - last.x - 1].value)}${u}`] : [])]),
          ...[...series].reverse().map(p => [String(p.x), `${plain(p.y)}${u}`, '', '', ...(isAr ? [''] : [])]),
        ],
      }}
      footer={<>
        <div className="viz-kpis">
          <Kpi label={`${last.x} (latest)`} value={`${plain(last.y)}${target.unit}`} detail={`n = ${fc.n} years`} />
          <Kpi label={`${fc.points[0].year} forecast`} value={`${plain(fc.points[0].value)}${target.unit}`} detail={`${ciLabel(1)}: ${plain(fc.points[0].lo)} to ${plain(fc.points[0].hi)}${target.unit}`} />
          <Kpi label={`Backtest MAE, AR(${AR_ORDER}) here`} value={backtest?.mae != null ? `${plain(backtest.mae, 2)} pp` : '—'} detail={backtest ? `${backtest.folds} one-year-ahead folds` : 'not enough folds'} />
          <Kpi label="Backtest MAE, no change here" value={backtest?.baselineMae != null ? `${plain(backtest.baselineMae, 2)} pp` : '—'} detail="repeat last known value" />
        </div>
        <div className="pred-dirs">
          <p>
            <span className="pred-dir-k">Forecast direction</span>
            <Direction dir={fcDir} label={fcDir === 'up' ? 'Rising' : fcDir === 'down' ? 'Falling' : 'Flat'} />{' '}
            {isAr
              ? <>{plain(last.y)}{u} ({last.x}) → {plain(end.value)}{u} ({end.year}), {delta >= 0 ? '+' : '−'}{plain(Math.abs(delta))} pp.{' '}</>
              : <>{plain(last.y)}{u} ({last.x}) → {plain(end.value)}{u} ({end.year}): flat by construction. This is the honest default, not a claim that nothing will change.{' '}</>}
            {isAr && (noChangeInside
              ? <>The {end.year} {ciLabel(HORIZON)} ({plain(end.lo)} to {plain(end.hi)}{u}) includes the {last.x} value, so "no change" is still inside the model's own range.</>
              : <>The {end.year} {ciLabel(HORIZON)} ({plain(end.lo)} to {plain(end.hi)}{u}) excludes the {last.x} value — a clear direction under the model's assumptions, which the backtest below qualifies.</>)}
            {!isAr && <>{end.year} {ciLabel(HORIZON)}: {plain(end.lo)} to {plain(end.hi)}{u}.</>}
            {' '}Interval {intervalHow}{scaled}.
            {!drawBand && <> It is too wide to draw against this history{isAr ? '' : ' (it is set by the whole record, including any hyperinflation or crisis years)'}, so it is stated here instead.</>}
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
            <AlertTriangle size={14} aria-hidden /> <b>Unstable fit.</b> The fitted AR({AR_ORDER}) is non-stationary: iterated forward its forecast runs away instead of settling, so the multi-year numbers are not meaningful.
          </p>
        )}
        <p className="viz-verdict">
          {backtest == null
            ? `Not enough history to backtest this series out of sample.`
            : beatsBaseline
              ? <>On this country's own record, in {backtest.folds} historical one-year-ahead tests, AR({AR_ORDER})'s average error ({plain(backtest.mae!, 2)} pp) was lower than repeating the last known value ({plain(backtest.baselineMae!, 2)} pp). {significance(backtest.dm)}{!isAr && <> One country's record is not used to switch models — across economies the no-change forecast won, so it stays the headline.</>}</>
              : <>On this country's own record, in {backtest.folds} historical one-year-ahead tests, AR({AR_ORDER}) did <b>not</b> beat repeating the last known value ({plain(backtest.mae ?? NaN, 2)} pp vs {plain(backtest.baselineMae ?? NaN, 2)} pp). {significance(backtest.dm)}{isAr && <> The forecast is shown anyway, because across economies AR({AR_ORDER}) won for this series; for this country, recent history predicts next year about as well.</>}</>}
          {isAr && ar!.longRun != null && <> Iterated forward, the forecast converges toward {plain(ar!.longRun)}{target.unit}, a level set by the whole {last.x - ar!.n + 1}–{last.x} history. If the economy has changed structurally since (e.g. a boom-era growth rate that no longer applies), that pull is an assumption of the model, not evidence.</>}
        </p>
        {policy && <p className="viz-verdict">{policy.evidence}</p>}
        <Method caveats={`A forecast ${HORIZON} years out on an annual series this short carries a wide, genuine interval — shown, not hidden. The backtests only ever fit on data before the year they are scored against (no look-ahead), but they use today's revised World Bank figures, not the data as first published, so they are more favourable than a real-time test. The choice of headline model was written down before the cross-country backtest was run, but that data had been studied before, so it is not a test on unseen data; only forecasts scored against years that have not happened yet are.`}>
          {isAr
            ? <>Low-order autoregression (AR{AR_ORDER}) fit by ordinary least squares on the most recent unbroken run of years; forecast iterated forward using the model's own prior steps. 95% interval: rerun the same model from every past year with at least 10 years before it, keep its last {INTERVAL_RECENT} absolute errors at each horizon, and use the largest that leaves 95% of them inside (the split-conformal rule), then scale it by a per-horizon factor fitted on forecasts made before 2010. It needs no assumption about the error distribution and includes the model's own estimation error, but the past errors overlap, so its coverage is measured (shown on the interval), not guaranteed. Baseline: next year equals the last observed value.</>
            : <>Forecast: next years equal the last observed value (a random walk). Interval: t-quantile × the standard deviation of past year-to-year changes × √horizon, scaled by a per-horizon factor fitted so it held 95% of outcomes on forecasts made before 2010; the label shows what it held on forecasts made since. AR({AR_ORDER}) is still fitted, only to report how it did on this country's record.</>}
          {' '}Per-country backtest: for every cutoff year with at least {MIN_HISTORY} years before it, refit on data up to that year only and score the 1-year-ahead forecast against what happened next.
        </Method>
      </>}>
      <LineChart ariaLabel={`${target.label}, ${shown[0]?.x ?? last.x}–${last.x}, with a ${HORIZON}-year ${isAr ? '' : 'no-change '}forecast ${fcDir === 'up' ? 'rising' : fcDir === 'down' ? 'falling' : 'flat'} to ${plain(end.value)}${u}.`}
        xKind="year" height={250} fmtY={v => `${plain(v, 1)}${u}`} refLines={u === '%' ? [{ v: 0, label: '0' }] : undefined}
        bands={[{ from: fc.points[0].year, to: end.year, label: 'Forecast period' }]}
        areas={drawBand ? [{ key: 'ci', label: ciLabel(HORIZON), color: 'var(--series-2)', points: [{ t: last.x, lo: last.y, hi: last.y }, ...fc.points.map(p => ({ t: p.year, lo: p.lo, hi: p.hi }))] }] : []}
        series={[
          { key: 'hist', label: 'Actual', color: 'var(--series-1)', points: toLine(shown), markers: true },
          ...(trend && trend.direction !== 'flat' && trend.from >= (shown[0]?.x ?? -Infinity)
            ? [{ key: 'trend', label: `Trend ${trend.from}–${trend.to}`, color: 'var(--series-3)', points: trendLine(series, trend), dashed: true }]
            : []),
          { key: 'fc', label: fcLabel, color: 'var(--series-2)', points: forecastLine(last, fc, 'value'), dashed: true, markers: true },
          ...(isAr ? [{ key: 'naive', label: 'Naive baseline', color: 'var(--series-4)', points: forecastLine(last, naive, 'value'), dashed: true }] : []),
        ]} />
    </ChartFrame>
  )
}

/**
 * Predictions: statistical forecasts of a country's own macro series from its own history. Which model is the headline
 * for each series (AR(2) or "no change") and which interval it carries is set in utils/forecastPolicy.ts from a
 * cross-country backtest; each card also backtests AR(2) against "no change" on the selected country.
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
        Each headline model was picked by a backtest across every World Bank economy, and every card also backtests AR(2) against
        "no change" on this country — the comparison is shown whether the model wins or loses. Where no model beat "no change", that is
        what is shown. This is a projection of a time series from its own past, computed entirely in your browser — not a prediction
        informed by news, policy, or anything the AI Analyst has said. Source: World Bank Open Data, free and keyless.
      </p>
    </div>
  )
}
