import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch, jsonResponse, quietConsole } from '../test/helpers'
import { buildSnapshot, trendOf, changeLabel, MIN_CORRIDOR } from './displacement'

const pair = (coo: string, coa: string, o: Record<string, number | string> = {}) => ({ coo_iso: coo, coa_iso: coa, coo_name: coo, coa_name: coa, ...o })

describe('trendOf / changeLabel', () => {
  it('classifies year-on-year change against the ±15% threshold', () => {
    expect(trendOf(120, 100)).toBe('rising')
    expect(trendOf(110, 100)).toBe('steady')
    expect(trendOf(80, 100)).toBe('falling')
    expect(trendOf(5, 0)).toBe('new')
    expect(trendOf(0, 0)).toBe('steady')
  })
  it('labels changes with sign, and "new" when there was nothing before', () => {
    expect(changeLabel(150, 100)).toBe('+50%')
    expect(changeLabel(47, 100)).toBe('−53%')
    expect(changeLabel(100, 100)).toBe('±0%')
    expect(changeLabel(10, 0)).toBe('new')
  })
})

describe('buildSnapshot', () => {
  const cur = [
    pair('SDN', 'TCD', { refugees: 1_200_000, asylum_seekers: '100000', oip: '-' }),
    pair('SDN', 'EGY', { refugees: 800_000 }),
    pair('SDN', 'SDN', { idps: 9_000_000 }),
    pair('SYR', 'TUR', { refugees: 2_300_000 }),
    pair('SYR', 'DEU', { refugees: 10_000 }),           // below MIN_CORRIDOR: totals only
    pair('UNK', 'USA', { asylum_seekers: 1_400_000 }),  // unknown origin: can't be placed
    pair('TIB', 'IND', { refugees: 70_000 }),           // no country anchor
    pair('', 'DEU', { refugees: 5 }),                   // malformed row
  ]
  const prev = [
    pair('SDN', 'TCD', { refugees: 1_000_000 }),
    pair('SYR', 'TUR', { refugees: 2_900_000 }),
    pair('SDN', 'SDN', { idps: 8_000_000 }),
  ]
  const snap = buildSnapshot(cur, prev, 2025, 1)

  it('keeps corridors at or above MIN_CORRIDOR, largest first, with real anchor points', () => {
    expect(snap.corridors.map(c => `${c.from}>${c.to}`)).toEqual(['SYR>TUR', 'SDN>TCD', 'SDN>EGY'])
    expect(snap.corridors.every(c => c.count >= MIN_CORRIDOR)).toBe(true)
    const tcd = snap.corridors.find(c => c.to === 'TCD')!
    expect(tcd).toMatchObject({ count: 1_300_000, refugees: 1_200_000, asylumSeekers: 100_000, oip: 0, prev: 1_000_000, trend: 'rising' })
    expect(tcd.fromPoint).toHaveLength(2)
    expect(snap.corridors.find(c => c.to === 'TUR')!.trend).toBe('falling')
    expect(snap.corridors.find(c => c.to === 'EGY')!.trend).toBe('new')
  })

  it('totals each country over every pair (not just mapped corridors) plus IDPs', () => {
    const sdn = snap.countries.find(c => c.iso3 === 'SDN')!
    expect(sdn).toMatchObject({ abroad: 2_100_000, idps: 9_000_000, displaced: 11_100_000, idpsPrev: 8_000_000 })
    expect(snap.countries.find(c => c.iso3 === 'SYR')!.abroad).toBe(2_310_000)
    expect(snap.countries.find(c => c.iso3 === 'DEU')!.hosted).toBe(10_000)
    // hosts count people of unknown origin too
    expect(snap.countries.find(c => c.iso3 === 'USA')!.hosted).toBe(1_400_000)
  })

  it('reports people it cannot place instead of inventing a location', () => {
    expect(snap.unplaced).toBe(1_470_000)
    expect(snap.countries.some(c => c.iso3 === 'UNK' || c.iso3 === 'TIB')).toBe(false)
  })

  it('sorts countries by total displaced and records the compared years', () => {
    expect(snap.countries[0].iso3).toBe('SDN')
    expect([snap.year, snap.prevYear]).toEqual([2025, 2024])
  })
})

describe('fetchDisplacement', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())
  const load = async () => { vi.resetModules(); return import('./displacement') }
  const yearOf = (url: string) => Number(new URL(url).searchParams.get('year'))
  const NOW = Date.UTC(2026, 9, 19)

  it('uses last calendar year and the year before it', async () => {
    const fetchMock = mockFetch(url => jsonResponse({ items: [pair('SDN', 'TCD', { refugees: yearOf(url) === 2025 ? 300_000 : 200_000 })] }))
    const { fetchDisplacement } = await load()
    const snap = await fetchDisplacement(NOW)
    expect(fetchMock.mock.calls.map(c => yearOf(String(c[0])))).toEqual([2025, 2024])
    expect(snap?.year).toBe(2025)
    expect(snap?.corridors[0]).toMatchObject({ count: 300_000, prev: 200_000, trend: 'rising' })
  })

  it('falls back a year when the latest has no rows yet', async () => {
    mockFetch(url => jsonResponse({ items: yearOf(url) === 2025 ? [] : [pair('SYR', 'TUR', { refugees: 100_000 })] }))
    const { fetchDisplacement } = await load()
    expect((await fetchDisplacement(NOW))?.year).toBe(2024)
  })

  it('caches the snapshot for later callers', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ items: [pair('SYR', 'TUR', { refugees: 100_000 })] }))
    const { fetchDisplacement } = await load()
    await fetchDisplacement(NOW)
    await fetchDisplacement(NOW + 1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null — never a stand-in table — on HTTP errors, malformed payloads and network failure', async () => {
    for (const impl of [
      () => jsonResponse({}, { status: 500 }),
      () => jsonResponse({ items: 'nope' }),
      () => jsonResponse({ items: [pair('SDN', 'TCD', { refugees: 10 })] }), // nothing reaches MIN_CORRIDOR
      () => { throw new Error('offline') },
    ]) {
      mockFetch(impl)
      const { fetchDisplacement } = await load()
      expect(await fetchDisplacement(NOW)).toBeNull()
    }
  })
})
