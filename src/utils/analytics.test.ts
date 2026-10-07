import { describe, it, expect } from 'vitest'
import {
  DAY_MS, eventDay, latestDay, dailySeries, countryMatrix, wilson, twoProportionZ,
  backtestTrajectory, datedEvents, describeBacktest, rateMovers, MIN_EVAL_DAYS,
} from './analytics'
import type { CrisisEvent } from '../types'

const D0 = Date.UTC(2025, 0, 1)
const iso = (dayIdx: number) => new Date(D0 + dayIdx * DAY_MS).toISOString().slice(0, 10)

let n = 0
function ev(dayIdx: number, country: string, severity: CrisisEvent['severity'] = 'medium', extra: Partial<CrisisEvent> = {}): CrisisEvent {
  return {
    id: `t${n++}`, title: 'e', type: 'conflict', severity, latitude: 1, longitude: 1,
    country, date: iso(dayIdx), description: '', source: 'ACLED', ...extra,
  }
}

describe('eventDay / latestDay / datedEvents', () => {
  it('floors dates to UTC midnight and rejects unparseable ones', () => {
    expect(eventDay({ date: '2025-01-03T17:45:00Z' })).toBe(D0 + 2 * DAY_MS)
    expect(eventDay({ date: 'not a date' })).toBeNull()
  })
  it('latestDay ignores unparseable dates', () => {
    expect(latestDay([ev(3, 'A'), ev(9, 'A'), ev(0, 'A', 'low', { date: 'x' })])).toBe(D0 + 9 * DAY_MS)
    expect(latestDay([])).toBeNull()
  })
  it('drops synthetic baseline markers and country-less rows', () => {
    const rows = [ev(1, 'A'), ev(1, 'B', 'high', { source: 'Baseline' }), ev(1, 'C', 'high', { id: 'baseline-x' }), ev(1, '')]
    expect(datedEvents(rows).map(r => r.country)).toEqual(['A'])
  })
})

describe('dailySeries', () => {
  it('zero-fills quiet days, sums weighted severity, and computes a trailing 7-day mean', () => {
    const events = [ev(0, 'A', 'critical', { fatalities: 4 }), ev(0, 'B', 'low'), ev(6, 'A', 'medium')]
    const s = dailySeries(events, D0 + 6 * DAY_MS, 7)
    expect(s).toHaveLength(7)
    expect(s[0]).toMatchObject({ score: 11, events: 2, fatalities: 4, avg7: null })
    expect(s[3]).toMatchObject({ score: 0, events: 0 })
    expect(s[6].score).toBe(3)
    expect(s[6].avg7).toBeCloseTo(14 / 7)
  })
  it('ignores events outside the window', () => {
    const s = dailySeries([ev(-5, 'A'), ev(50, 'A')], D0 + 6 * DAY_MS, 7)
    expect(s.every(p => p.score === 0)).toBe(true)
  })
})

describe('countryMatrix', () => {
  it('ranks countries by window total, keeps topN, and reports the max cell', () => {
    const events = [ev(0, 'A', 'critical'), ev(1, 'A', 'critical'), ev(1, 'B', 'high'), ev(2, 'C', 'low')]
    const m = countryMatrix(events, D0 + 2 * DAY_MS, 3, 2)
    expect(m.countries).toEqual(['A', 'B'])
    expect(m.cells[0]).toEqual([10, 10, 0])
    expect(m.totals).toEqual([20, 6])
    expect(m.max).toBe(10)
  })
})

describe('rateMovers', () => {
  it('compares per-day rates so steady activity reads as flat, not falling', () => {
    const events: CrisisEvent[] = []
    for (let d = 0; d <= 9; d++) events.push(ev(d, 'Steady', 'medium'))            // 3 points every day
    for (let d = 7; d <= 9; d++) events.push(ev(d, 'Surging', 'critical'))         // quiet, then 10/day for the last 3 days
    for (let d = 0; d <= 6; d++) events.push(ev(d, 'Fading', 'critical'))          // 10/day, then silence
    const m = rateMovers(events, D0 + 9 * DAY_MS)
    const by = Object.fromEntries(m.map(x => [x.country, x]))
    expect(by.Steady.change).toBeCloseTo(0)
    expect(by.Surging.change).toBeCloseTo(10)
    expect(by.Fading.change).toBeCloseTo(-10)
    expect(m[0].country).toBe('Surging')
    expect(m[m.length - 1].country).toBe('Fading')
    expect(by.Surging).toMatchObject({ recentEvents: 3, priorEvents: 0 })
  })
  it('ignores events outside the 10-day window', () => {
    expect(rateMovers([ev(0, 'Old')], D0 + 30 * DAY_MS)).toEqual([])
  })
})

describe('statistics', () => {
  it('wilson interval matches known values and stays inside [0,1]', () => {
    const [lo, hi] = wilson(5, 10)
    expect(lo).toBeCloseTo(0.237, 2)
    expect(hi).toBeCloseTo(0.763, 2)
    expect(wilson(0, 10)[0]).toBe(0)
    expect(wilson(10, 10)[1]).toBe(1)
    expect(wilson(0, 0)).toEqual([0, 1])
  })
  it('two-proportion z is signed and zero when undefined', () => {
    expect(twoProportionZ(60, 100, 40, 100)).toBeGreaterThan(2.5)
    expect(twoProportionZ(40, 100, 60, 100)).toBeLessThan(-2.5)
    expect(twoProportionZ(0, 0, 5, 10)).toBe(0)
    expect(twoProportionZ(0, 10, 0, 10)).toBe(0)
  })
})

describe('backtestTrajectory', () => {
  it('declines to produce a result on a window that is too short', () => {
    const r = backtestTrajectory([ev(0, 'A'), ev(5, 'A')], D0 + 5 * DAY_MS)
    expect(r.insufficient).toMatch(/at least/)
    expect(r.evalDays).toBe(0)
  })
  it('returns an explicit message for empty data', () => {
    expect(backtestTrajectory([], D0).insufficient).toMatch(/No dated events/)
  })

  // Country "Surge" has a quiet period, then a burst that persists; "Fade" bursts once then goes silent.
  function scenario(): CrisisEvent[] {
    const rows: CrisisEvent[] = []
    for (let d = 0; d <= 45; d++) rows.push(ev(d, 'Steady', 'medium'))              // constant background
    for (let d = 20; d <= 45; d++) for (let k = 0; k < 4; k++) rows.push(ev(d, 'Surge', 'high'))   // sustained escalation from day 20
    for (let d = 20; d <= 22; d++) for (let k = 0; k < 6; k++) rows.push(ev(d, 'Fade', 'critical')) // 3-day spike, then silence
    rows.push(ev(0, 'Fade', 'low'))
    return rows
  }

  it('counts a sustained escalation as a hit and a one-off spike as a miss', () => {
    const r = backtestTrajectory(scenario(), D0 + 45 * DAY_MS)
    expect(r.insufficient).toBeNull()
    expect(r.evalDays).toBeGreaterThanOrEqual(MIN_EVAL_DAYS)
    expect(r.flagged.n).toBeGreaterThan(0)
    // Both countries get flagged at some point; the persistent one hits, the fading one doesn't.
    expect(r.flagged.hits).toBeGreaterThan(0)
    expect(r.flagged.hits).toBeLessThan(r.flagged.n)
    expect(r.flagged.ci[0]).toBeLessThanOrEqual(r.flagged.rate)
    expect(r.flagged.ci[1]).toBeGreaterThanOrEqual(r.flagged.rate)
    expect(r.bins.reduce((s, b) => s + b.n, 0)).toBe(r.eligible.n)
    expect(r.daily).toHaveLength(r.evalDays)
  })

  it('has no look-ahead: appending future events cannot change earlier days', () => {
    const base = scenario()
    const end = D0 + 45 * DAY_MS
    const a = backtestTrajectory(base, end)
    // Add a large burst on days 44–45 for a new country. Evaluation days up to day 36 can't see it
    // (the forward-looking outcome window for day 36 ends at day 43).
    const extra = [...base]
    for (let d = 44; d <= 45; d++) for (let k = 0; k < 30; k++) extra.push(ev(d, 'Future', 'critical'))
    const b = backtestTrajectory(extra, end)
    const cutoff = D0 + 36 * DAY_MS
    const flaggedUpTo = (r: typeof a) => r.daily.filter(p => p.t <= cutoff).map(p => [p.t, p.flagged, p.hits])
    expect(flaggedUpTo(b)).toEqual(flaggedUpTo(a))
  })
})

describe('describeBacktest', () => {
  const stat = (hits: number, n: number) => ({ hits, n, rate: hits / n, ci: wilson(hits, n) as [number, number] })
  const base = { insufficient: null, horizonDays: 7, firstEvalDay: 0, lastEvalDay: 0, evalDays: 40, bins: [], daily: [] }

  it('passes an insufficiency reason straight through', () => {
    expect(describeBacktest(backtestTrajectory([], 0))).toMatch(/No dated events/)
  })
  it('claims a lift only when z clears 1.96', () => {
    const good = describeBacktest({ ...base, eligible: stat(500, 1000), flagged: stat(70, 100), lift: 1.4, z: 4 })
    expect(good).toMatch(/1\.40× lift/)
    expect(good).toMatch(/distinguishable from chance/)
    const flat = describeBacktest({ ...base, eligible: stat(500, 1000), flagged: stat(52, 100), lift: 1.04, z: 0.4 })
    expect(flat).toMatch(/not distinguishable from chance/)
    expect(flat).not.toMatch(/lift/)
  })
  it('says so when the flag did worse than baseline', () => {
    expect(describeBacktest({ ...base, eligible: stat(500, 1000), flagged: stat(30, 100), lift: 0.6, z: -4 })).toMatch(/did worse/)
  })
})
