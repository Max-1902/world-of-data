import { describe, it, expect } from 'vitest'
import { DRIVER_PANELS, FORECAST_PANELS, panelsInView, viewOf, viewTitle } from './destinations'
import { PANEL_MAP, panelsForGroup } from './registry'

const ids = (group: Parameters<typeof panelsForGroup>[0], view: Parameters<typeof panelsInView>[1]) => panelsInView(group, view, panelsForGroup(group)).map(p => p.id)

describe('dock destinations', () => {
  it('Forecasts shows the GDP forecast and nowcast only', () => {
    expect(ids('analysis', 'forecasts').sort()).toEqual(['nowcast', 'predictions'])
  })
  it('Drivers shows the tested predictors and the trade links only, none of the wider Economy set', () => {
    expect(ids('markets', 'drivers').sort()).toEqual(['drivers', 'exposure', 'tradePartnersByCountry', 'tradeProductsByCountry'])
    expect(ids('markets', 'explore')).toContain('markets')
    expect(ids('markets', 'explore')).not.toContain('drivers')
  })
  it('everything else in those workspaces is reachable under Explore, so no panel is orphaned', () => {
    for (const group of ['analysis', 'markets'] as const) {
      const all = panelsForGroup(group).map(p => p.id)
      const shown = [...new Set((['forecasts', 'drivers', 'explore'] as const).flatMap(v => ids(group, v)))]
      expect(shown.sort()).toEqual(all.sort())
    }
  })
  it('the destination sets name real panels in the right workspace', () => {
    for (const id of FORECAST_PANELS) expect(PANEL_MAP.get(id)?.group).toBe('analysis')
    for (const id of DRIVER_PANELS) expect(PANEL_MAP.get(id)?.group).toBe('markets')
  })
  it('single-destination workspaces are not filtered', () => {
    expect(viewOf('security', 'anything')).toBeNull()
    expect(ids('security', 'explore')).toEqual(panelsForGroup('security').map(p => p.id))
    expect(viewTitle('security', null, 'SECURITY & DEFENSE')).toBe('SECURITY & DEFENSE')
  })
})
