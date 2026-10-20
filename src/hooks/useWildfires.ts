import { fetchWildfires, type FirePoint } from '../services/wildfires'
import { usePolling } from './usePolling'

const REFRESH_MS = 10 * 60_000 // FIRMS updates roughly every 10 min

export function useWildfires(enabled: boolean) {
  const { data: fires, loading, error, refresh } = usePolling<FirePoint[]>(fetchWildfires, { initial: [], intervalMs: REFRESH_MS, enabled })
  return { fires, loading, error, refresh }
}
