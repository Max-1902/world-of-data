import { describe, it, expect } from 'vitest'
import { LAYER_SECTIONS, MAP_ONLY, sortByLayerSections, ALL_LAYERS_PLACED } from './layerSections'

describe('layer sections', () => {
  it('places every layer exactly once', () => {
    const keys: string[] = LAYER_SECTIONS.flatMap(s => [...s.keys])
    expect(new Set(keys).size).toBe(keys.length)
    expect(ALL_LAYERS_PLACED).toBe(true)
  })
  it('leads with the economic themes, and keeps map-only layers inside their theme', () => {
    const sec = (k: string) => LAYER_SECTIONS.find(s => (s.keys as readonly string[]).includes(k))!.title
    expect(LAYER_SECTIONS[0].title).toBe('COUNTRY DATA')
    expect(sec('tradeStats')).toBe('MARKETS & TRADE')
    expect(sec('chokepoints')).toBe('MARKETS & TRADE')
    expect(sec('resources')).toBe('ENERGY & RESOURCES')
    expect(sec('pipelines')).toBe('ENERGY & RESOURCES')
    for (const k of MAP_ONLY) expect(sec(k)).toBeTruthy()
  })
  it('sorts into section order, unknown keys last', () => {
    expect(sortByLayerSections(['flights', 'zzz', 'military', 'stocks'], k => k)).toEqual(['stocks', 'military', 'flights', 'zzz'])
  })
})
