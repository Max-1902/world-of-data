import { fetchFlights } from '../services/opensky'
import type { Flight } from '../types'
import { usePolling } from './usePolling'

const REFRESH_MS = 15_000 // OpenSky asks polite clients not to go below 10 s

// fetchFlights returns [] on any failure, so treat that as an error and keep the last good snapshot
async function fetchNonEmpty(): Promise<Flight[]> {
  const data = await fetchFlights()
  if (data.length === 0) throw new Error('No flight data returned')
  return data
}

export function useFlights(enabled: boolean) {
  const { data: flights, loading, error, lastUpdated, refresh } = usePolling<Flight[]>(fetchNonEmpty, { initial: [], intervalMs: REFRESH_MS, enabled })
  return { flights, loading, error, lastUpdated, refresh }
}
