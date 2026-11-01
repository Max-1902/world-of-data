import { describe, it, expect } from 'vitest'
import { alignReturns, binomialTail, CLOSE_OFFSET_S, eventStudy, firstDayAfter, summarise, UNUSUAL, type DailyReturn } from './eventStudy'

const DAY = 86_400
const T0 = 1_300_000_000

/** Deterministic pseudo-noise, so the tests don't depend on Math.random. */
function noise(i: number, scale: number) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (x - Math.floor(x) - 0.5) * 2 * scale }

/** fund = 0.0002 + 1.5 × market + noise, with an optional shock on given days. */
function series(n: number, shock: Record<number, number> = {}): DailyReturn[] {
  return Array.from({ length: n }, (_, i) => {
    const market = noise(i, 0.01)
    return { t: T0 + i * DAY, market, fund: 0.0002 + 1.5 * market + noise(i + 7777, 0.004) + (shock[i] ?? 0) }
  })
}

describe('alignReturns', () => {
  it('uses only days both series traded and returns simple daily returns', () => {
    const fund: [number, number][] = [[1, 100], [2, 110], [3, 99], [4, 99]]
    const market: [number, number][] = [[1, 50], [3, 55], [4, 66]]
    const r = alignReturns(fund, market)
    expect(r.map(x => x.t)).toEqual([3, 4])
    expect(r[0].fund).toBeCloseTo(-0.01)
    expect(r[0].market).toBeCloseTo(0.1)
    expect(r[1].market).toBeCloseTo(0.2)
  })
})

describe('firstDayAfter', () => {
  const rets = series(5)
  it('picks the first session that closes after the event', () => {
    expect(firstDayAfter(rets, rets[2].t)).toBe(2) // during day 2's session → day 2's close is the first after
    expect(firstDayAfter(rets, rets[2].t + CLOSE_OFFSET_S)).toBe(3) // exactly at the close → next day
  })
  it('returns −1 when no session has closed since', () => {
    expect(firstDayAfter(rets, rets[4].t + CLOSE_OFFSET_S + 1)).toBe(-1)
  })
})

describe('eventStudy', () => {
  it('recovers the market model and reads an ordinary week as ordinary', () => {
    const s = eventStudy(series(800), T0 + 500 * DAY - 3600)!
    expect(s.beta).toBeCloseTo(1.5, 1)
    expect(s.estDays).toBe(250)
    expect(Math.abs(s.windows[5]!.car)).toBeLessThan(0.02)
    expect(s.windows[5]!.extremeShare).toBeGreaterThan(UNUSUAL)
  })
  it('flags a large post-event fall as unusual against the fund\'s own ordinary windows', () => {
    const s = eventStudy(series(800, { 500: -0.06, 501: -0.04 }), T0 + 500 * DAY - 3600)!
    expect(s.windows[1]!.car).toBeLessThan(-0.05)
    expect(s.windows[5]!.car).toBeLessThan(-0.08)
    expect(s.windows[5]!.extremeShare).toBeLessThan(UNUSUAL)
    expect(s.windows[5]!.days).toBe(5)
  })
  it('keeps the event out of its own baseline: a shock right after it does not change α and β', () => {
    const a = eventStudy(series(800), T0 + 500 * DAY - 3600)!
    const b = eventStudy(series(800, { 500: -0.2 }), T0 + 500 * DAY - 3600)!
    expect(b.beta).toBe(a.beta)
    expect(b.alpha).toBe(a.alpha)
  })
  it('reports a recent event\'s partial window under the next horizon only', () => {
    const s = eventStudy(series(503), T0 + 500 * DAY - 3600)!
    expect(s.windows[1]!.days).toBe(1)
    expect(s.windows[5]!.days).toBe(3)
    expect(s.windows[20]).toBeUndefined()
  })
  it('returns null without a year of history before the event, or with no session after it', () => {
    expect(eventStudy(series(400), T0 + 200 * DAY)).toBeNull()
    expect(eventStudy(series(400), T0 + 500 * DAY)).toBeNull()
  })
})

describe('binomialTail', () => {
  it('matches hand-computed values', () => {
    expect(binomialTail(0, 10, 0.05)).toBe(1)
    expect(binomialTail(1, 10, 0.05)).toBeCloseTo(1 - 0.95 ** 10)
    expect(binomialTail(11, 10, 0.05)).toBe(0)
  })
})

describe('summarise', () => {
  it('gives median, quartiles and the count of unusual windows against chance', () => {
    const w = [-0.04, -0.01, 0, 0.01, 0.02].map((car, i) => ({ days: 5, car, raw: car, extremeShare: i === 0 ? 0.01 : 0.5 }))
    const s = summarise(w)!
    expect(s).toMatchObject({ n: 5, median: 0, q1: -0.01, q3: 0.01, unusual: 1, expected: 0.25 })
    expect(s.pChance).toBeCloseTo(1 - 0.95 ** 5)
    expect(summarise([])).toBeNull()
  })
})
