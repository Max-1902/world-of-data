import type { CrisisEvent, Flight, NewsArticle } from '../types'

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

const SEV_WEIGHT: Record<CrisisEvent['severity'], number> = {
  critical: 10, high: 6, medium: 3, low: 1,
}

const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000   // last 3 days
const PRIOR_WINDOW_MS  = 10 * 24 * 60 * 60 * 1000  // 4–10 days before that
const FLAT_DEADZONE    = 2                          // |delta| below this reads as "flat"

function parseDate(d: string): number {
  const t = Date.parse(d)
  return Number.isNaN(t) ? Date.now() : t
}

function reasonFor(country: string, recentCount: number, priorCount: number, delta: number, flightBoost: boolean, newsHit: boolean): string {
  const suffix = [flightBoost && 'elevated air traffic nearby', newsHit && 'hot in recent news']
    .filter(Boolean).join('; ')
  if (delta > 0) {
    const base = priorCount === 0
      ? `${recentCount} new event${recentCount === 1 ? '' : 's'} in 72h, no prior activity`
      : `${recentCount} events in 72h, up from ${priorCount} in the prior week`
    return suffix ? `${base}; ${suffix}` : base
  }
  const plural = (n: number) => n === 1 ? 'event' : 'events'
  if (delta < 0) {
    const base = `${recentCount} ${plural(recentCount)} in 72h, down from ${priorCount} in the prior week`
    return suffix ? `${base}; ${suffix}` : base
  }
  const base = `Steady at ~${recentCount} ${plural(recentCount)} in 72h`
  return suffix ? `${base}; ${suffix}` : base
}

const RECENT_NEWS_WINDOW_MS = 48 * 60 * 60 * 1000  // last 48h

function findNewsHit(country: string, articles: NewsArticle[]): NewsArticle | undefined {
  const lc = country.toLowerCase()
  const now = Date.now()
  return articles.find(a => {
    const t = Date.parse(a.publishedAt)
    if (!Number.isNaN(t) && now - t > RECENT_NEWS_WINDOW_MS) return false
    const text = `${a.title} ${a.description}`.toLowerCase()
    return text.includes(lc)
  })
}

/**
 * Rule-based trajectory scoring: compares each country's crisis activity in the
 * last 3 days against the 4–10 day-prior window (using each event's own date),
 * ranking the fastest-rising regions. Pure function, no network calls.
 */
export function computeTrajectories(crises: CrisisEvent[], flights: Flight[], limit = 6, articles: NewsArticle[] = []): TrajectoryEntry[] {
  const now = Date.now()
  const byCountry: Record<string, { recent: CrisisEvent[]; prior: CrisisEvent[] }> = {}

  // Baseline entries (src/hooks/useCrises.ts) are synthetic "always ongoing" markers
  // stamped with today's date, not real event dates — including them would make every
  // long-running conflict misread as "rising, no prior activity" on every load.
  const dated = crises.filter(c => c.source !== 'Baseline' && !c.id.startsWith('baseline-'))

  for (const c of dated) {
    if (!c.country) continue
    const age = now - parseDate(c.date)
    if (age < 0 || age > RECENT_WINDOW_MS + PRIOR_WINDOW_MS) continue
    if (!byCountry[c.country]) byCountry[c.country] = { recent: [], prior: [] }
    if (age <= RECENT_WINDOW_MS) byCountry[c.country].recent.push(c)
    else byCountry[c.country].prior.push(c)
  }

  const score = (events: CrisisEvent[]) => events.reduce((s, e) => s + (SEV_WEIGHT[e.severity] ?? 1), 0)

  const entries: TrajectoryEntry[] = Object.entries(byCountry).map(([country, { recent, prior }]) => {
    const recentScore = score(recent)
    const priorScore   = score(prior)
    const delta = recentScore - priorScore
    const trend: TrajectoryEntry['trend'] = delta > FLAT_DEADZONE ? 'rising' : delta < -FLAT_DEADZONE ? 'falling' : 'flat'

    // Cross-check: flight density near this country's crisis coordinates
    const points = [...recent, ...prior].map(e => ({ lat: e.latitude, lng: e.longitude }))
    const nearbyFlights = points.length > 0
      ? flights.filter(f => f.latitude != null && f.longitude != null && points.some(p =>
          Math.abs(f.latitude! - p.lat) < 2 && Math.abs(f.longitude! - p.lng) < 2
        )).length
      : 0
    const flightBoost = nearbyFlights > 15

    // Cross-check: is this country mentioned in recent (48h) news coverage?
    const newsHit = findNewsHit(country, articles)

    const adjustedDelta = delta + (flightBoost ? 2 : 0) + (newsHit ? 2 : 0)

    const maxPossible = Math.max(recentScore, priorScore, 1) + (flightBoost ? 2 : 0) + (newsHit ? 2 : 0)
    const velocity = Math.max(0, Math.min(100, Math.round((adjustedDelta / maxPossible) * 50 + 50)))

    return {
      country,
      recentScore, priorScore,
      delta: adjustedDelta,
      trend,
      velocity,
      recentCount: recent.length,
      priorCount: prior.length,
      reason: reasonFor(country, recent.length, prior.length, adjustedDelta, flightBoost, !!newsHit),
      newsHit: newsHit?.title,
    }
  })

  return entries
    .filter(e => e.recentCount > 0 || e.priorCount > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit)
}
