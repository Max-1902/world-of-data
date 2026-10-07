import { describe, it, expect } from 'vitest'
import { binToHex, drawProps } from './hexbin'
import { DAY_MS } from './analytics'
import type { CrisisEvent } from '../types'

const END = Date.UTC(2025, 5, 30)
const iso = (back: number) => new Date(END - back * DAY_MS).toISOString().slice(0, 10)
let n = 0
const ev = (back: number, lat: number, lng: number, o: Partial<CrisisEvent> = {}): CrisisEvent => ({
  id: `h${n++}`, title: '', type: 'conflict', severity: 'high', latitude: lat, longitude: lng,
  country: 'Ukraine', date: iso(back), description: '', source: 'ACLED', fatalities: 0, ...o,
})

describe('binToHex', () => {
  it('merges nearby points into one cell and splits recent vs prior windows', async () => {
    const cells = await binToHex([
      ev(0, 48.14, 37.75), ev(2, 48.15, 37.76), // recent (within 7 days of END)
      ev(9, 48.14, 37.75, { severity: 'critical', fatalities: 5 }), // prior window (7–13 days back)
      ev(30, 48.14, 37.75), // outside both windows → ignored
    ], { endDay: END })
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ recent: 12, prior: 10, change: 2, events: 3, fatalities: 5, country: 'Ukraine' })
    expect(cells[0].ring[0]).toEqual(cells[0].ring[cells[0].ring.length - 1])
  })

  it('keeps distant points in separate cells and picks the majority country', async () => {
    const cells = await binToHex([
      ev(0, 48.14, 37.75), ev(0, 48.14, 37.75, { country: 'Russia' }), ev(1, 48.14, 37.75),
      ev(0, -1.7, 29.2, { country: 'DR Congo' }),
    ], { endDay: END })
    expect(cells).toHaveLength(2)
    expect(cells.find(c => c.events === 3)!.country).toBe('Ukraine')
  })

  it('skips baseline markers and non-finite coordinates', async () => {
    const cells = await binToHex([
      ev(0, 10, 10, { source: 'Baseline', id: 'baseline-x' }), ev(0, NaN, 10),
    ], { endDay: END })
    expect(cells).toEqual([])
  })

  it('keeps antimeridian cells contiguous', async () => {
    const [c] = await binToHex([ev(0, 65, 179.9)], { endDay: END })
    const lngs = c.ring.map(p => p[0])
    expect(Math.max(...lngs) - Math.min(...lngs)).toBeLessThan(180)
  })
})

describe('drawProps', () => {
  it('scales by square root so one huge cell does not flatten the rest', () => {
    const base = { id: '', lat: 0, lng: 0, ring: [], prior: 0, events: 1, fatalities: 0, country: '' }
    const [big, small, drop] = drawProps([
      { ...base, recent: 100, change: 100 }, { ...base, recent: 25, change: 25 }, { ...base, recent: 4, change: -100 },
    ])
    expect(big.intensity).toBe(1)
    expect(small.intensity).toBeCloseTo(0.5)
    expect(drop.divergence).toBe(-1)
    expect(big.heightScale).toBeGreaterThan(0)
  })
  it('handles an empty list', () => {
    expect(drawProps([])).toEqual([])
  })
})
