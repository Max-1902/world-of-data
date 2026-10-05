import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch, jsonResponse, installLocalStorage } from '../test/helpers'

async function load() { vi.resetModules(); return import('./geocode') }
const kharkiv = { name: 'Kharkiv', latitude: 49.98, longitude: 36.25, feature_code: 'PPLA', country: 'Ukraine', population: 1_400_000 }

describe('pickPlace', () => {
  it('accepts an exact-name city and rejects look-alikes', async () => {
    const { pickPlace } = await load()
    expect(pickPlace('Kharkiv', [kharkiv])).toMatchObject({ lat: 49.98, lng: 36.25, precision: 'city', country: 'Ukraine' })
    expect(pickPlace('Kharkiv', [{ ...kharkiv, name: 'Kharkivka' }])).toBeNull()
    expect(pickPlace('Trump', [{ name: 'Trump', latitude: 1, longitude: 1, feature_code: 'PPL', population: 300 }])).toBeNull()
    expect(pickPlace('Kharkiv', [{ ...kharkiv, feature_code: 'MT' }])).toBeNull()
  })
  it('matches case/diacritics and classifies countries and regions', async () => {
    const { pickPlace } = await load()
    expect(pickPlace('sao paulo', [{ name: 'São Paulo', latitude: -23, longitude: -46, feature_code: 'PPLA', population: 1e7 }])).not.toBeNull()
    expect(pickPlace('Ukraine', [{ name: 'Ukraine', latitude: 49, longitude: 32, feature_code: 'PCLI' }])?.precision).toBe('country')
    expect(pickPlace('Crimea', [{ name: 'Crimea', latitude: 45, longitude: 34, feature_code: 'ADM1' }])?.precision).toBe('region')
  })
  it('ignores results without coordinates', async () => {
    const { pickPlace } = await load()
    expect(pickPlace('X', [{ name: 'X', feature_code: 'PCLI' }])).toBeNull()
  })
})

describe('geocodePlace', () => {
  beforeEach(() => { installLocalStorage() })
  afterEach(() => vi.useRealTimers())

  it('looks a place up once and serves repeats from cache', async () => {
    const f = mockFetch(() => jsonResponse({ results: [kharkiv] }))
    const { geocodePlace } = await load()
    expect((await geocodePlace('Kharkiv'))?.precision).toBe('city')
    expect(await geocodePlace('kharkiv')).not.toBeNull()
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('caches "not a place" but not failures', async () => {
    const f = mockFetch(() => jsonResponse({ results: [] }))
    const { geocodePlace } = await load()
    expect(await geocodePlace('Nowhereville')).toBeNull()
    await geocodePlace('Nowhereville')
    expect(f).toHaveBeenCalledTimes(1)

    const g = mockFetch(() => jsonResponse({}, { status: 429 }))
    const mod = await load()
    expect(await mod.geocodePlace('Kyiv')).toBeNull()
    await mod.geocodePlace('Kyiv')
    expect(g).toHaveBeenCalledTimes(2)
  })
  it('returns null on network failure and malformed payloads', async () => {
    mockFetch(() => { throw new Error('offline') })
    const { geocodePlace } = await load()
    expect(await geocodePlace('Kyiv')).toBeNull()
    mockFetch(() => jsonResponse({ results: 'nope' }))
    const m = await load()
    expect(await m.geocodePlace('Odesa')).toBeNull()
  })
})
