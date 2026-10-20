import { fetchGfwAll, type GfwEvent } from '../services/gfw'
import { usePolling } from './usePolling'

// GFW processes AIS in daily batches; polling faster than hourly only spends the token's quota.
const REFRESH_MS = 60 * 60_000

/** AIS-off and encounter events (last 30 days) for the map layer; only the datasets that loaded. */
export function useGfwEvents(enabled: boolean) {
  const { data, loading, error, refresh } = usePolling<GfwEvent[]>(async () => {
    const { gaps, encounters } = await fetchGfwAll(30)
    return [gaps, encounters].flatMap(r => (r.status === 'ok' ? r.events : []))
  }, { initial: [], intervalMs: REFRESH_MS, enabled })
  return { gfwEvents: data, loading, error, refresh }
}
