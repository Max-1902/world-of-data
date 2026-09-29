import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWildfires, type FirePoint } from '../services/wildfires'

const REFRESH_MS = 10 * 60_000 // 10 min — FIRMS updates every ~10 min

export function useWildfires(enabled: boolean) {
  const [fires, setFires]     = useState<FirePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWildfires()
      if (!cancelledRef.current) setFires(data)
    } catch (e) {
      if (!cancelledRef.current) setError(String(e))
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) { setFires([]); return }
    cancelledRef.current = false
    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => { cancelledRef.current = true; clearInterval(t) }
  }, [enabled, load])

  return { fires, loading, error, refresh: load }
}
