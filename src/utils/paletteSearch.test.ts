import { describe, it, expect } from 'vitest'
import { rankItems, type PaletteItem } from './paletteSearch'

const items: PaletteItem[] = [
  { id: 'a', kind: 'panel', label: 'Risk Matrix', hint: 'Country-level threat assessment' },
  { id: 'b', kind: 'layer', label: 'VESSELS', hint: 'AIS ship tracking' },
  { id: 'c', kind: 'chokepoint', label: 'Strait of Hormuz', keywords: 'oil shipping' },
  { id: 'd', kind: 'panel', label: 'Threat Level', hint: 'Composite global threat index' },
]

describe('rankItems', () => {
  it('returns items in order for an empty query, capped by limit', () => {
    expect(rankItems(items, '  ').map(i => i.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(rankItems(items, '', 2)).toHaveLength(2)
  })

  it('ranks label-prefix above label-substring above hint-only', () => {
    expect(rankItems(items, 'threat').map(i => i.id)).toEqual(['d', 'a'])
  })

  it('requires every token to match somewhere', () => {
    expect(rankItems(items, 'strait oil').map(i => i.id)).toEqual(['c'])
    expect(rankItems(items, 'strait banana')).toEqual([])
  })

  it('is case-insensitive and matches keywords', () => {
    expect(rankItems(items, 'SHIPPING').map(i => i.id)).toEqual(['c'])
  })
})
