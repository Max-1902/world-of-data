import { describe, it, expect } from 'vitest'
import { regimeLine } from './AnalysisSection'
import type { MeanBreak } from '../../../utils/econAnalysis'

// Germany's CPI break as the panel showed it on 2026-10-20: 3.9% in 1960–1983, 2.0% in 1984–2025.
const brk = (significant = true): MeanBreak => ({
  n: 66, year: 1984, supF: 22, significant,
  before: { from: 1960, to: 1983, mean: 3.9, n: 24 },
  after: { from: 1984, to: 2025, mean: 2.0, n: 42 },
})

describe('regimeLine', () => {
  it('runs to the last year: one point per year, so LineChart never reads the long regime as a data gap', () => {
    const pts = regimeLine(brk())
    expect(pts).toHaveLength(66)
    expect(pts[0]).toEqual({ x: 1960, y: 3.9 })
    expect(pts[pts.length - 1]).toEqual({ x: 2025, y: 2.0 })
    expect(pts.every((p, i) => i === 0 || p.x - pts[i - 1].x === 1)).toBe(true)
    expect(pts.find(p => p.x === 1983)?.y).toBe(3.9)
    expect(pts.find(p => p.x === 1984)?.y).toBe(2.0)
  })

  it('draws nothing without a significant break', () => {
    expect(regimeLine(brk(false))).toEqual([])
    expect(regimeLine(null)).toEqual([])
  })
})
