/**
 * Boundary/edge coverage for computeTrajectories with a frozen clock, so window edges,
 * dead-zones and velocity math are asserted exactly rather than approximately.
 * (trajectory.test.ts covers the happy-path behaviours.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeTrajectories, isFlaggedUp, SAMPLED_NOTE } from './trajectory'
import type { CrisisEvent, NewsArticle } from '../types'

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
const article = (o: Partial<NewsArticle>): NewsArticle => ({
  id: `a${seq++}`, title: '', description: '', url: '', source: 'Wire', publishedAt: new Date(NOW - HOUR).toISOString(), ...o,
})
const one = (crises: CrisisEvent[], limit = 6, articles: NewsArticle[] = [], focus?: string | null) =>
  computeTrajectories(crises, { limit, articles, focusCountry: focus })[0]

describe('window boundaries', () => {
  it('counts an event at exactly 3 days as recent, and 1ms older as prior', () => {
    expect(one([crisis({ ageMs: 3 * DAY })])).toMatchObject({ recentCount: 1, priorCount: 0 })
    expect(one([crisis({ ageMs: 3 * DAY + 1 })])).toMatchObject({ recentCount: 0, priorCount: 1 })
  })

  it('includes events up to exactly 10 days old and excludes anything older (7-day prior bucket)', () => {
    expect(one([crisis({ ageMs: 10 * DAY })])).toMatchObject({ priorCount: 1 })
    expect(computeTrajectories([crisis({ ageMs: 10 * DAY + 1 })])).toEqual([])
  })

  it('ignores events dated in the future', () => {
    expect(computeTrajectories([crisis({ ageMs: -1 })])).toEqual([])
  })

  it('drops an unparseable date instead of counting it as a brand-new event', () => {
    expect(computeTrajectories([crisis({ date: 'not-a-date' })])).toEqual([])
  })

  it('a news mention cannot lift a falling country: delta stays negative and the reason says "down from"', () => {
    // 3 recent vs a prior pace of 12 * 3/7 ≈ 5.1 → delta −2.1 (falling); news used to add +2 and lift it above 0
    const crises = [crisis({ ageMs: HOUR }), ...Array.from({ length: 4 }, () => crisis({ ageMs: 5 * DAY }))]
    const entry = one(crises, 6, [article({ title: 'Testland unrest' })])
    expect(entry.trend).toBe('falling')
    expect(entry.delta).toBeCloseTo(-2.1, 6)
    expect(entry.reason).toMatch(/^1 event in 72h, down from 4/)
  })

  it('skips events with no country', () => {
    expect(computeTrajectories([crisis({ country: '' })])).toEqual([])
  })

  it('excludes synthetic baseline entries by source and by id prefix', () => {
    const result = computeTrajectories([
      crisis({ source: 'Baseline' }), crisis({ id: 'baseline-x', country: 'Other' }),
    ])
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
    // delta = recent − prior × 3/7 = 7 − 4.29
    expect(e).toMatchObject({ recentScore: 7, priorScore: 10, delta: 2.7, recentCount: 2, priorCount: 1 })
  })

  it.each([
    // [recent score, prior score, delta, trend]. The prior week's pace over 72h is prior × 3/7, and the
    // dead-zone is |delta| <= 2, so 3 points in 72h against 7 in the prior week is *steady*, not a drop.
    [3, 7, 0, 'flat'],      // steady pace
    [5, 7, 2, 'flat'],      // exactly on the dead-zone edge
    [6, 7, 3, 'rising'],
    [1, 7, -2, 'flat'],     // exactly on the dead-zone edge
    [0, 7, -3, 'falling'],
    [3, 14, -3, 'falling'], // half the previous pace
  ] as const)('recent %i vs prior %i gives delta %d (%s)', (recentScore, priorScore, delta, trend) => {
    // low (weight 1) events: score == count
    const events = [
      ...Array.from({ length: recentScore }, () => crisis({ severity: 'low', ageMs: HOUR })),
      ...Array.from({ length: priorScore }, () => crisis({ severity: 'low', ageMs: 5 * DAY })),
    ]
    expect(one(events)).toMatchObject({ recentScore, priorScore, delta, trend })
  })

  it('does not read steady daily activity as falling', () => {
    // one low event every day for 10 days: 3 in the last 72h, 7 before that
    const events = Array.from({ length: 10 }, (_, d) => crisis({ severity: 'low', ageMs: d * DAY + HOUR }))
    expect(one(events)).toMatchObject({ recentScore: 3, priorScore: 7, trend: 'flat', velocity: 50 })
  })
})

describe('velocity', () => {
  it('is 100 for purely new critical activity and 0 for purely old critical activity', () => {
    expect(one([crisis({ severity: 'critical' })]).velocity).toBe(100)
    expect(one([crisis({ severity: 'critical', ageMs: 5 * DAY })]).velocity).toBe(0)
  })

  it('is 50 when the last 72h match the prior week\'s pace', () => {
    const steady = [...Array.from({ length: 3 }, () => crisis({ severity: 'low', ageMs: HOUR })), ...Array.from({ length: 7 }, () => crisis({ severity: 'low', ageMs: 5 * DAY }))]
    expect(one(steady).velocity).toBe(50)
  })

  it('always stays within 0..100', () => {
    const news = [article({ title: 'Testland in turmoil' })]
    const cases = [
      one([crisis({ severity: 'critical' })], 6, news),
      one([crisis({ severity: 'critical', ageMs: 5 * DAY })], 6, news),
      one([crisis({ severity: 'low' })]),
    ]
    for (const c of cases) {
      expect(c.velocity).toBeGreaterThanOrEqual(0)
      expect(c.velocity).toBeLessThanOrEqual(100)
      expect(Number.isInteger(c.velocity)).toBe(true)
    }
  })
})

describe('news cross-check', () => {
  const base = [crisis({ country: 'Freedonia' })]

  it('matches case-insensitively in title or description', () => {
    expect(one(base, 6, [article({ title: 'FREEDONIA votes' })]).newsHit).toBe('FREEDONIA votes')
    expect(one(base, 6, [article({ title: 'x', description: 'about freedonia today' })]).newsHit).toBe('x')
  })

  it('ignores articles older than 48h but keeps those just inside the window', () => {
    expect(one(base, 6, [article({ title: 'Freedonia', publishedAt: new Date(NOW - 48 * HOUR - 1).toISOString() })]).newsHit).toBeUndefined()
    expect(one(base, 6, [article({ title: 'Freedonia', publishedAt: new Date(NOW - 48 * HOUR).toISOString() })]).newsHit).toBe('Freedonia')
  })

  it('does not discard an article whose date cannot be parsed', () => {
    expect(one(base, 6, [article({ title: 'Freedonia', publishedAt: 'garbage' })]).newsHit).toBe('Freedonia')
  })

  it('uses the first matching article as context only: delta, velocity, trend and reason are unchanged', () => {
    const arts = [article({ title: 'Unrelated' }), article({ title: 'Freedonia one' }), article({ title: 'Freedonia two' })]
    const e = one(base, 6, arts)
    const plain = one(base)
    expect(e.newsHit).toBe('Freedonia one')
    expect({ ...e, newsHit: undefined }).toEqual({ ...plain, newsHit: undefined })
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
    const e = one([crisis({ severity: 'low' }), crisis({ severity: 'critical', ageMs: 5 * DAY }), crisis({ severity: 'critical', ageMs: 6 * DAY })])
    expect(e.trend).toBe('falling')
    expect(e.reason).toBe('1 event in 72h, down from 2 in the prior week')
  })

  it('flat', () => {
    const steady = [...Array.from({ length: 3 }, () => crisis({ severity: 'low', ageMs: HOUR })), ...Array.from({ length: 7 }, () => crisis({ severity: 'low', ageMs: 5 * DAY }))]
    expect(one(steady).reason).toBe('Steady at ~3 events in 72h')
  })

  it('a quiet focus country keeps its headline as context, but the reason is about tracked events only', () => {
    const e = one([], 6, [article({ title: 'Quietland reopens border' })], 'Quietland')
    expect(e.reason).toBe('No tracked crisis activity in the last 10 days')
    expect(e.newsHit).toBe('Quietland reopens border')
    expect(e).toMatchObject({ trend: 'flat', velocity: 50, delta: 0, recentCount: 0, priorCount: 0 })
  })
})

describe('ranking & limits', () => {
  it('defaults to 6 results, ranked by delta', () => {
    const crises = Array.from({ length: 9 }, (_, i) => crisis({ country: `C${i}`, severity: 'critical' }))
    expect(computeTrajectories(crises)).toHaveLength(6)
  })

  it('limit 0 returns nothing and a limit above the count returns everything', () => {
    const crises = [crisis({ country: 'A' }), crisis({ country: 'B' })]
    expect(computeTrajectories(crises, { limit: 0 })).toEqual([])
    expect(computeTrajectories(crises, { limit: 50 })).toHaveLength(2)
  })

  it('returns [] for no input', () => {
    expect(computeTrajectories([])).toEqual([])
  })

  it('never mutates its inputs', () => {
    const crises = [crisis({ country: 'A' }), crisis({ country: 'B', severity: 'critical' })]
    const snapshot = JSON.stringify(crises)
    computeTrajectories(crises, { articles: [article({ title: 'A' })] })
    expect(JSON.stringify(crises)).toBe(snapshot)
  })

  it('focusCountry is matched exactly (case-sensitive) against tracked countries', () => {
    const crises = [crisis({ country: 'Alpha', severity: 'critical' })]
    const [e] = computeTrajectories(crises, { focusCountry: 'alpha' })
    expect(e.recentCount).toBe(0)         // fell through to the quiet entry
    expect(e.country).toBe('alpha')
  })
})

describe('capped feed', () => {
  // 20 days of one event a day, then a burst: with full history this is "unusually high"
  const history = Array.from({ length: 20 }, (_, d) => crisis({ ageMs: 3 * DAY + (d + 0.5) * DAY }))
  const burst = Array.from({ length: 12 }, () => crisis({ ageMs: HOUR }))

  it('uncapped, a burst against the country\'s own normal is flagged', () => {
    const e = computeTrajectories([...history, ...burst])[0]
    expect(e.unusual).toBe('high')
    expect(e.sampled).toBe(false)
    expect(isFlaggedUp(e)).toBe(true)
  })

  it('capped, the same rows get no baseline, no flag, and a reason that says they are a sample', () => {
    const e = computeTrajectories([...history, ...burst], { capped: true })[0]
    expect(e.baseline).toBeNull()
    expect(e.unusual).toBeNull()
    expect(e.sampled).toBe(true)
    expect(e.trend).toBe('rising')
    expect(isFlaggedUp(e)).toBe(false)
    expect(e.reason).toContain(SAMPLED_NOTE)
  })

  it('no percentage is shown for an unusual country: the tail value is a rough flag, not a probability', () => {
    const e = computeTrajectories([...history, ...burst])[0]
    expect(e.reason).toContain('a rough flag from a short history, not a measured probability')
    expect(e.reason).not.toMatch(/%/)
  })
})
