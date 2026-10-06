import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchGPSJam, type GPSJamData } from '../services/gpsjam'

const REFRESH_MS = 60 * 60_000 // upstream publishes one file per UTC day; hourly is plenty

export function useGPSJam(enabled: boolean) {
  const [data, setData]       = useState<GPSJamData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const next = await fetchGPSJam()
      if (!cancelledRef.current) setData(next)
    } catch (e) {
      if (!cancelledRef.current) setError(String(e))
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) { setData(null); return }
    cancelledRef.current = false
    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => { cancelledRef.current = true; clearInterval(t) }
  }, [enabled, load])

  return { data, loading, error, refresh: load }
}
