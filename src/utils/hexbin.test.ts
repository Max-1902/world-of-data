import { describe, it, expect } from 'vitest'
import { binPoints, drawProps } from './hexbin'

describe('binPoints', () => {
  it('merges nearby points into one cell, summing weight and keeping the peak', async () => {
    const cells = await binPoints([
      { lat: 48.14, lng: 37.75, weight: 1, peak: 4.6 },
      { lat: 48.15, lng: 37.76, weight: 2, peak: 5.9 },
      { lat: 48.14, lng: 37.75, weight: 1, peak: 4.8 },
    ], 3)
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ value: 4, count: 3, peak: 5.9 })
    expect(cells[0].ring[0]).toEqual(cells[0].ring[cells[0].ring.length - 1])
  })

  it('keeps distant points in separate cells', async () => {
    const cells = await binPoints([{ lat: 48.14, lng: 37.75, weight: 1 }, { lat: -1.7, lng: 29.2, weight: 1 }], 3)
    expect(cells).toHaveLength(2)
    expect(cells.every(c => c.peak === 0)).toBe(true)   // no per-point peak supplied
  })

  it('skips non-finite coordinates and invalid weights', async () => {
    const cells = await binPoints([
      { lat: NaN, lng: 10, weight: 1 }, { lat: 10, lng: Infinity, weight: 1 }, { lat: 10, lng: 10, weight: -1 }, { lat: 10, lng: 10, weight: NaN },
    ], 3)
    expect(cells).toEqual([])
  })

  it('keeps antimeridian cells contiguous', async () => {
    const [c] = await binPoints([{ lat: 65, lng: 179.9, weight: 1 }], 3)
    const lngs = c.ring.map(p => p[0])
    expect(Math.max(...lngs) - Math.min(...lngs)).toBeLessThan(180)
  })

  it('finer resolution gives smaller, more numerous cells', async () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ lat: 10 + i * 0.05, lng: 20 + i * 0.05, weight: 1 }))
    expect((await binPoints(pts, 4)).length).toBeGreaterThan((await binPoints(pts, 3)).length)
  })
})

describe('drawProps', () => {
  it('scales by square root so one huge cell does not flatten the rest', () => {
    const base = { id: '', lat: 0, lng: 0, ring: [] as [number, number][], count: 1, peak: 0 }
    const [big, small, none] = drawProps([{ ...base, value: 100 }, { ...base, value: 25 }, { ...base, value: 0 }])
    expect(big.intensity).toBe(1)
    expect(small.intensity).toBeCloseTo(0.5)
    expect(none.intensity).toBe(0)
  })
  it('handles an empty list', () => {
    expect(drawProps([])).toEqual([])
  })
})
