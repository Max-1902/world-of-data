/**
 * Shared, observable store for the long-window ACLED history behind the Analytics panel and its map layer.
 * Both read the same snapshot, so opening the panel and switching on the layer cost one fetch, not two.
 *
 * Held in memory only: a 75-day window is tens of thousands of rows, which is the wrong thing to write into
 * localStorage. The cost of that choice is a refetch on page reload, bounded by the page ceiling in
 * fetchACLEDHistory and the TTL below.
 */
import type { CrisisEvent } from '../types'
import { fetchACLEDHistory, type ACLEDHistory } from './crises'
import { datedEvents, latestDay } from '../utils/analytics'
import { binToHex, drawProps, type HexCell } from '../utils/hexbin'

export const HISTORY_DAYS = 75
export const HISTORY_TTL_MS = 30 * 60 * 1000

export type HexMode = 'intensity' | 'change'
export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'
export type DrawCell = ReturnType<typeof drawProps>[number]

export interface ConflictHistoryState {
  status: HistoryStatus
  /** Real, dated events only */
  events: CrisisEvent[]
  /** Newest event day (UTC midnight). The window is anchored here, not on "today", because ACLED publishes with a lag. */
  endDay: number | null
  hexes: DrawCell[]
  truncated: boolean
  fetchedAt: number | null
  mapMode: HexMode
  error: string | null
}

const INITIAL: ConflictHistoryState = {
  status: 'idle', events: [], endDay: null, hexes: [], truncated: false, fetchedAt: null, mapMode: 'intensity', error: null,
}

export function createConflictHistory(
  fetcher: (days: number) => Promise<ACLEDHistory> = fetchACLEDHistory,
  now: () => number = Date.now,
) {
  let state: ConflictHistoryState = INITIAL
  let inflight: Promise<void> | null = null
  const listeners = new Set<() => void>()
  const set = (patch: Partial<ConflictHistoryState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()) }

  async function run(): Promise<void> {
    set({ status: 'loading', error: null })
    try {
      const { events: raw, truncated } = await fetcher(HISTORY_DAYS)
      const events = datedEvents(raw)
      const endDay = latestDay(events)
      if (events.length === 0 || endDay === null) {
        set({ status: 'empty', events: [], endDay: null, hexes: [], truncated: false, fetchedAt: now() })
        return
      }
      const cells: HexCell[] = await binToHex(events, { endDay })
      set({ status: 'ready', events, endDay, hexes: drawProps(cells), truncated, fetchedAt: now() })
    } catch (e) {
      // Keep whatever was loaded before; only the status and message change.
      set({ status: state.events.length > 0 ? 'ready' : 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  return {
    getState: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
    /** Loads unless fresh data is already held or a load is in flight. `force` bypasses the TTL. */
    load(force = false): Promise<void> {
      if (inflight) return inflight
      if (!force && state.fetchedAt !== null && now() - state.fetchedAt < HISTORY_TTL_MS && state.status !== 'error') return Promise.resolve()
      inflight = run().finally(() => { inflight = null })
      return inflight
    },
    setMapMode(mapMode: HexMode) { if (mapMode !== state.mapMode) set({ mapMode }) },
  }
}

export const conflictHistory = createConflictHistory()
