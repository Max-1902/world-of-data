import { describe, it, expect, vi } from 'vitest'
import { SHAPES, shapeFor, shapeSdf, addMarkShapes, iconSizeFor, markImageName } from './markShapes'

const alphaAt = (a: Uint8Array, x: number, y: number) => a[(y * 32 + x) * 4 + 3]
const inside = (a: Uint8Array) => { let n = 0; for (let i = 3; i < a.length; i += 4) if (a[i] > 191) n++; return n }

describe('mark shapes', () => {
  it('draws every shape differently, so a category can be told by silhouette', () => {
    const maps = SHAPES.map(s => Array.from(shapeSdf(s)).join(','))
    expect(new Set(maps).size).toBe(SHAPES.length)
  })

  it('is filled in the middle (except the rings) and empty at the corners', () => {
    for (const s of SHAPES) {
      const a = shapeSdf(s)
      expect(alphaAt(a, 0, 0), s).toBe(0)
      expect(inside(a), s).toBeGreaterThan(40)
    }
    expect(alphaAt(shapeSdf('circle'), 16, 16)).toBeGreaterThan(191)
    expect(alphaAt(shapeSdf('ring'), 16, 16)).toBeLessThan(191)
  })

  it('gives each category its own shape, in the colour map order', () => {
    const cats = ['a', 'b', 'c']
    expect(new Set(cats.map(c => shapeFor(cats, c))).size).toBe(3)
    expect(shapeFor(cats, 'unknown')).toBe(SHAPES[0])
  })

  it('has a shape for every infrastructure type, which is the largest category set', () => {
    expect(SHAPES.length).toBeGreaterThanOrEqual(18)
  })

  it('registers each image once, as SDF', () => {
    const added: string[] = []
    const addImage = vi.fn((id: string, _img: unknown, _opts: unknown) => { added.push(id) })
    const map = { hasImage: (id: string) => added.includes(id), addImage }
    addMarkShapes(map as never); addMarkShapes(map as never)
    expect(addImage).toHaveBeenCalledTimes(SHAPES.length)
    expect(addImage.mock.calls[0][2]).toEqual({ sdf: true })
    expect(added[0]).toBe(markImageName(SHAPES[0]))
  })

  it('converts a circle radius into the icon size that draws the same width', () => {
    expect(iconSizeFor(11)).toBe(1.25)
  })
})
