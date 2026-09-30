import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchOutageEvents, type OutageEvent } from '../services/outages'

const REFRESH_MS = 5 * 60_000 // 5 min

export function useOutages(enabled: boolean) {
  const [outages, setOutages] = useState<OutageEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOutageEvents()
      if (!cancelledRef.current) setOutages(data)
    } catch (e) {
      if (!cancelledRef.current) setError(String(e))
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) { setOutages([]); return }
    cancelledRef.current = false
    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => { cancelledRef.current = true; clearInterval(t) }
  }, [enabled, load])

  return { outages, loading, error, refresh: load }
}
