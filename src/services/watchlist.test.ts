import { describe, it, expect, vi } from 'vitest'
import { evaluateWatch, createWatchStore, MAX_ALERTS, MAX_SEEN, type KV } from './watchlist'
import type { CrisisEvent } from '../types'
import type { TrajectoryEntry } from '../utils/trajectory'

const ev = (id: string, country: string, severity: CrisisEvent['severity'] = 'high', o: Partial<CrisisEvent> = {}): CrisisEvent => ({
  id, title: `Event ${id}`, type: 'conflict', severity, latitude: 1, longitude: 1, country,
  date: '2026-09-30', description: '', source: 'ACLED', ...o,
})
const traj = (country: string, trend: TrajectoryEntry['trend'], reason = 'r', o: Partial<TrajectoryEntry> = {}): TrajectoryEntry => ({
  country, recentScore: 0, priorScore: 0, delta: 0, trend, velocity: 0, recentCount: 0, priorCount: 0, reason,
  baseline: null, unusual: null, sampled: false, ...o,
})
const normal = { days: 20, span: 'last 20 days', expected: 3, pHigh: 0.4, pLow: 0.7 }
const empty = { seen: null, trends: {} }

describe('evaluateWatch', () => {
  it('first evaluation only records what exists — no alerts', () => {
    const r = evaluateWatch(['Sudan'], [ev('a', 'Sudan', 'critical')], [traj('Sudan', 'rising')], empty, 1)
    expect(r.alerts).toEqual([])
    expect(r.memory.seen).toEqual(['a'])
    expect(r.memory.trends).toEqual({ Sudan: 'rising' })
  })

  it('stays un-initialised while there are no live events, so the first real batch is not "new"', () => {
    const baselineOnly = [ev('baseline-x', 'Sudan', 'critical', { source: 'Baseline' })]
    const r1 = evaluateWatch(['Sudan'], baselineOnly, [], empty, 1)
    expect(r1.memory.seen).toBeNull()
    const r2 = evaluateWatch(['Sudan'], [...baselineOnly, ev('a', 'Sudan', 'critical')], [], r1.memory, 2)
    expect(r2.alerts).toEqual([])
    expect(r2.memory.seen).toEqual(['a'])
  })

  it('alerts on a new high/critical event in a watched country, case-insensitively, once', () => {
    const mem = { seen: ['a'], trends: {} }
    const crises = [ev('a', 'Sudan'), ev('b', 'sudan', 'critical', { fatalities: 12 })]
    const r = evaluateWatch(['Sudan'], crises, [], mem, 5)
    expect(r.alerts).toHaveLength(1)
    expect(r.alerts[0]).toMatchObject({ id: 'ev-b', country: 'Sudan', kind: 'event', severity: 'critical', read: false })
    expect(r.alerts[0].detail).toContain('12 reported fatalities')
    const again = evaluateWatch(['Sudan'], crises, [], r.memory, 6)
    expect(again.alerts).toEqual([])
  })

  it('ignores unwatched countries, low/medium severity and baseline entries (but still marks them seen)', () => {
    const crises = [ev('x', 'Peru'), ev('y', 'Sudan', 'medium'), ev('baseline-z', 'Sudan', 'critical', { source: 'Baseline' }), ev('w', 'Sudan', 'low')]
    const r = evaluateWatch(['Sudan'], crises, [], { seen: [], trends: {} }, 1)
    expect(r.alerts).toEqual([])
    expect(r.memory.seen).toEqual(['x', 'y', 'w'])
  })

  it('a newly watched country does not alert on events that were already seen', () => {
    const r = evaluateWatch(['Peru'], [ev('x', 'Peru')], [], { seen: ['x'], trends: {} }, 1)
    expect(r.alerts).toEqual([])
  })

  it('raises a trend alert only on the flip to rising, and re-arms after it stops rising', () => {
    let r = evaluateWatch(['Mali'], [], [traj('Mali', 'flat')], { seen: [], trends: {} }, 1)
    expect(r.alerts).toEqual([])
    r = evaluateWatch(['Mali'], [], [traj('Mali', 'rising', '5 events in 72h')], r.memory, 2)
    expect(r.alerts).toHaveLength(1)
    expect(r.alerts[0]).toMatchObject({ kind: 'trend', country: 'Mali', detail: '5 events in 72h' })
    r = evaluateWatch(['Mali'], [], [traj('Mali', 'rising')], r.memory, 3)
    expect(r.alerts).toEqual([])
    r = evaluateWatch(['Mali'], [], [traj('Mali', 'falling')], r.memory, 4)
    r = evaluateWatch(['Mali'], [], [traj('Mali', 'rising')], r.memory, 5)
    expect(r.alerts).toHaveLength(1)
    expect(r.memory.trends.Mali).toBe('rising')
  })

  it('with a known normal, alerts on "unusually high" rather than on a plain rise', () => {
    let r = evaluateWatch(['Mali'], [], [traj('Mali', 'rising', 'r', { baseline: normal })], { seen: [], trends: {} }, 1)
    expect(r.alerts).toEqual([])
    r = evaluateWatch(['Mali'], [], [traj('Mali', 'rising', 'r', { baseline: { ...normal, pHigh: 0.001 }, unusual: 'high' })], r.memory, 2)
    expect(r.alerts).toHaveLength(1)
    expect(r.alerts[0].title).toBe('Mali activity is unusually high')
    r = evaluateWatch(['Mali'], [], [traj('Mali', 'rising', 'r', { baseline: { ...normal, pHigh: 0.001 }, unusual: 'high' })], r.memory, 3)
    expect(r.alerts).toEqual([])
  })

  it('does not re-fire a trend alert when a watched country briefly drops out of the trajectory list', () => {
    const r1 = evaluateWatch(['Mali'], [], [traj('Mali', 'rising')], { seen: [], trends: { Mali: 'rising' } }, 1)
    const r2 = evaluateWatch(['Mali'], [], [traj('Mali', 'rising')], r1.memory, 2)
    expect(r1.alerts).toEqual([])
    expect(r2.alerts).toEqual([])
  })

  it('bounds the seen-id memory', () => {
    const many = Array.from({ length: MAX_SEEN + 10 }, (_, i) => ev(`e${i}`, 'Peru'))
    const r = evaluateWatch([], many, [], { seen: [], trends: {} }, 1)
    expect(r.memory.seen).toHaveLength(MAX_SEEN)
    expect(r.memory.seen![MAX_SEEN - 1]).toBe(`e${MAX_SEEN + 9}`)
  })
})

function memKV(init: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...init }
  return { data, get: k => data[k] ?? null, set: (k, v) => { data[k] = v } }
}

describe('createWatchStore', () => {
  it('adds, dedupes (case-insensitive), removes, toggles and persists', () => {
    const kv = memKV()
    const s = createWatchStore(kv)
    s.add('  Sudan '); s.add('sudan'); s.add('')
    expect(s.getState().countries).toEqual(['Sudan'])
    expect(s.isWatched('SUDAN')).toBe(true)
    s.toggle('Mali'); s.toggle('sudan')
    expect(s.getState().countries).toEqual(['Mali'])
    expect(JSON.parse(kv.data['ws-watch']).countries).toEqual(['Mali'])
    expect(createWatchStore(kv).getState().countries).toEqual(['Mali'])
  })

  it('survives corrupt or wrong-shaped storage', () => {
    for (const bad of ['{not json', '123', '{"countries":"x","alerts":5}']) {
      const s = createWatchStore(memKV({ 'ws-watch': bad, 'ws-watch-mem': bad }))
      expect(s.getState()).toEqual({ countries: [], alerts: [], notify: false })
      expect(() => s.evaluate([], [])).not.toThrow()
    }
  })

  it('evaluate returns only fresh alerts, stores them newest-first, and markAllRead clears unread', () => {
    let t = 1000
    const s = createWatchStore(memKV(), () => t)
    s.add('Sudan')
    s.evaluate([ev('a', 'Sudan')], [])
    t = 2000
    const fresh = s.evaluate([ev('a', 'Sudan'), ev('b', 'Sudan'), ev('c', 'Sudan')], [])
    expect(fresh.map(a => a.id).sort()).toEqual(['ev-b', 'ev-c'])
    expect(s.getState().alerts).toHaveLength(2)
    expect(s.getState().alerts.every(a => !a.read)).toBe(true)
    s.markAllRead()
    expect(s.getState().alerts.every(a => a.read)).toBe(true)
    s.clearAlerts()
    expect(s.getState().alerts).toEqual([])
  })

  it('alert memory persists across sessions: events that arrived while closed alert on next load', () => {
    const kv = memKV()
    const s1 = createWatchStore(kv)
    s1.add('Sudan')
    s1.evaluate([ev('a', 'Sudan')], [])
    const s2 = createWatchStore(kv)
    const fresh = s2.evaluate([ev('a', 'Sudan'), ev('n', 'Sudan', 'critical')], [])
    expect(fresh.map(a => a.id)).toEqual(['ev-n'])
  })

  it('caps stored alerts and notifies subscribers with a new state object', () => {
    const s = createWatchStore(memKV())
    s.add('Sudan')
    s.evaluate([ev('seed', 'Peru')], [])
    const l = vi.fn()
    s.subscribe(l)
    const before = s.getState()
    s.evaluate(Array.from({ length: MAX_ALERTS + 5 }, (_, i) => ev(`e${i}`, 'Sudan')), [])
    expect(s.getState().alerts).toHaveLength(MAX_ALERTS)
    expect(s.getState()).not.toBe(before)
    expect(l).toHaveBeenCalled()
  })
})
