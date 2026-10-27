import { describe, it, expect } from 'vitest'
import { traceExposure, partnerNames, gdpByIso2, summarizeExposure, fmtRange, mapRows, type Gdp } from './exposure'
import { TRADE_PROFILES, type TradeProfile } from '../services/tradeStats'
import { CHOKEPOINTS, EIA_CHOKEPOINTS_SOURCE, type Chokepoint } from '../services/chokepoints'

const EIA = { worldMaritimeOilMbd: 80, name: 'EIA', year: 2024 }
const partners = (pairs: [string, number][]) => pairs.map(([country, pct]) => ({ country, pct }))
const products = (pairs: [string, number][]) => pairs.map(([hs, pct]) => ({ hs, pct, product: `HS ${hs}` }))

function profile(iso2: string, name: string, over: Partial<TradeProfile> = {}): TradeProfile {
  return {
    iso2, name, year: 2025, exportsUsdBn: 100, importsUsdBn: 100,
    topExportPartners: partners([['A', 30], ['B', 20], ['C', 10], ['D', 8], ['E', 6], ['F', 5]]),
    topImportPartners: partners([['A', 25], ['B', 15], ['C', 12], ['D', 9], ['E', 7], ['F', 4]]),
    topExports: products([['84', 20], ['85', 15], ['87', 10], ['30', 8], ['90', 7], ['39', 6], ['72', 5], ['29', 4]]),
    topImports: products([['27', 20], ['84', 15], ['85', 10], ['87', 8], ['30', 6], ['39', 5]]),
    tradeBalance: 0, tradeBlocs: [], currency: '', incomeGroup: 'high', ...over,
  }
}
const gdp = (pairs: [string, number][]) => new Map<string, Gdp>(pairs.map(([k, bn]) => [k, { usd: bn * 1e9, year: '2025' }]))

describe('demand shock', () => {
  const X = profile('XX', 'Xland', { exportsUsdBn: 200 })   // 30% of exports to A, exports = 20% of GDP
  const Y = profile('YY', 'Yland', { topExportPartners: partners([['B', 30], ['C', 20], ['D', 10], ['E', 8], ['F', 6], ['G', 5]]) })
  const res = traceExposure({ kind: 'demand', partner: 'A' }, [X, Y], gdp([['XX', 1000], ['YY', 500]]), EIA)

  it('multiplies the partner share by exports as a share of GDP, most exposed first', () => {
    expect(res.rows[0].name).toBe('Xland')
    expect(res.rows[0].lo).toBeCloseTo(6)   // 30% × (200 / 1000)
    expect(res.rows[0].bounded).toBe(false)
  })
  it('bounds a partner outside the top 6 by the smallest listed share instead of inventing one', () => {
    const y = res.rows.find(r => r.name === 'Yland')!
    expect(y.bounded).toBe(true)
    expect(y.lo).toBe(0)
    expect(y.hi).toBeCloseTo(1)   // < 5% × (100 / 500)
    expect(y.path[0].text).toContain('not among Yland\'s top 6')
  })
  it('labels every step, with sources and years on the observed ones', () => {
    expect(res.shared.every(s => s.kind === 'assumption')).toBe(true)
    for (const r of res.rows) {
      expect(r.path.every(s => ['observed', 'statistical', 'assumption'].includes(s.kind))).toBe(true)
      expect(r.path.filter(s => s.source).every(s => s.year)).toBe(true)
    }
  })
  it('adds an assumption step and effect only when a shock size is given', () => {
    expect(res.rows[0].effect).toBeUndefined()
    const sized = traceExposure({ kind: 'demand', partner: 'A', sizePct: 10 }, [X], gdp([['XX', 1000]]), EIA)
    expect(sized.rows[0].effect!.lo).toBeCloseTo(-0.6)
    expect(sized.shared.filter(s => s.kind === 'assumption')).toHaveLength(2)
    expect(sized.rows[0].path[sized.rows[0].path.length - 1].kind).toBe('assumption')
  })
  it('skips the partner itself and reporters without GDP, saying why', () => {
    const r = traceExposure({ kind: 'demand', partner: 'Xland' }, [X, Y], gdp([['XX', 1000]]), EIA)
    expect(r.rows).toHaveLength(0)
    expect(r.skipped).toEqual([{ name: 'Yland', reason: 'no World Bank GDP figure' }])
  })
  it('flags GDP and trade figures from different years', () => {
    const r = traceExposure({ kind: 'demand', partner: 'A' }, [X], new Map([['XX', { usd: 1e12, year: '2021' }]]), EIA)
    expect(r.rows[0].path.some(s => s.text.includes('mixes years'))).toBe(true)
  })
})

describe('supply shock', () => {
  it('reads import shares and imports', () => {
    const r = traceExposure({ kind: 'supply', partner: 'A' }, [profile('XX', 'Xland', { importsUsdBn: 300 })], gdp([['XX', 1000]]), EIA)
    expect(r.rows[0].lo).toBeCloseTo(7.5)   // 25% × 30%
    expect(r.rows[0].path[0].text).toContain('supplies 25%')
  })
})

describe('oil chokepoint shock', () => {
  const hormuz = { id: 'h', name: 'Strait of Hormuz', oilFlowMbd: 20 } as Chokepoint
  const importer = profile('IM', 'Importia', { importsUsdBn: 500 })   // fuels 20% of imports, none in exports
  const exporter = profile('EX', 'Exportia', { exportsUsdBn: 400, topExports: products([['27', 60], ['84', 10], ['85', 8], ['87', 5], ['30', 4], ['39', 3], ['72', 2], ['29', 1]]), topImports: products([['84', 20], ['85', 15], ['87', 10], ['30', 8], ['39', 6], ['90', 5]]) })
  const res = traceExposure({ kind: 'oil', chokepoint: hormuz, pricePct: 20 }, [importer, exporter], gdp([['IM', 1000], ['EX', 800]]), EIA)

  it('states the observed flow, then the price-channel assumption, then the assumed price move', () => {
    expect(res.shared.map(s => s.kind)).toEqual(['observed', 'assumption', 'assumption'])
    expect(res.shared[0].text).toContain('25% of world maritime oil trade')
    expect(res.shared[1].text).toContain('same for any oil chokepoint')
  })
  it('signs net fuel importers as losers and exporters as gainers, with a first-order effect', () => {
    const exp = res.rows.find(r => r.name === 'Exportia')!
    const imp = res.rows.find(r => r.name === 'Importia')!
    expect(exp.direction).toBe('gain')
    expect(imp.direction).toBe('loss')
    expect(exp.effect!.lo).toBeGreaterThan(0)
    expect(imp.effect!.hi).toBeLessThan(0)
    expect(imp.bounded).toBe(true)   // no fuels among its top-8 exports: bounded below 4%
  })
  it('ranks by size of exposure whichever the direction', () => {
    expect(res.rows[0].name).toBe('Exportia')   // ~30% of GDP net exports vs ~10% net imports
  })
})

describe('on the real data', () => {
  const iso3ToIso2 = new Map([['USA', 'US'], ['CHN', 'CN'], ['DEU', 'DE']])
  const g = gdpByIso2([{ iso3: 'USA', value: 29e12, year: '2024' }, { iso3: 'CHN', value: 18e12, year: '2024' }, { iso3: 'DEU', value: 4.6e12, year: '2024' }, { iso3: 'XXX', value: 1, year: '2024' }], iso3ToIso2)
  it('maps GDP onto ISO2 and drops codes it cannot map', () => {
    expect([...g.keys()].sort()).toEqual(['CN', 'DE', 'US'])
  })
  it('lists partner names from the Comtrade lists, and traces a demand shock with a readable summary', () => {
    expect(partnerNames(TRADE_PROFILES)).toContain('China')
    const r = traceExposure({ kind: 'demand', partner: 'China' }, TRADE_PROFILES, g, EIA_CHOKEPOINTS_SOURCE)
    expect(r.rows.map(x => x.iso2).sort()).toEqual(['DE', 'US'])
    expect(r.skipped.length).toBe(TRADE_PROFILES.length - 3)
    expect(summarizeExposure(r)).toContain('Most exposed:')
  })
  it('offers an oil shock only through chokepoints with an EIA flow', () => {
    expect(CHOKEPOINTS.some(c => c.oilFlowMbd != null)).toBe(true)
  })
})

it('maps exact rows only, signed for oil, keyed by ISO3', () => {
  const hz = { id: 'h', name: 'Hormuz', oilFlowMbd: 20 } as Chokepoint
  const ex = profile('EX', 'Exportia', { exportsUsdBn: 400, topExports: products([['27', 60], ['84', 10], ['85', 8], ['87', 5], ['30', 4], ['39', 3], ['72', 2], ['29', 1]]) })
  const im = profile('IM', 'Importia')
  const res = traceExposure({ kind: 'oil', chokepoint: hz }, [ex, im], gdp([['EX', 800], ['IM', 1000]]), EIA)
  const rows = mapRows(res, new Map([['EX', 'EXX'], ['IM', 'IMM']]), () => '2025')
  expect(rows.map(r => r.iso3)).toEqual(['EXX'])   // Importia has no fuels in its top-8 exports: bounded, not drawn
  expect(rows[0].value).toBeCloseTo(30 - 2.5)       // 60% × 400/800 minus 20% × 100/800
})

it('formats a degenerate range as one value', () => {
  expect(fmtRange(1.23, 1.23)).toBe('1.2%')
  expect(fmtRange(0, 2.5)).toBe('0–2.5%')
  expect(fmtRange(-12.4, -3)).toBe('−12 to −3%')
})
