/**
 * Next week's change in US working gas in storage (EIA Weekly Natural Gas Storage Report, Lower 48, Bcf):
 * a forecast, two baselines, and a backtest run in time order that decides which one is shown.
 *
 * Target: the change the next report will show, levelₜ − levelₜ₋₁ (positive = injection, negative = withdrawal).
 * Baselines, both standard for this report:
 *   - last week:  the change just reported repeats;
 *   - seasonal:   the average change in the same calendar week of the previous five years (`seasonal5y`).
 * Model (the only one tried; written down before any backtest was run, 2026-10-19):
 *   ŷₜ = seasonalₜ + β · (cₜ₋₁ − seasonalₜ₋₁)
 *   i.e. the seasonal norm plus a share β of last week's departure from its own norm. β is refit at every forecast
 *   origin by least squares through the origin on all earlier consecutive pairs of departures.
 * No weather: actual weather in the forecast week would leak the answer, and a fair test would need weather
 * *forecasts* as they were issued at the time, which no free keyless archive provides.
 *
 * Backtest: every week with five earlier years of history (for the norm) and MIN_PAIRS departures to fit β on is
 * forecast from earlier data only and scored against what EIA reported. The interval is the split-conformal rule
 * from `empiricalInterval` (the ⌈q (n + 1)⌉-th smallest absolute error) applied to the method's own earlier
 * out-of-sample errors in the same season only — weeks within SEASON_WINDOW_DAYS of the same calendar date in earlier
 * years. A first version used the last three years of errors regardless of season; its "80%" range held 52% of
 * winter weeks and 95% of summer ones (right on average, wrong in every season), so it was replaced after that
 * backtest. Coverage is measured in the backtest, not assumed.
 */
import type { WeeklyPoint } from '../services/eia'
import { dieboldMariano, mean, type DieboldMariano } from './econAnalysis'
import { seasonal5y } from './inventory'

const DAY = 86_400_000
const WEEK = 7 * DAY
const isWeekApart = (a: number, b: number) => Math.abs(b - a - WEEK) <= DAY

/** Departures needed before β is fitted (about a year of weeks). */
export const MIN_PAIRS = 52
/** Earlier errors an interval is read from: weeks within this many days of the same calendar date (any earlier year). */
export const SEASON_WINDOW_DAYS = 28
/** Fewer such errors than this (about four years' worth) and no interval is shown rather than one read off a handful. */
export const INTERVAL_MIN_ERRORS = 30
/** Backtest split, to show whether the result holds in both halves rather than only on average. */
export const SPLIT_T = Date.UTC(2021, 0, 1)

export type Method = 'model' | 'seasonal' | 'last'
export const METHODS: Method[] = ['model', 'seasonal', 'last']

/** Week-on-week changes; a change is only formed between levels exactly one week apart. */
export function weeklyChanges(levels: WeeklyPoint[]): WeeklyPoint[] {
  const out: WeeklyPoint[] = []
  for (let i = 1; i < levels.length; i++) {
    if (isWeekApart(levels[i - 1].t, levels[i].t)) out.push({ period: levels[i].period, t: levels[i].t, value: levels[i].value - levels[i - 1].value })
  }
  return out
}

/** Days between two dates' positions in the year, wrapping round New Year. */
export function dayOfYearDistance(a: number, b: number): number {
  const doy = (t: number) => (t - Date.UTC(new Date(t).getUTCFullYear(), 0, 1)) / DAY
  const d = Math.abs(doy(a) - doy(b)) % 365.25
  return Math.min(d, 365.25 - d)
}

/** Absolute errors of `pick` over earlier folds in the same season as `t`. */
function seasonErrors(folds: Fold[], t: number, pick: (f: Fold) => number): number[] {
  return folds.filter(f => f.t < t && dayOfYearDistance(f.t, t) <= SEASON_WINDOW_DAYS).map(f => Math.abs(pick(f) - f.actual))
}

/** Split-conformal half-width: the ⌈q (n + 1)⌉-th smallest absolute error; NaN below INTERVAL_MIN_ERRORS errors. */
export function conformalHalfWidth(absErrors: number[], q: number): number {
  if (absErrors.length < INTERVAL_MIN_ERRORS) return NaN
  const sorted = [...absErrors].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length, Math.ceil(q * (sorted.length + 1))) - 1]
}

interface Prepared {
  c: WeeklyPoint[]
  /** seasonal norm for each change (earlier years only), null when any of the five years is missing */
  s: (number | null)[]
  /** departure from the norm */
  a: (number | null)[]
}

function prepare(levels: WeeklyPoint[]): Prepared {
  const c = weeklyChanges(levels)
  const s = c.map(p => seasonal5y(c, p.t)?.avg ?? null)
  const a = c.map((p, i) => s[i] == null ? null : p.value - s[i]!)
  return { c, s, a }
}

export interface Fold {
  t: number
  period: string
  actual: number
  forecast: Record<Method, number>
  beta: number
  /** the model's 80% / 95% interval at that time, from its earlier errors only; null until enough exist */
  lo80: number | null; hi80: number | null; lo95: number | null; hi95: number | null
}

export interface Score { mae: number; rmse: number; directionHit: number }
export interface PeriodScore { label: string; n: number; model: number; seasonal: number; last: number }

export interface GasBacktest {
  folds: Fold[]
  from: number
  to: number
  score: Record<Method, Score>
  /** model MAE ÷ seasonal MAE: below 1 = the model's misses were smaller */
  relMae: number
  dmVsSeasonal: DieboldMariano | null
  dmVsLast: DieboldMariano | null
  coverage80: { held: number; n: number }
  coverage95: { held: number; n: number }
  /** MAE by calendar month of the week ending, model vs seasonal: where it wins and where it fails */
  byMonth: { month: number; n: number; model: number; seasonal: number }[]
  periods: PeriodScore[]
  /** the model's five largest misses */
  worst: Fold[]
  /** whether the model is the headline: lower MAE than the seasonal baseline and DM p < 0.05 */
  modelWins: boolean
}

export interface GasForecast {
  /** week ending of the change being forecast (one week after the latest report) */
  t: number
  basedOn: WeeklyPoint
  value: Record<Method, number>
  beta: number
  headline: 'model' | 'seasonal'
  /** the headline method's interval, from its backtest errors in the same season; NaN when too few */
  lo80: number; hi80: number; lo95: number; hi95: number
}

/** β by least squares through the origin on consecutive departures before index `end`; 0 without enough pairs. */
function makeBetaFitter(p: Prepared) {
  // running sums so the whole backtest is linear in the number of weeks
  let sxy = 0, sxx = 0, pairs = 0, upto = 1
  return (end: number): number | null => {
    for (; upto < end; upto++) {
      const x = p.a[upto - 1], y = p.a[upto]
      if (x == null || y == null || !isWeekApart(p.c[upto - 1].t, p.c[upto].t)) continue
      sxy += x * y; sxx += x * x; pairs++
    }
    return pairs >= MIN_PAIRS && sxx > 0 ? sxy / sxx : null
  }
}

function predict(p: Prepared, i: number, beta: number): Record<Method, number> | null {
  const s = p.s[i], prevA = p.a[i - 1]
  if (s == null || prevA == null) return null
  return { model: s + beta * prevA, seasonal: s, last: p.c[i - 1].value }
}

const sign = (v: number) => v > 0 ? 1 : v < 0 ? -1 : 0

function score(folds: Fold[], m: Method): Score {
  const e = folds.map(f => f.forecast[m] - f.actual)
  return {
    mae: mean(e.map(Math.abs)),
    rmse: Math.sqrt(mean(e.map(x => x * x))),
    // a zero change counts as a miss unless forecast exactly; EIA reports whole Bcf, so this is rare
    directionHit: folds.filter(f => sign(f.forecast[m]) === sign(f.actual)).length / folds.length,
  }
}

const maeOf = (folds: Fold[], m: Method) => mean(folds.map(f => Math.abs(f.forecast[m] - f.actual)))

/** Rolling-origin backtest over the whole history; null when no week can be forecast (under ~6 years of data). */
export function backtestGasStorage(levels: WeeklyPoint[]): GasBacktest | null {
  const p = prepare(levels)
  const fitBeta = makeBetaFitter(p)
  const folds: Fold[] = []
  for (let i = 1; i < p.c.length; i++) {
    if (!isWeekApart(p.c[i - 1].t, p.c[i].t)) continue
    const beta = fitBeta(i)
    if (beta == null) continue
    const f = predict(p, i, beta)
    if (!f) continue
    const t = p.c[i].t
    const recent = seasonErrors(folds, t, x => x.forecast.model)
    const h80 = conformalHalfWidth(recent, 0.8), h95 = conformalHalfWidth(recent, 0.95)
    const ok = Number.isFinite(h80)
    folds.push({
      t, period: p.c[i].period, actual: p.c[i].value, forecast: f, beta,
      lo80: ok ? f.model - h80 : null, hi80: ok ? f.model + h80 : null,
      lo95: ok ? f.model - h95 : null, hi95: ok ? f.model + h95 : null,
    })
  }
  if (!folds.length) return null

  const err = (m: Method) => folds.map(f => f.forecast[m] - f.actual)
  const sc = Object.fromEntries(METHODS.map(m => [m, score(folds, m)])) as Record<Method, Score>
  const dmVsSeasonal = dieboldMariano(err('model'), err('seasonal'), 1)
  const withInterval = folds.filter(f => f.lo80 != null)
  const inside = (f: Fold, lo: number | null, hi: number | null) => f.actual >= lo! && f.actual <= hi!

  const byMonth = Array.from({ length: 12 }, (_, month) => {
    const fs = folds.filter(f => new Date(f.t).getUTCMonth() === month)
    return { month, n: fs.length, model: fs.length ? maeOf(fs, 'model') : NaN, seasonal: fs.length ? maeOf(fs, 'seasonal') : NaN }
  })
  const half = (label: string, fs: Fold[]): PeriodScore => ({ label, n: fs.length, model: fs.length ? maeOf(fs, 'model') : NaN, seasonal: fs.length ? maeOf(fs, 'seasonal') : NaN, last: fs.length ? maeOf(fs, 'last') : NaN })
  const before = folds.filter(f => f.t < SPLIT_T), after = folds.filter(f => f.t >= SPLIT_T)
  const relMae = sc.model.mae / sc.seasonal.mae

  return {
    folds, from: folds[0].t, to: folds[folds.length - 1].t,
    score: sc, relMae, dmVsSeasonal,
    dmVsLast: dieboldMariano(err('model'), err('last'), 1),
    coverage80: { held: withInterval.filter(f => inside(f, f.lo80, f.hi80)).length, n: withInterval.length },
    coverage95: { held: withInterval.filter(f => inside(f, f.lo95, f.hi95)).length, n: withInterval.length },
    byMonth,
    periods: [
      ...(before.length ? [half(`${new Date(folds[0].t).getUTCFullYear()}–2020`, before)] : []),
      ...(after.length ? [half(`2021–${new Date(folds[folds.length - 1].t).getUTCFullYear()}`, after)] : []),
    ],
    worst: [...folds].sort((x, y) => Math.abs(y.forecast.model - y.actual) - Math.abs(x.forecast.model - x.actual)).slice(0, 5),
    modelWins: relMae < 1 && dmVsSeasonal != null && dmVsSeasonal.p < 0.05,
  }
}

/**
 * The forecast for the week after the latest report, fitted on everything reported so far. The headline follows
 * the backtest: the model only if it beat the seasonal baseline there (`modelWins`), otherwise the seasonal norm.
 * Null when the next week's seasonal norm can't be formed or β can't be fitted yet.
 */
export function forecastGasStorage(levels: WeeklyPoint[], bt: GasBacktest | null): GasForecast | null {
  const p = prepare(levels)
  const n = p.c.length
  if (n < 2) return null
  const last = p.c[n - 1]
  const t = last.t + WEEK
  const sNext = seasonal5y(p.c, t)?.avg
  const prevA = p.a[n - 1]
  const beta = makeBetaFitter(p)(n)
  if (sNext == null || prevA == null || beta == null) return null
  const headline = bt?.modelWins ? 'model' : 'seasonal'
  const value: Record<Method, number> = { model: sNext + beta * prevA, seasonal: sNext, last: last.value }
  const abs = seasonErrors(bt?.folds ?? [], t, f => f.forecast[headline])
  const h80 = conformalHalfWidth(abs, 0.8), h95 = conformalHalfWidth(abs, 0.95)
  const v = value[headline]
  return { t, basedOn: last, value, beta, headline, lo80: v - h80, hi80: v + h80, lo95: v - h95, hi95: v + h95 }
}
