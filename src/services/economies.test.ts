/**
 * Systemic coverage check for "aggregate shown as a country". Instead of one regression row per bug (FCV), every path
 * that turns third-party rows into countries is fed every aggregate code the World Bank publishes, plus OWID's region
 * and former-state codes, and must emit none of them, while still keeping every real economy. tests/policy.test.ts
 * checks that no service keeps its own aggregate list again (three hand-copied lists drifted together once).
 * Live drift against the APIs themselves: `npm run research:coverage`.
 */
import { describe, it, expect, vi } from 'vitest'
import snapshot from '../data/wb-economies.json'
import { WB_ECONOMY_ISO3, WB_AGGREGATE_ISO3, isWbEconomy, isOwidCountry } from './economies'
import { parseWorldBank } from './countryIndicators'
import { parsePowerCsv } from './powerGeneration'
import { mockFetch, jsonResponse, textResponse } from '../test/helpers'

const economies = snapshot.economies as [string, string, string][]
const aggregates = snapshot.aggregates as [string, string][]
const AGG_CODES = [...WB_AGGREGATE_ISO3]
// OWID's own region, income-group and former-state codes as they appear in its grapher CSVs (2026-10-16)
const OWID_NON_COUNTRY: [string, string][] = [
  ['World', 'OWID_WRL'], ['Europe', ''], ['Sub-Saharan Africa (WB)', 'WB_SSA'], ['East Asia and Pacific (WB)', 'WB_EAP'],
  ['North America (WB)', 'WB_NA'], ['Middle East, North Africa, Afghanistan and Pakistan (WB)', 'WB_MENAP'],
  ['USSR', 'OWID_USS'], ['Yugoslavia', 'OWID_YGS'], ['East Germany', 'OWID_GDR'], ['Czechoslovakia', 'OWID_CZS'],
  ['Channel Islands', 'OWID_CIS'],
]

// One World Bank row per economy and per aggregate, as `country/all/indicator/…` returns them
const wbRow = (iso3: string, iso2: string, name: string, value = 1) => ({ country: { id: iso2, value: name }, countryiso3code: iso3, value, date: '2023' })
const allWbRows = [
  ...economies.map(([iso3, iso2, name], i) => wbRow(iso3, iso2, name, i + 1)),
  ...aggregates.map(([iso3, name]) => wbRow(iso3, 'Z9', name, 1e9)),
  wbRow('FCS', 'Z9', 'Fragile and conflict affected situations', 1e9),
  wbRow('', 'XD', 'High income', 1e9),
]

describe('the World Bank snapshot', () => {
  it('splits the API metadata into 217 economies and 79 aggregates, with no code in both', () => {
    expect(economies).toHaveLength(217)
    expect(aggregates).toHaveLength(79)
    expect(economies.filter(([c]) => WB_AGGREGATE_ISO3.has(c))).toEqual([])
    expect(new Set(economies.map(e => e[0])).size).toBe(217)
  })

  it('every economy has an ISO3 and ISO2 code', () => {
    for (const [iso3, iso2] of economies) { expect(iso3).toMatch(/^[A-Z]{3}$/); expect(iso2).toMatch(/^[A-Z0-9]{2}$/) }
  })
})

describe('isWbEconomy / isOwidCountry', () => {
  it.each(AGG_CODES)('rejects aggregate %s', code => {
    expect(isWbEconomy(code)).toBe(false)
    expect(isOwidCountry(code)).toBe(false)
  })

  it('accepts every World Bank economy', () => {
    expect(economies.filter(([c]) => !isWbEconomy(c))).toEqual([])
  })

  it('fails closed on a code it has never seen (a renamed aggregate, as FCS → FCV was)', () => {
    expect(isWbEconomy('QQQ')).toBe(false)
    expect(isWbEconomy('')).toBe(false)
    expect(isWbEconomy(undefined)).toBe(false)
  })

  it.each(OWID_NON_COUNTRY)('rejects OWID entity %s (%s)', (_name, code) => {
    expect(isOwidCountry(code)).toBe(false)
  })

  it('keeps Kosovo, the one current country OWID codes outside ISO3', () => {
    expect(isOwidCountry('OWID_KOS')).toBe(true)
  })
})

describe('every country-producing parser drops every aggregate', () => {
  it('parseWorldBank (Country Analytics, rankings, analyst rank tool)', () => {
    const out = parseWorldBank([{}, allWbRows], 2010)
    expect(out.filter(r => !WB_ECONOMY_ISO3.has(r.iso3))).toEqual([])
    expect(out).toHaveLength(217)
  })

  it('fetchMilitaryPersonnelRanking', async () => {
    vi.resetModules()
    mockFetch(() => jsonResponse([{}, allWbRows]))
    const list = await (await import('./militaryPersonnel')).fetchMilitaryPersonnelRanking()
    expect(list.filter(e => !WB_ECONOMY_ISO3.has(e.iso3))).toEqual([])
    expect(list).toHaveLength(217)
  })

  it('fetchInfraIndicatorRanking', async () => {
    vi.resetModules()
    mockFetch(() => jsonResponse([{}, allWbRows]))
    const list = await (await import('./infraIndicators')).fetchInfraIndicatorRanking()
    expect(list.filter(e => !WB_ECONOMY_ISO3.has(e.iso3))).toEqual([])
    expect(list).toHaveLength(217)
  })

  const owidCsv = (header: string) => [header,
    ...OWID_NON_COUNTRY.map(([n, c]) => `${n.replace(/,/g, '')},${c},2023,1000`),
    ...aggregates.map(([c]) => `Agg ${c},${c},2023,1000`),
    'Chad,TCD,2023,5', 'Kosovo,OWID_KOS,2023,4',
  ].join('\n')

  it('fetchOwidChart (Rankings panel)', async () => {
    vi.resetModules()
    mockFetch(() => textResponse(owidCsv('Entity,Code,Year,value')))
    const owid = await import('./owid')
    const chart = await owid.fetchOwidChart(owid.OWID_CHARTS[0].slug)
    expect(chart!.values.map(v => v.code).sort()).toEqual(['OWID_KOS', 'TCD'])
  })

  it('parsePowerCsv (Ember electricity)', () => {
    const out = parsePowerCsv(owidCsv('Entity,Code,Year,coal_generation__twh'))
    expect(out.map(v => v.code).sort()).toEqual(['OWID_KOS', 'TCD'])
  })
})
