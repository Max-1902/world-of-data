/**
 * Shared, observable state for the Country Analytics panel and its map layer: which two indicators are being compared,
 * how the globe is coloured, and the World Bank rows loaded for each indicator. One load per indicator no matter how
 * many components ask (fetchIndicatorAll also caches for an hour).
 */
import { PRESETS, fetchIndicatorAll, type CountryValue } from './countryIndicators'
import type { MapMode } from '../utils/countryStats'

export type SliceStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface IndicatorSlice {
  status: SliceStatus
  rows: CountryValue[]
  error: string | null
}

export interface CountryAnalyticsState {
  selection: { x: string; y: string }
  mapMode: MapMode
  slices: Record<string, IndicatorSlice>
}

const IDLE: IndicatorSlice = { status: 'idle', rows: [], error: null }
export const sliceOf = (s: CountryAnalyticsState, id: string): IndicatorSlice => s.slices[id] ?? IDLE

export function createCountryAnalytics(fetcher: (id: string) => Promise<CountryValue[]> = fetchIndicatorAll) {
  let state: CountryAnalyticsState = { selection: { x: PRESETS[0].x, y: PRESETS[0].y }, mapMode: 'value', slices: {} }
  const inflight = new Map<string, Promise<void>>()
  const listeners = new Set<() => void>()
  const set = (next: Partial<CountryAnalyticsState>) => { state = { ...state, ...next }; listeners.forEach(l => l()) }
  const setSlice = (id: string, slice: IndicatorSlice) => set({ slices: { ...state.slices, [id]: slice } })

  function load(id: string, force = false): Promise<void> {
    const running = inflight.get(id)
    if (running) return running
    const cur = sliceOf(state, id)
    if (!force && cur.status === 'ready') return Promise.resolve()
    setSlice(id, { ...cur, status: 'loading', error: null })
    const p = (async () => {
      try {
        const rows = await fetcher(id)
        setSlice(id, { status: 'ready', rows, error: null })
      } catch (e) {
        // keep rows from an earlier successful load, if any
        setSlice(id, { status: sliceOf(state, id).rows.length ? 'ready' : 'error', rows: sliceOf(state, id).rows, error: e instanceof Error ? e.message : String(e) })
      }
    })().finally(() => inflight.delete(id))
    inflight.set(id, p)
    return p
  }

  return {
    getState: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
    load,
    /** Loads several indicators, at most `limit` at a time so a burst can't trip the World Bank's rate limiting. */
    async loadMany(ids: readonly string[], limit = 4): Promise<void> {
      const queue = [...ids]
      await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) await load(id)
      }))
    },
    setSelection(x: string, y: string) { if (x !== state.selection.x || y !== state.selection.y) set({ selection: { x, y } }) },
    setMapMode(mapMode: MapMode) { if (mapMode !== state.mapMode) set({ mapMode }) },
  }
}

export const countryAnalytics = createCountryAnalytics()

const DEFAULT_X = 'NY.GDP.PCAP.CD'

/**
 * Points the Country Analytics selection at `yId` in value mode, so another panel's "On the map" button can shade the
 * globe by that indicator. The X axis stays as it was unless it would equal Y.
 */
export function selectForMap(yId: string, store: Pick<typeof countryAnalytics, 'getState' | 'setSelection' | 'setMapMode'> = countryAnalytics): void {
  const x = store.getState().selection.x
  store.setSelection(x === yId ? (yId === DEFAULT_X ? 'SP.POP.TOTL' : DEFAULT_X) : x, yId)
  store.setMapMode('value')
}
