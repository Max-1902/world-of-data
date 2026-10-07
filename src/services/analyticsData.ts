/**
 * Shared, observable store for the Analytics panel and its map layer. It loads the same two live feeds the rest of
 * the app already uses — USGS earthquakes and NASA FIRMS fire detections — through their existing service clients,
 * so opening the panel and switching on the hexagon layer cost one fetch per feed, not two.
 *
 * Memory only: the fire feed is tens of thousands of rows. Refetches are throttled by a TTL.
 */
import { fetchEarthquakes, type Earthquake } from './earthquakes'
import { fetchWildfires, type FirePoint } from './wildfires'
import { binPoints, drawProps, type HexPoint } from '../utils/hexbin'

export const ANALYTICS_TTL_MS = 10 * 60 * 1000

export type HexSource = 'fires' | 'quakes'
export type SliceStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'
export type DrawCell = ReturnType<typeof drawProps>[number]

export interface Slice<T> {
  status: SliceStatus
  data: T[]
  /** epoch ms of the last completed load */
  fetchedAt: number | null
  error: string | null
  cells: DrawCell[]
}

export interface AnalyticsDataState {
  quakes: Slice<Earthquake>
  fires: Slice<FirePoint>
  hexSource: HexSource
}

/** H3 resolution per feed: quakes are a few hundred points (coarse cells read better), fires tens of thousands. */
export const HEX_RES: Record<HexSource, number> = { quakes: 3, fires: 4 }

const emptySlice = <T>(): Slice<T> => ({ status: 'idle', data: [], fetchedAt: null, error: null, cells: [] })

export function quakePoints(quakes: Earthquake[]): HexPoint[] {
  return quakes.map(q => ({ lat: q.latitude, lng: q.longitude, weight: 1, peak: q.magnitude }))
}

/** Detections without a reported power contribute nothing to a cell's total, so they never inflate it. */
export function firePoints(fires: FirePoint[]): HexPoint[] {
  return fires.map(f => ({ lat: f.latitude, lng: f.longitude, weight: f.frp > 0 ? f.frp : 0, peak: f.frp }))
}

interface Deps {
  fetchQuakes: () => Promise<Earthquake[]>
  fetchFires: () => Promise<FirePoint[]>
  now: () => number
}

export function createAnalyticsData(deps: Partial<Deps> = {}) {
  const { fetchQuakes = () => fetchEarthquakes('week', '4.5'), fetchFires = fetchWildfires, now = Date.now } = deps
  let state: AnalyticsDataState = { quakes: emptySlice(), fires: emptySlice(), hexSource: 'fires' }
  const inflight: Partial<Record<HexSource, Promise<void>>> = {}
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(l => l())
  const patch = <K extends HexSource>(key: K, p: Partial<AnalyticsDataState[K]>) => {
    state = { ...state, [key]: { ...state[key], ...p } }
    emit()
  }

  async function run(source: HexSource): Promise<void> {
    patch(source, { status: 'loading', error: null })
    try {
      if (source === 'quakes') {
        // fetchEarthquakes swallows its own errors and returns [], so an empty result can mean "down" as well as "quiet"
        const data = await fetchQuakes()
        const cells = data.length ? drawProps(await binPoints(quakePoints(data), HEX_RES.quakes)) : []
        patch('quakes', { status: data.length ? 'ready' : 'empty', data, cells, fetchedAt: now() })
      } else {
        const data = await fetchFires()
        const cells = data.length ? drawProps((await binPoints(firePoints(data), HEX_RES.fires)).filter(c => c.value > 0)) : []
        patch('fires', { status: data.length ? 'ready' : 'empty', data, cells, fetchedAt: now() })
      }
    } catch (e) {
      // keep whatever loaded before; only the status and message change
      const had = state[source].data.length > 0
      patch(source, { status: had ? 'ready' : 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  return {
    getState: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
    /** Loads one feed unless fresh data is held or a load is in flight. `force` bypasses the TTL. */
    load(source: HexSource, force = false): Promise<void> {
      const running = inflight[source]
      if (running) return running
      const s = state[source]
      if (!force && s.fetchedAt !== null && now() - s.fetchedAt < ANALYTICS_TTL_MS && s.status !== 'error') return Promise.resolve()
      return inflight[source] = run(source).finally(() => { delete inflight[source] })
    },
    setHexSource(hexSource: HexSource) {
      if (hexSource === state.hexSource) return
      state = { ...state, hexSource }
      emit()
    },
  }
}

export const analyticsData = createAnalyticsData()
