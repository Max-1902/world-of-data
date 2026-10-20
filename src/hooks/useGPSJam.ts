import { fetchGPSJam, type GPSJamData } from '../services/gpsjam'
import { usePolling } from './usePolling'

const REFRESH_MS = 60 * 60_000 // upstream publishes one file per UTC day; hourly is plenty

export function useGPSJam(enabled: boolean) {
  const { data, loading, error, refresh } = usePolling<GPSJamData | null>(fetchGPSJam, { initial: null, intervalMs: REFRESH_MS, enabled })
  return { data, loading, error, refresh }
}
