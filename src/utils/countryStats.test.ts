import { describe, it, expect } from 'vitest'
import {
  summarizeForAI, makeScale, niceTicks, pearson, ranks, spearman, fisherCI, ols, joinRows, analyzePair, describePair, describeFit,
  percentile, histogram, correlationMatrix, countryColors, MIN_PAIR_N,
} from './countryStats'
import { INDICATOR_BY_ID, type CountryValue } from '../services/countryIndicators'

const cv = (iso3: string, value: number, year = '2022'): CountryValue => ({ iso3, name: `Country ${iso3}`, value, year })
const rows = (vals: number[], prefix = 'C'): CountryValue[] => vals.map((v, i) => cv(`${prefix}${i}`, v))

describe('scales', () => {
  it('round-trip values and reject what they cannot place', () => {
    const log = makeScale('log'), sym = makeScale('symlog'), lin = makeScale('linear')
    expect(log.inv(log.fwd(12345))).toBeCloseTo(12345)
    expect(log.valid(0)).toBe(false)
    expect(log.valid(-3)).toBe(false)
    expect(sym.inv(sym.fwd(-250))).toBeCloseTo(-250)
    expect(sym.fwd(0)).toBe(0)
    expect(sym.valid(-5)).toBe(true)
    expect(lin.valid(NaN)).toBe(false)
  })
  it('symlog is odd and monotonic', () => {
    const s = makeScale('symlog')
    expect(s.fwd(-7)).toBeCloseTo(-s.fwd(7))
    expect(s.fwd(10)).toBeLessThan(s.fwd(100))
  })
})

describe('niceTicks', () => {
  it('gives round linear ticks inside the range', () => {
    expect(niceTicks('linear', 0, 100)).toEqual([0, 20, 40, 60, 80, 100])
    expect(niceTicks('linear', 47, 83).every(t => t >= 47 && t <= 83)).toBe(true)
  })
  it('gives decade ticks on a log axis, adding 2 and 5 when the span is narrow', () => {
    expect(niceTicks('log', 1, 10000)).toEqual([1, 10, 100, 1000, 10000])
    expect(niceTicks('log', 150, 900)).toEqual([200, 500])
  })
  it('gives 0 and signed powers of ten on a symlog axis', () => {
    expect(niceTicks('symlog', -100, 1000)).toEqual([-100, -10, -1, 0, 1, 10, 100, 1000])
  })
  it('handles an empty range', () => {
    expect(niceTicks('linear', 5, 5)).toEqual([5])
  })
})

describe('correlation', () => {
  it('pearson is ±1 on exact lines and null when undefined', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1)
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1)
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull()
    expect(pearson([1, 2], [1, 2])).toBeNull()
  })
  it('matches a hand-computed pearson value', () => {
    // x = 1..5, y = 2,1,4,3,5  → r = 0.8
    expect(pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8, 6)
  })
  it('ranks ties by their average', () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    expect(ranks([3, 1, 2])).toEqual([3, 1, 2])
  })
  it('spearman captures any monotonic relationship, which pearson does not', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8]
    const y = x.map(v => v ** 5)
    expect(spearman(x, y)).toBeCloseTo(1)
    expect(pearson(x, y)!).toBeLessThan(0.97)
  })
  it('fisher interval brackets r, narrows with n, and refuses tiny n', () => {
    const small = fisherCI(0.5, 20)!, big = fisherCI(0.5, 200)!
    expect(small[0]).toBeLessThan(0.5); expect(small[1]).toBeGreaterThan(0.5)
    expect(big[1] - big[0]).toBeLessThan(small[1] - small[0])
    expect(fisherCI(0.5, 3)).toBeNull()
    expect(fisherCI(1, 50)).toBeNull()
  })
})

describe('ols', () => {
  it('recovers slope, intercept and R² of an exact line', () => {
    const f = ols([0, 1, 2, 3], [1, 3, 5, 7])!
    expect(f.slope).toBeCloseTo(2); expect(f.intercept).toBeCloseTo(1); expect(f.r2).toBeCloseTo(1)
  })
  it('gives R² = r² and null for a vertical or tiny sample', () => {
    const x = [1, 2, 3, 4, 5], y = [2, 1, 4, 3, 5]
    expect(ols(x, y)!.r2).toBeCloseTo(0.64, 6)
    expect(ols([2, 2, 2], [1, 2, 3])).toBeNull()
    expect(ols([1, 2], [1, 2])).toBeNull()
  })
})

describe('joinRows', () => {
  it('keeps only countries in both indicators with values the scales accept', () => {
    const x = [cv('A', 10), cv('B', 0), cv('C', 5), cv('D', 7)]
    const y = [cv('A', 1), cv('B', 2), cv('C', -1), cv('E', 9)]
    const j = joinRows(x, y, makeScale('log'), makeScale('linear'))
    expect(j.map(r => r.iso3)).toEqual(['A', 'C'])      // B has x=0 (invalid on log), D/E are unmatched
    expect(j[0]).toMatchObject({ x: 10, y: 1, xYear: '2022' })
  })
})

describe('analyzePair', () => {
  const lin = makeScale('linear')
  it('returns null below the minimum sample', () => {
    expect(analyzePair(rows([1, 2, 3]), rows([1, 2, 3]), lin, lin)).toBeNull()
    expect(MIN_PAIR_N).toBeGreaterThan(3)
  })

  it('fits a trend and ranks the countries furthest above and below it', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i + 1)
    const ys = xs.map(v => 2 * v + 1)
    ys[4] += 12     // C4 sits well above the line
    ys[14] -= 12    // C14 sits well below it
    const a = analyzePair(rows(xs), rows(ys), lin, lin)!
    expect(a.n).toBe(20)
    expect(a.spearman!).toBeGreaterThan(0.9)
    expect(a.over[0].iso3).toBe('C4')
    expect(a.under[0].iso3).toBe('C14')
    expect(a.over[0].z).toBeGreaterThan(2)
    expect(a.under[0].z).toBeLessThan(-2)
    expect(a.over[0].expected).toBeGreaterThan(0)
    expect(a.ci![0]).toBeLessThan(a.spearman!)
  })

  it('fits on the axis scale, so a power law is a straight line on log–log axes', () => {
    const xs = Array.from({ length: 15 }, (_, i) => 10 ** (1 + i / 3))
    const ys = xs.map(v => 3 * v ** 0.5)
    const a = analyzePair(rows(xs), rows(ys), makeScale('log'), makeScale('log'))!
    expect(a.fit.slope).toBeCloseTo(0.5)
    expect(a.fit.r2).toBeCloseTo(1)
    expect(a.residSd).toBeLessThan(1e-9 + 1)             // exact power law → near-zero residuals
    expect(a.points.every(p => Math.abs(p.expected - p.y) / p.y < 1e-6)).toBe(true)
  })
})

describe('descriptions', () => {
  const x = INDICATOR_BY_ID.get('NY.GDP.PCAP.CD')!, y = INDICATOR_BY_ID.get('SP.DYN.LE00.IN')!
  const xs = Array.from({ length: 30 }, (_, i) => 10 ** (2.5 + i / 10))
  const wiggle = (i: number) => (i % 2 ? 0.3 : -0.3)
  const a = analyzePair(rows(xs), rows(xs.map((v, i) => 40 + 10 * Math.log10(v) + wiggle(i))), makeScale(x.scale), makeScale(y.scale))!

  it('words the relationship from the numbers', () => {
    const text = describePair(a, x, y)
    expect(text).toMatch(/Across 30 countries/)
    expect(text).toMatch(/very strong positive/)
    expect(text).toMatch(/ρ = (0\.9\d|1\.00)/)
  })
  it('says an uncorrelated pair tells you nothing', () => {
    const flat = describePair({ ...a, spearman: 0.05 }, x, y)
    expect(flat).toMatch(/negligible/)
    expect(flat).toMatch(/almost nothing/)
  })
  it('reads the trend in the units of each axis', () => {
    expect(describeFit(a.fit, makeScale('log'), makeScale('linear'), x, y)).toMatch(/Each 10× in GDP\/cap goes with \+10/)
    expect(describeFit({ slope: 0.5, intercept: 0, r2: 0.9 }, makeScale('log'), makeScale('log'), x, y)).toMatch(/3\.16×/)
    expect(describeFit({ slope: 2, intercept: 0, r2: 0.5 }, makeScale('linear'), makeScale('linear'), x, y)).toMatch(/\+1 in GDP\/cap goes with \+2\.0/)
    expect(describeFit({ slope: 2, intercept: 0, r2: 0.5 }, makeScale('linear'), makeScale('symlog'), x, y)).toMatch(/symmetric-log/)
  })
})

describe('percentile & histogram', () => {
  it('interpolates percentiles', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(percentile([0, 10], 0.25)).toBe(2.5)
    expect(percentile([7], 0.9)).toBe(7)
    expect(percentile([], 0.5)).toBeNaN()
  })
  it('bins in axis space and keeps every valid value', () => {
    const h = histogram([1, 10, 100, 1000, 10000, 0, -5], makeScale('log'), 4)
    expect(h).toHaveLength(4)
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(5)        // 0 and −5 can't sit on a log axis
    expect(h[0].lo).toBeCloseTo(1); expect(h[3].hi).toBeCloseTo(10000)
    expect(histogram([], makeScale('linear'))).toEqual([])
  })
})

describe('correlationMatrix', () => {
  it('is symmetric with a unit diagonal and respects the minimum shared sample', () => {
    const base = Array.from({ length: 20 }, (_, i) => i + 1)
    const m = correlationMatrix([
      { id: 'a', rows: rows(base) },
      { id: 'b', rows: rows(base.map(v => -v)) },
      { id: 'c', rows: rows([1, 2, 3], 'C') },            // only 3 countries
    ])
    expect(m.rho[0][0]).toBe(1)
    expect(m.rho[0][1]).toBeCloseTo(-1)
    expect(m.rho[1][0]).toBe(m.rho[0][1])
    expect(m.n[0][1]).toBe(20)
    expect(m.rho[0][2]).toBeNull()
    expect(m.rho[2][2]).toBeNull()
  })
})

describe('countryColors', () => {
  it('shades every country with data in value mode and reports the clipped legend range', () => {
    const r = rows(Array.from({ length: 50 }, (_, i) => i + 1))
    const c = countryColors('value', r, makeScale('linear'), null)
    expect(Object.keys(c.colors)).toHaveLength(50)
    expect(c.lo!).toBeGreaterThan(1); expect(c.hi!).toBeLessThan(50)
    expect(c.colors.C0).not.toBe(c.colors.C49)
  })
  it('skips values a log scale cannot place', () => {
    const c = countryColors('value', [cv('A', 0), cv('B', 5), cv('C', 50)], makeScale('log'), null)
    expect(Object.keys(c.colors).sort()).toEqual(['B', 'C'])
  })
  it('colours only analysed countries in trend mode, red above and blue below', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i + 1)
    const ys = xs.map(v => 2 * v); ys[4] += 15; ys[14] -= 15
    const a = analyzePair(rows(xs), rows(ys), makeScale('linear'), makeScale('linear'))!
    const c = countryColors('trend', [], makeScale('linear'), a)
    expect(Object.keys(c.colors)).toHaveLength(20)
    const red = (h: string) => parseInt(h.slice(1, 3), 16) - parseInt(h.slice(5, 7), 16)
    expect(red(c.colors.C4)).toBeGreaterThan(0)
    expect(red(c.colors.C14)).toBeLessThan(0)
    expect(c.lo).toBeNull()
  })
  it('returns nothing for empty input', () => {
    expect(countryColors('value', [], makeScale('linear'), null).colors).toEqual({})
    expect(countryColors('trend', [], makeScale('linear'), null).colors).toEqual({})
  })
})

describe('summarizeForAI', () => {
  const x = INDICATOR_BY_ID.get('NY.GDP.PCAP.CD')!, y = INDICATOR_BY_ID.get('MS.MIL.XPND.GD.ZS')!
  const xs = makeScale(x.scale), ys = makeScale(y.scale)
  const gdp = Array.from({ length: 20 }, (_, i) => 1000 * 1.4 ** i)
  const mil = gdp.map((_, i) => 2 + (i === 5 ? 20 : 0) + (i === 12 ? -1.5 : 0))
  const a = analyzePair(rows(gdp), rows(mil), xs, ys)!

  it('names both indicators, the sample size and the extreme countries with actual vs expected', () => {
    const text = summarizeForAI(a, x, y, xs, ys)
    expect(text).toContain('Military spending (% of GDP) (Y) against GDP per capita (US$) (X), 20 countries')
    expect(text).toMatch(/Spearman ρ/)
    expect(text).toMatch(/Furthest ABOVE the trend: Country C5 \(22\.0% actual vs/)
    expect(text).toMatch(/Furthest BELOW the trend: .*Country C12/)
    expect(text).toMatch(/\+\d+\.\d sd/)
  })
  it('lists each source once when both indicators share one, and says "none" with no outliers on a side', () => {
    expect(summarizeForAI(a, x, y, xs, ys)).toContain('(World Bank)')
    expect(summarizeForAI({ ...a, over: [], under: [] }, x, y, xs, ys)).toContain('Furthest ABOVE the trend: none.')
  })
})
