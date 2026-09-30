/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fetchOutageEvents, type OutageEvent } from '../../services/outages'
import { onGlobalReload } from '../../utils/reloadBus'

// ── Outages panel ──────────────────────────────────────────────────────────────
const OUTAGE_TABS = ['All', 'Country', 'ASN', 'Region'] as const

type OutageTab = typeof OUTAGE_TABS[number]

const LOOKBACK_OPTIONS = [
  { label: '6h',  hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
]

export function outageScoreColor(score: number): string {
  if (score >= 500) return 'var(--red)'
  if (score >= 200) return 'var(--amber)'
  if (score >= 50)  return 'var(--amber)'
  return 'var(--accent)'
}

function formatDuration(secs: number): string {
  if (secs < 60)   return `${secs}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  return `${(secs / 3600).toFixed(1)}h`
}

function formatOutageTime(epoch: number): string {
  if (!epoch) return ''
  try { return formatDistanceToNow(new Date(epoch * 1000), { addSuffix: true }) } catch { return '' }
}

export function OutagesPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const [tab, setTab]             = useState<OutageTab>('All')
  const [lookback, setLookback]   = useState(24)
  const [events, setEvents]       = useState<OutageEvent[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOutageEvents(lookback)
      setEvents(data)
      setLastFetch(Date.now())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [lookback])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = window.setInterval(load, 5 * 60_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(t); unsub() }
  }, [load])

  const filtered = tab === 'All'
    ? events
    : events.filter(e => {
        if (tab === 'Country') return e.entityType === 'country'
        if (tab === 'ASN')     return e.entityType === 'asn'
        if (tab === 'Region')  return e.entityType === 'region'
        return true
      })

  return (
    <>
      {/* Lookback + refresh row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {LOOKBACK_OPTIONS.map(o => (
          <button key={o.label} onClick={() => setLookback(o.hours)}
            className={`news-tab ${lookback === o.hours ? 'active' : ''}`}>
            {o.label}
          </button>
        ))}
        <button onClick={load} disabled={loading} title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', opacity: loading ? 0.3 : 1, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Type filter tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>
        {OUTAGE_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`news-tab ${tab === t ? 'active' : ''}`}>
            {t.toUpperCase()}
          </button>
        ))}
        {lastFetch && (
          <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text3)', alignSelf: 'center', letterSpacing: '.06em' }}>
            {formatDistanceToNow(new Date(lastFetch), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && events.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// QUERYING IODA…</div>
        )}
        {!loading && error && (
          <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--red)66', letterSpacing: '.08em' }}>// {error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO OUTAGES DETECTED</div>
        )}
        {filtered.map(ev => (
          <div
            key={ev.id}
            className="intel-row"
            style={{ alignItems: 'flex-start', cursor: onGeoSearch ? 'pointer' : 'default' }}
            title={onGeoSearch ? `Fly to ${ev.entityName}` : undefined}
            onClick={() => onGeoSearch?.(ev.entityName)}
          >
            <div style={{
              width: 2, alignSelf: 'stretch', flexShrink: 0,
              background: outageScoreColor(ev.score),
              boxShadow: `0 0 4px ${outageScoreColor(ev.score)}66`,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                {ev.entityName}
              </div>
              <div style={{ display: 'flex', gap: 5, fontSize: '10px', color: 'var(--text3)', marginTop: 1, flexWrap: 'wrap' }}>
                <span style={{
                  color: outageScoreColor(ev.score),
                  border: `1px solid ${outageScoreColor(ev.score)}44`,
                  padding: '0 3px', fontWeight: 700, letterSpacing: '.08em',
                  textTransform: 'uppercase', fontSize: '9.5px',
                }}>
                  {ev.score >= 500 ? 'CRITICAL' : ev.score >= 200 ? 'MAJOR' : ev.score >= 50 ? 'MODERATE' : 'MINOR'}
                </span>
                <span style={{ color: 'var(--text3)', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '.06em' }}>{ev.entityType}</span>
                {ev.duration > 0 && (
                  <span style={{ color: 'var(--text3)' }}>⏱ {formatDuration(ev.duration)}</span>
                )}
                {ev.start > 0 && (
                  <span style={{ color: 'var(--text3)' }}>{formatOutageTime(ev.start)}</span>
                )}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: 4 }}>
              <div style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color: outageScoreColor(ev.score), fontWeight: 700 }}>
                {ev.score}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text3)' }}>score</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
