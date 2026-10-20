import { describe, it, expect } from 'vitest'
import { POLICY, INTERVAL_RECENT, coverageLabel, headlineForecast } from './forecastPolicy'
import { arForecast, naiveForecast, type Pt } from './econAnalysis'

const series = (ys: number[], x0 = 1970): Pt[] => ys.map((y, i) => ({ x: x0 + i, y }))
// deterministic, mean-reverting around 3
const ys: number[] = [3, 3.4]
for (let i = 2; i < 50; i++) ys.push(1 + 0.6 * ys[i - 1] + 0.05 * ys[i - 2] + Math.sin(i * 1.7) * 0.8)

describe('forecast policy', () => {
  it('covers exactly the three evaluated World Bank series, each with its evidence', () => {
    expect(Object.keys(POLICY).sort()).toEqual(['FP.CPI.TOTL.ZG', 'NY.GDP.MKTP.KD.ZG', 'SL.UEM.TOTL.ZS'])
    for (const p of Object.values(POLICY)) expect(p.evidence.length).toBeGreaterThan(100)
  })

  it('inflation and unemployment headline "no change", never the AR(2) that lost to it', () => {
    for (const id of ['FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS']) {
      const h = headlineForecast(id, series(ys), 3)!
      expect(h.headline).toBe('naive')
      const nv = naiveForecast(series(ys), 3)!
      h.forecast.points.forEach((p, i) => {
        expect(p.value).toBe(nv.points[i].value)
        // the naive interval, its half-width scaled by the per-horizon factor
        expect(p.hi - p.value).toBeCloseTo((nv.points[i].hi - nv.points[i].value) * POLICY[id].scale[i], 10)
      })
      expect(h.ar).toEqual(arForecast(series(ys), 2, 3)) // still computed, for the per-country report
    }
  })

  it('GDP headlines AR(2) with the same point forecast and an interval from its own last errors', () => {
    const h = headlineForecast('NY.GDP.MKTP.KD.ZG', series(ys), 3)!
    const ar = arForecast(series(ys), 2, 3)!
    expect(h.headline).toBe('ar')
    expect(h.forecast.points.map(p => p.value)).toEqual(ar.points.map(p => p.value))
    expect(h.fallbackHorizons).toEqual([])
    // symmetric around the point forecast, and not the textbook interval
    for (const p of h.forecast.points) expect(p.hi - p.value).toBeCloseTo(p.value - p.lo, 10)
    expect(h.forecast.points[0].hi).not.toBeCloseTo(ar.points[0].hi, 6)
    expect(INTERVAL_RECENT).toBe(20)
  })

  it('falls back to the textbook interval per horizon when there are too few past errors, and says which', () => {
    // 30 years: origins 10..29 give 20 one-step errors but only 18 three-step ones
    const short = series(ys.slice(0, 30))
    const h = headlineForecast('NY.GDP.MKTP.KD.ZG', short, 3)!
    expect(h.fallbackHorizons).toEqual([3])
    const tb = arForecast(short, 2, 3)!.points[2]
    expect(h.forecast.points[2].value).toBe(tb.value)
    expect(h.forecast.points[2].hi - tb.value).toBeCloseTo((tb.hi - tb.value) * POLICY['NY.GDP.MKTP.KD.ZG'].scale[2], 10)
  })

  it('an unevaluated series keeps AR(2) with its textbook interval and no policy', () => {
    const h = headlineForecast('NE.EXP.GNFS.ZS', series(ys), 3)!
    expect(h.headline).toBe('ar')
    expect(h.policy).toBeNull()
    expect(h.forecast).toEqual(arForecast(series(ys), 2, 3))
  })

  it('unemployment intervals are widened, inflation ones narrowed, and each is labelled with what it actually held', () => {
    expect(POLICY['SL.UEM.TOTL.ZS'].scale.every(k => k > 1)).toBe(true)
    expect(POLICY['FP.CPI.TOTL.ZG'].scale.every(k => k < 1)).toBe(true)
    expect(coverageLabel(POLICY['SL.UEM.TOTL.ZS'], 3)).toBe('95% interval (held 94.9% of outcomes in backtests since 2010)')
    expect(coverageLabel(null, 1)).toContain('coverage not measured')
  })

  it('is null when not even a naive forecast is possible', () => {
    expect(headlineForecast('FP.CPI.TOTL.ZG', series([1]), 3)).toBeNull()
  })
})
