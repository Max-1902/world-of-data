/**
 * Local snapshot history. The live feeds only ever show "now", so the app records a compact
 * snapshot of its own computed numbers (global threat, per-country risk scores, flight count)
 * at most every SNAPSHOT_INTERVAL_MS while it is open. That gives sparklines and
 * "since your last visit" deltas without any backend.
 *
 * Storage is IndexedDB in the browser (free, no account). History only covers the times the
 * app was actually open — there is no backfill, and gaps are real gaps.
 */
import type { CrisisEvent } from '../types'
import { SEV_WEIGHT } from '../utils/trajectory'

export interface Snapshot {
  /** epoch ms */
  t: number
  threat: number
  /** null when the flights layer was off, so "not measured" is never stored as zero */
  flights: number | null
  /** country -> weighted severity score (same weights as the Risk Matrix), top COUNTRY_LIMIT only */
  countries: Record<string, number>
}

export interface SnapshotStore {
  getAll(): Promise<Snapshot[]>
  put(s: Snapshot): Promise<void>
  deleteBefore(t: number): Promise<void>
}

export const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export const COUNTRY_LIMIT = 40

export function scoreByCountry(crises: CrisisEvent[], limit = COUNTRY_LIMIT): Record<string, number> {
  const m: Record<string, number> = {}
  for (const c of crises) {
    if (!c.country) continue
    m[c.country] = (m[c.country] ?? 0) + (SEV_WEIGHT[c.severity] ?? 1)
  }
  const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, limit)
  return Object.fromEntries(top)
}

export function buildSnapshot(input: { crises: CrisisEvent[]; threat: number; flights: number | null; now: number }): Snapshot {
  return { t: input.now, threat: input.threat, flights: input.flights, countries: scoreByCountry(input.crises) }
}

export interface SeriesPoint { t: number; v: number }

export function threatSeries(snaps: Snapshot[]): SeriesPoint[] {
  return snaps.map(s => ({ t: s.t, v: s.threat }))
}

/**
 * A country absent from a snapshot fell outside the top COUNTRY_LIMIT (or had no events), so it
 * is treated as 0 — but only once the country has appeared at least once, to avoid a flat
 * leading run of zeros for countries we have no data on.
 */
export function countrySeries(snaps: Snapshot[], country: string): SeriesPoint[] {
  const out: SeriesPoint[] = []
  let seen = false
  for (const s of snaps) {
    const v = s.countries[country]
    if (v !== undefined) seen = true
    if (seen) out.push({ t: s.t, v: v ?? 0 })
  }
  return out
}

export interface Mover { country: string; before: number; now: number; delta: number }

/**
 * Countries whose score moved most since `sinceT`. The comparison point is the newest snapshot
 * taken at or before `sinceT`; with no such snapshot there is nothing honest to compare against
 * and this returns null.
 */
export function changesSince(snaps: Snapshot[], sinceT: number, current: Record<string, number>, limit = 3): { baselineT: number; movers: Mover[] } | null {
  let base: Snapshot | null = null
  for (const s of snaps) if (s.t <= sinceT && (!base || s.t > base.t)) base = s
  if (!base) return null
  const keys = new Set([...Object.keys(base.countries), ...Object.keys(current)])
  const movers: Mover[] = []
  for (const country of keys) {
    const before = base.countries[country] ?? 0
    const now = current[country] ?? 0
    if (now !== before) movers.push({ country, before, now, delta: now - before })
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return { baselineT: base.t, movers: movers.slice(0, limit) }
}

// ── Storage ─────────────────────────────────────────────────────────────────

export function createMemoryStore(): SnapshotStore {
  const rows = new Map<number, Snapshot>()
  return {
    getAll: async () => [...rows.values()].sort((a, b) => a.t - b.t),
    put: async s => { rows.set(s.t, s) },
    deleteBefore: async t => { for (const k of [...rows.keys()]) if (k < t) rows.delete(k) },
  }
}

const DB_NAME = 'ws-history'
const STORE = 'snapshots'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export function createIdbStore(): SnapshotStore | null {
  if (typeof indexedDB === 'undefined') return null
  let dbPromise: Promise<IDBDatabase> | null = null
  const open = () => dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 't' })
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => { dbPromise = null; reject(r.error) }
  })
  return {
    async getAll() {
      const db = await open()
      const rows = await req(db.transaction(STORE).objectStore(STORE).getAll() as IDBRequest<Snapshot[]>)
      return rows.sort((a, b) => a.t - b.t)
    },
    async put(s) {
      const db = await open()
      await req(db.transaction(STORE, 'readwrite').objectStore(STORE).put(s))
    },
    async deleteBefore(t) {
      const db = await open()
      await req(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(IDBKeyRange.upperBound(t, true)))
    },
  }
}

// ── Observable history ──────────────────────────────────────────────────────

export function createHistory(store: SnapshotStore, now: () => number = Date.now) {
  let snaps: Snapshot[] = []
  let loaded: Promise<void> | null = null
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(l => l())

  const load = () => loaded ??= (async () => {
    try {
      await store.deleteBefore(now() - RETENTION_MS)
      const stored = await store.getAll()
      // keep anything recorded before load finished
      snaps = [...stored, ...snaps.filter(s => !stored.some(r => r.t === s.t))].sort((a, b) => a.t - b.t)
      emit()
    } catch (e) {
      console.warn('[history] could not load snapshots:', e)
    }
  })()

  return {
    load,
    getSnapshots: () => snaps,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
    /** Records a snapshot unless one was taken within SNAPSHOT_INTERVAL_MS. Returns whether it recorded. */
    async record(input: Omit<Parameters<typeof buildSnapshot>[0], 'now'>): Promise<boolean> {
      await load()
      const t = now()
      const last = snaps[snaps.length - 1]
      if (last && t - last.t < SNAPSHOT_INTERVAL_MS) return false
      const snap = buildSnapshot({ ...input, now: t })
      snaps = [...snaps, snap]
      emit()
      try { await store.put(snap) } catch (e) { console.warn('[history] could not persist snapshot:', e) }
      return true
    },
  }
}

export const history = createHistory(createIdbStore() ?? createMemoryStore())

// ── "Last seen" ─────────────────────────────────────────────────────────────

const LAST_SEEN_KEY = 'ws-last-seen'

/** When the user last had the app open, read before this session overwrites it. null on first visit. */
export function readLastSeen(): number | null {
  try {
    const n = Number(localStorage.getItem(LAST_SEEN_KEY))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch { return null }
}

/** Keep "last seen" current while the app is open; call once, returns a cleanup. */
export function trackLastSeen(): () => void {
  const stamp = () => { try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())) } catch {} }
  const onHide = () => { if (document.visibilityState === 'hidden') stamp() }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', stamp)
  const timer = window.setInterval(stamp, 5 * 60 * 1000)
  return () => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', stamp)
    clearInterval(timer)
  }
}
