import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ConflictFeed, CrisisEvent, NewsArticle } from '../types'
import { watchStore, type WatchAlert } from '../services/watchlist'
import { conflictTrajectories } from '../utils/monthlyTrajectory'

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
export function useWatchEvaluator(crises: CrisisEvent[], feed: ConflictFeed, articles: NewsArticle[]) {
  // articles only attach context to trend entries; don't re-evaluate on every news refresh
  const latest = useRef({ feed, articles })
  latest.current = { feed, articles }

  useEffect(() => {
    if (crises.length === 0) return
    const { feed: f, articles: a } = latest.current
    const trajectories = conflictTrajectories(crises, f, { limit: 200, articles: a })
    const fresh = watchStore.evaluate(crises, trajectories)
    if (fresh.length > 0 && watchStore.getState().notify) notifyBrowser(fresh)
  }, [crises])
}
