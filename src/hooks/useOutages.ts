import { fetchOutageEvents, type OutageEvent } from '../services/outages'
import { usePolling } from './usePolling'

const REFRESH_MS = 5 * 60_000

export function useOutages(enabled: boolean) {
  const { data: outages, loading, error, refresh } = usePolling<OutageEvent[]>(fetchOutageEvents, { initial: [], intervalMs: REFRESH_MS, enabled })
  return { outages, loading, error, refresh }
}
