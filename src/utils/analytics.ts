/**
 * Pure analytics over a window of dated crisis events: daily series, a country × day matrix, and a
 * walk-forward backtest of the trajectory rule (utils/trajectory.ts). No network, no clock — every
 * function takes the data and an explicit end day, so results are deterministic and testable.
 *
 * Scoring reuses SEV_WEIGHT (the Risk Matrix / trajectory weights) so there is still one scoring system.
 */
import type { CrisisEvent } from '../types'
import { SEV_WEIGHT, computeTrajectories } from './trajectory'

export const DAY_MS = 86_400_000

/** UTC midnight (epoch ms) of an event's date, or null when the date doesn't parse. */
export function eventDay(e: Pick<CrisisEvent, 'date'>): number | null {
  const t = Date.parse(e.date)
  return Number.isNaN(t) ? null : Math.floor(t / DAY_MS) * DAY_MS
}

export function eventScore(e: Pick<CrisisEvent, 'severity'>): number {
  return SEV_WEIGHT[e.severity] ?? 1
}

/** Real events only — the synthetic always-on baseline markers carry today's date, not an event date. */
export function datedEvents(events: CrisisEvent[]): CrisisEvent[] {
  return events.filter(e => e.source !== 'Baseline' && !e.id.startsWith('baseline-') && !!e.country && eventDay(e) !== null)
}

/** The newest event day in the data. Using it (not "today") keeps ACLED's reporting lag out of the charts. */
export function latestDay(events: CrisisEvent[]): number | null {
  let max: number | null = null
  for (const e of events) {
    const d = eventDay(e)
    if (d !== null && (max === null || d > max)) max = d
  }
  return max
}

// ── Daily series ──────────────────────────────────────────────────────────────

export interface DailyPoint {
  /** UTC midnight, epoch ms */
  t: number
  score: number
  events: number
  fatalities: number
  /** trailing 7-day mean of `score`; null until 7 days of history exist */
  avg7: number | null
}

export function dailySeries(events: CrisisEvent[], endDay: number, days: number): DailyPoint[] {
  const start = endDay - (days - 1) * DAY_MS
  const pts: DailyPoint[] = Array.from({ length: days }, (_, i) => ({ t: start + i * DAY_MS, score: 0, events: 0, fatalities: 0, avg7: null }))
  for (const e of events) {
    const d = eventDay(e)
    if (d === null || d < start || d > endDay) continue
    const p = pts[Math.round((d - start) / DAY_MS)]
    p.score += eventScore(e)
    p.events += 1
    p.fatalities += e.fatalities ?? 0
  }
  for (let i = 6; i < pts.length; i++) {
    let sum = 0
    for (let j = i - 6; j <= i; j++) sum += pts[j].score
    pts[i].avg7 = sum / 7
  }
  return pts
}

// ── Country × day matrix ──────────────────────────────────────────────────────

export interface CountryMatrix {
  days: number[]
  countries: string[]
  /** cells[row][col] — weighted severity score for that country on that day */
  cells: number[][]
  totals: number[]
  max: number
}

export function countryMatrix(events: CrisisEvent[], endDay: number, days: number, topN: number): CountryMatrix {
  const start = endDay - (days - 1) * DAY_MS
  const byCountry = new Map<string, number[]>()
  for (const e of events) {
    const d = eventDay(e)
    if (d === null || d < start || d > endDay) continue
    let row = byCountry.get(e.country)
    if (!row) byCountry.set(e.country, row = new Array(days).fill(0))
    row[Math.round((d - start) / DAY_MS)] += eventScore(e)
  }
  const ranked = [...byCountry.entries()]
    .map(([country, row]) => ({ country, row, total: row.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || a.country.localeCompare(b.country))
    .slice(0, topN)
  return {
    days: Array.from({ length: days }, (_, i) => start + i * DAY_MS),
    countries: ranked.map(r => r.country),
    cells: ranked.map(r => r.row),
    totals: ranked.map(r => r.total),
    max: ranked.reduce((m, r) => Math.max(m, ...r.row), 0),
  }
}

// ── Movers (per-day rates) ────────────────────────────────────────────────────

export interface RateMover {
  country: string
  /** recentRate − priorRate, in score points per day */
  change: number
  recentRate: number
  priorRate: number
  recentEvents: number
  priorEvents: number
}

/**
 * Change in each country's average daily score: the latest `recentDays` versus the `priorDays` before them.
 * Rates (not raw sums) are compared, so a country that is simply steady reads as ~0 rather than "falling".
 * Same idea as the live trajectory rule's pace-adjusted delta, but in score points per day and unrounded.
 */
export function rateMovers(events: CrisisEvent[], endDay: number, recentDays = 3, priorDays = 7): RateMover[] {
  const recentFrom = endDay - (recentDays - 1) * DAY_MS
  const priorFrom = recentFrom - priorDays * DAY_MS
  const acc = new Map<string, { r: number; p: number; re: number; pe: number }>()
  for (const e of events) {
    const d = eventDay(e)
    if (d === null || d < priorFrom || d > endDay) continue
    let a = acc.get(e.country)
    if (!a) acc.set(e.country, a = { r: 0, p: 0, re: 0, pe: 0 })
    if (d >= recentFrom) { a.r += eventScore(e); a.re++ } else { a.p += eventScore(e); a.pe++ }
  }
  return [...acc.entries()]
    .map(([country, a]) => ({
      country, recentRate: a.r / recentDays, priorRate: a.p / priorDays,
      change: a.r / recentDays - a.p / priorDays, recentEvents: a.re, priorEvents: a.pe,
    }))
    .sort((x, y) => y.change - x.change || x.country.localeCompare(y.country))
}

// ── Statistics helpers ────────────────────────────────────────────────────────

/** Wilson score interval for a proportion (95% by default); honest at small n and at 0 / 1. */
export function wilson(hits: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1]
  const p = hits / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return [Math.max(0, centre - half), Math.min(1, centre + half)]
}

/** Two-proportion z statistic (pooled). Positive when the first proportion is larger. */
export function twoProportionZ(h1: number, n1: number, h2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 0
  const p = (h1 + h2) / (n1 + n2)
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  return se === 0 ? 0 : (h1 / n1 - h2 / n2) / se
}

// ── Walk-forward backtest of the trajectory rule ──────────────────────────────

/** The trajectory rule looks back 10 days (3 recent + 7 prior), so evaluation starts once that much history exists. */
export const LOOKBACK_DAYS = 10
export const BACKTEST_HORIZON_DAYS = 7
/** Fewer than this many evaluation days is not a backtest, it's an anecdote. */
export const MIN_EVAL_DAYS = 14
/** Bins with fewer samples than this are shown as "too few", never as a rate. */
export const MIN_BIN_SAMPLES = 20

export const VELOCITY_BINS: { label: string; lo: number; hi: number }[] = [
  { label: '< 40',   lo: 0,  hi: 40 },
  { label: '40–59',  lo: 40, hi: 60 },
  { label: '60–74',  lo: 60, hi: 75 },
  { label: '75–89',  lo: 75, hi: 90 },
  { label: '90+',    lo: 90, hi: 101 },
]

export interface RateStat {
  hits: number
  n: number
  rate: number
  ci: [number, number]
}

function rateStat(hits: number, n: number): RateStat {
  return { hits, n, rate: n > 0 ? hits / n : 0, ci: wilson(hits, n) }
}

export interface BacktestResult {
  /** Why there is no result, when there isn't one. */
  insufficient: string | null
  horizonDays: number
  firstEvalDay: number | null
  lastEvalDay: number | null
  evalDays: number
  /** every (country, day) with any activity in the trailing 10 days */
  eligible: RateStat
  /** the subset the rule flagged `rising` */
  flagged: RateStat
  /** flagged.rate / eligible.rate */
  lift: number
  /** two-proportion z, flagged vs everything not flagged; |z| > 1.96 ≈ 95% (ignores autocorrelation) */
  z: number
  bins: (RateStat & { label: string })[]
  daily: { t: number; flagged: number; hits: number }[]
}

const EMPTY_STAT = rateStat(0, 0)

function insufficient(reason: string, horizonDays: number): BacktestResult {
  return {
    insufficient: reason, horizonDays, firstEvalDay: null, lastEvalDay: null, evalDays: 0,
    eligible: EMPTY_STAT, flagged: EMPTY_STAT, lift: 0, z: 0,
    bins: VELOCITY_BINS.map(b => ({ ...EMPTY_STAT, label: b.label })), daily: [],
  }
}

/**
 * Replays the live trajectory rule on every past day using only events dated on or before that day, then
 * checks what actually happened in the following `horizon` days.
 *
 * Question asked: "when the rule says a country is *rising*, is the next week busier than that country's
 * trailing 10-day average?" — a hit is `score in (t, t+H] / H  >  score in (t-10d, t] / 10`.
 * The baseline is the same hit test over *all* country-days with recent activity, so `lift` says how much the
 * flag adds over simply picking any active country.
 *
 * Only the event-count component of the rule is replayed: the live rule also nudges the score with nearby
 * flight density and news mentions, and no historical flight/news snapshots exist to replay.
 * Overlapping windows make samples autocorrelated, so the intervals are optimistic; treat them as a guide.
 */
export function backtestTrajectory(events: CrisisEvent[], endDay: number, horizonDays = BACKTEST_HORIZON_DAYS): BacktestResult {
  const dated = datedEvents(events)
  if (dated.length === 0) return insufficient('No dated events to evaluate.', horizonDays)

  let startDay = Infinity
  for (const e of dated) startDay = Math.min(startDay, eventDay(e)!)
  const firstEval = startDay + LOOKBACK_DAYS * DAY_MS
  const lastEval = endDay - horizonDays * DAY_MS
  const evalDays = Math.floor((lastEval - firstEval) / DAY_MS) + 1
  if (evalDays < MIN_EVAL_DAYS) {
    return insufficient(`Needs at least ${MIN_EVAL_DAYS} evaluable days (${LOOKBACK_DAYS} of history plus ${horizonDays} days of outcome); this window has ${Math.max(0, evalDays)}.`, horizonDays)
  }

  // per-country daily score, indexed from startDay
  const span = Math.round((endDay - startDay) / DAY_MS) + 1
  const scores = new Map<string, Float64Array>()
  const byDay: CrisisEvent[][] = Array.from({ length: span }, () => [])
  for (const e of dated) {
    const i = Math.round((eventDay(e)! - startDay) / DAY_MS)
    if (i < 0 || i >= span) continue
    byDay[i].push(e)
    let row = scores.get(e.country)
    if (!row) scores.set(e.country, row = new Float64Array(span))
    row[i] += eventScore(e)
  }
  const sum = (row: Float64Array, from: number, to: number) => {   // inclusive indices
    let s = 0
    for (let i = Math.max(0, from); i <= Math.min(span - 1, to); i++) s += row[i]
    return s
  }

  let eligibleHits = 0, eligibleN = 0, flaggedHits = 0, flaggedN = 0
  const binHits = VELOCITY_BINS.map(() => 0)
  const binN = VELOCITY_BINS.map(() => 0)
  const daily: BacktestResult['daily'] = []

  for (let k = 0; k < evalDays; k++) {
    const dayMs = firstEval + k * DAY_MS
    const idx = Math.round((dayMs - startDay) / DAY_MS)
    // only the trailing window is needed; everything later is excluded so there is no look-ahead
    const windowEvents: CrisisEvent[] = []
    for (let i = Math.max(0, idx - LOOKBACK_DAYS + 1); i <= idx; i++) windowEvents.push(...byDay[i])
    const entries = computeTrajectories(windowEvents, [], Infinity, [], null, dayMs + DAY_MS - 1)

    let dayFlagged = 0, dayHits = 0
    for (const en of entries) {
      const row = scores.get(en.country)!
      const trailingRate = (en.recentScore + en.priorScore) / LOOKBACK_DAYS
      const forwardRate = sum(row, idx + 1, idx + horizonDays) / horizonDays
      const hit = forwardRate > trailingRate
      eligibleN++; if (hit) eligibleHits++
      const bi = VELOCITY_BINS.findIndex(b => en.velocity >= b.lo && en.velocity < b.hi)
      if (bi >= 0) { binN[bi]++; if (hit) binHits[bi]++ }
      if (en.trend === 'rising') {
        flaggedN++; dayFlagged++
        if (hit) { flaggedHits++; dayHits++ }
      }
    }
    daily.push({ t: dayMs, flagged: dayFlagged, hits: dayHits })
  }

  const eligible = rateStat(eligibleHits, eligibleN)
  const flagged = rateStat(flaggedHits, flaggedN)
  return {
    insufficient: flaggedN === 0 ? 'The rule never flagged a rising country in this window.' : null,
    horizonDays,
    firstEvalDay: firstEval,
    lastEvalDay: firstEval + (evalDays - 1) * DAY_MS,
    evalDays,
    eligible,
    flagged,
    lift: eligible.rate > 0 ? flagged.rate / eligible.rate : 0,
    z: twoProportionZ(flaggedHits, flaggedN, eligibleHits - flaggedHits, eligibleN - flaggedN),
    bins: VELOCITY_BINS.map((b, i) => ({ ...rateStat(binHits[i], binN[i]), label: b.label })),
    daily,
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/**
 * Plain-language reading of a backtest, generated from the numbers so it can never claim more than they show.
 * Significance uses |z| > 1.96; because overlapping windows are autocorrelated, "distinguishable" is a lenient bar.
 */
export function describeBacktest(r: BacktestResult): string {
  if (r.insufficient) return r.insufficient
  const [lo, hi] = r.flagged.ci
  const head = `Over ${r.evalDays} replayed days, countries the rule flagged as rising were busier in the following ${r.horizonDays} days ${pct(r.flagged.rate)} of the time (${r.flagged.hits.toLocaleString()} of ${r.flagged.n.toLocaleString()}; 95% interval ${pct(lo)}–${pct(hi)}), versus ${pct(r.eligible.rate)} for any active country.`
  if (r.z > 1.96) return `${head} That is a ${r.lift.toFixed(2)}× lift and is distinguishable from chance.`
  if (r.z < -1.96) return `${head} The flag did worse than picking any active country at random — a surge here tended to be followed by a lull.`
  return `${head} That difference is not distinguishable from chance at this sample size, so the flag is not shown to add predictive value over this window.`
}
