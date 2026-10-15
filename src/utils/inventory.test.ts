import { describe, it, expect } from 'vitest'
import { nearest, seasonal5y, summarize } from './inventory'
import type { WeeklyPoint } from '../services/eia'

const DAY = 86_400_000
/** Weekly Fridays from 2019-01-04, value = f(week index). */
function weekly(n: number, f: (i: number) => number, start = Date.UTC(2019, 0, 4)): WeeklyPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = start + i * 7 * DAY
    return { t, period: new Date(t).toISOString().slice(0, 10), value: f(i) }
  })
}

describe('inventory comparisons', () => {
  it('matches the same calendar week only within half a week', () => {
    const pts = weekly(10, i => i)
    expect(nearest(pts, pts[3].t + 3 * DAY)!.value).toBe(3)
    expect(nearest(pts, pts[0].t - 5 * DAY)).toBeNull()
  })

  it('computes week-on-week and year-on-year changes from the latest week', () => {
    const pts = weekly(60, i => 100 + i)
    const s = summarize(pts)!
    expect(s.latest.value).toBe(159)
    expect(s.weekChange).toBe(1)
    // a year (365 days) earlier lands on week 59 − 52 = 7 (within half a week)
    expect(s.yearChange).toBe(159 - 107)
  })

  it('reports no week-on-week change when the previous week is missing', () => {
    const pts = weekly(5, i => i).filter((_, i) => i !== 3)
    expect(summarize(pts)!.weekChange).toBeNull()
  })

  it('takes the average and range of the same week in each of the five previous years', () => {
    // value = calendar year, so the five previous same-weeks are 2020..2024 → avg 2022, range 2020–2024
    const pts = weekly(52 * 6 + 10, i => new Date(Date.UTC(2019, 0, 4) + i * 7 * DAY).getUTCFullYear())
    const last = pts[pts.length - 1]
    expect(new Date(last.t).getUTCFullYear()).toBe(2025)
    expect(seasonal5y(pts, last.t)).toEqual({ avg: 2022, min: 2020, max: 2024 })
    const s = summarize(pts)!
    expect(s.vsSeasonalPct).toBeCloseTo((2025 / 2022 - 1) * 100, 10)
  })

  it('gives no seasonal comparison with fewer than five earlier years', () => {
    const pts = weekly(52 * 3, () => 1)
    expect(seasonal5y(pts, pts[pts.length - 1].t)).toBeNull()
    expect(summarize(pts)!.vsSeasonalPct).toBeNull()
  })

  it('returns null for an empty series', () => {
    expect(summarize([])).toBeNull()
  })
})
