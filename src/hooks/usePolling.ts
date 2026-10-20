import { useCallback, useEffect, useRef, useState } from 'react'
import { onGlobalReload } from '../utils/reloadBus'

export interface PollOptions<T> {
  initial: T
  /** Leave out to load once (and on `key` changes) without polling. */
  intervalMs?: number
  enabled?: boolean
  /** Reload straight away when this changes (e.g. a query parameter). */
  key?: string | number
  /** Also reload when the TopBar's global refresh fires. */
  globalReload?: boolean
}

export interface Polled<T> {
  data: T
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

/**
 * Loads `fetcher` now (and every `intervalMs`, if set) while enabled; switching off resets to `initial`.
 * Only the newest request may write state, so a late response can't bring back a disabled layer.
 */
export function usePolling<T>(fetcher: () => Promise<T>, { initial, intervalMs, enabled = true, key, globalReload = false }: PollOptions<T>): Polled<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const initialRef = useRef(initial)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const reqRef = useRef(0)
  const busyRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!enabledRef.current) return
    const id = ++reqRef.current
    busyRef.current = true
    setLoading(true)
    setError(null)
    try {
      const next = await fetcherRef.current()
      if (id === reqRef.current) { setData(next); setLastUpdated(new Date()) }
    } catch (e) {
      if (id === reqRef.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === reqRef.current) { busyRef.current = false; setLoading(false) }
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      reqRef.current++
      busyRef.current = false
      setData(initialRef.current)
      setLoading(false)
      return
    }
    void refresh()
    // skip a tick while the last poll is still running instead of stacking requests
    const timer = intervalMs ? window.setInterval(() => { if (!busyRef.current) void refresh() }, intervalMs) : undefined
    const unsub = globalReload ? onGlobalReload(() => void refresh()) : undefined
    return () => { reqRef.current++; busyRef.current = false; clearInterval(timer); unsub?.() }
  }, [enabled, intervalMs, key, globalReload, refresh])

  return { data, loading, error, lastUpdated, refresh }
}
