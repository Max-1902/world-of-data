import { useState, useEffect } from 'react'
import { fetchWildfires, type FirePoint } from '../services/wildfires'

const REFRESH_MS = 10 * 60_000 // 10 min — FIRMS updates every ~10 min

export function useWildfires(enabled: boolean) {
  const [fires, setFires]     = useState<FirePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) { setFires([]); return }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchWildfires()
        if (!cancelled) setFires(data)
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [enabled])

  return { fires, loading, error }
}
