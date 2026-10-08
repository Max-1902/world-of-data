import { describe, it, expect } from 'vitest'
import { aggregateDaily, replay, backtest, dateRange, addDays, rates, type AggRow, type Observation } from './backtest'
import { computeTrajectories } from '../utils/trajectory'
import type { CrisisEvent } from '../types'

const row = (event_date: string, country: string, severity: CrisisEvent['severity'] = 'high', fatalities = 0): AggRow => ({ event_date, country, severity, fatalities })

describe('aggregateDaily', () => {
  it('sums count, severity score and fatalities per day and country, skipping bad rows', () => {
    const agg = aggregateDaily([
      row('2026-01-01', 'A', 'critical', 3), row('2026-01-01', 'A', 'medium', 1), row('2026-01-02', 'B'),
      row('not-a-date', 'A'), row('2026-01-01', ''),
    ])
    expect(agg).toEqual({ '2026-01-01': { A: { n: 2, score: 13, fatalities: 4 } }, '2026-01-02': { B: { n: 1, score: 6, fatalities: 0 } } })
  })
})

describe('dates', () => {
  it('builds inclusive ranges and shifts days across month ends', () => {
    expect(dateRange('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('replay', () => {
  it('gives the same flag the dashboard computes from the same events at the end of each day', () => {
    // Irregular, seeded activity over 30 days in three countries.
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const sevs: CrisisEvent['severity'][] = ['critical', 'high', 'medium', 'low']
    const events: CrisisEvent[] = []
    for (const day of dateRange('2026-01-01', '2026-01-30'))
      for (const c of ['A', 'B', 'C'])
        for (let k = Math.floor(rnd() * (c === 'A' ? 6 : 3)); k > 0; k--)
          events.push({ id: `${day}${c}${k}`, title: '', type: 'conflict', severity: sevs[Math.floor(rnd() * 4)], latitude: 0, longitude: 0, country: c, date: day, description: '', source: 'ACLED' })
    const agg = aggregateDaily(events.map(e => ({ event_date: e.date, country: e.country, severity: e.severity, fatalities: 0 })))
    const obs = replay(agg, '2026-01-01', '2026-01-30')
    expect(obs.length).toBeGreaterThan(30)
    for (const o of obs) {
      const endOfDay = Date.parse(o.asOf) + 86_400_000 - 1
      const dash = computeTrajectories(events, [], 99, [], o.country, endOfDay)[0]
      expect({ c: o.country, d: o.asOf, trend: o.trend, delta: o.delta }).toEqual({ c: o.country, d: o.asOf, trend: dash.trend, delta: dash.delta })
    }
  })

  it('only uses as-of days whose 10-day lookback and 3-day outcome are inside the range', () => {
    const agg = aggregateDaily([row('2026-01-05', 'A')])
    const days = [...new Set(replay(agg, '2026-01-01', '2026-01-20').map(o => o.asOf))]
    expect(days[0]).toBe('2026-01-10')
    expect(days[days.length - 1]).toBe('2026-01-14') // A leaves the lookback after the 14th
  })

  it('measures the outcome on the three following days only', () => {
    const agg = aggregateDaily([row('2026-01-10', 'A'), row('2026-01-11', 'A', 'critical'), row('2026-01-13', 'A', 'low'), row('2026-01-14', 'A', 'critical')])
    const o = replay(agg, '2026-01-01', '2026-01-20').find(x => x.asOf === '2026-01-10')!
    expect(o).toMatchObject({ recent: 6, next: 11, trend: 'rising' })
  })

  it('marks at most six observations a day as shown, highest delta first', () => {
    const rows = Array.from({ length: 9 }, (_, i) => Array.from({ length: i + 1 }, () => row('2026-01-10', `C${i}`))).flat()
    const shown = replay(aggregateDaily(rows), '2026-01-01', '2026-01-20').filter(o => o.asOf === '2026-01-10' && o.shown)
    expect(shown.map(o => o.country).sort()).toEqual(['C3', 'C4', 'C5', 'C6', 'C7', 'C8'])
  })
})

describe('rates and report', () => {
  const o = (p: Partial<Observation>): Observation => ({ asOf: 'd', country: 'c', trend: 'flat', delta: 0, recent: 0, priorPace: 0, next: 0, shown: false, ...p })

  it('computes elevated, escalated and mean change; null on no observations', () => {
    expect(rates([o({ recent: 10, priorPace: 2, next: 12 }), o({ recent: 10, priorPace: 2, next: 3 })]))
      .toEqual({ n: 2, elevated: 0.5, escalated: 0.5, meanChange: -2.5 })
    expect(rates([])).toEqual({ n: 0, elevated: null, escalated: null, meanChange: null })
  })

  it('reports a lift of 1 when rising flags do no better than the base rate', () => {
    // Every country is steady at one event a day: everything is flat, no rising flags.
    const rows = dateRange('2026-01-01', '2026-01-31').flatMap(d => [row(d, 'A'), row(d, 'B')])
    const r = backtest(aggregateDaily(rows), '2026-01-01', '2026-01-31')
    expect(r.byTrend.rising.n).toBe(0)
    expect(r.byTrend.flat.n).toBe(r.all.n)
    expect(r.liftElevated).toBeNull()
    expect(r.asOfDays).toBe(19)
    expect(r.countries).toBe(2)
  })
})
