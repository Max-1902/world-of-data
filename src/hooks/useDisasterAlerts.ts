import { useState, useEffect, useCallback } from 'react'
import { fetchDisasterAlerts, type DisasterAlert } from '../services/gdacs'
import { onGlobalReload } from '../utils/reloadBus'

const REFRESH_MS = 15 * 60 * 1000

export function useDisasterAlerts(days = 14) {
  const [alerts, setAlerts] = useState<DisasterAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchDisasterAlerts(days)
    setAlerts(data)
    if (data.length > 0) setLastUpdated(Date.now())
    setLoading(false)
  }, [days])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(timer); unsub() }
  }, [load])

  return { alerts, loading, lastUpdated, refresh: load }
}
