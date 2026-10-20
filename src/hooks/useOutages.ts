import { useCallback } from 'react'
import { fetchOutageEvents, type OutageEvent } from '../services/outages'
import { fetchRadarOutages, type RadarOutage } from '../services/radarOutages'
import { usePolling } from './usePolling'

const REFRESH_MS = 5 * 60_000
const RADAR_REFRESH_MS = 15 * 60_000

/** IODA alerts (last 24 h) and Cloudflare Radar's confirmed outages (last 7 days; [] when not configured or failing). */
export function useOutages(enabled: boolean) {
  const { data: outages, loading, error, refresh } = usePolling<OutageEvent[]>(fetchOutageEvents, { initial: [], intervalMs: REFRESH_MS, enabled })
  const { data: radarOutages, refresh: refreshRadar } = usePolling<RadarOutage[]>(
    async () => { const r = await fetchRadarOutages('7d'); return r.status === 'ok' ? r.outages : [] },
    { initial: [], intervalMs: RADAR_REFRESH_MS, enabled },
  )
  const refreshBoth = useCallback(() => { refresh(); refreshRadar() }, [refresh, refreshRadar])
  return { outages, radarOutages, loading, error, refresh: refreshBoth }
}
