import { describe, it, expect } from 'vitest'
import {
  normalCdf, tPValue, tCrit95, regress, senSlope, mannKendall, trendTest, hpFilter, outputGap, recessions, byDecade,
  cagr, growthDecomposition, okun, phillips, persistence, sectoralBalances, debtDynamics, anomalyScan, meanBreak,
  benjaminiHochberg, diffs, lastRun, spreadSeries, annualAverage, SUPF_CRIT_5, type Pt,
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
    // plain Mann–Kendall rejects ~24% of such series and trend-free pre-whitening ~29% (simulated; README research notes)
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
