/**
 * User watchlist + alerts. Everything is computed locally from data the app already has
 * (crisis events and the rule-based trajectories) and persisted in localStorage — no backend,
 * no accounts, no paid services.
 *
 * Two alert kinds, for countries the user watches:
 *  - event: a previously unseen live high/critical event appeared (incl. while the app was closed,
 *           because seen ids persist)
 *  - trend: the country's trajectory flipped to "rising"
 * Baseline entries are hand-entered "always ongoing" markers, never alerts.
 */
import type { CrisisEvent } from '../types'
import type { TrajectoryEntry } from '../utils/trajectory'

export interface WatchAlert {
  id: string
  t: number
  country: string
  kind: 'event' | 'trend'
  severity: CrisisEvent['severity']
  title: string
  detail: string
  read: boolean
}

export interface WatchState {
  countries: string[]
  alerts: WatchAlert[]
  /** Browser notifications requested by the user (still requires granted permission). */
  notify: boolean
}

interface Memory {
  /** null until the first evaluation, so the initial load never floods the user with "new" events */
  seen: string[] | null
  trends: Record<string, TrajectoryEntry['trend']>
}

export const MAX_ALERTS = 50
export const MAX_SEEN = 3000
const ALERT_SEVERITIES: ReadonlyArray<CrisisEvent['severity']> = ['high', 'critical']

const norm = (s: string) => s.trim().toLowerCase()
const isBaseline = (c: CrisisEvent) => c.source === 'Baseline' || c.id.startsWith('baseline-')

export interface EvaluateResult {
  alerts: WatchAlert[]
  memory: Memory
}

/** Pure: given the current data and what was already seen, decide which new alerts to raise. */
export function evaluateWatch(
  countries: string[],
  crises: CrisisEvent[],
  trajectories: TrajectoryEntry[],
  memory: Memory,
  now: number,
): EvaluateResult {
  const live = crises.filter(c => !isBaseline(c))
  // Nothing live yet (feed still loading or down): stay un-initialised, otherwise the first real
  // batch would all look "new" and alert.
  if (memory.seen === null && live.length === 0) return { alerts: [], memory }
  const watched = new Map(countries.map(c => [norm(c), c]))
  const prevSeen = memory.seen
  const seen = new Set(prevSeen ?? [])
  const alerts: WatchAlert[] = []

  for (const c of live) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    const name = watched.get(norm(c.country ?? ''))
    if (prevSeen === null || !name || !ALERT_SEVERITIES.includes(c.severity)) continue
    alerts.push({
      id: `ev-${c.id}`, t: now, country: name, kind: 'event', severity: c.severity,
      title: c.title, detail: `New ${c.severity} ${c.type} event${c.fatalities ? ` · ${c.fatalities} reported fatalities` : ''}`,
      read: false,
    })
  }

  const trends: Memory['trends'] = {}
  for (const t of trajectories) {
    const name = watched.get(norm(t.country))
    if (!name) continue
    trends[name] = t.trend
    if (prevSeen !== null && t.trend === 'rising' && memory.trends[name] !== 'rising') {
      alerts.push({
        id: `tr-${name}-${new Date(now).toISOString().slice(0, 10)}`, t: now, country: name, kind: 'trend',
        severity: 'high', title: `${name} activity is rising`, detail: t.reason, read: false,
      })
    }
  }
  // keep prior trend for watched countries that had no entry this round (don't re-fire when they reappear)
  for (const [name, prev] of Object.entries(memory.trends)) if (!(name in trends) && watched.has(norm(name))) trends[name] = prev

  return { alerts, memory: { seen: [...seen].slice(-MAX_SEEN), trends } }
}

// ── Persistence + observable store ───────────────────────────────────────────

export interface KV { get(key: string): string | null; set(key: string, value: string): void }

export const localKV: KV = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch {} },
}

const K_STATE = 'ws-watch'
const K_MEM = 'ws-watch-mem'

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

export function createWatchStore(kv: KV = localKV, now: () => number = Date.now) {
  const saved = parse<Partial<WatchState>>(kv.get(K_STATE), {})
  let state: WatchState = {
    countries: Array.isArray(saved.countries) ? saved.countries.filter(c => typeof c === 'string') : [],
    alerts: Array.isArray(saved.alerts) ? saved.alerts : [],
    notify: saved.notify === true,
  }
  let memory = parse<Memory>(kv.get(K_MEM), { seen: null, trends: {} })
  if (!memory || typeof memory !== 'object' || !('trends' in memory)) memory = { seen: null, trends: {} }
  const listeners = new Set<() => void>()

  function commit(next: WatchState) {
    state = next
    kv.set(K_STATE, JSON.stringify(state))
    listeners.forEach(l => l())
  }

  return {
    getState: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
    isWatched: (country: string) => state.countries.some(c => norm(c) === norm(country)),
    add(country: string) {
      const name = country.trim()
      if (!name || state.countries.some(c => norm(c) === norm(name))) return
      commit({ ...state, countries: [...state.countries, name] })
    },
    remove(country: string) {
      commit({ ...state, countries: state.countries.filter(c => norm(c) !== norm(country)) })
    },
    toggle(country: string) {
      if (state.countries.some(c => norm(c) === norm(country))) this.remove(country)
      else this.add(country)
    },
    setNotify(on: boolean) { commit({ ...state, notify: on }) },
    markAllRead() {
      if (state.alerts.some(a => !a.read)) commit({ ...state, alerts: state.alerts.map(a => ({ ...a, read: true })) })
    },
    clearAlerts() { commit({ ...state, alerts: [] }) },
    /** Runs detection against current data; returns the alerts that were newly raised. */
    evaluate(crises: CrisisEvent[], trajectories: TrajectoryEntry[]): WatchAlert[] {
      const res = evaluateWatch(state.countries, crises, trajectories, memory, now())
      memory = res.memory
      kv.set(K_MEM, JSON.stringify(memory))
      const fresh = res.alerts.filter(a => !state.alerts.some(x => x.id === a.id))
      if (fresh.length > 0) commit({ ...state, alerts: [...fresh, ...state.alerts].slice(0, MAX_ALERTS) })
      return fresh
    },
  }
}

export const watchStore = createWatchStore()
