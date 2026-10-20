import { describe, it, expect } from 'vitest'
import type { WeeklyPoint } from '../services/eia'
import { backtestGasStorage, conformalHalfWidth, dayOfYearDistance, forecastGasStorage, INTERVAL_MIN_ERRORS, weeklyChanges } from './gasStorage'

const DAY = 86_400_000
const start = Date.UTC(2010, 0, 1)

/** Deterministic pseudo-random normal (LCG + Box–Muller), so every run sees the same series. */
function rng(seed: number) {
  let s = seed
  const u = () => { s = (s * 1664525 + 1013904223) % 2 ** 32; return (s + 0.5) / 2 ** 32 }
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u())
}

/** Storage levels whose weekly change = a seasonal swing + an AR(1) departure with persistence `phi`. */
function synthetic(weeks: number, phi: number, seed = 7): WeeklyPoint[] {
  const z = rng(seed)
  let level = 3000, a = 0
  const out: WeeklyPoint[] = []
  for (let i = 0; i < weeks; i++) {
    const t = start + i * 7 * DAY
    const season = -100 * Math.cos((2 * Math.PI * (t - start)) / (365.25 * DAY)) // withdrawals in winter, injections in summer
    a = phi * a + 20 * z()
    level += season + a
    out.push({ t, period: new Date(t).toISOString().slice(0, 10), value: Math.round(level) })
  }
  return out
}

describe('weeklyChanges', () => {
  it('differences consecutive weeks and skips a missing week instead of forming a two-week change', () => {
    const pts = [0, 1, 3].map((w, i) => ({ t: start + w * 7 * DAY, period: '', value: [100, 90, 150][i] }))
    expect(weeklyChanges(pts).map(c => c.value)).toEqual([-10])
  })
})

describe('conformalHalfWidth / dayOfYearDistance', () => {
  it('takes the ⌈q (n + 1)⌉-th smallest error, and nothing below the minimum count', () => {
    const e = Array.from({ length: 99 }, (_, i) => i + 1)
    expect(conformalHalfWidth(e, 0.8)).toBe(80)
    expect(conformalHalfWidth(e, 0.95)).toBe(95)
    expect(conformalHalfWidth(e.slice(0, INTERVAL_MIN_ERRORS - 1), 0.8)).toBeNaN()
  })
  it('wraps round New Year', () => {
    expect(dayOfYearDistance(Date.UTC(2020, 11, 30), Date.UTC(2021, 0, 3))).toBeLessThan(6)
    expect(dayOfYearDistance(Date.UTC(2020, 6, 1), Date.UTC(2015, 6, 1))).toBeLessThan(1.5)
  })
})

describe('backtestGasStorage', () => {
  it('beats the seasonal norm and recovers the persistence when departures do persist', () => {
    const bt = backtestGasStorage(synthetic(52 * 16, 0.6))!
    expect(bt.folds.length).toBeGreaterThan(400)
    expect(bt.score.model.mae).toBeLessThan(bt.score.seasonal.mae)
    expect(bt.modelWins).toBe(true)
    expect(bt.folds[bt.folds.length - 1].beta).toBeGreaterThan(0.4)
    expect(bt.folds[bt.folds.length - 1].beta).toBeLessThan(0.8)
    // the 80% range is measured, and on a stationary series it should hold roughly 80%
    const cov = bt.coverage80.held / bt.coverage80.n
    expect(cov).toBeGreaterThan(0.7)
    expect(cov).toBeLessThan(0.9)
    expect(bt.periods.map(p => p.label)).toEqual(['2016–2020', `2021–${new Date(bt.to).getUTCFullYear()}`])
  })

  it('does not make the model the headline when departures are pure noise', () => {
    const levels = synthetic(52 * 16, 0)
    const bt = backtestGasStorage(levels)!
    expect(bt.modelWins).toBe(false)
    expect(forecastGasStorage(levels, bt)!.headline).toBe('seasonal')
  })

  it('never looks ahead: changing later reports leaves earlier forecasts untouched', () => {
    const levels = synthetic(52 * 12, 0.5)
    const altered = levels.map((p, i) => i > 500 ? { ...p, value: p.value + (i - 500) * 37 } : p)
    const a = backtestGasStorage(levels)!.folds.filter(f => f.t < levels[500].t)
    const b = backtestGasStorage(altered)!.folds.filter(f => f.t < levels[500].t)
    expect(a.length).toBeGreaterThan(50)
    expect(b).toEqual(a)
  })

  it('returns null with too little history for the seasonal norm', () => {
    expect(backtestGasStorage(synthetic(52 * 5, 0.5))).toBeNull()
    expect(forecastGasStorage(synthetic(52 * 5, 0.5), null)).toBeNull()
    expect(backtestGasStorage([])).toBeNull()
  })
})

describe('forecastGasStorage', () => {
  it('forecasts the week after the latest report, with the headline method and an interval around it', () => {
    const levels = synthetic(52 * 16, 0.6)
    const bt = backtestGasStorage(levels)!
    const f = forecastGasStorage(levels, bt)!
    expect(f.t).toBe(levels[levels.length - 1].t + 7 * DAY)
    expect(f.headline).toBe('model')
    expect(f.value.last).toBe(levels[levels.length - 1].value - levels[levels.length - 2].value)
    expect(f.lo95).toBeLessThan(f.lo80)
    expect(f.lo80).toBeLessThan(f.value.model)
    expect(f.hi80).toBeLessThan(f.hi95)
  })
})
