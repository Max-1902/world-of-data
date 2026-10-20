import { fetchDisasterAlerts, type DisasterAlert } from '../services/gdacs'
import { usePolling } from './usePolling'

const REFRESH_MS = 15 * 60_000

export function useDisasterAlerts(days = 14) {
  const { data: alerts, loading, lastUpdated, refresh } = usePolling<DisasterAlert[]>(
    () => fetchDisasterAlerts(days), { initial: [], intervalMs: REFRESH_MS, key: days, globalReload: true },
  )
  // fetchDisasterAlerts returns [] on failure, so an empty list doesn't count as an update
  return { alerts, loading, lastUpdated: alerts.length ? lastUpdated?.getTime() ?? null : null, refresh }
}
