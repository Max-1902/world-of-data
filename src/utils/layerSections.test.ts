import { describe, it, expect } from 'vitest'
import { LAYER_SECTIONS, sortByLayerSections, ALL_LAYERS_PLACED } from './layerSections'

describe('layer sections', () => {
  it('places every layer exactly once', () => {
    const keys: string[] = LAYER_SECTIONS.flatMap(s => [...s.keys])
    expect(new Set(keys).size).toBe(keys.length)
    expect(ALL_LAYERS_PLACED).toBe(true)
  })
  it('keeps trade, resources and country colouring under economy', () => {
    const sec = (k: string) => LAYER_SECTIONS.find(s => (s.keys as readonly string[]).includes(k))!.title
    expect(sec('countryAnalytics')).toBe('ECONOMY')
    expect(sec('tradeStats')).toBe('ECONOMY')
    expect(sec('resources')).toBe('ECONOMY')
  })
  it('sorts into section order, unknown keys last', () => {
    expect(sortByLayerSections(['stocks', 'zzz', 'flights', 'military'], k => k)).toEqual(['flights', 'military', 'stocks', 'zzz'])
  })
})
