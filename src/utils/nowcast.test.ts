import { describe, it, expect } from 'vitest'
import { backtestNowcast, fitBridge, ipGrowth, isPandemic, monthsKnown, monthsOf, nowcast, parseEurostat, prevQuarter, quarterIp, quarterOf, rangeHalfWidth, MIN_TRAIN } from './nowcast'

// Synthetic only: IP drifts with a seeded wobble, and GDP growth = 0.2 + 0.3 × IP growth + small noise.
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5 } }
function synth(endQ = '2026-Q2', ipEnd = '2026-08', noise = 0.05) {
  const r = rng(3)
  const ip = new Map<string, number>()
  let level = 100
  for (let y = 1995; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    const k = `${y}-${String(m).padStart(2, '0')}`
    if (k > ipEnd) break
    level *= 1 + r() * 0.03
    ip.set(k, level)
  }
  const gdp = new Map<string, number>()
  for (let y = 1995; y <= 2026; y++) for (let n = 1; n <= 4; n++) {
    const q = `${y}-Q${n}`
    if (q > endQ) break
    const g = ipGrowth(ip, q, 3)
    if (g !== null) gdp.set(q, 0.2 + 0.3 * g + r() * noise)
  }
  return { ip, gdp }
}

describe('calendar helpers', () => {
  it('maps months and quarters', () => {
    expect(quarterOf('2026-08')).toBe('2026-Q3')
    expect(monthsOf('2026-Q3')).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(prevQuarter('2026-Q1')).toBe('2025-Q4')
    expect(isPandemic('2020-Q2')).toBe(true)
    expect(isPandemic('2022-Q1')).toBe(false)
  })
})

describe('IP growth with a partial quarter', () => {
  const ip = new Map([['2026-04', 100], ['2026-05', 100], ['2026-06', 100], ['2026-07', 110], ['2026-08', 99]])
  it('carries the last published month forward and counts the months known', () => {
    expect(quarterIp(ip, '2026-Q3', 3)).toBeCloseTo((110 + 99 + 99) / 3)
    expect(quarterIp(ip, '2026-Q3', 1)).toBeCloseTo(110)
    expect(ipGrowth(ip, '2026-Q3', 1)).toBeCloseTo(10)
    expect(monthsKnown(ip, '2026-Q3')).toBe(2)
    expect(quarterIp(ip, '2026-Q4', 3)).toBeNull()
  })
})

describe('bridge model and backtest (synthetic)', () => {
  const { ip, gdp } = synth()
  it('recovers the relationship it was built with, from earlier quarters only', () => {
    const fit = fitBridge(gdp, ip, '2026-Q3')!
    expect(fit.b).toBeCloseTo(0.3, 1)
    expect(fit.a).toBeCloseTo(0.2, 1)
    expect(fitBridge(gdp, ip, '1996-Q1')).toBeNull()   // fewer than MIN_TRAIN quarters
    expect(MIN_TRAIN).toBe(32)
  })
  it('qualifies the model when it beats "same as last quarter" in both periods, scoring pandemic quarters apart', () => {
    const bt = backtestNowcast(gdp, ip, 3)
    expect(bt.modelQualifies).toBe(true)
    expect(bt.early!.rmseModel).toBeLessThan(bt.early!.rmseNaive)
    expect(bt.pandemic!.n).toBe(8)
    expect(bt.folds.every(f => f.q >= '2005-Q1')).toBe(true)
  })
  // persistent growth that IP says nothing about: "same as last quarter" is hard to beat, so the model must not qualify
  function persistent() {
    const r = rng(9)
    let g = 0.5
    return new Map([...gdp].map(([q]) => { g = 0.97 * g + 0.015 + r() * 0.1; return [q, g] as [string, number] }))
  }
  it('does not qualify a model with no signal', () => {
    expect(backtestNowcast(persistent(), ip, 3).modelQualifies).toBe(false)
  })
  it('nowcasts the first unpublished quarter with the months known, and falls back to the baseline when the model fails', () => {
    const n = nowcast(gdp, ip)!
    expect([n.quarter, n.known, n.headline]).toEqual(['2026-Q3', 2, 'model'])
    expect(n.range).not.toBeNull()
    const flat = persistent()
    const f = nowcast(flat, ip)!
    expect(f.headline).toBe('naive')
    expect(f.value).toBe(flat.get('2026-Q2'))
  })
  it('gives no nowcast before the quarter\'s first month is out', () => {
    expect(nowcast(gdp, synth('2026-Q2', '2026-06').ip)).toBeNull()
  })
})

describe('rangeHalfWidth / parseEurostat', () => {
  it('uses the split-conformal rank and needs 10 errors', () => {
    expect(rangeHalfWidth([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe(10)   // ⌈0.8 × 12⌉ = 10th smallest
    expect(rangeHalfWidth([1, 2])).toBeNull()
  })
  it('reads JSON-stat values by time index and rejects other shapes', () => {
    const m = parseEurostat({ value: { 0: 0.2, 2: 0.4 }, dimension: { time: { category: { index: { '2026-Q1': 0, '2026-Q2': 1, '2026-Q3': 2 } } } } })
    expect([...m]).toEqual([['2026-Q1', 0.2], ['2026-Q3', 0.4]])
    expect(() => parseEurostat({ error: 'x' })).toThrow('Unexpected Eurostat response shape')
  })
})
