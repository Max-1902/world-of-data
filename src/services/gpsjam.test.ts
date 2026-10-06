import { describe, it, expect } from 'vitest'
import { fetchGPSJam, percentBad, severityOf, unwrapRing } from './gpsjam'
import { mockFetch, jsonResponse } from '../test/helpers'

const CELL = '8400527ffffffff' // valid res-4 H3 cell

describe('percentBad / severityOf', () => {
  it("matches GPSJAM's formula and colour bands (>10% red, else yellow)", () => {
    expect(percentBad(8, 3)).toBeCloseTo(18.18, 1)
    expect(severityOf(10)).toBe('medium')
    expect(severityOf(10.1)).toBe('high')
  })
})

describe('unwrapRing', () => {
  it('leaves normal rings alone and makes antimeridian-straddling rings contiguous', () => {
    const normal: [number, number][] = [[10, 0], [11, 0], [11, 1]]
    expect(unwrapRing(normal)).toBe(normal)
    expect(unwrapRing([[179.5, 0], [-179.5, 0], [-179.5, 1]])).toEqual([[179.5, 0], [180.5, 0], [180.5, 1]])
  })
})

describe('fetchGPSJam', () => {
  it('turns H3 cells into closed hexagon rings with centre, percent and severity', async () => {
    const fn = mockFetch(() => jsonResponse({ date: '2026-10-04', cells: [{ h: CELL, good: 8, bad: 3 }] }))
    const data = await fetchGPSJam()
    expect(fn.mock.calls[0][0]).toBe('/api/gpsjam')
    expect(data.date).toBe('2026-10-04')
    expect(data.cells).toHaveLength(1)
    const [c] = data.cells
    expect(c).toMatchObject({ id: CELL, good: 8, bad: 3, severity: 'high' })
    expect(c.percentBad).toBeCloseTo(18.18, 1)
    expect(c.lat).toBeCloseTo(85.17, 1)
    expect(c.lng).toBeCloseTo(33.12, 1)
    expect(c.ring.length).toBeGreaterThanOrEqual(6) // ≥5 corners (pentagon/edge-distorted cells have extra vertices) + closing point
    expect(c.ring[0]).toEqual(c.ring[c.ring.length - 1])
  })

  it('drops invalid cell ids, malformed rows and cells below the 2% threshold', async () => {
    mockFetch(() => jsonResponse({ date: '2026-10-04', cells: [
      { h: 'zzzz', good: 1, bad: 9 },
      { h: CELL, good: 'x', bad: 9 },
      { h: CELL, good: 100, bad: 1 },
      null,
      { h: CELL, good: 0, bad: 5 },
    ] }))
    const { cells } = await fetchGPSJam()
    expect(cells).toHaveLength(1)
    expect(cells[0].bad).toBe(5)
  })

  it('throws on HTTP errors and malformed payloads so the hook can surface them', async () => {
    mockFetch(() => new Response('', { status: 502 }))
    await expect(fetchGPSJam()).rejects.toThrow('502')
    mockFetch(() => jsonResponse({ nope: true }))
    await expect(fetchGPSJam()).rejects.toThrow('unexpected payload')
  })
})
