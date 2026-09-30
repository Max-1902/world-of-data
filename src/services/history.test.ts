import { describe, it, expect, vi } from 'vitest'
import {
  scoreByCountry, buildSnapshot, countrySeries, threatSeries, changesSince,
  createMemoryStore, createHistory, SNAPSHOT_INTERVAL_MS, RETENTION_MS, COUNTRY_LIMIT,
  readLastSeen, type Snapshot,
} from './history'
import { installLocalStorage, quietConsole } from '../test/helpers'
import type { CrisisEvent } from '../types'

const ev = (country: string, severity: CrisisEvent['severity']): CrisisEvent => ({
  id: `${country}-${severity}-${Math.random()}`, title: 't', type: 'conflict', severity,
  latitude: 1, longitude: 1, country, date: new Date().toISOString(), description: '', source: 'x',
})
const snap = (t: number, countries: Record<string, number>, threat = 0): Snapshot => ({ t, threat, flights: null, countries })

describe('scoreByCountry', () => {
  it('sums severity weights per country (same weights as the Risk Matrix)', () => {
    expect(scoreByCountry([ev('A', 'critical'), ev('A', 'low'), ev('B', 'high')])).toEqual({ A: 11, B: 6 })
  })
  it('skips events with no country and caps at the limit, keeping the highest scores', () => {
    const many = Array.from({ length: COUNTRY_LIMIT + 5 }, (_, i) => ev(`C${i}`, i === 0 ? 'critical' : 'low'))
    const out = scoreByCountry([...many, ev('', 'critical')])
    expect(Object.keys(out)).toHaveLength(COUNTRY_LIMIT)
    expect(out.C0).toBe(10)
    expect(out['']).toBeUndefined()
  })
})

describe('series helpers', () => {
  const snaps = [snap(1, {}, 5), snap(2, { A: 3 }, 6), snap(3, {}, 7), snap(4, { A: 9 }, 8)]
  it('threatSeries maps every snapshot', () => {
    expect(threatSeries(snaps)).toEqual([{ t: 1, v: 5 }, { t: 2, v: 6 }, { t: 3, v: 7 }, { t: 4, v: 8 }])
  })
  it('countrySeries starts at first appearance, then treats absence as 0', () => {
    expect(countrySeries(snaps, 'A')).toEqual([{ t: 2, v: 3 }, { t: 3, v: 0 }, { t: 4, v: 9 }])
  })
  it('countrySeries is empty for a country never seen', () => {
    expect(countrySeries(snaps, 'Z')).toEqual([])
  })
})

describe('changesSince', () => {
  const snaps = [snap(100, { A: 10, B: 5 }), snap(200, { A: 12, B: 5 }), snap(300, { A: 20 })]
  it('compares against the newest snapshot at or before the cutoff', () => {
    const r = changesSince(snaps, 250, { A: 20, C: 4 })!
    expect(r.baselineT).toBe(200)
    expect(r.movers).toEqual([
      { country: 'A', before: 12, now: 20, delta: 8 },
      { country: 'B', before: 5, now: 0, delta: -5 },
      { country: 'C', before: 0, now: 4, delta: 4 },
    ])
  })
  it('returns null when no snapshot predates the cutoff', () => {
    expect(changesSince(snaps, 50, { A: 1 })).toBeNull()
  })
  it('omits unchanged countries and respects the limit', () => {
    const r = changesSince(snaps, 250, { A: 12, B: 5, C: 1, D: 2, E: 3, F: 4 }, 2)!
    expect(r.movers.map(m => m.country)).toEqual(['F', 'E'])
  })
})

describe('createHistory', () => {
  const input = { crises: [ev('A', 'high')], threat: 7, flights: 12 }

  it('records the first snapshot and rate-limits the next', async () => {
    let t = 1_000_000
    const h = createHistory(createMemoryStore(), () => t)
    expect(await h.record(input)).toBe(true)
    t += SNAPSHOT_INTERVAL_MS - 1
    expect(await h.record(input)).toBe(false)
    t += 1
    expect(await h.record(input)).toBe(true)
    expect(h.getSnapshots()).toHaveLength(2)
    expect(h.getSnapshots()[0]).toMatchObject({ threat: 7, flights: 12, countries: { A: 6 } })
  })

  it('persists to the store, reloads it, and prunes past the retention window', async () => {
    const store = createMemoryStore()
    const t0 = 10 * RETENTION_MS
    await store.put(snap(t0 - RETENTION_MS - 1, { OLD: 1 }))
    await store.put(snap(t0 - 1000, { KEPT: 1 }))
    const h = createHistory(store, () => t0)
    await h.load()
    expect(h.getSnapshots().map(s => s.t)).toEqual([t0 - 1000])
  })

  it('does not record a snapshot too soon after a persisted one from a previous session', async () => {
    const store = createMemoryStore()
    await store.put(snap(5_000_000 - 1000, { A: 1 }))
    const h = createHistory(store, () => 5_000_000)
    expect(await h.record(input)).toBe(false)
  })

  it('notifies subscribers with a fresh array reference', async () => {
    const h = createHistory(createMemoryStore(), () => 1)
    const before = h.getSnapshots()
    const l = vi.fn()
    h.subscribe(l)
    await h.record(input)
    expect(l).toHaveBeenCalled()
    expect(h.getSnapshots()).not.toBe(before)
  })

  it('keeps working in memory when the store fails', async () => {
    quietConsole()
    const bad = { getAll: async () => { throw new Error('nope') }, put: async () => { throw new Error('nope') }, deleteBefore: async () => {} }
    const h = createHistory(bad, () => 1)
    expect(await h.record(input)).toBe(true)
    expect(h.getSnapshots()).toHaveLength(1)
  })

  it('stores null flights when the layer is off (not zero)', () => {
    expect(buildSnapshot({ crises: [], threat: 0, flights: null, now: 1 }).flights).toBeNull()
  })
})

describe('readLastSeen', () => {
  it('returns null on first visit and when storage is unusable', () => {
    installLocalStorage()
    expect(readLastSeen()).toBeNull()
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    expect(readLastSeen()).toBeNull()
  })
  it('returns the stored timestamp, ignoring garbage', () => {
    const { storage } = installLocalStorage()
    storage.setItem('ws-last-seen', '1234')
    expect(readLastSeen()).toBe(1234)
    storage.setItem('ws-last-seen', 'abc')
    expect(readLastSeen()).toBeNull()
  })
})
