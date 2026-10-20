import { describe, it, expect } from 'vitest'
import {
  normalCdf, tPValue, tCrit95, regress, senSlope, mannKendall, trendTest, hpFilter, outputGap, recessions, byDecade,
  cagr, growthDecomposition, okun, phillips, persistence, sectoralBalances, debtDynamics, anomalyScan, meanBreak,
  benjaminiHochberg, diffs, lastRun, spreadSeries, annualAverage, SUPF_CRIT_5, type Pt,
  naiveForecast, arForecast, backtestForecast, dieboldMariano,
} from './econAnalysis'

const series = (ys: number[], x0 = 2000): Pt[] => ys.map((y, i) => ({ x: x0 + i, y }))
/** Seeded PRNG (mulberry32) so tests are deterministic and never depend on Math.random. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const uniform = rng(42)
/** uniform noise in [−0.5, 0.5), deterministic per index */
const noiseCache: number[] = []
const noise = (i: number) => { while (noiseCache.length <= i) noiseCache.push(uniform() - 0.5); return noiseCache[i] }
/** standard normal draws (Box–Muller) */
function normals(n: number, r: () => number): number[] {
  return Array.from({ length: n }, () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()))
}

describe('distributions', () => {
  it('normal CDF matches reference values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normalCdf(-1.645)).toBeCloseTo(0.05, 3)
  })
  it('t p-values and critical values match tables', () => {
    expect(tPValue(2.228, 10)).toBeCloseTo(0.05, 3)     // t(0.975, 10) = 2.228
    expect(tPValue(0, 5)).toBeCloseTo(1, 6)
    expect(tCrit95(10)).toBeCloseTo(2.228, 2)
    expect(tCrit95(30)).toBeCloseTo(2.042, 2)
    expect(tCrit95(3)).toBeCloseTo(3.182, 2)
  })
})

describe('regress', () => {
  it('recovers an exact line with zero standard error', () => {
    const r = regress([1, 2, 3, 4, 5], [3, 5, 7, 9, 11])!
    expect(r.slope).toBeCloseTo(2)
    expect(r.intercept).toBeCloseTo(1)
    expect(r.r2).toBeCloseTo(1)
    expect(r.se).toBeCloseTo(0)
  })
  it('regression: a constant y is not a significant zero slope', () => {
    const r = regress([1, 2, 3, 4, 5], [4, 4, 4, 4, 4])!
    expect(r.slope).toBe(0)
    expect(r.p).toBe(1)
  })
  it('matches a hand-worked example (slope, SE, CI)', () => {
    // x = 1..5, y = 2,4,5,4,5 → slope 0.6, intercept 2.2, SSE 2.4, se = sqrt(0.8/10) = 0.2828
    const r = regress([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])!
    expect(r.slope).toBeCloseTo(0.6)
    expect(r.intercept).toBeCloseTo(2.2)
    expect(r.se).toBeCloseTo(0.2828, 3)
    expect(r.ci[0]).toBeCloseTo(0.6 - 3.182 * 0.2828, 2)
    expect(r.p).toBeGreaterThan(0.1)    // t = 2.12, df 3 → p ≈ 0.124
    expect(r.p).toBeLessThan(0.15)
  })
  it('refuses too few points or no spread', () => {
    expect(regress([1, 2, 3], [1, 2, 3])).toBeNull()
    expect(regress([1, 1, 1, 1, 1], [1, 2, 3, 4, 5])).toBeNull()
  })
})

describe('trend tests', () => {
  it("Sen's slope ignores one wild outlier", () => {
    const pts = series([1, 2, 3, 4, 100, 6, 7, 8])
    expect(senSlope(pts)).toBeCloseTo(1)
  })
  it('Mann–Kendall S for a strictly increasing series is n(n−1)/2', () => {
    const mk = mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(mk.s).toBe(45)
    expect(mk.p).toBeLessThan(0.001)
  })
  it('finds a noisy upward trend and its slope', () => {
    const r = trendTest(series(Array.from({ length: 15 }, (_, i) => 10 + 0.5 * i + 0.3 * noise(i))))!
    expect(r.direction).toBe('up')
    expect(r.slope).toBeCloseTo(0.5, 1)
    expect(r.n).toBe(15)
  })
  it('calls a trendless series flat', () => {
    const r = trendTest(series(Array.from({ length: 15 }, (_, i) => 5 + noise(i))))!
    expect(r.direction).toBe('flat')
  })
  it('uses only the most recent window and needs at least 8 points', () => {
    const long = series([...Array(20).fill(0).map((_, i) => 100 - i), ...Array(15).fill(0).map((_, i) => 80 + i)], 1980)
    const r = trendTest(long)!
    expect(r.from).toBe(2000)   // last 15 of 35 years starting 1980
    expect(r.direction).toBe('up')
    expect(trendTest(series([1, 2, 3, 4, 5, 6, 7]))).toBeNull()
  })
})

// Calibration: under the null hypothesis a 5% test should reject about 5% of the time. These pin the p-values and
// critical values to their stated size, so a broken formula can't hide behind plausible-looking output.
describe('calibration under the null (Monte Carlo, 400 draws)', () => {
  it('trendTest rejects about 5% of trendless white-noise series', () => {
    const r = rng(7)
    let rejections = 0
    for (let k = 0; k < 400; k++) if (trendTest(series(normals(15, r)))!.direction !== 'flat') rejections++
    expect(rejections / 400).toBeGreaterThan(0.01)
    expect(rejections / 400).toBeLessThan(0.1)
  })
  it('the autocorrelation correction keeps false positives near 5% on persistent AR(1) noise (ρ = 0.6)', () => {
    const r = rng(11)
    let pw = 0
    for (let k = 0; k < 400; k++) {
      const e = normals(15, r)
      const y = [e[0]]
      for (let i = 1; i < 15; i++) y.push(0.6 * y[i - 1] + e[i])
      if (trendTest(series(y))!.direction !== 'flat') pw++
    }
    // plain Mann–Kendall rejects ~24% of such series and trend-free pre-whitening ~29% (simulated)
    expect(pw / 400).toBeLessThan(0.13)
    let rawRej = 0
    const r2 = rng(11)
    for (let k = 0; k < 400; k++) {
      const e = normals(15, r2)
      const y = [e[0]]
      for (let i = 1; i < 15; i++) y.push(0.6 * y[i - 1] + e[i])
      if (mannKendall(y).p < 0.05) rawRej++
    }
    expect(pw).toBeLessThan(rawRej / 1.5)
  })
  it('meanBreak rejects about 5% of break-free series (Andrews critical value)', () => {
    const r = rng(3)
    let rejections = 0
    for (let k = 0; k < 400; k++) if (meanBreak(series(normals(40, r), 1980))!.significant) rejections++
    expect(rejections / 400).toBeGreaterThan(0.01)
    expect(rejections / 400).toBeLessThan(0.1)
  })
  it('regress p-values are uniform-ish under the null: about 5% below 0.05', () => {
    const r = rng(5)
    let below = 0
    for (let k = 0; k < 400; k++) if (regress(normals(20, r), normals(20, r))!.p < 0.05) below++
    expect(below / 400).toBeGreaterThan(0.02)
    expect(below / 400).toBeLessThan(0.09)
  })
})

describe('Benjamini–Hochberg', () => {
  it('keeps the strong results and drops borderline ones among many tests', () => {
    const keep = benjaminiHochberg([0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205, 0.212, 0.216])
    expect(keep).toEqual([true, true, false, false, false, false, false, false, false, false])
  })
  it('handles empty input', () => { expect(benjaminiHochberg([])).toEqual([]) })
})

describe('series helpers', () => {
  it('diffs only between consecutive years; log mode in %', () => {
    expect(diffs([{ x: 2000, y: 1 }, { x: 2001, y: 3 }, { x: 2003, y: 10 }])).toEqual([{ x: 2001, y: 2 }])
    expect(diffs(series([100, 110]), 'log')[0].y).toBeCloseTo(9.531, 2)
  })
  it('lastRun returns the latest gap-free run', () => {
    expect(lastRun([{ x: 1990, y: 1 }, { x: 1995, y: 1 }, { x: 1996, y: 1 }]).map(p => p.x)).toEqual([1995, 1996])
  })
  it('spreadSeries and annualAverage align on periods', () => {
    const a = [{ period: '2020-01', t: 0, value: 3 }, { period: '2020-02', t: 1, value: 4 }]
    const b = [{ period: '2020-02', t: 1, value: 1 }]
    expect(spreadSeries(a, b)).toEqual([{ period: '2020-02', t: 1, value: 3 }])
    const monthly = Array.from({ length: 14 }, (_, i) => ({ period: `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, t: i, value: i }))
    expect(annualAverage(monthly, 12)).toEqual([{ x: 2020, y: 5.5 }])   // 2021 has only 2 months: dropped
  })
})

describe('business cycle', () => {
  it('HP filter returns a straight line unchanged', () => {
    const y = Array.from({ length: 20 }, (_, i) => 2 + 0.3 * i)
    hpFilter(y, 6.25).forEach((v, i) => expect(v).toBeCloseTo(y[i], 6))
  })
  it('HP with a huge λ approaches the OLS line', () => {
    const y = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7]
    const t = hpFilter(y, 1e7)
    const fit = regress(y.map((_, i) => i), y)!
    t.forEach((v, i) => expect(v).toBeCloseTo(fit.intercept + fit.slope * i, 1))
  })
  it('output gap is ~0 on steady exponential growth and needs 12 years', () => {
    const g = outputGap(series(Array.from({ length: 20 }, (_, i) => 100 * 1.02 ** i)))!
    g.points.forEach(p => expect(Math.abs(p.y)).toBeLessThan(1e-6))
    expect(outputGap(series([1, 2, 3]))).toBeNull()
  })
  it('dates contractions, depth and recovery', () => {
    const growth = series([2, 2, -3, -1, 1, 3, 2])
    const level = series([100, 102, 104.04, 100.92, 99.91, 100.91, 103.94, 106.02], 1999)
    const [r] = recessions(growth, level)
    expect(r.start).toBe(2002)
    expect(r.end).toBe(2003)
    expect(r.depth).toBeCloseTo(-3.97, 1)
    expect(r.recovered).toBe(2006)
  })
  it('marks a recession not yet recovered', () => {
    const [r] = recessions(series([1, -5]), series([100, 101, 96], 1999))
    expect(r.recovered).toBeNull()
  })
  it('decade stats, CAGR and per-capita decomposition', () => {
    const g = series(Array(10).fill(3), 2000)
    expect(byDecade(g)[0]).toMatchObject({ label: '2000s', n: 10, mean: 3 })
    expect(cagr(series([100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200]), 10)!.rate).toBeCloseTo(7.177, 2)
    expect(cagr(series([100, 200]), 10)).toBeNull()
    const d = growthDecomposition(g, series(Array(10).fill(1), 2000))[0]
    expect(d.perCapita).toBeCloseTo(100 * (1.03 / 1.01 - 1), 6)
  })
})

describe('structural break', () => {
  it('finds a clear shift in the mean at the right year', () => {
    const y = [...Array(15).fill(0).map((_, i) => 4 + 0.3 * noise(i)), ...Array(15).fill(0).map((_, i) => 1 + 0.3 * noise(i + 50))]
    const b = meanBreak(series(y, 1990))!
    expect(b.significant).toBe(true)
    expect(b.year).toBe(2005)
    expect(b.before.mean).toBeCloseTo(4, 0)
    expect(b.after.mean).toBeCloseTo(1, 0)
    expect(b.supF).toBeGreaterThan(SUPF_CRIT_5)
  })
  it('does not call a break in stationary noise, and needs 20 years', () => {
    const b = meanBreak(series(Array.from({ length: 30 }, (_, i) => noise(i)), 1990))!
    expect(b.significant).toBe(false)
    expect(meanBreak(series(Array(10).fill(1)))).toBeNull()
  })
})

describe('relationships on changes', () => {
  it("Okun: recovers a known coefficient and the stable-growth rate", () => {
    // Δu = 0.8 − 0.4 g → stable at g = 2
    const g = [3, -1, 2, 4, 1, 0, 5, 2.5, -2, 3.5]
    const u: number[] = [6]
    g.forEach(v => u.push(u[u.length - 1] + 0.8 - 0.4 * v))
    const r = okun(series(g, 2001), series(u, 2000))!
    expect(r.fit.slope).toBeCloseTo(-0.4, 6)
    expect(r.stableGrowth).toBeCloseTo(2, 6)
    expect(r.points).toHaveLength(10)
  })
  it('Okun: no stable-growth figure when the link is not significant', () => {
    const g = series([1, 2, 3, 4, 5, 6, 7, 8], 2001)
    const u = series([5, 5.1, 4.9, 5.2, 4.8, 5.1, 4.9, 5.2, 5], 2000)
    expect(okun(g, u)!.stableGrowth).toBeNull()
  })
  it('Phillips (accelerationist): Δπ = 3 − 0.5u gives a NAIRU of 6', () => {
    const u = [4, 8, 5, 7, 6, 3, 9, 5.5, 6.5, 4.5]
    const pi: number[] = [2]
    u.forEach(v => pi.push(pi[pi.length - 1] + 3 - 0.5 * v))
    const r = phillips(series(pi, 2000), series(u, 2001))!
    expect(r.fit.slope).toBeCloseTo(-0.5, 6)
    expect(r.nairu).toBeCloseTo(6, 6)
  })
  it('AR(1) persistence recovers ρ', () => {
    const v = [10]
    for (let i = 0; i < 12; i++) v.push(1 + 0.6 * v[v.length - 1])
    expect(persistence(series(v))!.slope).toBeCloseTo(0.6, 6)
  })
})

describe('balances and debt', () => {
  it('sectoral balances: private = CA − government', () => {
    expect(sectoralBalances(series([4]), series([-2]))).toEqual([{ x: 2000, currentAccount: 4, government: -2, privateSector: 6 }])
  })
  it('debt dynamics reproduce the identity on a worked example', () => {
    // d0 = 100, nominal GDP +4%, interest paid 3% of GDP, balance −2% → pb = +1
    const rows = debtDynamics({
      debt: series([100, 101], 2019), balance: series([-2], 2020), interest: series([3], 2020), nominalGdp: series([1000, 1040], 2019),
    })
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.growth).toBeCloseTo(4)
    expect(r.interestRate).toBeCloseTo(3 * 1.04)                 // 3% of this year's GDP on last year's stock
    expect(r.primaryBalance).toBeCloseTo(1)
    expect(r.snowball).toBeCloseTo(100 * (0.0312 - 0.04) / 1.04, 6)
    expect(r.change + r.primaryBalance - r.snowball).toBeCloseTo(r.sfa, 9)
    expect(r.stabilising).toBeCloseTo(r.snowball)
  })
  it('skips years with missing inputs', () => {
    expect(debtDynamics({ debt: series([100, 101], 2019), balance: [], interest: series([3], 2020), nominalGdp: series([1, 2], 2019) })).toEqual([])
  })
})

describe('anomalyScan', () => {
  it('flags a jump far outside the series history and reports the chance baseline', () => {
    const steady = series(Array.from({ length: 15 }, (_, i) => 5 + 0.1 * i + 0.02 * noise(i)))
    const jumped = series([...Array.from({ length: 14 }, (_, i) => 5 + 0.1 * i + 0.02 * noise(i)), 12])
    const r = anomalyScan([{ id: 'a', points: steady, mode: 'diff' }, { id: 'b', points: jumped, mode: 'diff' }])
    expect(r.tested).toBe(2)
    expect(r.flags.map(f => f.id)).toEqual(['b'])
    expect(r.flags[0].z).toBeGreaterThan(3)
    expect(r.expectedByChance).toBeCloseTo(2 * 0.0027, 3)
  })
  it('skips short series and constant changes', () => {
    const r = anomalyScan([{ id: 'short', points: series([1, 2, 3]), mode: 'diff' }, { id: 'const', points: series(Array.from({ length: 15 }, (_, i) => i)), mode: 'diff' }])
    expect(r.tested).toBe(0)
  })
})

describe('forecast', () => {
  it('naiveForecast repeats the last value with a widening interval', () => {
    const y = Array.from({ length: 10 }, (_, i) => 5 + 0.1 * noise(i))
    const f = naiveForecast(series(y), 3)!
    expect(f.points.map(p => p.value)).toEqual([y[9], y[9], y[9]])
    expect(f.points.map(p => p.year)).toEqual([2010, 2011, 2012])
    expect(f.points[0].hi - f.points[0].lo).toBeLessThan(f.points[2].hi - f.points[2].lo)
  })
  it('naiveForecast is null below 2 points', () => {
    expect(naiveForecast(series([1]), 1)).toBeNull()
  })

  it('arForecast recovers an exact AR(1) recurrence with zero residual spread', () => {
    // y_t = 10 + 0.5 y_{t-1}, started away from the fixed point so it's still moving
    const y = [0]
    for (let i = 1; i < 20; i++) y.push(10 + 0.5 * y[i - 1])
    const f = arForecast(series(y), 1, 2)!
    const next = 10 + 0.5 * y[y.length - 1]
    expect(f.points[0].value).toBeCloseTo(next, 6)
    expect(f.points[0].hi - f.points[0].lo).toBeCloseTo(0, 6) // exact recurrence: no residual, no spread
    expect(f.n).toBe(20)
  })
  it('arForecast widens its interval with the horizon on a noisy series', () => {
    const y = Array.from({ length: 30 }, (_, i) => 5 + 0.2 * i + noise(i))
    const f = arForecast(series(y), 2, 3)!
    expect(f.points[0].hi - f.points[0].lo).toBeLessThan(f.points[2].hi - f.points[2].lo)
  })
  it('arForecast interval: σ̂² = SSR / (n − p − 1), widened by ψ-weights (h=2: √(1+φ²), h=3: √(1+φ²+φ⁴) for AR(1))', () => {
    const y = [3]
    for (let i = 1; i < 40; i++) y.push(1 + 0.6 * y[i - 1] + noise(i))
    const f = arForecast(series(y), 1, 3)!
    // independent closed-form simple regression of y_t on y_{t-1}
    const xs = y.slice(0, -1), ys = y.slice(1), n = ys.length
    const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n
    const phi = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0)
    const c = my - phi * mx
    const ssr = ys.reduce((s, v, i) => s + (v - c - phi * xs[i]) ** 2, 0)
    const half1 = tCrit95(n - 2) * Math.sqrt(ssr / (n - 2))
    const half = f.points.map(p => (p.hi - p.lo) / 2)
    expect(f.points[0].value).toBeCloseTo(c + phi * y[y.length - 1], 8)
    expect(half[0]).toBeCloseTo(half1, 8)
    expect(half[1]).toBeCloseTo(half1 * Math.sqrt(1 + phi ** 2), 8)
    expect(half[2]).toBeCloseTo(half1 * Math.sqrt(1 + phi ** 2 + phi ** 4), 8)
    expect(f.longRun!).toBeCloseTo(c / (1 - phi), 8)
  })
  it('arForecast reports the long-run level c / (1 − Σφ), and null for a non-stationary fit', () => {
    const conv = [0]
    for (let i = 1; i < 20; i++) conv.push(10 + 0.5 * conv[i - 1])
    expect(arForecast(series(conv), 1, 1)!.longRun).toBeCloseTo(20, 6)
    const explosive = [0]
    for (let i = 1; i < 20; i++) explosive.push(1 + 1.5 * explosive[i - 1])
    expect(arForecast(series(explosive), 1, 1)!.longRun).toBeNull()
  })
  it('arForecast is null when there is not enough history for the requested order', () => {
    expect(arForecast(series([1, 2, 3, 4]), 2, 1)).toBeNull()
  })

  it('backtestForecast scores only 1-year-ahead folds with no look-ahead, and compares against the naive baseline', () => {
    // Perfectly linear: an AR(1) (or anything fit on the trend) should have ~zero error, clearly beating "repeat last value".
    const y = Array.from({ length: 25 }, (_, i) => 10 + 2 * i)
    const bt = backtestForecast(series(y), s => arForecast(s, 1, 1), 10)!
    expect(bt.folds).toBeGreaterThan(0)
    expect(bt.mae).toBeLessThan(0.01)
    expect(bt.baselineMae).toBeCloseTo(2, 6) // naive always misses a steady +2/year trend by exactly 2
    expect(bt.mae!).toBeLessThan(bt.baselineMae!)
  })
  it('backtestForecast returns null with no eligible folds', () => {
    expect(backtestForecast(series([1, 2, 3]), s => arForecast(s, 1, 1), 10)).toBeNull()
  })
})

describe('dieboldMariano', () => {
  // Reference values from an independent NumPy/SciPy implementation (HLN-corrected DM, t(n−1) p-value), 2026-10-15.
  const REF = [
    { e1: [2.245011,-2.811232,0.459909,-0.624547,-0.497914,-0.237157,-2.221985,-0.255126,-0.951734,3.655299,0.248365,-0.387894,-0.309416,-0.734851,-1.160666,-0.429881,0.530140,-0.262409,1.053535,-0.219782,0.026686,1.700403,0.599616,-0.555752,-0.201123,0.594578,2.128597,-0.296582,-0.267915,1.102545,-0.975106,-0.320892,0.970793,0.638385,0.100668,0.737115,-3.110979,1.123437,-1.055609,-1.835482,0.304090,0.770599,-0.489244,-1.184046,0.028737,-0.058022,1.546158,0.822149,0.213197,1.222797,-0.226075], e2: [-1.098490,0.722464,0.560792,-0.156312,-0.941089,0.332069,-2.663284,0.839137,0.620505,-1.722743,-0.012511,-1.140510,0.752943,-2.157584,-1.085944,0.860538,1.352041,-2.453806,-0.627844,0.280822,-0.590138,1.829704,-1.230349,0.309985,-1.073246,1.626559,0.056184,-0.329476,-1.810003,1.770008,0.748056,0.748920,1.331669,0.464149,-0.783171,-0.960265,-0.800220,1.427080,-1.686419,-0.576006,-0.273368,0.167081,0.552884,-1.454007,-1.983015,0.075144,1.414920,0.912764,0.317216,-0.268871,0.402557], h: 1, stat: -0.586902, p: 0.559910 },
    { e1: [-1.678775,-0.503930,0.122627,-0.861483,-0.524073,-0.901032,-0.366846,0.938419,-0.447238,-0.169258,0.895090,0.709247,1.864728,-2.299534,0.942545,-0.530512,0.148161,0.921491,1.191578,1.143286], e2: [-0.329383,1.270629,-0.811272,0.344920,1.379286,-0.106510,2.876997,1.621127,2.893133,0.470752,-0.921397,-0.316247,1.308034,-1.146170,0.917672,-0.518485,2.277250,-1.228972,0.650778,-0.208250], h: 1, stat: -0.883611, p: 0.387950 },
    { e1: [-0.616260,-0.199053,0.046058,-0.148005,-0.207683,-0.915689,-0.208047,-2.352175,-0.173065,-1.317862,1.232290,1.396919,-2.146128,0.159408,-0.139000,-1.151387,0.584818,-0.507858,-1.944359,-0.293344,-0.163078,0.117074,-1.354356,0.677249,0.809003,-1.260410,-0.724741,-0.088371,-0.622518,1.918130], e2: [0.229209,-1.111640,-0.866920,-0.063217,2.525357,-0.196091,0.140224,0.565450,-0.044139,2.508727,-0.584677,0.818623,0.176482,0.683316,-1.294307,1.944924,-0.133680,0.037580,-1.028474,-0.802665,0.620663,1.085150,0.828580,1.329867,0.785938,0.031308,0.920179,0.652964,-0.110633,0.798680], h: 2, stat: 0.104666, p: 0.917361 },
  ]
  it.each(REF.map((r, i) => [i, r] as const))('matches the SciPy reference (case %i)', (_i, r) => {
    const dm = dieboldMariano(r.e1, r.e2, r.h)!
    expect(dm.stat).toBeCloseTo(r.stat, 4)
    expect(dm.p).toBeCloseTo(r.p, 4)
    expect(dm.n).toBe(r.e1.length)
  })

  it('calls a small MAE gap on ~50 folds "not significant" (the 0.89 vs 0.97 question)', () => {
    const r = REF[0]
    const mae = (v: number[]) => v.reduce((s, x) => s + Math.abs(x), 0) / v.length
    expect(Math.abs(mae(r.e1) - mae(r.e2))).toBeLessThan(0.15)
    expect(dieboldMariano(r.e1, r.e2)!.p).toBeGreaterThan(0.05)
  })

  it('detects a real difference', () => {
    const small = Array.from({ length: 40 }, (_, i) => (i % 2 ? 0.2 : -0.2))
    const big = Array.from({ length: 40 }, (_, i) => (i % 3 ? 1.5 : -1.2))
    expect(dieboldMariano(small, big)!.p).toBeLessThan(0.001)
    expect(dieboldMariano(small, big)!.stat).toBeLessThan(0)
  })

  it('refuses below 5 folds or with zero variance', () => {
    expect(dieboldMariano([1, 2, 3, 4], [1, 2, 3, 4])).toBeNull()
    expect(dieboldMariano([1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1])).toBeNull()
  })
})

describe('backtestForecast pairing', () => {
  it('scores model and baseline on the same folds even when the model skips some', () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({ x: 1990 + i, y: Math.sin(i) }))
    // a model that declines every other fold
    const bt = backtestForecast(pts, train => (train.length % 2 ? null : naiveForecast(train, 1)), 10)!
    expect(bt.folds).toBe(10)
    expect(bt.mae).toBeCloseTo(bt.baselineMae!, 10) // same model as the baseline, same folds: identical MAE
  })
})

describe('mannKendall / senSlope against pymannkendall', () => {
  // pymannkendall 1.4.3 original_test (tie-corrected variance, continuity correction), 2026-10-15. Over 40 random
  // series S, z and Sen's slope matched exactly and p to 1.4e-7. trendTest's autocorrelation correction is a
  // documented variant (bias-corrected r1, applied only when r1 > 0) and is not compared here.
  const REF = [
    { ys: [-0.2, -0.265, -1.8, -0.9, 1.1, 0.8, -0.0, 0.2, -0.5, -0.518, 1.2, 0.767], s: 14.0, z: 0.8914431257, p: 0.3726914905, slope: 0.0800000000 },
    { ys: [0.6, 0.8, -0.844, -0.1, 0.5, 0.9, -0.032, 1.428, 0.656, 1.2, 2.4, 0.7, 1.31, 2.05, 2.1], s: 59.0, z: 2.8702556240, p: 0.0041014009, slope: 0.1464000000 },
    { ys: [2.721, 1.5, 1.4, 0.537, -1.138, -0.794, -1.5, 0.838, -1.8, 0.909, 0.851, -0.179, -2.1, 0.2, -0.268, 1.5, 1.1, -1.465, 0.9, 0.777], s: -25.0, z: -0.7790729678, p: 0.4359367329, slope: -0.0384068627 },
  ]
  it.each(REF.map((r, i) => [i, r] as const))('case %i', (_i, r) => {
    const m = mannKendall(r.ys)
    expect(m.s).toBe(r.s)
    expect(m.z).toBeCloseTo(r.z, 8)
    expect(m.p).toBeCloseTo(r.p, 6)
    expect(senSlope(r.ys.map((y, x) => ({ x, y })))).toBeCloseTo(r.slope, 10)
  })
})
