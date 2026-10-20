import type { CrisisEvent, Flight, NewsArticle } from '../types'
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
  newsHit?: string
}

export const SEV_WEIGHT: Record<CrisisEvent['severity'], number> = {
  critical: 10, high: 6, medium: 3, low: 1,
}

export const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000   // last 3 days
export const PRIOR_WINDOW_MS  = 10 * 24 * 60 * 60 * 1000  // outer cutoff: events up to 10 days old count; 3–10 days old is the "prior" bucket
export const FLAT_DEADZONE    = 2                          // |delta| below this reads as "flat"

/**
 * Baseline entries (src/hooks/useCrises.ts) are synthetic "always ongoing" markers stamped with
 * today's date, not real events — they must never be counted as live activity.
 */
export function isBaseline(c: CrisisEvent): boolean {
  return c.source === 'Baseline' || c.id.startsWith('baseline-')
}

/**
 * The trend rule itself: the last 72h's severity score against what the prior week's pace predicts
 * for 72h. Shared by computeTrajectories and the research backtest (src/research/backtest.ts) so the
 * flag that is tested is exactly the flag that is shown.
 */
export function classifyTrend(recentScore: number, priorScore: number): { delta: number; priorPace: number; trend: TrajectoryEntry['trend'] } {
  // The windows differ in length (3 days vs 7), so comparing raw sums would read steady activity as a ~57%
  // drop. `delta` stays in "score points per 72h", so the flat band and the +2 boosts keep their meaning.
  const priorPace = priorScore * (RECENT_WINDOW_MS / (PRIOR_WINDOW_MS - RECENT_WINDOW_MS))
  const delta = Math.round((recentScore - priorPace) * 10) / 10
  const trend: TrajectoryEntry['trend'] = delta > FLAT_DEADZONE ? 'rising' : delta < -FLAT_DEADZONE ? 'falling' : 'flat'
  return { delta, priorPace, trend }
}

// Wording follows the unboosted trend, so a news or flight boost can't make a drop read as "up from".
function reasonFor(recentCount: number, priorCount: number, trend: TrajectoryEntry['trend'], flightBoost: boolean, newsHit: boolean): string {
  const suffix = [flightBoost && 'elevated air traffic nearby', newsHit && 'hot in recent news']
    .filter(Boolean).join('; ')
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

function findNewsHit(country: string, articles: NewsArticle[], now: number): NewsArticle | undefined {
  return articles.find(a => {
    const t = Date.parse(a.publishedAt)
    if (!Number.isNaN(t) && now - t > RECENT_NEWS_WINDOW_MS) return false
    // whole words, unqualified: "Oman" must not hit a story about Romania, nor "Sudan" one about South Sudan
    return mentionsCountry(`${a.title} ${a.description}`, country)
  })
}

/**
 * Rule-based trajectory scoring: compares each country's crisis activity in the
 * last 3 days against the pace of the 3–10 day-prior window (using each event's own date),
 * ranking the fastest-rising regions. Pure function, no network calls.
 *
 * `now` is the "as of" instant; it defaults to the present and exists so the same rule can be replayed
 * on past days without any look-ahead.
 */
export function computeTrajectories(crises: CrisisEvent[], flights: Flight[], limit = 6, articles: NewsArticle[] = [], focusCountry?: string | null, now: number = Date.now()): TrajectoryEntry[] {
  const byCountry: Record<string, { recent: CrisisEvent[]; prior: CrisisEvent[] }> = {}

  // Including baseline markers would make every long-running conflict misread as "rising, no prior activity".
  const dated = crises.filter(c => !isBaseline(c))

  for (const c of dated) {
    if (!c.country) continue
    // an undated event can't be placed in either window (it used to count as "now" and inflate the recent one)
    const t = Date.parse(c.date)
    if (Number.isNaN(t)) continue
    const age = now - t
    // PRIOR_WINDOW_MS is the outer cutoff, so the prior bucket spans 7 days — the length classifyTrend
    // normalises by. (It used to be RECENT + PRIOR = 13 days, a 10-day bucket scaled as 7, which read every
    // steady country as "falling"; found while building the research backtest.)
    if (age < 0 || age > PRIOR_WINDOW_MS) continue
    if (!byCountry[c.country]) byCountry[c.country] = { recent: [], prior: [] }
    if (age <= RECENT_WINDOW_MS) byCountry[c.country].recent.push(c)
    else byCountry[c.country].prior.push(c)
  }

  const score = (events: CrisisEvent[]) => events.reduce((s, e) => s + (SEV_WEIGHT[e.severity] ?? 1), 0)

  const entries: TrajectoryEntry[] = Object.entries(byCountry).map(([country, { recent, prior }]) => {
    const recentScore = score(recent)
    const priorScore   = score(prior)
    const { delta, priorPace, trend } = classifyTrend(recentScore, priorScore)

    // Cross-check: flight density near this country's crisis coordinates
    const points = [...recent, ...prior].map(e => ({ lat: e.latitude, lng: e.longitude }))
    const nearbyFlights = points.length > 0
      ? flights.filter(f => f.latitude != null && f.longitude != null && points.some(p =>
          Math.abs(f.latitude! - p.lat) < 2 && Math.abs(f.longitude! - p.lng) < 2
        )).length
      : 0
    const flightBoost = nearbyFlights > 15

    // Cross-check: is this country mentioned in recent (48h) news coverage?
    const newsHit = findNewsHit(country, articles, now)

    const adjustedDelta = Math.round((delta + (flightBoost ? 2 : 0) + (newsHit ? 2 : 0)) * 10) / 10

    const maxPossible = Math.max(recentScore, priorPace, 1) + (flightBoost ? 2 : 0) + (newsHit ? 2 : 0)
    const velocity = Math.max(0, Math.min(100, Math.round((adjustedDelta / maxPossible) * 50 + 50)))

    return {
      country,
      recentScore, priorScore,
      delta: adjustedDelta,
      trend,
      velocity,
      recentCount: recent.length,
      priorCount: prior.length,
      reason: reasonFor(recent.length, prior.length, trend, flightBoost, !!newsHit),
      newsHit: newsHit?.title,
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
      reason: newsHit ? 'No tracked crisis activity in the last 10 days; mentioned in recent news' : 'No tracked crisis activity in the last 10 days',
      newsHit: newsHit?.title,
    }]
  }

  return withActivity
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit)
}
