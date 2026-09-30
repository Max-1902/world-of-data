import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { CrisisEvent, Flight, NewsArticle } from '../types'
import { watchStore, type WatchAlert } from '../services/watchlist'
import { computeTrajectories } from '../utils/trajectory'

export function useWatchlist() {
  return useSyncExternalStore(watchStore.subscribe, watchStore.getState)
}

function notifyBrowser(alerts: WatchAlert[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  for (const a of alerts.slice(0, 3)) {
    try { new Notification(`${a.country}: ${a.kind === 'trend' ? 'activity rising' : 'new event'}`, { body: a.title, tag: a.id }) } catch {}
  }
}

/** Mounted once in App: re-checks the watchlist whenever the live data changes. */
export function useWatchEvaluator(crises: CrisisEvent[], flights: Flight[], articles: NewsArticle[]) {
  // flights/articles only feed the trajectory's secondary signals; don't re-evaluate on every 15s flight poll
  const latest = useRef({ flights, articles })
  latest.current = { flights, articles }

  useEffect(() => {
    if (crises.length === 0) return
    const trajectories = computeTrajectories(crises, latest.current.flights, 200, latest.current.articles)
    const fresh = watchStore.evaluate(crises, trajectories)
    if (fresh.length > 0 && watchStore.getState().notify) notifyBrowser(fresh)
  }, [crises])
}
