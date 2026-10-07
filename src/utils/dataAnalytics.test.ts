import { describe, it, expect } from 'vitest'
import {
  HOUR_MS, DAY_MS, bucketCounts, trailingMean, median, gutenbergRichter, quakeRegion, quakeRegionMatrix,
  depthBins, fireHourCounts, frpHistogram, fireSummary,
} from './dataAnalytics'

describe('bucketCounts', () => {
  it('places times in half-open buckets and ignores out-of-range ones', () => {
    const start = 1000
    expect(bucketCounts([1000, 1999, 2000, 3500, 999, 4000], start, 1000, 3)).toEqual([2, 1, 1])
  })
})

describe('trailingMean', () => {
  it('is null until a full window exists, then slides', () => {
    expect(trailingMean([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
    expect(trailingMean([5], 3)).toEqual([null])
  })
})

describe('median', () => {
  it('handles odd, even and empty input', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('gutenbergRichter', () => {
  it('recovers b ≈ 1 from a magnitude sample drawn with exactly that exponent', () => {
    // Deterministic quantiles of the Gutenberg–Richter distribution above mc=4.5 with b=1, reported at 0.1 resolution.
    const mc = 4.5, n = 2000
    const mags = Array.from({ length: n }, (_, i) => {
      const u = (i + 0.5) / n
      const m = mc - 0.05 - Math.log10(1 - u)         // continuous exponential tail with b = 1
      return Math.round(m * 10) / 10
    }).filter(m => m >= mc)
    const gr = gutenbergRichter(mags, mc)
    expect(gr.b).toBeGreaterThan(0.9)
    expect(gr.b).toBeLessThan(1.1)
    expect(gr.bErr).toBeGreaterThan(0)
    expect(gr.bErr!).toBeLessThan(0.1)
  })

  it('counts cumulatively, drops sub-completeness magnitudes and non-finite values', () => {
    const gr = gutenbergRichter([4.5, 4.6, 4.6, 5.0, 4.0, NaN], 4.5)
    expect(gr.n).toBe(4)
    expect(gr.points[0]).toEqual({ m: 4.5, cumulative: 4 })
    expect(gr.points.find(p => p.m === 4.6)).toEqual({ m: 4.6, cumulative: 3 })
    expect(gr.points[gr.points.length - 1]).toEqual({ m: 5, cumulative: 1 })
  })

  it('returns no estimate for empty or degenerate input', () => {
    expect(gutenbergRichter([], 4.5)).toMatchObject({ n: 0, b: null, points: [] })
    expect(gutenbergRichter([4.4], 4.5).n).toBe(0)
    expect(gutenbergRichter([4.5], 4.5)).toMatchObject({ n: 1, bErr: null })
  })
})

describe('quakeRegion', () => {
  it('takes the text after the last comma, or the whole place when there is none', () => {
    expect(quakeRegion('12 km SSW of Hirara, Japan')).toBe('Japan')
    expect(quakeRegion('Fiji region')).toBe('Fiji region')
    expect(quakeRegion('5 km N of Town, Somewhere, CA')).toBe('CA')
    expect(quakeRegion('')).toBe('Unknown')
  })
})

describe('quakeRegionMatrix', () => {
  const end = 10 * DAY_MS
  const q = (daysBack: number, place: string) => ({ place, time: end - daysBack * DAY_MS - HOUR_MS })
  it('ranks regions by count and fills the right window columns', () => {
    const m = quakeRegionMatrix([q(0, 'a, Japan'), q(0, 'b, Japan'), q(2, 'c, Chile'), q(6.5, 'd, Japan'), q(9, 'e, Peru')], end, 7)
    expect(m.rows).toEqual(['Japan', 'Chile'])           // Peru is older than 7 windows
    expect(m.cells[0]).toEqual([1, 0, 0, 0, 0, 0, 2])    // last column = most recent day
    expect(m.cells[1]).toEqual([0, 0, 0, 0, 1, 0, 0])
    expect(m.totals).toEqual([3, 1])
    expect(m.max).toBe(2)
    expect(m.cols).toHaveLength(7)
    expect(m.cols[6]).toBe(end - DAY_MS)
  })
  it('respects topN and handles no data', () => {
    expect(quakeRegionMatrix([q(0, 'a, A'), q(0, 'b, B'), q(0, 'c, C')], end, 7, DAY_MS, 2).rows).toHaveLength(2)
    expect(quakeRegionMatrix([], end)).toMatchObject({ rows: [], max: 0 })
  })
})

describe('depthBins', () => {
  it('assigns half-open depth classes and skips non-finite depths', () => {
    const counts = Object.fromEntries(depthBins([{ depth: -2 }, { depth: 10 }, { depth: 35 }, { depth: 69.9 }, { depth: 150 }, { depth: 650 }, { depth: NaN }]).map(b => [b.label, b.count]))
    expect(counts).toEqual({ '0–35': 2, '35–70': 2, '70–150': 0, '150–300': 1, '300+': 1 })
  })
})

describe('fire statistics', () => {
  const f = (o: Partial<{ time: string; frp: number; daynight: 'D' | 'N'; confidence: 'high' | 'nominal' | 'low' }> = {}) =>
    ({ time: '1200', frp: 5, daynight: 'D' as const, confidence: 'nominal' as const, ...o })

  it('bins detections by UTC acquisition hour, tolerating unpadded and bad times', () => {
    const c = fireHourCounts([f({ time: '0010' }), f({ time: '10' }), f({ time: '2359' }), f({ time: '910' }), f({ time: '9999' }), f({ time: 'xx' })])
    expect(c).toHaveLength(24)
    expect(c[0]).toBe(2)       // '0010' and '10' → 00:10
    expect(c[9]).toBe(1)       // '910' → 09:10
    expect(c[23]).toBe(1)
    expect(c.reduce((a, b) => a + b, 0)).toBe(4)
  })

  it('histograms FRP on log-spaced classes and excludes missing power', () => {
    const h = Object.fromEntries(frpHistogram([f({ frp: 0.5 }), f({ frp: 1 }), f({ frp: 2.9 }), f({ frp: 10 }), f({ frp: 500 }), f({ frp: 0 })]).map(b => [b.label, b.count]))
    expect(h['< 1']).toBe(1)
    expect(h['1–3']).toBe(2)
    expect(h['10–30']).toBe(1)
    expect(h['300+']).toBe(1)
    expect(Object.values(h).reduce((a, b) => a + b, 0)).toBe(5)
  })

  it('summarises totals and shares without dividing by zero', () => {
    const s = fireSummary([f({ frp: 10, daynight: 'N', confidence: 'high' }), f({ frp: 20 }), f({ frp: 0, daynight: 'N' }), f({ frp: 30, confidence: 'high' })])
    expect(s).toMatchObject({ detections: 4, totalFrpMw: 60, withFrp: 3, nightShare: 0.5, highConfidenceShare: 0.5 })
    expect(fireSummary([])).toMatchObject({ detections: 0, nightShare: 0, highConfidenceShare: 0, totalFrpMw: 0 })
  })
})
