import { loadHistoricalReactions, loadRecentReactions, type HistoryResult, type RecentResult } from '../services/disasterMarkets'
import { usePolling } from './usePolling'

const RECENT_MS = 30 * 60_000

/** Recent alerts refresh with the GDACS feed; the 2009-onward history loads once per session. */
export function useDisasterMarkets() {
  const recent = usePolling<RecentResult | null>(loadRecentReactions, { initial: null, intervalMs: RECENT_MS, globalReload: true })
  const history = usePolling<HistoryResult | null>(() => loadHistoricalReactions(), { initial: null })
  return { recent, history }
}
