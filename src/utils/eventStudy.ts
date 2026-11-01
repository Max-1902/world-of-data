/**
 * Event study: did a fund move unusually after an event, compared with the world market and with its own ordinary
 * weeks? The standard market-model method (MacKinlay 1997, "Event Studies in Economics and Finance"):
 *
 * 1. Daily simple returns of the fund and the benchmark on the days both traded.
 * 2. Fit fund = α + β·benchmark by least squares on an estimation window that ends before the event
 *    (trading days −260 to −11), so the event can't shape its own baseline.
 * 3. Abnormal return = actual − (α + β·benchmark), summed over the first h trading days after the event (CAR).
 * 4. How unusual: the share of the fund's ordinary h-day windows (same model, non-overlapping, away from the event)
 *    whose |CAR| was at least as large. That compares against the fund's own fat-tailed history instead of assuming a
 *    normal distribution.
 *
 * Everything is a description of what happened after the event, not proof the event caused it: other news on the same
 * days moves funds too, and this cannot separate the two.
 */

export interface DailyReturn {
  /** unix seconds of the trading day (Yahoo's daily bar timestamp: the regular session open) */
  t: number
  fund: number
  market: number
}

/** A US regular session closes 6.5 hours after it opens; a return "happens" at the close. */
export const CLOSE_OFFSET_S = 6.5 * 3600
export const HORIZONS = [1, 5, 20] as const
export type Horizon = (typeof HORIZONS)[number]

const EST_FROM = 260
const EST_TO = 11
const MIN_EST_DAYS = 120
/** ordinary windows must start and end this many trading days away from the event */
const POOL_GAP = 30
/** a window counts as "unusual" when fewer than this share of ordinary windows were as large */
export const UNUSUAL = 0.05

const utcDay = (t: number) => Math.floor(t / 86_400)

/** Daily returns on the days both series have a close (matched by UTC date), oldest first. */
export function alignReturns(fund: [number, number][], market: [number, number][]): DailyReturn[] {
  const m = new Map(market.map(([t, c]) => [utcDay(t), c]))
  const out: DailyReturn[] = []
  let prev: [number, number, number] | null = null
  for (const [t, c] of fund) {
    const mc = m.get(utcDay(t))
    if (mc === undefined) continue
    if (prev) out.push({ t, fund: c / prev[1] - 1, market: mc / prev[2] - 1 })
    prev = [t, c, mc]
  }
  return out
}

/** Index of the first return whose close is after the event (day 1), or −1 when there is none yet. */
export function firstDayAfter(rets: DailyReturn[], eventS: number): number {
  let lo = 0, hi = rets.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rets[mid].t + CLOSE_OFFSET_S <= eventS) lo = mid + 1
    else hi = mid
  }
  return lo < rets.length ? lo : -1
}

export interface WindowResult {
  /** trading days actually covered: below the horizon while an event is still recent */
  days: number
  /** cumulative abnormal return, as a fraction */
  car: number
  /** the fund's raw return over the same days, as a fraction */
  raw: number
  /** share of the fund's ordinary windows of `days` trading days with |CAR| at least this large */
  extremeShare: number
}

export interface StudyResult {
  /** unix seconds of the last close before the event (day 0) */
  baseT: number
  alpha: number
  beta: number
  /** daily residual standard deviation in the estimation window */
  sigma: number
  estDays: number
  windows: Partial<Record<Horizon, WindowResult>>
}

/** Run the event study for one fund and one event time (unix seconds). Null when there isn't enough history before it. */
export function eventStudy(rets: DailyReturn[], eventS: number): StudyResult | null {
  const b = firstDayAfter(rets, eventS)
  if (b < 0 || b < EST_FROM) return null
  const est = rets.slice(b - EST_FROM, b - EST_TO + 1)
  if (est.length < MIN_EST_DAYS) return null
  const n = est.length
  const mx = est.reduce((s, r) => s + r.market, 0) / n
  const my = est.reduce((s, r) => s + r.fund, 0) / n
  let sxy = 0, sxx = 0
  for (const r of est) { sxy += (r.market - mx) * (r.fund - my); sxx += (r.market - mx) ** 2 }
  if (sxx === 0) return null
  const beta = sxy / sxx
  const alpha = my - beta * mx
  const resid = rets.map(r => r.fund - (alpha + beta * r.market))
  const sigma = Math.sqrt(est.reduce((s, _r, i) => s + resid[b - EST_FROM + i] ** 2, 0) / (n - 2))

  const windows: StudyResult['windows'] = {}
  for (const h of HORIZONS) {
    const days = Math.min(h, rets.length - b)
    if (days <= 0) continue
    // a recent event's shorter window stands in only for the shortest horizon it has not completed
    if (days < h && HORIZONS.some(k => k < h && k >= days)) continue
    let car = 0, growth = 1
    for (let i = b; i < b + days; i++) { car += resid[i]; growth *= 1 + rets[i].fund }
    windows[h] = { days, car, raw: growth - 1, extremeShare: extremeShare(resid, b, days, Math.abs(car)) }
  }
  return { baseT: rets[b - 1].t, alpha, beta, sigma, estDays: n, windows }
}

function extremeShare(resid: number[], b: number, days: number, size: number): number {
  let total = 0, asLarge = 0
  for (let i = 0; i + days <= resid.length; i += days) {
    if (i + days > b - POOL_GAP && i < b + days + POOL_GAP) continue
    let s = 0
    for (let k = i; k < i + days; k++) s += resid[k]
    total++
    if (Math.abs(s) >= size) asLarge++
  }
  return total > 0 ? asLarge / total : 1
}

export interface GroupSummary {
  n: number
  median: number
  q1: number
  q3: number
  /** events whose move was in the outer UNUSUAL share of their fund's ordinary windows */
  unusual: number
  /** how many of those chance alone would give: n × UNUSUAL */
  expected: number
  /** P(at least `unusual` such events | no effect at all), one-sided binomial */
  pChance: number
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function binomialTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1
  if (k > n) return 0
  let term = (1 - p) ** n, cdf = 0
  for (let i = 0; i < k; i++) {
    cdf += term
    term *= ((n - i) / (i + 1)) * (p / (1 - p))
  }
  return Math.max(0, Math.min(1, 1 - cdf))
}

/** Summarise completed windows of one horizon across events. Null for an empty group. */
export function summarise(windows: WindowResult[]): GroupSummary | null {
  if (windows.length === 0) return null
  const cars = windows.map(w => w.car).sort((a, b) => a - b)
  const unusual = windows.filter(w => w.extremeShare < UNUSUAL).length
  return {
    n: windows.length,
    median: quantile(cars, 0.5),
    q1: quantile(cars, 0.25),
    q3: quantile(cars, 0.75),
    unusual,
    expected: windows.length * UNUSUAL,
    pChance: binomialTail(unusual, windows.length, UNUSUAL),
  }
}
