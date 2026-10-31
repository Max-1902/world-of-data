/**
 * Quarterly GDP nowcast for European economies: an estimate of this quarter's real GDP growth before Eurostat publishes
 * it, from the months of industrial production already out. Pure, no network.
 *
 * ── Rule, written down and committed before any real data was scored (2026-10-27) ────────────────────────────────
 * Target   real GDP growth on the previous quarter, %, seasonally and calendar adjusted, chain-linked volumes
 *          (Eurostat namq_10_gdp: B1GQ, CLV_PCH_PRE, SCA).
 * Input    industrial production index, B–D (mining, manufacturing, energy), seasonally and calendar adjusted
 *          (Eurostat sts_inpr_m: PRD, I21, SCA). Quarter value = mean of its months; a month not yet published is
 *          filled with the last published month of that quarter (carry forward). Input = % change of that mean on
 *          the previous quarter's full mean.
 * Model    bridge equation: GDP growth = a + b × IP growth, ordinary least squares, refit at every forecast origin on
 *          all earlier quarters (with complete IP), at least MIN_TRAIN of them. The only model tried.
 * Baseline "same as last quarter": last published GDP growth.
 * Backtest every quarter from BACKTEST_FROM on with enough history is nowcast from earlier quarters only, for each
 *          number of IP months known (1, 2, 3), and scored against the published figure. Quarters 2020-Q1 to
 *          2021-Q4 are scored separately and do not count for the rule (one pandemic quarter outweighs years).
 * Headline the model is shown as the headline for a country only if, with the number of IP months the live nowcast
 *          has, its root-mean-square error is below the baseline's in BOTH periods (BACKTEST_FROM–2014 and 2015 on,
 *          pandemic quarters excluded), each with at least MIN_SCORED quarters. Otherwise the baseline is the headline
 *          and the model's numbers are shown as "did not qualify".
 * Range    the 80% range is ± the ⌈0.8 (n + 1)⌉-th smallest absolute backtest error of the headline method at that
 *          number of months (pandemic quarters excluded): split-conformal, as in utils/gasStorage.ts.
 * Caveat   scored on today's revised data, not on the data as first published, so the backtest flatters both methods;
 *          the model is fit on complete-IP quarters but used with 1–2 months, which the backtest measures.
 */
import { regress } from './econAnalysis'

export const BACKTEST_FROM = '2005-Q1'
export const SPLIT = '2015-Q1'
export const MIN_TRAIN = 32
export const MIN_SCORED = 12
export const RANGE_LEVEL = 0.8

export type Quarter = string          // '2026-Q3'
export type Month = string            // '2026-08'
export type Series<K extends string> = ReadonlyMap<K, number>

export const quarterOf = (m: Month): Quarter => `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`
export function monthsOf(q: Quarter): [Month, Month, Month] {
  const y = q.slice(0, 4), first = (Number(q.slice(6)) - 1) * 3 + 1
  return [0, 1, 2].map(i => `${y}-${String(first + i).padStart(2, '0')}`) as [Month, Month, Month]
}
export function prevQuarter(q: Quarter): Quarter {
  const y = Number(q.slice(0, 4)), n = Number(q.slice(6))
  return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`
}
export function nextQuarter(q: Quarter): Quarter {
  const y = Number(q.slice(0, 4)), n = Number(q.slice(6))
  return n === 4 ? `${y + 1}-Q1` : `${y}-Q${n + 1}`
}
export const isPandemic = (q: Quarter) => q >= '2020-Q1' && q <= '2021-Q4'

/** Mean of a quarter's IP months using only the first `known` of them, carrying the last known month forward; null if month 1 is missing. */
export function quarterIp(ip: Series<Month>, q: Quarter, known: 1 | 2 | 3 = 3): number | null {
  const ms = monthsOf(q)
  const vals: number[] = []
  for (let i = 0; i < 3; i++) {
    const v = i < known ? ip.get(ms[i]) : undefined
    if (v !== undefined) vals.push(v)
    else if (vals.length) vals.push(vals[vals.length - 1])
    else return null
  }
  return (vals[0] + vals[1] + vals[2]) / 3
}

/** % change of the quarter's IP mean (first `known` months) on the previous quarter's complete mean. */
export function ipGrowth(ip: Series<Month>, q: Quarter, known: 1 | 2 | 3 = 3): number | null {
  const cur = quarterIp(ip, q, known), prev = quarterIp(ip, prevQuarter(q), 3)
  return cur === null || prev === null || prev === 0 ? null : (cur / prev - 1) * 100
}

/** How many of the quarter's months are published (consecutive from its first month). */
export function monthsKnown(ip: Series<Month>, q: Quarter): 0 | 1 | 2 | 3 {
  const ms = monthsOf(q)
  let n = 0
  while (n < 3 && ip.has(ms[n])) n++
  return n as 0 | 1 | 2 | 3
}

export interface Bridge { a: number; b: number; n: number; r2: number }

/** Fit on every quarter before `before` that has published GDP growth and complete IP. */
export function fitBridge(gdp: Series<Quarter>, ip: Series<Month>, before: Quarter): Bridge | null {
  const x: number[] = [], y: number[] = []
  for (const [q, g] of [...gdp].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (q >= before) break
    const gi = ipGrowth(ip, q, 3)
    if (gi !== null) { x.push(gi); y.push(g) }
  }
  if (x.length < MIN_TRAIN) return null
  const r = regress(x, y)
  return r ? { a: r.intercept, b: r.slope, n: r.n, r2: r.r2 } : null
}

export interface Fold { q: Quarter; actual: number; model: number; naive: number }
export interface PeriodScore { n: number; rmseModel: number; rmseNaive: number }
export interface Backtest {
  known: 1 | 2 | 3
  folds: Fold[]
  /** pandemic quarters excluded */
  early: PeriodScore | null
  late: PeriodScore | null
  pandemic: PeriodScore | null
  modelQualifies: boolean
}

const rmse = (e: number[]) => Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length)
function score(folds: Fold[]): PeriodScore | null {
  if (folds.length === 0) return null
  return { n: folds.length, rmseModel: rmse(folds.map(f => f.model - f.actual)), rmseNaive: rmse(folds.map(f => f.naive - f.actual)) }
}

/** Pseudo-real-time backtest at one number of known IP months, and the pre-registered headline decision. */
export function backtestNowcast(gdp: Series<Quarter>, ip: Series<Month>, known: 1 | 2 | 3): Backtest {
  const folds: Fold[] = []
  for (const q of [...gdp.keys()].sort()) {
    if (q < BACKTEST_FROM) continue
    const actual = gdp.get(q)!, last = gdp.get(prevQuarter(q))
    const x = ipGrowth(ip, q, known)
    if (last === undefined || x === null) continue
    const fit = fitBridge(gdp, ip, q)
    if (!fit) continue
    folds.push({ q, actual, model: fit.a + fit.b * x, naive: last })
  }
  const calm = folds.filter(f => !isPandemic(f.q))
  const early = score(calm.filter(f => f.q < SPLIT)), late = score(calm.filter(f => f.q >= SPLIT))
  const ok = (s: PeriodScore | null) => !!s && s.n >= MIN_SCORED && s.rmseModel < s.rmseNaive
  return { known, folds, early, late, pandemic: score(folds.filter(f => isPandemic(f.q))), modelQualifies: ok(early) && ok(late) }
}

/** ± half-width holding RANGE_LEVEL of past absolute errors (split-conformal); null with fewer than 10 errors. */
export function rangeHalfWidth(errors: number[], level = RANGE_LEVEL): number | null {
  if (errors.length < 10) return null
  const abs = errors.map(Math.abs).sort((a, b) => a - b)
  const k = Math.ceil(level * (abs.length + 1))
  return k > abs.length ? null : abs[k - 1]
}

export interface Nowcast {
  quarter: Quarter
  known: 1 | 2 | 3
  headline: 'model' | 'naive'
  value: number
  /** ± half-width of the 80% range, from the headline's own backtest errors */
  range: number | null
  model: { value: number; fit: Bridge } | null
  naive: { value: number; from: Quarter }
  backtest: Backtest
}

/**
 * The nowcast for the first quarter after the last published GDP figure, if at least its first IP month is out.
 * Null when there is no such quarter or too little history to fit.
 */
export function nowcast(gdp: Series<Quarter>, ip: Series<Month>): Nowcast | null {
  const lastQ = [...gdp.keys()].sort().pop()
  if (!lastQ) return null
  const quarter = nextQuarter(lastQ)
  const known = monthsKnown(ip, quarter)
  if (known === 0) return null
  const x = ipGrowth(ip, quarter, known)
  const fit = fitBridge(gdp, ip, quarter)
  const bt = backtestNowcast(gdp, ip, known)
  const model = fit && x !== null ? { value: fit.a + fit.b * x, fit } : null
  const naive = { value: gdp.get(lastQ)!, from: lastQ }
  const headline = bt.modelQualifies && model ? 'model' : 'naive'
  const calm = bt.folds.filter(f => !isPandemic(f.q))
  const range = rangeHalfWidth(calm.map(f => (headline === 'model' ? f.model : f.naive) - f.actual))
  return { quarter, known, headline, value: headline === 'model' ? model!.value : naive.value, range, model, naive, backtest: bt }
}

/** Months of a quarter's industrial production out when Eurostat's GDP flash lands (~30 days after the quarter; IP lags ~45). */
export const FLASH_MONTHS_KNOWN = 2

export interface Scorecard { quarter: Quarter; actual: number; said: Nowcast; inRange: boolean | null }

/**
 * What the nowcast said for the last published quarter, just before its GDP figure came out: the same rule re-run on
 * data cut back to then (earlier GDP, IP up to month FLASH_MONTHS_KNOWN of that quarter). Uses today's revised figures,
 * not the archived live number. Null when that quarter could not have been nowcast.
 */
export function scoreLastQuarter(gdp: Series<Quarter>, ip: Series<Month>, known: 1 | 2 | 3 = FLASH_MONTHS_KNOWN): Scorecard | null {
  const q = [...gdp.keys()].sort().pop()
  if (!q) return null
  const cut = monthsOf(q)[known - 1]
  const said = nowcast(new Map([...gdp].filter(([k]) => k < q)), new Map([...ip].filter(([m]) => m <= cut)))
  if (!said || said.quarter !== q) return null
  const actual = gdp.get(q)!
  return { quarter: q, actual, said, inRange: said.range === null ? null : Math.abs(actual - said.value) <= said.range }
}

/** Eurostat JSON-stat (one series) → period → value. */
export function parseEurostat(json: unknown): Map<string, number> {
  const d = json as { value?: Record<string, unknown>; dimension?: { time?: { category?: { index?: Record<string, number> } } } }
  const idx = d?.dimension?.time?.category?.index
  if (!idx || !d.value || typeof d.value !== 'object') throw new Error('Unexpected Eurostat response shape')
  const out = new Map<string, number>()
  for (const [period, i] of Object.entries(idx)) {
    const v = d.value[String(i)]
    if (typeof v === 'number' && Number.isFinite(v)) out.set(period, v)
  }
  return out
}
