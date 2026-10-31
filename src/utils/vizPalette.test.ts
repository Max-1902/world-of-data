import { describe, it, expect } from 'vitest'
import { SEQUENTIAL, NEUTRAL, NEUTRAL_LIGHT, ABOVE, BELOW, divergingColor, rampColor, sequentialColor } from './vizPalette'

describe('vizPalette', () => {
  it('returns the end stops exactly and clamps out-of-range input', () => {
    expect(sequentialColor(0)).toBe(SEQUENTIAL[0])
    expect(sequentialColor(1)).toBe(SEQUENTIAL[SEQUENTIAL.length - 1])
    expect(sequentialColor(-3)).toBe(SEQUENTIAL[0])
    expect(sequentialColor(7)).toBe(SEQUENTIAL[SEQUENTIAL.length - 1])
  })
  it('interpolates linearly between stops', () => {
    expect(rampColor(['#000000', '#ffffff'], 0.5)).toBe('#808080')
  })
  it('gets monotonically lighter along the ramp', () => {
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16)
    const ls = Array.from({ length: 11 }, (_, i) => lum(sequentialColor(i / 10)))
    expect([...ls].sort((a, b) => a - b)).toEqual(ls)
  })
  it('diverges from the given neutral, so the light theme gets a light midpoint', () => {
    expect(divergingColor(0)).toBe(NEUTRAL)
    expect(divergingColor(0, NEUTRAL_LIGHT)).toBe(NEUTRAL_LIGHT)
    expect(divergingColor(1, NEUTRAL_LIGHT)).toBe(ABOVE)
    expect(divergingColor(-1, NEUTRAL_LIGHT)).toBe(BELOW)
  })
})
