import { useEffect, useSyncExternalStore } from 'react'
import { conflictHistory } from '../services/conflictHistory'

/** The shared 75-day ACLED history. Pass `enabled` to start (and keep fresh) the load; every caller sees the same snapshot. */
export function useConflictHistory(enabled: boolean) {
  const state = useSyncExternalStore(conflictHistory.subscribe, conflictHistory.getState)
  useEffect(() => {
    if (!enabled) return
    void conflictHistory.load()
    const timer = window.setInterval(() => { void conflictHistory.load() }, 10 * 60 * 1000)
    return () => clearInterval(timer)
  }, [enabled])
  return { ...state, reload: () => conflictHistory.load(true), setMapMode: conflictHistory.setMapMode }
}
