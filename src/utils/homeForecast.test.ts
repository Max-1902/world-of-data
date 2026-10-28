import { describe, it, expect } from 'vitest'
import { FLAGSHIP_SERIES, G20_ISO3, buildHomeForecast, g20Projections } from './homeForecast'
import { headlineForecast } from './forecastPolicy'
import type { Pt } from './econAnalysis'
import type { WeoPayload } from '../services/imfWeo'

const series = (n: number, x0 = 1995): Pt[] => Array.from({ length: n }, (_, i) => ({ x: x0 + i, y: 1.5 + Math.sin(i * 1.7) }))
const weo = (values: WeoPayload['values']): WeoPayload => ({
  indicator: 'NGDP_RPCH', label: 'Real GDP growth', unit: '%', vintage: 'World Economic Outlook (October 2026)', lastModified: '2026-10-08', values,
})

describe('buildHomeForecast', () => {
  it('reports too little history rather than forecasting from it', () => {
    expect(buildHomeForecast(series(10), null, 'DEU')).toEqual({ kind: 'short', n: 10 })
  })

  it('uses the same headline forecast as the Predictions panel', () => {
    const s = series(30)
    const r = buildHomeForecast(s, null, 'DEU')
    if (r.kind !== 'ok') throw new Error('expected a forecast')
    const direct = headlineForecast(FLAGSHIP_SERIES, s, 3)!
    expect(r.forecast.points).toEqual(direct.forecast.points)
    expect(r.headline).toBe(direct.headline)
    expect(r.last).toEqual(s[s.length - 1])
  })

  it('carries only the IMF figures for the forecast years, and mentions the IMF in the basis only when it has one', () => {
    const s = series(30)
    const without = buildHomeForecast(s, weo({}), 'DEU')
    if (without.kind !== 'ok') throw new Error('expected a forecast')
    expect(without.imf).toEqual([])
    expect(without.basis.some(b => /IMF/.test(b.text))).toBe(false)

    const y = without.forecast.points[0].year
    const withImf = buildHomeForecast(s, weo({ DEU: { [String(s[s.length - 1].x)]: 9, [String(y)]: 1.4 } }), 'DEU')
    if (withImf.kind !== 'ok') throw new Error('expected a forecast')
    expect(withImf.imf).toEqual([{ year: y, value: 1.4, projection: y >= 2026 }])
    expect(withImf.imfVintage).toContain('October 2026')
    expect(withImf.basis.some(b => b.kind === 'statistical' && /IMF/.test(b.text))).toBe(true)
  })

  it('labels every basis line observed or statistical, never as a cause', () => {
    const r = buildHomeForecast(series(30), null, 'DEU')
    if (r.kind !== 'ok') throw new Error('expected a forecast')
    expect(r.basis[0].kind).toBe('observed')
    expect(r.basis.slice(1).every(b => b.kind === 'statistical')).toBe(true)
    expect(r.basis.some(b => /because|caused|driven by/i.test(b.text))).toBe(false)
  })
})

describe('g20Projections', () => {
  it("ranks the IMF's figures for the edition's year and the next, with economies it has no figure for last", () => {
    const g = g20Projections(weo({ DEU: { '2026': 1, '2027': 1.5 }, IND: { '2026': 6, '2027': 6.5 }, USA: { '2026': 2 } }))!
    expect(g.years).toEqual([2026, 2027])
    expect(g.rows).toHaveLength(G20_ISO3.length)
    expect(g.rows.slice(0, 3).map(r => r.iso3)).toEqual(['IND', 'DEU', expect.any(String)])
    expect(g.rows.find(r => r.iso3 === 'USA')).toEqual({ iso3: 'USA', thisYear: 2, nextYear: null })
    expect(g.rows[g.rows.length - 1].nextYear).toBeNull()
  })
  it('returns null when the edition states no year', () => {
    expect(g20Projections({ ...weo({}), vintage: 'World Economic Outlook' })).toBeNull()
  })
})
