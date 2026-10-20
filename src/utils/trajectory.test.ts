import { describe, it, expect } from 'vitest'
import { computeTrajectories, countTails, isFlaggedUp, BASELINE_MAX_DAYS } from './trajectory'
import type { CrisisEvent, Flight, NewsArticle } from '../types'

function crisis(overrides: Partial<CrisisEvent>): CrisisEvent {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: 'Event',
    type: 'conflict',
    severity: 'medium',
    latitude: 0,
    longitude: 0,
    country: 'Testland',
    date: new Date().toISOString(),
    description: '',
    source: 'Test',
    ...overrides,
  }
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('computeTrajectories as-of time', () => {
  it('scores relative to the supplied time and ignores events after it', () => {
    const asOf = Date.UTC(2025, 0, 20, 23, 59, 59)
    const day = (d: number) => new Date(Date.UTC(2025, 0, d)).toISOString().slice(0, 10)
    const crises = [
      crisis({ country: 'Past', severity: 'critical', date: day(19) }),
      crisis({ country: 'Past', severity: 'critical', date: day(20) }),
      crisis({ country: 'Future', severity: 'critical', date: day(25) }),   // after asOf: must not count
    ]
    const entries = computeTrajectories(crises, [], 6, [], null, asOf)
    expect(entries.map(e => e.country)).toEqual(['Past'])
    expect(entries[0]).toMatchObject({ trend: 'rising', recentCount: 2, priorCount: 0 })
  })
})

describe('computeTrajectories', () => {
  it('marks a country rising when recent activity outweighs prior activity', () => {
    const crises = [
      crisis({ country: 'Ruritania', severity: 'critical', date: daysAgo(1) }),
      crisis({ country: 'Ruritania', severity: 'critical', date: daysAgo(2) }),
    ]
    const [entry] = computeTrajectories(crises, [], 6)
    expect(entry.country).toBe('Ruritania')
    expect(entry.trend).toBe('rising')
    expect(entry.recentCount).toBe(2)
    expect(entry.priorCount).toBe(0)
  })

  it('marks a country falling when prior activity outweighs recent activity', () => {
    const crises = [
      crisis({ country: 'Genovia', severity: 'critical', date: daysAgo(6) }),
      crisis({ country: 'Genovia', severity: 'critical', date: daysAgo(8) }),
      crisis({ country: 'Genovia', severity: 'low', date: daysAgo(1) }),
    ]
    const [entry] = computeTrajectories(crises, [], 6)
    expect(entry.country).toBe('Genovia')
    expect(entry.trend).toBe('falling')
  })

  it('marks a country flat when recent and prior severity scores are close', () => {
    const crises = [
      crisis({ country: 'Freedonia', severity: 'medium', date: daysAgo(1) }),
      crisis({ country: 'Freedonia', severity: 'medium', date: daysAgo(6) }),
    ]
    const [entry] = computeTrajectories(crises, [], 6)
    expect(entry.trend).toBe('flat')
  })

  it('excludes baseline/synthetic entries from trajectory scoring', () => {
    const crises = [
      crisis({ id: 'baseline-1', country: 'Sylvania', source: 'Baseline', severity: 'critical' }),
    ]
    const result = computeTrajectories(crises, [], 6)
    expect(result.find(e => e.country === 'Sylvania')).toBeUndefined()
  })

  it('reads perfectly steady activity (one event a day for two weeks) as flat, with a 7-day prior bucket', () => {
    // Regression: the cutoff used to be 13 days, so a 10-day prior bucket was scaled as 7 days and every
    // steady country came out "falling — 3 events in 72h, down from 10 in the prior week".
    const asOf = Date.UTC(2026, 9, 7, 15)
    const crises = Array.from({ length: 14 }, (_, d) =>
      crisis({ country: 'Steady', severity: 'high', date: new Date(asOf - d * 86_400_000).toISOString().slice(0, 10) }))
    const [entry] = computeTrajectories(crises, [], 6, [], null, asOf)
    expect(entry).toMatchObject({ trend: 'flat', recentCount: 3, priorCount: 7, delta: 0 })
  })

  it('drops events older than 10 days', () => {
    const crises = [crisis({ country: 'Edge', severity: 'critical', date: daysAgo(11) })]
    expect(computeTrajectories(crises, [], 6).find(e => e.country === 'Edge')).toBeUndefined()
  })

  it('ignores events outside the tracked 10-day window', () => {
    const crises = [
      crisis({ country: 'OldNews', severity: 'critical', date: daysAgo(30) }),
    ]
    const result = computeTrajectories(crises, [], 6)
    expect(result.find(e => e.country === 'OldNews')).toBeUndefined()
  })

  it('boosts velocity when flights cluster near a country\'s crisis coordinates', () => {
    const crises = [
      crisis({ country: 'Aeropolis', severity: 'low', date: daysAgo(1), latitude: 10, longitude: 10 }),
      crisis({ country: 'Aeropolis', severity: 'low', date: daysAgo(6), latitude: 10, longitude: 10 }),
    ]
    const nearbyFlights: Flight[] = Array.from({ length: 20 }, (_, i) => ({
      icao24: `abc${i}`, callsign: `FL${i}`, origin_country: 'x',
      latitude: 10.1, longitude: 10.1, altitude: 1000, velocity: 200, heading: 0, on_ground: false,
    }))
    const withFlights = computeTrajectories(crises, nearbyFlights, 6)
    const withoutFlights = computeTrajectories(crises, [], 6)
    expect(withFlights[0].velocity).toBeGreaterThan(withoutFlights[0].velocity)
    expect(withFlights[0].reason).toContain('elevated air traffic nearby')
  })

  it('boosts and annotates when a country is mentioned in recent news', () => {
    const crises = [
      crisis({ country: 'Newsland', severity: 'high', date: daysAgo(1) }),
    ]
    const articles: NewsArticle[] = [{
      id: 'a1', title: 'Crisis deepens in Newsland', description: '', url: '',
      source: 'Test Wire', publishedAt: new Date().toISOString(),
    }]
    const [entry] = computeTrajectories(crises, [], 6, articles)
    expect(entry.newsHit).toBe('Crisis deepens in Newsland')
    expect(entry.reason).toContain('hot in recent news')
  })

  it('returns an explicit quiet entry for a focusCountry with no tracked activity', () => {
    const result = computeTrajectories([], [], 6, [], 'Quietland')
    expect(result).toHaveLength(1)
    expect(result[0].country).toBe('Quietland')
    expect(result[0].trend).toBe('flat')
    expect(result[0].reason).toContain('No tracked crisis activity')
  })

  it('returns only the matching entry when focusCountry has tracked activity', () => {
    const crises = [
      crisis({ country: 'Alpha', severity: 'critical', date: daysAgo(1) }),
      crisis({ country: 'Beta', severity: 'critical', date: daysAgo(1) }),
    ]
    const result = computeTrajectories(crises, [], 6, [], 'Beta')
    expect(result).toHaveLength(1)
    expect(result[0].country).toBe('Beta')
  })

  it('sorts results by delta descending and respects the limit', () => {
    const crises = [
      crisis({ country: 'Small', severity: 'low', date: daysAgo(1) }),
      crisis({ country: 'Big', severity: 'critical', date: daysAgo(1) }),
      crisis({ country: 'Medium', severity: 'medium', date: daysAgo(1) }),
    ]
    const result = computeTrajectories(crises, [], 2)
    expect(result).toHaveLength(2)
    expect(result[0].country).toBe('Big')
    expect(result[0].delta).toBeGreaterThanOrEqual(result[1].delta)
  })
})

describe('own-normal surprise', () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = Date.UTC(2026, 9, 19, 12)
  const at = (daysBack: number) => new Date(now - daysBack * DAY).toISOString()
  /** `perDay(d)` events for each day d (days back) from 0.5 to 24.5. */
  const series = (country: string, perDay: (d: number) => number) =>
    Array.from({ length: 25 }, (_, i) => i + 0.5).flatMap(d =>
      Array.from({ length: perDay(d) }, (_, j) => crisis({ id: `${country}-${d}-${j}`, country, date: at(d) })))

  it('countTails matches the Poisson tail and widens under overdispersion', () => {
    // P(X ≥ 2 | Poisson(1)) = 1 − 2/e
    expect(countTails(2, 1, 1).pHigh).toBeCloseTo(1 - 2 / Math.E, 10)
    expect(countTails(0, 1, 1).pLow).toBeCloseTo(1 / Math.E, 10)
    expect(countTails(10, 3, 30).pHigh).toBeGreaterThan(countTails(10, 3, 3).pHigh * 50)
    // tiny tails are summed directly, not lost to 1 − cdf rounding
    expect(countTails(60, 5, 5).pHigh).toBeGreaterThan(0)
  })

  it('ranks a quiet country jumping 0 → 4 above a large conflict moving within its normal range', () => {
    const big = series('Bigland', d => d < 3 ? 103 + (d === 0.5 ? 5 : 0) : 100 + ((d * 2) % 7) - 3)
    const small = series('Smallland', d => d < 3 && d !== 2.5 ? 2 : 0)
    const [first, second] = computeTrajectories([...big, ...small], [], 6, [], null, now)
    expect(first.country).toBe('Smallland')
    expect(first.unusual).toBe('high')
    expect(first.baseline?.days).toBe(21)
    expect(first.reason).toContain('unusually high for this country')
    expect(second.country).toBe('Bigland')
    expect(second.unusual).toBeNull()
    expect(second.delta).toBeGreaterThan(first.delta)   // bigger raw move, yet ranked second
    expect(second.reason).toContain("within this country's normal range")
  })

  it('flags an unusually quiet country as low', () => {
    const quiet = series('Hushland', d => d < 3 ? 0 : 6)
    const [entry] = computeTrajectories(quiet, [], 6, [], null, now)
    expect(entry.unusual).toBe('low')
    expect(entry.reason).toContain('unusually quiet')
  })

  it('does not flag a bursty country for a count its own swings already cover', () => {
    // mean ~3/day, but in bursts of 30 every tenth day
    const bursty = series('Burstia', d => d < 3 ? (d === 1.5 ? 18 : 0) : Math.round(d) % 10 === 5 ? 30 : 0)
    const [entry] = computeTrajectories(bursty, [], 6, [], null, now)
    expect(entry.baseline!.expected).toBeGreaterThan(5)
    expect(entry.unusual).toBeNull()
  })

  it('has no normal when the feed reaches back less than MIN_BASELINE_DAYS before the 72h window', () => {
    const short = [crisis({ country: 'Newland', date: at(1) }), crisis({ country: 'Newland', date: at(8) })]
    const [entry] = computeTrajectories(short, [], 6, [], null, now)
    expect(entry.baseline).toBeNull()
    expect(entry.unusual).toBeNull()
  })

  it('takes history length from the oldest event in the feed, capped at BASELINE_MAX_DAYS', () => {
    const old = [crisis({ country: 'Elsewhere', date: at(60) }), crisis({ country: 'Here', date: at(1) })]
    const [entry] = computeTrajectories(old, [], 6, [], null, now)
    expect(entry.baseline?.days).toBe(BASELINE_MAX_DAYS)
  })

  it('isFlaggedUp uses the own-normal flag when known, else the rising rule', () => {
    const b = { days: 10, expected: 1, pHigh: 0.5, pLow: 0.5 }
    expect(isFlaggedUp({ trend: 'rising', baseline: null, unusual: null })).toBe(true)
    expect(isFlaggedUp({ trend: 'rising', baseline: b, unusual: null })).toBe(false)
    expect(isFlaggedUp({ trend: 'flat', baseline: b, unusual: 'high' })).toBe(true)
  })
})
