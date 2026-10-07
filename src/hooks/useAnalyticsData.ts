import { useEffect, useSyncExternalStore } from 'react'
import { analyticsData, type HexSource } from '../services/analyticsData'

/**
 * The shared earthquake + wildfire analytics data. Pass the feeds you need loaded (and kept fresh); every caller
 * sees the same snapshot, so two components asking for the same feed share one request.
 */
export function useAnalyticsData(want: Partial<Record<HexSource, boolean>>) {
  const state = useSyncExternalStore(analyticsData.subscribe, analyticsData.getState)
  const quakes = !!want.quakes, fires = !!want.fires
  useEffect(() => {
    if (!quakes && !fires) return
    const load = () => { if (quakes) void analyticsData.load('quakes'); if (fires) void analyticsData.load('fires') }
    load()
    const timer = window.setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [quakes, fires])
  return {
    ...state,
    reload: (source: HexSource) => analyticsData.load(source, true),
    setHexSource: analyticsData.setHexSource,
  }
}
