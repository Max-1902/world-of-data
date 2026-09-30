import { useState } from 'react'
import { Bell, BellOff, Trash2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { watchStore } from '../../services/watchlist'
import { useWatchlist } from '../../hooks/useWatchlist'
import type { CrisisEvent } from '../../types'

const SEV_COLOR = { critical: 'var(--red)', high: 'var(--red)', medium: 'var(--amber)', low: 'var(--text3)' } as const

export function WatchlistPanel({ crises, onCountryClick }: { crises: CrisisEvent[]; onCountryClick?: (country: string) => void }) {
  const { countries, alerts, notify } = useWatchlist()
  const [draft, setDraft] = useState('')
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const known = [...new Set(crises.map(c => c.country).filter(Boolean))].sort()
  const unread = alerts.filter(a => !a.read).length

  function add() {
    if (!draft.trim()) return
    watchStore.add(draft)
    setDraft('')
  }

  async function toggleNotify() {
    if (notify) return watchStore.setNotify(false)
    if (typeof Notification === 'undefined') return
    // Permission is requested only from this explicit click.
    const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    setPermission(result)
    watchStore.setNotify(result === 'granted')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }} onMouseEnter={() => unread > 0 && watchStore.markAllRead()}>
      <form onSubmit={e => { e.preventDefault(); add() }} style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          list="watch-countries" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a country to watch…"
          aria-label="Country to watch"
          style={{ flex: 1, minWidth: 0, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: 11, color: 'var(--text1)', outline: 'none' }}
        />
        <datalist id="watch-countries">{known.map(c => <option key={c} value={c} />)}</datalist>
        <button type="submit" className="cy-btn" disabled={!draft.trim()}>Watch</button>
      </form>

      <div style={{ padding: '6px 8px', display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        {countries.length === 0 && (
          <span style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.5 }}>
            Nothing watched yet. Add a country here, or click the star in any country's detail drawer. You'll be alerted to new high-severity events and rising trends.
          </span>
        )}
        {countries.map(c => (
          <span key={c} className="watch-chip">
            <button onClick={() => onCountryClick?.(c)} className="watch-chip-name">{c}</button>
            <button onClick={() => watchStore.remove(c)} aria-label={`Stop watching ${c}`} className="watch-chip-x"><X size={10} /></button>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={toggleNotify} disabled={permission === 'unsupported' || permission === 'denied'} className="cy-btn"
          title={permission === 'denied' ? 'Notifications are blocked in your browser settings' : 'Show a desktop notification for new alerts while the app is open'}>
          {notify ? <Bell size={11} /> : <BellOff size={11} />}
          {notify ? 'Notifications on' : 'Notifications off'}
        </button>
        {alerts.length > 0 && (
          <button onClick={() => watchStore.clearAlerts()} className="cy-btn" style={{ marginLeft: 'auto' }}>
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>

      {alerts.length === 0 && countries.length > 0 && (
        <div style={{ padding: '10px', fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.5 }}>
          No alerts yet. Alerts are raised from live feeds only while this app is open; events that arrive while it's closed alert on your next visit.
        </div>
      )}
      {alerts.map(a => (
        <div key={a.id} className="intel-row" onClick={() => onCountryClick?.(a.country)}
          style={{ alignItems: 'flex-start', gap: 8, padding: '6px 10px', cursor: onCountryClick ? 'pointer' : 'default' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEV_COLOR[a.severity], marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text1)', lineHeight: 1.4 }}>{a.title}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              {a.country} · {a.detail} · {formatDistanceToNow(a.t, { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
