import type { CrisisEvent, NewsArticle } from '../types'
import { mentionsCountry } from './countryBrief'

export interface TrajectoryEntry {
  country: string
  recentScore: number
  priorScore: number
  delta: number
  trend: 'rising' | 'falling' | 'flat'
  velocity: number
  recentCount: number
  priorCount: number
  reason: string
  /** a headline from the last 48h naming this country — context for the reader only; it does not move the score or the flag */
  newsHit?: string
  /**
   * The conflict feed hit its row cap, so these counts are a sample of the window, not totals: no own-normal is
   * computed and the entry is never flagged (see `TrajectoryOptions.capped`).
   */
  sampled: boolean
  /**
   * The country measured against its own recent history (see `ownBaseline`). null when the feed doesn't reach
   * back MIN_BASELINE_DAYS before the 72h window, so there is no "normal" to compare with.
   */
  baseline: OwnBaseline | null
  /** 'high' / 'low' when the 72h count is that unlikely under the country's own normal (p < UNUSUAL_P), else null. */
  unusual: 'high' | 'low' | null
  /** which windows the counts cover; absent means the live rule, the last 72h against the prior week */
  window?: TrendWindow
}

/** The windows behind an entry, in words the UI and the analyst can quote. */
export interface TrendWindow {
  source: string
  /** the window `recentCount` covers, e.g. "72h" or "September 2026" */
  recent: string
  /** what it is compared with, e.g. "the prior week" */
  prior: string
}

export const LIVE_WINDOW: TrendWindow = { source: 'ACLED (live)', recent: '72h', prior: 'the prior week' }

export interface OwnBaseline {
  /** whole days of history the normal was measured over (the days just before the 72h window) */
  days: number
  /** that history in words, e.g. "last 28 days" or "last 6 months" */
  span: string
  /** events this country's own normal predicts for a 72h window */
  expected: number
  /** P(a 72h count at least this high | the country's normal) */
  pHigh: number
  /** P(a 72h count at most this low | the country's normal) */
  pLow: number
}

export const SEV_WEIGHT: Record<CrisisEvent['severity'], number> = {
  critical: 10, high: 6, medium: 3, low: 1,
}

export const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000   // last 3 days
export const PRIOR_WINDOW_MS  = 10 * 24 * 60 * 60 * 1000  // outer cutoff: events up to 10 days old count; 3–10 days old is the "prior" bucket
export const FLAT_DEADZONE    = 2                          // |delta| below this reads as "flat"

const DAY_MS = 24 * 60 * 60 * 1000
export const BASELINE_MAX_DAYS = 28   // a country's normal is read from at most this many days before the 72h window
export const MIN_BASELINE_DAYS = 7    // with less history than this there is no normal to compare against
/**
 * Where the counts come from. Pass the live events *before* any same-place thinning done for the map, and whether the
 * poll hit its row cap. A capped feed can stop anywhere inside the window it asked for, and reading history from its
 * oldest row would make a sample look like a complete record, so a capped feed gets no baseline and raises no flags.
 */
export interface TrajectoryOptions {
  limit?: number
  /** recent headlines: only used to attach a `newsHit` for context, never in the score */
  articles?: NewsArticle[]
  focusCountry?: string | null
  /** the "as of" instant; defaults to now, and exists so the rule can be replayed on past days without look-ahead */
  now?: number
  capped?: boolean
}

/**
 * Flag threshold. Strict on purpose: the Watchlist tests every country at once, so at 0.05 a quiet day would
 * still flag a few countries by chance; at 0.01 it is about one per 100 countries tested.
 */
export const UNUSUAL_P = 0.01

/**
 * Baseline entries (src/hooks/useCrises.ts) are synthetic "always ongoing" markers stamped with
 * today's date, not real events — they must never be counted as live activity.
 */
export function isBaseline(c: CrisisEvent): boolean {
  return c.source === 'Baseline' || c.id.startsWith('baseline-')
}

/**
 * The trend rule itself: the last 72h's severity score against what the prior week's pace predicts
 * for 72h.
 */
export function classifyTrend(recentScore: number, priorScore: number): { delta: number; priorPace: number; trend: TrajectoryEntry['trend'] } {
  // The windows differ in length (3 days vs 7), so comparing raw sums would read steady activity as a ~57%
  // drop. `delta` stays in "score points per 72h", so the flat band keeps its meaning.
  const priorPace = priorScore * (RECENT_WINDOW_MS / (PRIOR_WINDOW_MS - RECENT_WINDOW_MS))
  const delta = Math.round((recentScore - priorPace) * 10) / 10
  const trend: TrajectoryEntry['trend'] = delta > FLAT_DEADZONE ? 'rising' : delta < -FLAT_DEADZONE ? 'falling' : 'flat'
  return { delta, priorPace, trend }
}

// ── Own-normal surprise ─────────────────────────────────────────────────────
// A raw point delta always ranks the biggest wars first (300 → 310 events beats 0 → 4). Instead each country's
// 72h event count is compared with the count its *own* history predicts, and the question asked is how unlikely
// that count is. Counts, not severity scores, because the tail probabilities below are defined on counts.

// Lanczos approximation (g = 7), accurate to ~1e-13 for x > 0.
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x)
  x -= 1
  let a = LANCZOS[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/**
 * Count distribution with the given mean and variance: Poisson when variance ≤ mean, otherwise negative
 * binomial. Conflict events come in bursts, so a country's day-to-day spread is usually far wider than Poisson's;
 * using its own measured spread keeps a bursty country's ordinary swings from reading as surprises.
 */
function countLogPmf(mean: number, variance: number): (k: number) => number {
  if (variance <= mean * 1.0001) return k => k * Math.log(mean) - mean - logGamma(k + 1)
  const r = (mean * mean) / (variance - mean)
  const p = mean / variance
  const c = r * Math.log(p) - logGamma(r)
  const lq = Math.log1p(-p)
  return k => logGamma(k + r) - logGamma(k + 1) + c + k * lq
}

/** P(X ≥ k) and P(X ≤ k) for a count with this mean and variance. Exported for tests. */
export function countTails(k: number, mean: number, variance: number): { pHigh: number; pLow: number } {
  if (mean <= 0) return { pHigh: k <= 0 ? 1 : 0, pLow: 1 }
  const logPmf = countLogPmf(mean, variance)
  let pLow = 0
  for (let j = 0; j <= k; j++) pLow += Math.exp(logPmf(j))
  // summed upward from k rather than 1 − P(X < k), which loses tiny tail probabilities to rounding
  let pHigh = 0
  const limit = Math.max(k, mean) + 60 * Math.sqrt(Math.max(variance, mean)) + 100
  for (let j = k; j < limit; j++) {
    const term = Math.exp(logPmf(j))
    pHigh += term
    if (j > mean && term < pHigh * 1e-15) break
  }
  return { pHigh: Math.min(1, pHigh), pLow: Math.min(1, pLow) }
}

/**
 * A country's normal 72h count, from its daily counts over the `days` before the window (zero days included).
 * Half a pseudo-event keeps a country with no history from having a rate of exactly zero, where any single
 * event would be "impossible"; with it, one event against a silent history is not flagged, two or more are.
 */
export function ownBaseline(dailyCounts: number[], recentCount: number): OwnBaseline {
  const days = dailyCounts.length
  const windowDays = RECENT_WINDOW_MS / DAY_MS
  const total = dailyCounts.reduce((s, n) => s + n, 0)
  const rate = (total + 0.5) / days
  const raw = dailyCounts.reduce((s, n) => s + n * n, 0) / days - (total / days) ** 2
  const dayVar = Math.max(rate, days > 1 ? raw * days / (days - 1) : 0)
  // treats the three days as independent, which understates a sustained surge's rarity a little (conservative)
  const expected = rate * windowDays
  const { pHigh, pLow } = countTails(recentCount, expected, dayVar * windowDays)
  return { days, span: `last ${days} days`, expected, pHigh, pLow }
}

export function unusualness(b: OwnBaseline | null): TrajectoryEntry['unusual'] {
  if (!b) return null
  return b.pHigh < UNUSUAL_P ? 'high' : b.pLow < UNUSUAL_P ? 'low' : null
}

/**
 * Whether an entry should be flagged as "up": unusually high for that country when its normal is known, and the
 * plain rising rule otherwise (feed too short to have a normal).
 */
export function isFlaggedUp(t: Pick<TrajectoryEntry, 'trend' | 'baseline' | 'unusual'> & { sampled?: boolean }): boolean {
  if (t.sampled) return false
  return t.baseline ? t.unusual === 'high' : t.trend === 'rising'
}

const fmtExpected = (x: number) => x < 10 ? String(Math.round(x * 10) / 10) : String(Math.round(x))

// No percentage is shown. pHigh/pLow come from 7–28 days of counts and treat the three days as independent, so they
// rank countries and set the flag but are not calibrated probabilities; no replay has measured how often a flag is right.
export function baselineClause(b: OwnBaseline, unusual: TrajectoryEntry['unusual']): string {
  const vs = `~${fmtExpected(b.expected)} expected from its own ${b.span}`
  if (unusual === 'high') return `unusually high for this country (${vs}; a rough flag from a short history, not a measured probability)`
  if (unusual === 'low') return `unusually quiet for this country (${vs}; a rough flag from a short history, not a measured probability)`
  return `within this country's normal range (${vs})`
}

export const SAMPLED_NOTE = 'sample only: the conflict feed hit its row cap, so these are not totals and no flag is raised'

function reasonFor(recentCount: number, priorCount: number, trend: TrajectoryEntry['trend'], own: string | null, sampled: boolean): string {
  const suffix = [own, sampled && SAMPLED_NOTE].filter(Boolean).join('; ')
  if (trend === 'rising') {
    const base = priorCount === 0
      ? `${recentCount} new event${recentCount === 1 ? '' : 's'} in 72h, no prior activity`
      : `${recentCount} events in 72h, up from ${priorCount} in the prior week`
    return suffix ? `${base}; ${suffix}` : base
  }
  const plural = (n: number) => n === 1 ? 'event' : 'events'
  if (trend === 'falling') {
    const base = `${recentCount} ${plural(recentCount)} in 72h, down from ${priorCount} in the prior week`
    return suffix ? `${base}; ${suffix}` : base
  }
  const base = `Steady at ~${recentCount} ${plural(recentCount)} in 72h`
  return suffix ? `${base}; ${suffix}` : base
}

const RECENT_NEWS_WINDOW_MS = 48 * 60 * 60 * 1000  // last 48h

export function findNewsHit(country: string, articles: NewsArticle[], now: number): NewsArticle | undefined {
  return articles.find(a => {
    const t = Date.parse(a.publishedAt)
    if (!Number.isNaN(t) && now - t > RECENT_NEWS_WINDOW_MS) return false
    // whole words, unqualified: "Oman" must not hit a story about Romania, nor "Sudan" one about South Sudan
    return mentionsCountry(`${a.title} ${a.description}`, country)
  })
}

/**
 * Rule-based trajectory scoring: compares each country's conflict activity in the last 3 days against the pace of
 * the 3–10 day-prior window (using each event's own date). Where the feed reaches back far enough, each country is
 * also measured against its own normal (`baseline`) and the list is ranked by how unusual the last 72h are for that
 * country, not by raw size. Without that history it falls back to ranking the fastest-rising regions. Only dated
 * conflict events enter the score: air traffic and news coverage used to add +2 boosts and no longer do. Pure function.
 */
export function computeTrajectories(crises: CrisisEvent[], opts: TrajectoryOptions = {}): TrajectoryEntry[] {
  const { limit = 6, articles = [], focusCountry, now = Date.now(), capped = false } = opts
  const byCountry: Record<string, { recent: CrisisEvent[]; prior: CrisisEvent[] }> = {}

  // Including baseline markers would make every long-running conflict misread as "rising, no prior activity".
  const dated = crises.filter(c => !isBaseline(c))

  // How far back the feed reaches is read from its oldest event (any country): reading it this way can only shorten
  // the history, never pad it with days that weren't fetched — a missing day counted as zero would make every country
  // look surging. It cannot tell a capped feed from a complete one, which is why `capped` turns the baseline off.
  let oldest = Infinity
  const ages: number[] = []
  for (const c of dated) {
    const t = Date.parse(c.date)
    const age = now - t
    ages.push(age)
    if (c.country && age >= 0 && t < oldest) oldest = t
  }
  const historyDays = Math.min(BASELINE_MAX_DAYS, Math.floor((now - RECENT_WINDOW_MS - oldest) / DAY_MS))
  const hasHistory = !capped && historyDays >= MIN_BASELINE_DAYS
  const daily: Record<string, number[]> = {}

  dated.forEach((c, i) => {
    if (!c.country) return
    // an undated event can't be placed in either window (it used to count as "now" and inflate the recent one)
    const age = ages[i]
    if (Number.isNaN(age)) return
    if (hasHistory && age > RECENT_WINDOW_MS) {
      const bin = Math.floor((age - RECENT_WINDOW_MS) / DAY_MS)
      if (bin < historyDays) (daily[c.country] ??= new Array(historyDays).fill(0))[bin]++
    }
    // PRIOR_WINDOW_MS is the outer cutoff, so the prior bucket spans 7 days — the length classifyTrend
    // normalises by. (It used to be RECENT + PRIOR = 13 days, a 10-day bucket scaled as 7, which read every
    // steady country as "falling".)
    if (age < 0 || age > PRIOR_WINDOW_MS) return
    if (!byCountry[c.country]) byCountry[c.country] = { recent: [], prior: [] }
    if (age <= RECENT_WINDOW_MS) byCountry[c.country].recent.push(c)
    else byCountry[c.country].prior.push(c)
  })

  const score = (events: CrisisEvent[]) => events.reduce((s, e) => s + (SEV_WEIGHT[e.severity] ?? 1), 0)

  const entries: TrajectoryEntry[] = Object.entries(byCountry).map(([country, { recent, prior }]) => {
    const recentScore = score(recent)
    const priorScore   = score(prior)
    const { delta, priorPace, trend } = classifyTrend(recentScore, priorScore)

    const newsHit = findNewsHit(country, articles, now)
    const baseline = hasHistory ? ownBaseline(daily[country] ?? new Array(historyDays).fill(0), recent.length) : null
    const unusual = unusualness(baseline)
    const velocity = Math.max(0, Math.min(100, Math.round((delta / Math.max(recentScore, priorPace, 1)) * 50 + 50)))

    return {
      country,
      recentScore, priorScore,
      delta,
      trend,
      velocity,
      recentCount: recent.length,
      priorCount: prior.length,
      reason: reasonFor(recent.length, prior.length, trend, baseline && baselineClause(baseline, unusual), capped),
      newsHit: newsHit?.title,
      baseline,
      unusual,
      sampled: capped,
    }
  })

  const withActivity = entries.filter(e => e.recentCount > 0 || e.priorCount > 0)

  if (focusCountry) {
    const existing = withActivity.find(e => e.country === focusCountry)
    if (existing) return [existing]

    // No dated crisis activity for this country in the tracked window — still
    // surface an explicit "quiet" entry rather than falling through to the
    // generic empty state, since the user asked about this specific country.
    const newsHit = findNewsHit(focusCountry, articles, now)
    return [{
      country: focusCountry,
      recentScore: 0, priorScore: 0,
      delta: 0,
      trend: 'flat',
      velocity: 50,
      recentCount: 0, priorCount: 0,
      reason: `No tracked crisis activity in the last 10 days${capped ? `; ${SAMPLED_NOTE}` : ''}`,
      newsHit: newsHit?.title,
      baseline: null,
      unusual: null,
      sampled: capped,
    }]
  }

  // With a known normal: most unusual first (smallest chance of a count this high), size only breaks ties.
  return withActivity
    .sort((a, b) => a.baseline && b.baseline ? a.baseline.pHigh - b.baseline.pHigh || b.delta - a.delta : b.delta - a.delta)
    .slice(0, limit)
}
