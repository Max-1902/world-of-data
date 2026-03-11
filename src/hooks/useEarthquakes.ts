import { useState, useEffect } from 'react'
import { fetchEarthquakes, type Earthquake } from '../services/earthquakes'

export function useEarthquakes(enabled: boolean) {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) { setEarthquakes([]); return }
    setLoading(true)
    fetchEarthquakes('week', '4.5').then((data) => {
      setEarthquakes(data)
      setLoading(false)
    })
    const t = window.setInterval(() => {
      fetchEarthquakes('week', '4.5').then(setEarthquakes)
    }, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [enabled])

  return { earthquakes, loading }
}
