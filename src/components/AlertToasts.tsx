import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { watchStore, type WatchAlert } from '../services/watchlist'
import { useWatchlist } from '../hooks/useWatchlist'

const TOAST_MS = 10_000
const MAX_TOASTS = 3

/** Transient toasts for alerts raised while the app is open. Persisted history lives in the Watchlist panel. */
export default function AlertToasts({ onSelectCountry }: { onSelectCountry: (country: string) => void }) {
  const { alerts } = useWatchlist()
  const [toasts, setToasts] = useState<WatchAlert[]>([])
  // Alerts already present at mount are history, not news.
  const shown = useRef<Set<string>>(new Set(alerts.map(a => a.id)))

  useEffect(() => {
    const fresh = alerts.filter(a => !shown.current.has(a.id))
    if (fresh.length === 0) return
    fresh.forEach(a => shown.current.add(a.id))
    setToasts(prev => [...fresh, ...prev].slice(0, MAX_TOASTS))
    const ids = new Set(fresh.map(a => a.id))
    const timer = window.setTimeout(() => setToasts(prev => prev.filter(t => !ids.has(t.id))), TOAST_MS)
    return () => clearTimeout(timer)
  }, [alerts])

  if (toasts.length === 0) return null
  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <div className="alert-toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`alert-toast ${t.severity}`}>
          <button className="alert-toast-body" onClick={() => { watchStore.markAllRead(); dismiss(t.id); onSelectCountry(t.country) }}>
            <span className="alert-toast-eyebrow">{t.country.toUpperCase()} · {t.kind === 'trend' ? 'RISING' : 'NEW EVENT'}</span>
            <span className="alert-toast-title">{t.title}</span>
            <span className="alert-toast-detail">{t.detail}</span>
          </button>
          <button className="alert-toast-x" aria-label="Dismiss alert" onClick={() => dismiss(t.id)}><X size={12} /></button>
        </div>
      ))}
    </div>
  )
}
