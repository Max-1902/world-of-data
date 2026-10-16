/**
 * Country-name joins, tested as a class. Every matcher that decides "does this label / text belong to country X"
 * runs against the same adversarial table, so a new matcher that falls back to substring tests fails here.
 * Regressions: "UK" bases under Ukraine, Niger's trade profile showing Nigeria's, North Korea's showing South Korea's,
 * Somaliland resolving to Mali, "Congo (Brazzaville)" resolving to the DRC.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveISO2 } from '../services/worldbank'
import { mentionsCountry, sameCountry } from './countryBrief'
import { matchCountry } from '../components/countryDrawer/parts'
import { getTradeProfile } from '../services/tradeStats'
import { computeTrajectories } from './trajectory'
import { placeMentions } from './countryMatch'
import { mockFetch, textResponse, quietConsole } from '../test/helpers'
import type { CrisisEvent, NewsArticle } from '../types'

/** Pairs of distinct countries whose names contain one another, or which are easily confused. */
const DISTINCT: [string, string][] = [
  ['Niger', 'Nigeria'],
  ['Mali', 'Somalia'],
  ['Oman', 'Romania'],
  ['Guinea', 'Guinea-Bissau'],
  ['Guinea', 'Equatorial Guinea'],
  ['Guinea', 'Papua New Guinea'],
  ['Republic of the Congo', 'Democratic Republic of the Congo'],
  ['Congo (Brazzaville)', 'Congo (Kinshasa)'],
  ['Sudan', 'South Sudan'],
  ['Dominica', 'Dominican Republic'],
  ['UK', 'Ukraine'],
  ['Iran', 'Iraq'],
  ['India', 'Indonesia'],
  ['Austria', 'Australia'],
  ['Slovakia', 'Slovenia'],
  ['North Korea', 'South Korea'],
  ['Samoa', 'American Samoa'],
  ['Netherlands', 'Caribbean Netherlands'],
]

/** Different spellings of one country. */
const SAME: [string, string][] = [
  ['Turkey', 'Türkiye'],
  ['Czechia', 'Czech Republic'],
  ['Eswatini', 'Swaziland'],
  ['Myanmar', 'Burma'],
  ['UK', 'United Kingdom'],
  ['Ivory Coast', "Côte d'Ivoire"],
  ['Lao PDR', 'Laos'],
  ['Viet Nam', 'Vietnam'],
  ['Congo, Dem. Rep.', 'DR Congo'],
  ['Korea, Rep.', 'South Korea'],
  ['Macedonia', 'North Macedonia'],
]

/** Places that are not the country inside their name. */
const NOT_THE_COUNTRY: [string, string][] = [
  ['New Mexico', 'Mexico'],
  ['Somaliland', 'Mali'],
  ['Northern Cyprus', 'Cyprus'],
  ['Northern Ireland', 'Ireland'],
  ['Lake Chad', 'Chad'],
  ['Niger Delta', 'Niger'],
]

describe('resolveISO2', () => {
  it.each(DISTINCT)('%s and %s resolve to different codes', (a, b) => {
    expect(resolveISO2(a)).not.toBeNull()
    expect(resolveISO2(b)).not.toBeNull()
    expect(resolveISO2(a)).not.toBe(resolveISO2(b))
  })
  it.each(SAME)('%s and %s resolve to the same code', (a, b) => {
    expect(resolveISO2(a)).not.toBeNull()
    expect(resolveISO2(a)).toBe(resolveISO2(b))
  })
  it.each(NOT_THE_COUNTRY)('%s does not resolve to %s', (place, country) => {
    expect(resolveISO2(place)).not.toBe(resolveISO2(country))
  })
  it('gives up on labels that name two countries or none', () => {
    expect(resolveISO2('Korea')).toBeNull()
    expect(resolveISO2('Georgia, USA')).toBeNull()
    expect(resolveISO2('UK/US')).toBeNull()
    expect(resolveISO2('Kurdistan')).toBeNull()
  })
  it('still finds a country named as whole words inside a longer label', () => {
    expect(resolveISO2('Kyiv, Ukraine')).toBe('UA')
    expect(resolveISO2('Republic of the Congo (Brazzaville)')).toBe('CG')
  })
})

describe('sameCountry / matchCountry', () => {
  it.each(DISTINCT)('%s is not %s', (a, b) => {
    expect(sameCountry(a, b)).toBe(false)
    expect(matchCountry(a, b.toLowerCase())).toBe(false)
  })
  it.each(SAME)('%s is %s', (a, b) => {
    expect(sameCountry(a, b)).toBe(true)
    expect(matchCountry(a, b.toLowerCase())).toBe(true)
  })
  it.each(NOT_THE_COUNTRY)('%s is not %s', (place, country) => {
    expect(sameCountry(place, country)).toBe(false)
  })
})

describe('mentionsCountry (free text)', () => {
  it.each([
    ['Fighting in South Sudan escalates', 'Sudan'],
    ['Equatorial Guinea elections', 'Guinea'],
    ['Papua New Guinea quake', 'Guinea'],
    ['Guinea-Bissau coup attempt', 'Guinea'],
    ['Nigeria raises rates', 'Niger'],
    ['Somalia drought', 'Mali'],
    ['Romania election', 'Oman'],
    ['Ukraine strikes', 'UK'],
    ['New Mexico wildfire', 'Mexico'],
    ['Oil theft in the Niger Delta', 'Niger'],
  ])('%j does not mention %s', (text, country) => {
    expect(mentionsCountry(text, country)).toBe(false)
  })
  it.each([
    ['Sudan and South Sudan sign deal', 'Sudan'],
    ['Guinea junta sets vote date', 'Guinea'],
    ['Niger expels envoy', 'Niger'],
    ['M5.1 - 12 km SW of Muscat, Oman', 'Oman'],
  ])('%j mentions %s', (text, country) => {
    expect(mentionsCountry(text, country)).toBe(true)
  })
  it('KNOWN LIMIT: a US state and a country with the same name cannot be told apart by text', () => {
    // Documented residual risk, not a pass condition to defend: "Atlanta, Georgia" reads as Georgia.
    expect(placeMentions('Atlanta, Georgia storm', 'Georgia')).toHaveLength(1)
  })
})

describe('getTradeProfile', () => {
  it.each(DISTINCT)('never returns the profile of the other country (%s / %s)', (a, b) => {
    const pa = getTradeProfile(a), pb = getTradeProfile(b)
    if (pa && pb) expect(pa.iso2).not.toBe(pb.iso2)
    if (pa) expect(pa.iso2).toBe(resolveISO2(a))
    if (pb) expect(pb.iso2).toBe(resolveISO2(b))
  })
  it('has no profile for an ambiguous name', () => {
    expect(getTradeProfile('Korea')).toBeNull()
  })
})

describe('trajectory news hit', () => {
  const now = Date.parse('2026-10-15T12:00:00Z')
  const event = (country: string): CrisisEvent => ({
    id: `e-${country}`, title: 't', type: 'conflict', severity: 'high', latitude: 0, longitude: 0, country,
    date: new Date(now - 3_600_000).toISOString(), description: '', source: 'ACLED',
  })
  const article = (title: string): NewsArticle => ({
    id: title, title, description: '', url: 'https://example.org', source: 'x', publishedAt: new Date(now - 3_600_000).toISOString(),
  } as NewsArticle)

  it.each([
    ['Oman', 'Romania votes in snap election'],
    ['Niger', 'Nigeria fuel subsidy protests'],
    ['Sudan', 'South Sudan peace talks resume'],
    ['Mali', 'Somalia drought deepens'],
  ])('a story about another country is not a news hit for %s', (country, headline) => {
    const [entry] = computeTrajectories([event(country)], [], 6, [article(headline)], null, now)
    expect(entry.newsHit).toBeUndefined()
  })
  it('a story naming the country is a hit', () => {
    const [entry] = computeTrajectories([event('Niger')], [], 6, [article('Niger junta expels envoy')], null, now)
    expect(entry.newsHit).toBeDefined()
  })
})

describe('power plants by country (WRI GPPD)', () => {
  beforeEach(() => { vi.resetModules(); quietConsole() })
  const csv = (...rows: string[]) => ['country,country_long,name,capacity_mw,latitude,longitude,primary_fuel', ...rows].join('\n')

  it.each([
    ['Niger', 'Nigeria'],
    ['Sudan', 'South Sudan'],
    ['Guinea', 'Guinea-Bissau'],
    ['Oman', 'Romania'],
  ])('%s does not pull in %s plants', async (country, other) => {
    mockFetch(() => textResponse(csv(`AAA,${country},Own,10,1,1,Gas`, `BBB,${other},Other,5000,2,2,Gas`)))
    const { fetchPowerPlantsForCountry } = await import('../services/infrastructure')
    expect((await fetchPowerPlantsForCountry(country)).map(p => p.name)).toEqual(['Own'])
  })
})

describe('contested territory', () => {
  it('files disputed South China Sea features under no claimant (regression: an alias sent them to China)', () => {
    expect(resolveISO2('S.China Sea')).toBeNull()
    expect(resolveISO2('Spratly Islands')).toBeNull()
    expect(sameCountry('S.China Sea', 'China')).toBe(false)
    expect(matchCountry('S.China Sea', 'china')).toBe(false)
    expect(matchCountry('S.China Sea', 'philippines')).toBe(false)
  })
  it('files Crimea and Abkhazia sites under the de jure sovereign, as the datasets do', () => {
    expect(matchCountry('Ukraine', 'ukraine')).toBe(true)
    expect(matchCountry('Georgia', 'georgia')).toBe(true)
  })
})
