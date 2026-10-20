import { describe, it, expect } from 'vitest'
import { greatCircle, bowRight, distanceKm } from './geodesic'

describe('greatCircle', () => {
  it('starts and ends at the given points', () => {
    const pts = greatCircle([38.3, 35.0], [35.2, 39.0], 10)
    expect(pts).toHaveLength(11)
    expect(pts[0][0]).toBeCloseTo(38.3, 6); expect(pts[0][1]).toBeCloseTo(35.0, 6)
    expect(pts[10][0]).toBeCloseTo(35.2, 6); expect(pts[10][1]).toBeCloseTo(39.0, 6)
  })
  it('bulges poleward on long east-west routes, as a great circle should', () => {
    const pts = greatCircle([-74, 40], [2, 49], 20)
    expect(pts[10][1]).toBeGreaterThan(49)
  })
  it('stays continuous across the antimeridian', () => {
    const pts = greatCircle([170, 0], [-170, 0], 8)
    for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][0] - pts[i - 1][0])).toBeLessThan(10)
    expect(pts[pts.length - 1][0]).toBeCloseTo(190, 6)
  })
  it('handles identical points', () => {
    expect(greatCircle([1, 1], [1, 1])).toEqual([[1, 1], [1, 1]])
  })
})

describe('bowRight / distanceKm', () => {
  it('offsets the middle to the right of travel and leaves the ends alone', () => {
    const line: [number, number][] = [[0, 0], [5, 0], [10, 0]]
    const bowed = bowRight(line, 0.1)
    expect(bowed[0]).toEqual([0, 0]); expect(bowed[2]).toEqual([10, 0])
    expect(bowed[1][1]).toBeLessThan(0) // heading east, right is south
    const back = bowRight([...line].reverse(), 0.1)
    expect(back[1][1]).toBeGreaterThan(0) // the opposite flow sits on the other side
  })
  it('measures great-circle distance', () => {
    expect(distanceKm([0, 0], [0, 1])).toBeCloseTo(111.2, 0)
  })
})
