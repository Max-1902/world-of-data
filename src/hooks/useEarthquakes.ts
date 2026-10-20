import { fetchEarthquakes, type Earthquake } from '../services/earthquakes'
import { usePolling } from './usePolling'

const REFRESH_MS = 10 * 60_000

const fetchWeek = () => fetchEarthquakes('week', '4.5')

export function useEarthquakes(enabled: boolean) {
  const { data: earthquakes, loading, refresh } = usePolling<Earthquake[]>(fetchWeek, { initial: [], intervalMs: REFRESH_MS, enabled })
  return { earthquakes, loading, refresh }
}
