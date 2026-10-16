import { describe, it, expect } from 'vitest'
import { buildSearchCatalogue, PANEL_ALIASES } from './searchCatalogue'
import { PANEL_MAP } from '../panels/registry'
import { scoreItems } from '../utils/paletteSearch'

describe('search catalogue', () => {
  const { catalogue, groupOfPanel } = buildSearchCatalogue()

  it('lists every registry panel with its workspace, and ids are unique', () => {
    for (const id of PANEL_MAP.keys()) {
      expect(catalogue.some(c => c.id === `panel:${id}`)).toBe(true)
      expect(groupOfPanel.get(id)).toBe(PANEL_MAP.get(id)!.group)
    }
    expect(new Set(catalogue.map(c => c.id)).size).toBe(catalogue.length)
  })

  it('aliases only refer to panels that exist', () => {
    for (const id of Object.keys(PANEL_ALIASES)) expect(PANEL_MAP.has(id), id).toBe(true)
  })

  it.each([
    ['ai analyst', 'panel:analyst'],
    ['ai', 'panel:analyst'],
    ['analyst', 'panel:analyst'],
    ['prediction', 'panel:predictions'],
    ['prection', 'panel:predictions'],
    ['forecast', 'panel:predictions'],
    ['watchlist', 'panel:watchlist'],
  ])('“%s” puts %s first as a strong match', (q, id) => {
    const [top] = scoreItems(catalogue, q)
    expect(top.item.id).toBe(id)
    expect(top.strong).toBe(true)
  })

  it.each(['paris', 'berlin', 'tokyo', 'nairobi'])('a place name (“%s”) is not a strong panel match', q => {
    expect(scoreItems(catalogue, q)[0]?.strong ?? false).toBe(false)
  })
})
