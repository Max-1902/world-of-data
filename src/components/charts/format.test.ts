import { describe, it, expect } from 'vitest'
import { niceAxis, tickLabel, crisp } from './format'

describe('niceAxis', () => {
  it('ends the axis at the first clean step above the data, not the next power-of-ten multiple', () => {
    expect(niceAxis(2100).max).toBe(2500)   // niceMax used to give 5,000 — 60% empty plot
    expect(niceAxis(1234).max).toBe(1250)
    expect(niceAxis(19).max).toBe(20)
  })

  it('returns evenly spaced ticks from zero, 3–6 intervals', () => {
    for (const v of [3, 7, 12, 42, 999, 2100, 56_789]) {
      const { max, ticks } = niceAxis(v)
      expect(ticks[0]).toBe(0)
      expect(ticks[ticks.length - 1]).toBe(max)
      expect(max).toBeGreaterThanOrEqual(v)
      expect(ticks.length - 1).toBeGreaterThanOrEqual(3)
      expect(ticks.length - 1).toBeLessThanOrEqual(6)
      const step = ticks[1] - ticks[0]
      ticks.forEach((t, i) => expect(t).toBeCloseTo(i * step))
    }
  })

  it('never puts fractional ticks on a count axis', () => {
    for (const v of [1, 2, 3, 7, 9, 13]) expect(niceAxis(v).ticks.every(Number.isInteger)).toBe(true)
  })

  it('degrades to a unit axis for zero or invalid input', () => {
    expect(niceAxis(0)).toEqual({ max: 1, ticks: [0, 1] })
    expect(niceAxis(NaN)).toEqual({ max: 1, ticks: [0, 1] })
  })
})

describe('tickLabel', () => {
  it('keeps ticks exact below 10K and compacts above', () => {
    expect(tickLabel(1250)).toBe('1,250')
    expect(tickLabel(40_000)).toBe('40K')
  })
})

describe('crisp', () => {
  it('lands hairlines on half-pixels', () => {
    expect(crisp(10.3)).toBe(10.5)
    expect(crisp(10)).toBe(10.5)
  })
})
