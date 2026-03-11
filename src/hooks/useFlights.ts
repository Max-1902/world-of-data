import { useState, useEffect, useRef } from 'react'
import { fetchFlights } from '../services/opensky'
import type { Flight } from '../types'

const REFRESH_INTERVAL = 15_000 // 15 s — OpenSky asks polite clients to not go below 10 s

export function useFlights(enabled: boolean) {
  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const timerRef = useRef<number | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFlights()
      setFlights(data)
      setLastUpdated(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled) {
      setFlights([])
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    load()
    timerRef.current = window.setInterval(load, REFRESH_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [enabled])

  return { flights, loading, error, lastUpdated, refresh: load }
}
