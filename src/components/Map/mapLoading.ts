import { useSyncExternalStore } from 'react'

/**
 * Counts map-layer fetches in flight so MapView can show a loading overlay when a retrieval runs long.
 * Layers wrap their own requests in `trackMapLoad`; the count drops whether the request resolves or rejects.
 */
let pending = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function trackMapLoad<T>(p: Promise<T>): Promise<T> {
  pending++
  emit()
  return p.finally(() => { pending--; emit() })
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** True while any tracked map-layer fetch is in flight. */
export function useMapLoadPending(): boolean {
  return useSyncExternalStore(subscribe, () => pending > 0)
}
