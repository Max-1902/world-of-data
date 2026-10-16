import { describe, it, expect } from 'vitest'
import { editDistance, rankItems, scoreItems, type PaletteItem } from './paletteSearch'

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

describe('typo tolerance', () => {
  const panels: PaletteItem[] = [
    { id: 'pred', kind: 'panel', label: 'Predictions', keywords: 'forecast' },
    { id: 'ai', kind: 'panel', label: 'Analyst chat', keywords: 'ai assistant' },
    { id: 'air', kind: 'layer', label: 'AIRSPACE' },
  ]

  it('editDistance counts edits and transpositions, capped at max+1', () => {
    expect(editDistance('prection', 'prediction')).toBe(2)
    expect(editDistance('analsyt', 'analyst')).toBe(1)
    expect(editDistance('paris', 'predictions')).toBe(3)
  })

  it('finds a panel from a misspelt title, as a strong (label) match', () => {
    const [top] = scoreItems(panels, 'prection')
    expect(top.item.id).toBe('pred')
    expect(top.strong).toBe(true)
    expect(rankItems(panels, 'analsyt').map(i => i.id)).toEqual(['ai'])
    expect(rankItems(panels, 'forcast').map(i => i.id)).toEqual(['pred'])
  })

  it('matches an alias as a whole word and does not fuzz very short tokens', () => {
    expect(rankItems(panels, 'ai').map(i => i.id)).toEqual(['ai', 'air'])
    expect(rankItems(panels, 'xi')).toEqual([])
  })

  it('a hint-only hit is not strong (so a place name is not mistaken for a panel)', () => {
    const [top] = scoreItems([{ id: 's', kind: 'panel', label: 'Sanctions', hint: 'Iran, Russia, North Korea' }], 'iran')
    expect(top.strong).toBe(false)
  })
})
