import { useEffect, useSyncExternalStore } from 'react'
import type { CrisisEvent, Flight } from '../types'
import { history, readLastSeen, trackLastSeen, type Snapshot } from '../services/history'
import { computeThreatScore } from '../utils/threat'

/** Read once at module load, before this session stamps a new value. */
export const PREVIOUS_VISIT: number | null = readLastSeen()

/** Wait for data to settle (feeds arrive at different times) before snapshotting. */
const SETTLE_MS = 20_000

export function useHistory(): Snapshot[] {
  return useSyncExternalStore(history.subscribe, history.getSnapshots)
}

/** Mounted once in App: records snapshots of the app's computed numbers and tracks "last seen". */
export function useHistoryRecorder(crises: CrisisEvent[], flights: Flight[], flightsEnabled: boolean) {
  useEffect(() => { void history.load(); return trackLastSeen() }, [])

  useEffect(() => {
    if (crises.length === 0) return
    const timer = window.setTimeout(() => {
      void history.record({
        crises,
        threat: computeThreatScore(crises, flights),
        flights: flightsEnabled ? flights.length : null,
      })
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [crises, flights, flightsEnabled])
}
