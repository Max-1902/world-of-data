/**
 * Backtest of the Watchlist's trend flag (utils/trajectory.ts classifyTrend) on daily per-country ACLED
 * aggregates. For every day D and every country with activity in the 10-day lookback, the flag is
 * recomputed exactly as the dashboard would at the end of D, then compared with what happened in the
 * next 3 days. Pure: no network, no clock.
 *
 * What it can and cannot say:
 *  - It replays the rule on data *as ACLED reports it at fetch time*. ACLED adds and revises events after
 *    the fact, so the flag the live dashboard showed on day D saw less data than this replay. The daily
 *    recorder (scripts/research/record.ts) stores dated vintages so that gap can be measured later.
 *  - The flight/news boosts are left out (no historical flight or news data); they only change ordering
 *    and velocity, not the rising/flat/falling flag itself.
 *  - It tests one question: does "rising" carry information about the next 72 hours beyond what the
 *    base rate gives? It says nothing about whether a rise matters.
 */
import { classifyTrend, SEV_WEIGHT, FLAT_DEADZONE } from '../utils/trajectory'
import type { CrisisEvent } from '../types'

export interface DayCell { n: number; score: number; fatalities: number }
/** date (YYYY-MM-DD) → country → that day's events */
export type DailyAgg = Record<string, Record<string, DayCell>>

export interface AggRow { event_date: string; country: string; severity: CrisisEvent['severity']; fatalities: number }

export function aggregateDaily(rows: AggRow[]): DailyAgg {
  const out: DailyAgg = {}
  for (const r of rows) {
    if (!r.country || !/^\d{4}-\d{2}-\d{2}$/.test(r.event_date)) continue
    const day = out[r.event_date] ??= {}
    const c = day[r.country] ??= { n: 0, score: 0, fatalities: 0 }
    c.n++
    c.score += SEV_WEIGHT[r.severity] ?? 1
    c.fatalities += Number.isFinite(r.fatalities) ? r.fatalities : 0
  }
  return out
}

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
export const addDays = (d: string, n: number) => iso(Date.parse(d) + n * DAY)

/** Every date from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let t = Date.parse(from); t <= Date.parse(to); t += DAY) out.push(iso(t))
  return out
}

export interface Observation {
  asOf: string
  country: string
  trend: 'rising' | 'flat' | 'falling'
  delta: number
  /** severity score, days D-2..D */
  recent: number
  /** the prior week's pace scaled to 72h (days D-9..D-3) */
  priorPace: number
  /** severity score, days D+1..D+3 */
  next: number
  /** shown on the Watchlist that day: among the 6 highest deltas */
  shown: boolean
}

const WATCHLIST_SIZE = 6

/**
 * One observation per (as-of day, country). As-of days run from `from`+9 to `to`-3 so every window
 * is inside the covered range; days inside the range with no row count as zero events.
 */
export function replay(agg: DailyAgg, from: string, to: string): Observation[] {
  const score = (d: string, c: string) => agg[d]?.[c]?.score ?? 0
  const sum = (c: string, start: string, days: number) => dateRange(start, addDays(start, days - 1)).reduce((s, d) => s + score(d, c), 0)
  const out: Observation[] = []
  for (const asOf of dateRange(addDays(from, 9), addDays(to, -3))) {
    const countries = new Set<string>()
    for (const d of dateRange(addDays(asOf, -9), asOf)) for (const c of Object.keys(agg[d] ?? {})) countries.add(c)
    const day: Observation[] = []
    for (const country of countries) {
      const recent = sum(country, addDays(asOf, -2), 3)
      const prior = sum(country, addDays(asOf, -9), 7)
      const { delta, priorPace, trend } = classifyTrend(recent, prior)
      day.push({ asOf, country, trend, delta, recent, priorPace, next: sum(country, addDays(asOf, 1), 3), shown: false })
    }
    day.sort((a, b) => b.delta - a.delta).slice(0, WATCHLIST_SIZE).forEach(o => { o.shown = true })
    out.push(...day)
  }
  return out
}

export interface Rates {
  n: number
  /** next 72h above the prior week's pace by more than the flat band: "activity stayed elevated" */
  elevated: number | null
  /** next 72h higher than the last 72h: "it kept rising" */
  escalated: number | null
  /** mean of (next − recent) */
  meanChange: number | null
}

export function rates(obs: Observation[]): Rates {
  const n = obs.length
  if (!n) return { n, elevated: null, escalated: null, meanChange: null }
  return {
    n,
    elevated: obs.filter(o => o.next - o.priorPace > FLAT_DEADZONE).length / n,
    escalated: obs.filter(o => o.next > o.recent).length / n,
    meanChange: obs.reduce((s, o) => s + o.next - o.recent, 0) / n,
  }
}

export interface BacktestReport {
  from: string
  to: string
  asOfDays: number
  countries: number
  all: Rates
  byTrend: Record<Observation['trend'], Rates>
  /** the flags the Watchlist would actually have shown */
  shownRising: Rates
  /**
   * Naive comparison flag: "recent 72h above zero and above the prior pace at all" (no dead-zone) —
   * if the real rule can't beat this, the dead-zone adds nothing.
   */
  naiveUp: Rates
  /** P(elevated | rising) ÷ P(elevated | all); 1 means the flag carries no information */
  liftElevated: number | null
}

export function backtest(agg: DailyAgg, from: string, to: string): BacktestReport {
  const obs = replay(agg, from, to)
  const by = (t: Observation['trend']) => rates(obs.filter(o => o.trend === t))
  const all = rates(obs)
  const rising = by('rising')
  return {
    from, to,
    asOfDays: new Set(obs.map(o => o.asOf)).size,
    countries: new Set(obs.map(o => o.country)).size,
    all,
    byTrend: { rising, flat: by('flat'), falling: by('falling') },
    shownRising: rates(obs.filter(o => o.shown && o.trend === 'rising')),
    naiveUp: rates(obs.filter(o => o.recent > 0 && o.recent > o.priorPace)),
    liftElevated: rising.elevated != null && all.elevated ? rising.elevated / all.elevated : null,
  }
}
