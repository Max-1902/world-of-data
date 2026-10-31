import { describe, it, expect } from 'vitest'
import { buildWorldOutlook, direction, worldSentences } from './worldOutlook'
import type { WeoPayload } from '../services/imfWeo'

const years = (from: number, to: number, f: (y: number) => number) =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [String(from + i), f(from + i)]))

const gdp = (groups: WeoPayload['groups'], vintage = 'World Economic Outlook (October 2026)'): WeoPayload =>
  ({ indicator: 'NGDP_RPCH', label: 'Real GDP growth', unit: '%', vintage, lastModified: '2026-10-08 14:43:32', values: {}, groups })

const WORLD = { ...years(2000, 2019, () => 3.7), '2025': 3.5, '2026': 3.1, '2027': 3.4, '2028': 3.3, '2031': 3.1, '2035': 9 }
const GROUPS = { WEOWORLD: WORLD, ADVEC: { '2026': 2.1, '2027': 1.8 }, OEMDC: { '2026': 3.7, '2027': 4.4 }, EURO: { '2026': 1.1 } }
const CPI = { ...gdp({ WEOWORLD: { '2026': 4.7, '2027': 4.1 } }), indicator: 'PCPIPCH' as const }

describe('direction', () => {
  it('calls a change under 0.2 points about the same, in either direction', () => {
    expect(direction(3.1, 3.4)).toBe('up')
    expect(direction(3.5, 3.1)).toBe('down')
    expect(direction(3.3, 3.4)).toBe('steady')
    expect(direction(3.4, 3.3)).toBe('steady')
  })
})

describe('buildWorldOutlook', () => {
  it('reads the IMF world figure around the edition year, the 2000–2019 average and the groups', () => {
    const w = buildWorldOutlook(gdp(GROUPS), CPI)!
    expect(w.years).toEqual({ prev: 2025, now: 2026, next: 2027, end: 2031 })   // capped five years past the edition
    expect(w.growth).toEqual({ prev: 3.5, now: 3.1, next: 3.4, end: 3.1 })
    expect(w.baseline).toBeCloseTo(3.7)
    expect(w.inflation).toEqual({ now: 4.7, next: 4.1 })
    expect(w.groups.find(g => g.code === 'EURO')).toEqual({ code: 'EURO', label: 'Euro area', now: 1.1, next: null })
    expect(w.groups.find(g => g.code === 'DA')).toMatchObject({ now: null, next: null })
  })
  it('is null without a stated edition or a world figure for its year, and copes with no groups at all', () => {
    expect(buildWorldOutlook(gdp(GROUPS, 'World Economic Outlook'), null)).toBeNull()
    expect(buildWorldOutlook(gdp({ WEOWORLD: { '2025': 3 } }), null)).toBeNull()
    expect(buildWorldOutlook(gdp(undefined), null)).toBeNull()
  })
  it('states no average when the series does not cover 2000–2019, and no inflation when it was not loaded', () => {
    const w = buildWorldOutlook(gdp({ WEOWORLD: { '2026': 3.1, '2027': 3.4 } }), null)!
    expect(w.baseline).toBeNull()
    expect(w.inflation).toBeNull()
    expect(w.growth.end).toBeNull()
  })
})

describe('worldSentences', () => {
  it('says where world growth is heading in the IMF figures, against the past average, with inflation and the split', () => {
    const s = worldSentences(buildWorldOutlook(gdp(GROUPS), CPI)!).join(' ')
    expect(s).toContain('The IMF projects world real GDP growth of 3.1% in 2026, down from an estimated 3.5% in 2025, then 3.4% in 2027 (a pick-up).')
    expect(s).toContain('2027 is below the world’s 2000–2019 average of 3.7%, and the IMF’s figure for 2031 is 3.1%.')
    expect(s).toContain('World consumer-price inflation: 4.7% in 2026, 4.1% in 2027 (easing).')
    expect(s).toContain('Growth in 2027: 4.4% in emerging and developing economies, 1.8% in advanced economies.')
  })
  it('leaves out what the IMF did not publish instead of guessing it', () => {
    const s = worldSentences(buildWorldOutlook(gdp({ WEOWORLD: { '2026': 3.1 } }), null)!).join(' ')
    expect(s).toBe('The IMF projects world real GDP growth of 3.1% in 2026.')
  })
})
