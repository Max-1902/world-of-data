import { describe, it, expect, vi } from 'vitest'
import { createCountryAnalytics, selectForMap, sliceOf } from './countryAnalytics'
import { PRESETS, type CountryValue } from './countryIndicators'

const rows = (n: number): CountryValue[] => Array.from({ length: n }, (_, i) => ({ iso3: `C${i}`, name: `C${i}`, value: i, year: '2022' }))

describe('countryAnalytics store', () => {
  it('starts on the first preset with the value map mode', () => {
    const s = createCountryAnalytics(async () => []).getState()
    expect(s.selection).toEqual({ x: PRESETS[0].x, y: PRESETS[0].y })
    expect(s.mapMode).toBe('value')
  })

  it('loads an indicator once, moving through loading to ready', async () => {
    const fetcher = vi.fn(async () => rows(3))
    const store = createCountryAnalytics(fetcher)
    const seen: string[] = []
    store.subscribe(() => seen.push(sliceOf(store.getState(), 'A').status))
    await Promise.all([store.load('A'), store.load('A')])
    await store.load('A')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(seen[0]).toBe('loading')
    expect(sliceOf(store.getState(), 'A')).toMatchObject({ status: 'ready', error: null })
    expect(sliceOf(store.getState(), 'A').rows).toHaveLength(3)
    expect(sliceOf(store.getState(), 'never-loaded').status).toBe('idle')
  })

  it('records an error, and retries on the next load', async () => {
    let n = 0
    const store = createCountryAnalytics(async () => { if (n++ === 0) throw new Error('World Bank HTTP 500'); return rows(2) })
    await store.load('A')
    expect(sliceOf(store.getState(), 'A')).toMatchObject({ status: 'error', error: 'World Bank HTTP 500', rows: [] })
    await store.load('A')
    expect(sliceOf(store.getState(), 'A').status).toBe('ready')
  })

  it('keeps earlier rows when a forced refresh fails', async () => {
    let n = 0
    const store = createCountryAnalytics(async () => { if (n++ === 0) return rows(4); throw new Error('later') })
    await store.load('A')
    await store.load('A', true)
    expect(sliceOf(store.getState(), 'A')).toMatchObject({ status: 'ready', error: 'later' })
    expect(sliceOf(store.getState(), 'A').rows).toHaveLength(4)
  })

  it('loadMany loads each indicator independently', async () => {
    const fetcher = vi.fn(async (id: string) => id === 'bad' ? Promise.reject(new Error('x')) : rows(1))
    const store = createCountryAnalytics(fetcher)
    await store.loadMany(['a', 'b', 'bad'])
    expect(sliceOf(store.getState(), 'a').status).toBe('ready')
    expect(sliceOf(store.getState(), 'bad').status).toBe('error')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('loadMany never runs more than the concurrency limit at once', async () => {
    let active = 0, peak = 0
    const store = createCountryAnalytics(async () => {
      active++; peak = Math.max(peak, active)
      await new Promise(r => setTimeout(r, 5))
      active--
      return rows(1)
    })
    await store.loadMany(Array.from({ length: 10 }, (_, i) => `i${i}`), 3)
    expect(peak).toBe(3)
    expect(Object.values(store.getState().slices).every(s => s.status === 'ready')).toBe(true)
    expect(Object.keys(store.getState().slices)).toHaveLength(10)
  })

  it('notifies on real selection and mode changes only', () => {
    const store = createCountryAnalytics(async () => [])
    const l = vi.fn()
    const off = store.subscribe(l)
    store.setSelection('a', 'b')
    store.setSelection('a', 'b')
    store.setMapMode('trend')
    store.setMapMode('trend')
    expect(l).toHaveBeenCalledTimes(2)
    expect(store.getState().selection).toEqual({ x: 'a', y: 'b' })
    off()
    store.setMapMode('value')
    expect(l).toHaveBeenCalledTimes(2)
  })
})

describe('selectForMap', () => {
  it('sets Y, keeps X, and switches the map to value mode', () => {
    const store = createCountryAnalytics(async () => [])
    store.setSelection('NY.GDP.PCAP.CD', 'SP.DYN.LE00.IN')
    store.setMapMode('trend')
    selectForMap('MS.MIL.TOTL.P1', store)
    expect(store.getState().selection).toEqual({ x: 'NY.GDP.PCAP.CD', y: 'MS.MIL.TOTL.P1' })
    expect(store.getState().mapMode).toBe('value')
  })
  it('moves X off the chosen indicator so the pair is never X against itself', () => {
    const store = createCountryAnalytics(async () => [])
    store.setSelection('SP.POP.TOTL', 'SP.DYN.LE00.IN')
    selectForMap('SP.POP.TOTL', store)
    expect(store.getState().selection).toEqual({ x: 'NY.GDP.PCAP.CD', y: 'SP.POP.TOTL' })
    selectForMap('NY.GDP.PCAP.CD', store)
    expect(store.getState().selection).toEqual({ x: 'SP.POP.TOTL', y: 'NY.GDP.PCAP.CD' })
  })
})
