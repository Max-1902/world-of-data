import CloseButton from './CloseButton'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { formatDistanceToNow } from 'date-fns'
import { healthTracker, installFetchObserver, type HealthStatus } from '../services/sourceHealth'

const STATUS_COLOR: Record<HealthStatus, string> = { ok: 'var(--green)', degraded: 'var(--amber)', down: 'var(--red)' }
const STATUS_TEXT: Record<HealthStatus, string> = { ok: 'OK', degraded: 'INTERMITTENT', down: 'DOWN' }

/** TopBar button + popover listing every data source the app has actually contacted this session. */
export default function SourceHealth() {
  const sources = useSyncExternalStore(healthTracker.subscribe, healthTracker.getAll)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })

  function toggle() {
    // The TopBar clips overflow, so the popover is portalled to <body> and positioned from the button.
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    setOpen(o => !o)
  }

  // Installed from a child effect so it is in place before App's hooks issue their first requests.
  useEffect(() => installFetchObserver(), [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const worst: HealthStatus = sources.some(s => s.status === 'down') ? 'down' : sources.some(s => s.status === 'degraded') ? 'degraded' : 'ok'
  const bad = sources.filter(s => s.status !== 'ok').length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="cy-btn"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Data source health"
      >
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: sources.length ? STATUS_COLOR[worst] : 'var(--text3)', display: 'inline-block' }} />
        {bad > 0 ? `${bad} issue${bad === 1 ? '' : 's'}` : 'Data'}
      </button>
      {open && createPortal(
        <div ref={popRef} className="source-health-pop" role="dialog" aria-label="Data source health" style={{ top: pos.top, right: pos.right }}>
          <CloseButton corner onClick={() => setOpen(false)} label="Close data source health" style={{ top: 4, right: 6 }} />
          <div className="source-health-head">DATA SOURCES · THIS SESSION</div>
          {sources.length === 0 && <div className="source-health-empty">No requests observed yet.</div>}
          {sources.map(s => (
            <div key={s.id} className="source-health-row">
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s.status], flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="source-health-name">{s.label}</div>
                <div className="source-health-meta">
                  {s.lastOk ? `last OK ${formatDistanceToNow(s.lastOk, { addSuffix: true })}` : 'never succeeded'}
                  {s.status !== 'ok' && s.lastError ? ` · ${s.lastError}` : ''}
                </div>
              </div>
              <span className="source-health-state" style={{ color: STATUS_COLOR[s.status] }}>{STATUS_TEXT[s.status]} {s.okCount}/{s.attempts}</span>
            </div>
          ))}
          <div className="source-health-foot">Based on this browser's recent requests. A source only appears once its layer or panel has loaded.</div>
        </div>,
        document.body,
      )}
    </div>
  )
}
