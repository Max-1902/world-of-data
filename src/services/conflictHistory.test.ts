import { describe, it, expect, vi } from 'vitest'
import { createConflictHistory, HISTORY_TTL_MS } from './conflictHistory'
import type { CrisisEvent } from '../types'

const ev = (id: string, date: string, o: Partial<CrisisEvent> = {}): CrisisEvent => ({
  id, title: '', type: 'conflict', severity: 'high', latitude: 48.1, longitude: 37.7, country: 'Ukraine',
  date, description: '', source: 'ACLED', ...o,
})

describe('conflictHistory store', () => {
  it('loads, anchors the window on the newest event day and builds hexes', async () => {
    const fetcher = vi.fn(async () => ({ events: [ev('a', '2025-03-01'), ev('b', '2025-03-05')], truncated: true }))
    const store = createConflictHistory(fetcher)
    await store.load()
    const s = store.getState()
    expect(s.status).toBe('ready')
    expect(s.endDay).toBe(Date.UTC(2025, 2, 5))
    expect(s.truncated).toBe(true)
    expect(s.hexes.length).toBeGreaterThan(0)
  })

  it('reports empty (not error) when the source returns nothing', async () => {
    const store = createConflictHistory(async () => ({ events: [], truncated: false }))
    await store.load()
    expect(store.getState().status).toBe('empty')
  })

  it('keeps the known cause when the source returns nothing, and clears it on the next load', async () => {
    let n = 0
    const store = createConflictHistory(async () => n++ === 0
      ? { events: [], truncated: false, reason: 'ACLED rejected the login' }
      : { events: [ev('a', '2025-03-01')], truncated: false })
    await store.load()
    expect(store.getState()).toMatchObject({ status: 'empty', reason: 'ACLED rejected the login' })
    await store.load(true)
    expect(store.getState()).toMatchObject({ status: 'ready', reason: null })
  })

  it('drops baseline markers and undated rows before analysis', async () => {
    const store = createConflictHistory(async () => ({
      events: [ev('baseline-x', '2025-03-05', { source: 'Baseline' }), ev('c', 'garbage'), ev('d', '2025-03-02')], truncated: false,
    }))
    await store.load()
    expect(store.getState().events.map(e => e.id)).toEqual(['d'])
  })

  it('dedupes concurrent loads and honours the TTL, but force bypasses it', async () => {
    let t = 1_000
    const fetcher = vi.fn(async () => ({ events: [ev('a', '2025-03-01')], truncated: false }))
    const store = createConflictHistory(fetcher, () => t)
    await Promise.all([store.load(), store.load()])
    expect(fetcher).toHaveBeenCalledTimes(1)
    await store.load()
    expect(fetcher).toHaveBeenCalledTimes(1)
    t += HISTORY_TTL_MS + 1
    await store.load()
    expect(fetcher).toHaveBeenCalledTimes(2)
    await store.load(true)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('surfaces a thrown fetch as an error state, and keeps old data on a later failure', async () => {
    const fail = createConflictHistory(async () => { throw new Error('boom') })
    await fail.load()
    expect(fail.getState()).toMatchObject({ status: 'error', error: 'boom' })

    let n = 0
    const flaky = createConflictHistory(async () => {
      if (n++ === 0) return { events: [ev('a', '2025-03-01')], truncated: false }
      throw new Error('later failure')
    })
    await flaky.load()
    await flaky.load(true)
    expect(flaky.getState().status).toBe('ready')
    expect(flaky.getState().events).toHaveLength(1)
    expect(flaky.getState().error).toBe('later failure')
  })

  it('notifies subscribers and only on real map-mode changes', async () => {
    const store = createConflictHistory(async () => ({ events: [], truncated: false }))
    const l = vi.fn()
    const off = store.subscribe(l)
    store.setMapMode('change')
    store.setMapMode('change')
    expect(l).toHaveBeenCalledTimes(1)
    off()
    store.setMapMode('intensity')
    expect(l).toHaveBeenCalledTimes(1)
  })
})
