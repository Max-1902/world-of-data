import { describe, it, expect, vi } from 'vitest'
import { createAnalyticsData, ANALYTICS_TTL_MS, quakePoints, firePoints } from './analyticsData'
import type { Earthquake } from './earthquakes'
import type { FirePoint } from './wildfires'

const quake = (id: string, o: Partial<Earthquake> = {}): Earthquake => ({
  id, magnitude: 5.1, place: '10 km N of Town, Japan', time: 1_700_000_000_000, latitude: 35, longitude: 139, depth: 10, url: '', ...o,
})
const fire = (id: string, o: Partial<FirePoint> = {}): FirePoint => ({
  id, latitude: -10, longitude: 25, frp: 12, confidence: 'nominal', date: '2025-01-01', time: '1230', satellite: 'N21', daynight: 'D', brightness: 330, ...o,
})

describe('point mappers', () => {
  it('maps quakes to unit-weight points that carry their magnitude', () => {
    expect(quakePoints([quake('a', { magnitude: 6.2, latitude: 1, longitude: 2 })])).toEqual([{ lat: 1, lng: 2, weight: 1, peak: 6.2 }])
  })
  it('weights fires by radiative power and gives power-less detections no weight', () => {
    const pts = firePoints([fire('a', { frp: 40 }), fire('b', { frp: 0 })])
    expect(pts.map(p => p.weight)).toEqual([40, 0])
  })
})

describe('analyticsData store', () => {
  it('loads each feed independently and builds hexagons', async () => {
    const store = createAnalyticsData({ fetchQuakes: async () => [quake('a'), quake('b')], fetchFires: async () => [fire('x'), fire('y')] })
    await store.load('quakes')
    expect(store.getState().quakes.status).toBe('ready')
    expect(store.getState().quakes.cells.length).toBeGreaterThan(0)
    expect(store.getState().fires.status).toBe('idle')
    await store.load('fires')
    expect(store.getState().fires.cells[0].value).toBe(24)
  })

  it('does not draw fire cells that have no reported power', async () => {
    const store = createAnalyticsData({ fetchFires: async () => [fire('x', { frp: 0 })] })
    await store.load('fires')
    expect(store.getState().fires.status).toBe('ready')
    expect(store.getState().fires.cells).toEqual([])
  })

  it('reports empty (not error) when a feed returns nothing', async () => {
    const store = createAnalyticsData({ fetchQuakes: async () => [] })
    await store.load('quakes')
    expect(store.getState().quakes).toMatchObject({ status: 'empty', data: [], cells: [] })
  })

  it('surfaces a thrown fetch as an error, and keeps old data when a later refresh fails', async () => {
    const down = createAnalyticsData({ fetchFires: async () => { throw new Error('FIRMS HTTP 500') } })
    await down.load('fires')
    expect(down.getState().fires).toMatchObject({ status: 'error', error: 'FIRMS HTTP 500' })

    let n = 0
    const flaky = createAnalyticsData({ fetchFires: async () => { if (n++ === 0) return [fire('a')]; throw new Error('later') } })
    await flaky.load('fires')
    await flaky.load('fires', true)
    expect(flaky.getState().fires.status).toBe('ready')
    expect(flaky.getState().fires.data).toHaveLength(1)
    expect(flaky.getState().fires.error).toBe('later')
  })

  it('dedupes concurrent loads and honours the TTL, but force bypasses it', async () => {
    let t = 1_000
    const fetchQuakes = vi.fn(async () => [quake('a')])
    const store = createAnalyticsData({ fetchQuakes, now: () => t })
    await Promise.all([store.load('quakes'), store.load('quakes')])
    await store.load('quakes')
    expect(fetchQuakes).toHaveBeenCalledTimes(1)
    t += ANALYTICS_TTL_MS + 1
    await store.load('quakes')
    expect(fetchQuakes).toHaveBeenCalledTimes(2)
    await store.load('quakes', true)
    expect(fetchQuakes).toHaveBeenCalledTimes(3)
  })

  it('retries an errored feed immediately rather than waiting out the TTL', async () => {
    let n = 0
    const fetchFires = vi.fn(async () => { if (n++ === 0) throw new Error('x'); return [fire('a')] })
    const store = createAnalyticsData({ fetchFires, now: () => 5 })
    await store.load('fires')
    await store.load('fires')
    expect(store.getState().fires.status).toBe('ready')
  })

  it('notifies subscribers, and only on real hex-source changes', () => {
    const store = createAnalyticsData()
    const l = vi.fn()
    const off = store.subscribe(l)
    store.setHexSource('quakes')
    store.setHexSource('quakes')
    expect(l).toHaveBeenCalledTimes(1)
    off()
    store.setHexSource('fires')
    expect(l).toHaveBeenCalledTimes(1)
  })
})
