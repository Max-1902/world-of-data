/**
 * Boundary/edge coverage for computeTrajectories with a frozen clock, so window edges,
 * dead-zones and velocity math are asserted exactly rather than approximately.
 * (trajectory.test.ts covers the happy-path behaviours.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeTrajectories } from './trajectory'
import type { CrisisEvent, Flight, NewsArticle } from '../types'

const NOW = Date.parse('2025-06-15T12:00:00Z')
const HOUR = 3_600_000
const DAY = 24 * HOUR

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => vi.useRealTimers())

let seq = 0
function crisis(o: Partial<CrisisEvent> & { ageMs?: number } = {}): CrisisEvent {
  const { ageMs, ...rest } = o
  return {
    id: `c${seq++}`, title: 'Event', type: 'conflict', severity: 'medium', latitude: 0, longitude: 0,
    country: 'Testland', date: new Date(NOW - (ageMs ?? HOUR)).toISOString(), description: '', source: 'Test',
    ...rest,
  }
}
const flight = (lat: number | null, lng: number | null): Flight => ({
  icao24: `f${seq++}`, callsign: '', origin_country: '', latitude: lat, longitude: lng,
  altitude: null, velocity: null, heading: null, on_ground: false,
})
const article = (o: Partial<NewsArticle>): NewsArticle => ({
  id: `a${seq++}`, title: '', description: '', url: '', source: 'Wire', publishedAt: new Date(NOW - HOUR).toISOString(), ...o,
})
const one = (crises: CrisisEvent[], ...rest: [Flight[]?, number?, NewsArticle[]?, (string | null)?]) => {
  const [flights = [], limit = 6, articles = [], focus] = rest
  return computeTrajectories(crises, flights, limit, articles, focus)[0]
}

describe('window boundaries', () => {
  it('counts an event at exactly 3 days as recent, and 1ms older as prior', () => {
    expect(one([crisis({ ageMs: 3 * DAY })])).toMatchObject({ recentCount: 1, priorCount: 0 })
    expect(one([crisis({ ageMs: 3 * DAY + 1 })])).toMatchObject({ recentCount: 0, priorCount: 1 })
  })

  it('includes events up to exactly 13 days old and excludes anything older', () => {
    expect(one([crisis({ ageMs: 13 * DAY })])).toMatchObject({ priorCount: 1 })
    expect(computeTrajectories([crisis({ ageMs: 13 * DAY + 1 })], [], 6)).toEqual([])
  })

  it('ignores events dated in the future', () => {
    expect(computeTrajectories([crisis({ ageMs: -1 })], [], 6)).toEqual([])
  })

  it('treats an unparseable date as "now" (recent) rather than dropping or crashing', () => {
    expect(one([crisis({ date: 'not-a-date' })])).toMatchObject({ recentCount: 1 })
  })

  it('skips events with no country', () => {
    expect(computeTrajectories([crisis({ country: '' })], [], 6)).toEqual([])
  })

  it('excludes synthetic baseline entries by source and by id prefix', () => {
    const result = computeTrajectories([
      crisis({ source: 'Baseline' }), crisis({ id: 'baseline-x', country: 'Other' }),
    ], [], 6)
    expect(result).toEqual([])
  })
})

describe('scoring', () => {
  it.each([['critical', 10], ['high', 6], ['medium', 3], ['low', 1]] as const)('weights %s events as %i', (severity, weight) => {
    expect(one([crisis({ severity })]).recentScore).toBe(weight)
  })

  it('falls back to weight 1 for an unrecognised severity', () => {
    expect(one([crisis({ severity: 'weird' as unknown as CrisisEvent['severity'] })]).recentScore).toBe(1)
  })

  it('sums weights across events and keeps recent/prior separate', () => {
    const e = one([
      crisis({ severity: 'high', ageMs: DAY }), crisis({ severity: 'low', ageMs: 2 * DAY }),
      crisis({ severity: 'critical', ageMs: 5 * DAY }),
    ])
    expect(e).toMatchObject({ recentScore: 7, priorScore: 10, delta: -3, recentCount: 2, priorCount: 1 })
  })

  it.each([
    // recent - prior -> trend  (dead-zone is |delta| <= 2)
    [2, 'flat'], [3, 'rising'], [-2, 'flat'], [-3, 'falling'], [0, 'flat'],
  ] as const)('delta %i reads as %s', (delta, trend) => {
    // medium (3) events: build recent/prior scores that differ by `delta` using low (1) events
    const recent = Math.max(delta, 0), prior = Math.max(-delta, 0)
    const events = [
      ...Array.from({ length: recent }, () => crisis({ severity: 'low', ageMs: HOUR })),
      ...Array.from({ length: prior }, () => crisis({ severity: 'low', ageMs: 5 * DAY })),
      // anchor so the country always has activity even at delta 0
      crisis({ severity: 'low', ageMs: HOUR }), crisis({ severity: 'low', ageMs: 5 * DAY }),
    ]
    expect(one(events).trend).toBe(trend)
    expect(one(events).delta).toBe(delta)
  })
})

describe('velocity', () => {
  it('is 100 for purely new critical activity and 0 for purely old critical activity', () => {
    expect(one([crisis({ severity: 'critical' })]).velocity).toBe(100)
    expect(one([crisis({ severity: 'critical', ageMs: 5 * DAY })]).velocity).toBe(0)
  })

  it('is 50 when recent and prior activity are equal', () => {
    expect(one([crisis({ ageMs: HOUR }), crisis({ ageMs: 5 * DAY })]).velocity).toBe(50)
  })

  it('always stays within 0..100, including with both boosts applied', () => {
    const near = Array.from({ length: 20 }, () => flight(0.5, 0.5))
    const news = [article({ title: 'Testland in turmoil' })]
    const cases = [
      one([crisis({ severity: 'critical' })], near, 6, news),
      one([crisis({ severity: 'critical', ageMs: 5 * DAY })], near, 6, news),
      one([crisis({ severity: 'low' })]),
    ]
    for (const c of cases) {
      expect(c.velocity).toBeGreaterThanOrEqual(0)
      expect(c.velocity).toBeLessThanOrEqual(100)
      expect(Number.isInteger(c.velocity)).toBe(true)
    }
  })
})

describe('flight cross-check', () => {
  const base = [crisis({ latitude: 10, longitude: 10 })]
  const cluster = (n: number, lat = 10.5, lng = 10.5) => Array.from({ length: n }, () => flight(lat, lng))

  it('needs MORE than 15 nearby flights to trigger the boost', () => {
    expect(one(base, cluster(15)).reason).not.toContain('air traffic')
    expect(one(base, cluster(16)).reason).toContain('elevated air traffic nearby')
  })

  it('adds +2 to delta when triggered', () => {
    expect(one(base, cluster(16)).delta - one(base, []).delta).toBe(2)
  })

  it('only counts flights strictly within 2 degrees on both axes', () => {
    expect(one(base, cluster(16, 12.0, 10)).reason).not.toContain('air traffic')   // exactly 2° away
    expect(one(base, cluster(16, 11.99, 10)).reason).toContain('air traffic')
    expect(one(base, cluster(16, 10, 12.5)).reason).not.toContain('air traffic')
  })

  it('ignores flights with a null position', () => {
    const nulls = Array.from({ length: 30 }, () => flight(null, null))
    expect(one(base, nulls).reason).not.toContain('air traffic')
  })
})

describe('news cross-check', () => {
  const base = [crisis({ country: 'Freedonia' })]

  it('matches case-insensitively in title or description', () => {
    expect(one(base, [], 6, [article({ title: 'FREEDONIA votes' })]).newsHit).toBe('FREEDONIA votes')
    expect(one(base, [], 6, [article({ title: 'x', description: 'about freedonia today' })]).newsHit).toBe('x')
  })

  it('ignores articles older than 48h but keeps those just inside the window', () => {
    expect(one(base, [], 6, [article({ title: 'Freedonia', publishedAt: new Date(NOW - 48 * HOUR - 1).toISOString() })]).newsHit).toBeUndefined()
    expect(one(base, [], 6, [article({ title: 'Freedonia', publishedAt: new Date(NOW - 48 * HOUR).toISOString() })]).newsHit).toBe('Freedonia')
  })

  it('does not discard an article whose date cannot be parsed', () => {
    expect(one(base, [], 6, [article({ title: 'Freedonia', publishedAt: 'garbage' })]).newsHit).toBe('Freedonia')
  })

  it('uses the first matching article and adds +2 to delta', () => {
    const arts = [article({ title: 'Unrelated' }), article({ title: 'Freedonia one' }), article({ title: 'Freedonia two' })]
    const e = one(base, [], 6, arts)
    expect(e.newsHit).toBe('Freedonia one')
    expect(e.delta - one(base).delta).toBe(2)
  })

  it('stacks with the flight boost', () => {
    const b = [crisis({ country: 'Freedonia', latitude: 1, longitude: 1 })]
    const flights = Array.from({ length: 16 }, () => flight(1, 1))
    const e = one(b, flights, 6, [article({ title: 'Freedonia' })])
    expect(e.delta - one(b).delta).toBe(4)
    expect(e.reason).toContain('elevated air traffic nearby; hot in recent news')
  })
})

describe('reason text', () => {
  it('rising with no prior activity (singular and plural)', () => {
    expect(one([crisis({ severity: 'critical' })]).reason).toBe('1 new event in 72h, no prior activity')
    expect(one([crisis({ severity: 'high' }), crisis({ severity: 'high' })]).reason).toBe('2 new events in 72h, no prior activity')
  })

  it('rising vs. a prior week', () => {
    const e = one([crisis({ severity: 'critical' }), crisis({ severity: 'low', ageMs: 5 * DAY })])
    expect(e.reason).toMatch(/^1 events? in 72h, up from 1 in the prior week$/) // (singular/plural wording is not the point here)
  })

  it('falling', () => {
    const e = one([crisis({ severity: 'low' }), crisis({ severity: 'critical', ageMs: 5 * DAY })])
    expect(e.trend).toBe('falling')
    expect(e.reason).toBe('1 event in 72h, down from 1 in the prior week')
  })

  it('flat', () => {
    expect(one([crisis({ ageMs: HOUR }), crisis({ ageMs: 5 * DAY })]).reason).toBe('Steady at ~1 event in 72h')
  })

  it('a focus country mentioned in the news gets a distinct quiet-entry reason', () => {
    const e = one([], [], 6, [article({ title: 'Quietland reopens border' })], 'Quietland')
    expect(e.reason).toBe('No tracked crisis activity in the last 10 days; mentioned in recent news')
    expect(e.newsHit).toBe('Quietland reopens border')
    expect(e).toMatchObject({ trend: 'flat', velocity: 50, delta: 0, recentCount: 0, priorCount: 0 })
  })
})

describe('ranking & limits', () => {
  it('defaults to 6 results, ranked by delta', () => {
    const crises = Array.from({ length: 9 }, (_, i) => crisis({ country: `C${i}`, severity: 'critical' }))
    expect(computeTrajectories(crises, [])).toHaveLength(6)
  })

  it('limit 0 returns nothing and a limit above the count returns everything', () => {
    const crises = [crisis({ country: 'A' }), crisis({ country: 'B' })]
    expect(computeTrajectories(crises, [], 0)).toEqual([])
    expect(computeTrajectories(crises, [], 50)).toHaveLength(2)
  })

  it('returns [] for no input', () => {
    expect(computeTrajectories([], [])).toEqual([])
  })

  it('never mutates its inputs', () => {
    const crises = [crisis({ country: 'A' }), crisis({ country: 'B', severity: 'critical' })]
    const flights = [flight(0, 0)]
    const snapshot = JSON.stringify([crises, flights])
    computeTrajectories(crises, flights, 6, [article({ title: 'A' })], null)
    expect(JSON.stringify([crises, flights])).toBe(snapshot)
  })

  it('focusCountry is matched exactly (case-sensitive) against tracked countries', () => {
    const crises = [crisis({ country: 'Alpha', severity: 'critical' })]
    const [e] = computeTrajectories(crises, [], 6, [], 'alpha')
    expect(e.recentCount).toBe(0)         // fell through to the quiet entry
    expect(e.country).toBe('alpha')
  })
})
