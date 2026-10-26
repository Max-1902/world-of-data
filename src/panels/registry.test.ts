import { describe, it, expect } from 'vitest'
import { LAYER_IDS } from '../components/layerCatalogue'
import { GROUP_ORDER, GROUP_SECTIONS, PANEL_MAP, SIDEBAR_SECTIONS, panelsForGroup } from './registry'

describe('panel registry structure', () => {
  it('puts every panel under a section that exists in its own workspace', () => {
    for (const p of PANEL_MAP.values()) {
      expect(GROUP_SECTIONS[p.group].map(s => s.id), `${p.id} → ${p.section}`).toContain(p.section)
    }
  })

  it('has no empty sections and no duplicate section ids within a workspace', () => {
    for (const { id: group } of GROUP_ORDER) {
      const ids = GROUP_SECTIONS[group].map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const sid of ids) expect(panelsForGroup(group).some(p => p.section === sid), `${group}/${sid}`).toBe(true)
    }
  })

  it('returns panels grouped by section, in section order', () => {
    for (const { id: group } of GROUP_ORDER) {
      const order = GROUP_SECTIONS[group].map(s => s.id)
      const ranks = panelsForGroup(group).map(p => order.indexOf(p.section))
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    }
  })

  it('lists every workspace exactly once in the sidebar, in GROUP_ORDER order', () => {
    expect(SIDEBAR_SECTIONS.flatMap(s => s.groups)).toEqual(GROUP_ORDER.map(g => g.id))
  })

  it('opens each workspace with its most immediate view', () => {
    expect(panelsForGroup('overview')[0].id).toBe('threat')
    expect(panelsForGroup('analysis')[0].id).toBe('predictions')
    expect(panelsForGroup('markets')[0].id).toBe('markets')
  })

  it('points every panel\'s "Show on map" at real, toggleable map layers', () => {
    const known = new Set(LAYER_IDS.map(l => l.id))
    for (const p of PANEL_MAP.values()) {
      if (!Array.isArray(p.map)) continue
      expect(p.map.length, p.id).toBeGreaterThan(0)
      for (const id of p.map) expect(known.has(id), `${p.id} → ${id}`).toBe(true)
    }
  })
})

describe('layersForGroup', () => {
  it("collects each workspace's panel layers once, and nothing for workspaces whose panels draw no listed layer", async () => {
    const { layersForGroup } = await import('./registry')
    const markets = layersForGroup('markets')
    expect(markets).toContain('stocks')
    expect(markets).toContain('tradeStats')
    expect(new Set(markets).size).toBe(markets.length)
    expect(layersForGroup('country')).toEqual([])
  })
})
