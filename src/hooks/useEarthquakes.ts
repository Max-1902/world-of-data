import { useState, useEffect, useCallback } from 'react'
import { fetchEarthquakes, type Earthquake } from '../services/earthquakes'

export function useEarthquakes(enabled: boolean) {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    if (!enabled) return
    setLoading(true)
    return fetchEarthquakes('week', '4.5').then((data) => {
      setEarthquakes(data)
      setLoading(false)
    })
  }, [enabled])

  useEffect(() => {
    if (!enabled) { setEarthquakes([]); return }
    load()
    const t = window.setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [enabled, load])

  return { earthquakes, loading, refresh: load }
}
