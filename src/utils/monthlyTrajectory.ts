import type { ConflictFeed, CrisisEvent, NewsArticle } from '../types'
import { sameCountry } from './countryBrief'
import {
  FLAT_DEADZONE, LIVE_WINDOW, baselineClause, computeTrajectories, countTails, findNewsHit, isBaseline, unusualness,
  type OwnBaseline, type TrajectoryEntry, type TrajectoryOptions, type TrendWindow,
} from './trajectory'
import snapshotFile from '../data/ucdp-candidate.json'

/** src/data/ucdp-candidate.json, built by scripts/build-ucdp.mjs: per-country monthly counts, oldest month first. */
export interface UcdpSnapshot {
  retrieved: string
  months: string[]
  countries: Record<string, { events: number[]; clear: number[]; deaths: number[] }>
}

export const UCDP_SNAPSHOT: UcdpSnapshot = snapshotFile

const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function ucdpWindow(s: UcdpSnapshot): TrendWindow {
  return { source: 'UCDP Candidate Events', recent: monthLabel(s.months[s.months.length - 1]), prior: `the ${s.months.length - 1} months before` }
}

/**
 * A country's normal month, from its counts over the months before the latest (zero months included). Same
 * half-pseudo-event and own-spread rule as `ownBaseline`, with a month as the window instead of 72h.
 */
export function monthlyBaseline(priorCounts: number[], recentCount: number, days: number): OwnBaseline {
  const n = priorCounts.length
  const total = priorCounts.reduce((s, x) => s + x, 0)
  const expected = (total + 0.5) / n
  const raw = priorCounts.reduce((s, x) => s + x * x, 0) / n - (total / n) ** 2
  const variance = Math.max(expected, n > 1 ? raw * n / (n - 1) : 0)
  const { pHigh, pLow } = countTails(recentCount, expected, variance)
  return { days, span: `last ${n} months`, expected, pHigh, pLow }
}

const daysIn = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()
const fmt = (x: number) => x < 10 ? String(Math.round(x * 10) / 10) : String(Math.round(x))

/**
 * The monthly trend: each country's events in the latest released UCDP month against its own previous months.
 * UCDP counts lethal organised violence only (no protests or political events), released monthly with under a
 * month's lag, so this is a slower, narrower signal than the live 72h rule. Events still under UCDP review are
 * counted and the reason says how many. Pure function.
 */
export function computeMonthlyTrajectories(s: UcdpSnapshot, opts: Omit<TrajectoryOptions, 'capped'> = {}): TrajectoryEntry[] {
  const { limit = 6, articles = [], focusCountry, now = Date.now() } = opts
  const last = s.months.length - 1
  if (last < 1) return []
  const window = ucdpWindow(s)
  const days = s.months.slice(0, last).reduce((n, ym) => n + daysIn(ym), 0)

  const entries: TrajectoryEntry[] = Object.entries(s.countries).map(([country, c]) => {
    const recent = c.events[last]
    const prior = c.events.slice(0, last)
    const priorTotal = prior.reduce((a, b) => a + b, 0)
    const avg = priorTotal / last
    const delta = Math.round((recent - avg) * 10) / 10
    // a tenth of the country's usual month, so a large conflict's ordinary swing doesn't read as a trend
    const band = Math.max(FLAT_DEADZONE, avg * 0.1)
    const trend: TrajectoryEntry['trend'] = delta > band ? 'rising' : delta < -band ? 'falling' : 'flat'
    const baseline = monthlyBaseline(prior, recent, days)
    const unusual = unusualness(baseline)
    const unreviewed = recent - c.clear[last]
    const facts = [
      `${recent} event${recent === 1 ? '' : 's'} in ${window.recent} vs ~${fmt(avg)} a month in ${window.prior}`,
      `${c.deaths[last]} deaths (UCDP best estimate)`,
      unreviewed > 0 && `${unreviewed} still under UCDP review`,
      baselineClause(baseline, unusual),
    ].filter(Boolean).join('; ')
    return {
      country,
      recentScore: recent, priorScore: Math.round(avg * 10) / 10,
      delta,
      trend,
      velocity: Math.max(0, Math.min(100, Math.round((delta / Math.max(recent, avg, 1)) * 50 + 50))),
      recentCount: recent,
      priorCount: priorTotal,
      reason: facts,
      newsHit: findNewsHit(country, articles, now)?.title,
      baseline,
      unusual,
      sampled: false,
      window,
    }
  })

  const withActivity = entries.filter(e => e.recentCount > 0 || e.priorCount > 0)
  if (focusCountry) {
    const existing = withActivity.find(e => sameCountry(e.country, focusCountry))
    if (existing) return [existing]
    return [{
      country: focusCountry,
      recentScore: 0, priorScore: 0, delta: 0, trend: 'flat', velocity: 50, recentCount: 0, priorCount: 0,
      reason: `No lethal organised violence recorded by UCDP from ${monthLabel(s.months[0])} to ${window.recent}`,
      newsHit: findNewsHit(focusCountry, articles, now)?.title,
      baseline: null, unusual: null, sampled: false, window,
    }]
  }
  return withActivity.sort((a, b) => a.baseline!.pHigh - b.baseline!.pHigh || b.delta - a.delta).slice(0, limit)
}

/**
 * The trend every view shows: the live 72h rule while ACLED returns current events, otherwise UCDP's monthly one.
 * (ACLED's access tier on this account serves only year-old events, so in practice that is UCDP.)
 */
export function conflictTrajectories(crises: CrisisEvent[], feed: ConflictFeed | undefined, opts: Omit<TrajectoryOptions, 'capped'> & { snapshot?: UcdpSnapshot } = {}): TrajectoryEntry[] {
  const { snapshot = UCDP_SNAPSHOT, ...rest } = opts
  if (feed?.events.length) return computeTrajectories(feed.events, { ...rest, capped: feed.capped })
  if (crises.some(c => !isBaseline(c))) return computeTrajectories(crises, rest)
  return computeMonthlyTrajectories(snapshot, rest)
}

/** The windows the current trend covers, for headings: the same choice `conflictTrajectories` makes. */
export function conflictWindow(crises: CrisisEvent[], feed: ConflictFeed | undefined, snapshot: UcdpSnapshot = UCDP_SNAPSHOT): TrendWindow {
  return feed?.events.length || crises.some(c => !isBaseline(c)) ? LIVE_WINDOW : ucdpWindow(snapshot)
}
