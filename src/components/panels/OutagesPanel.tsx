/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fetchOutageEvents, SEVERITY_LABEL, OUTAGE_SOURCES, type OutageEvent } from '../../services/outages'
import { onGlobalReload } from '../../utils/reloadBus'

// ── Outages panel ──────────────────────────────────────────────────────────────
const OUTAGE_TABS = ['Ongoing', 'All', 'Country', 'Region', 'ASN'] as const

type OutageTab = typeof OUTAGE_TABS[number]

const LOOKBACK_OPTIONS = [
  { label: '6h',  hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
]

/** Panel colour for an outage — the same severity bands as the map pins, via the theme tokens. */
export function outageColor(ev: OutageEvent): string {
  if (ev.status === 'recovered') return 'var(--text3)'
  return ev.severity === 'severe' ? 'var(--red)' : ev.severity === 'major' ? 'var(--amber)' : 'var(--accent)'
}

/** "SEVERE · ONGOING" / "RECOVERED" */
export function outageBadge(ev: OutageEvent): string {
  return ev.status === 'recovered' ? 'RECOVERED' : `${SEVERITY_LABEL[ev.severity].toUpperCase()} · ONGOING`
}

export const tint = (color: string, pct = 30) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

const ENTITY_LABEL: Record<string, string> = { country: 'country-wide', region: 'region', asn: 'network', geoasn: 'network in region' }

function formatOutageTime(epoch: number): string {
  if (!epoch) return ''
  try { return formatDistanceToNow(new Date(epoch * 1000), { addSuffix: true }) } catch { return '' }
}

export function OutagesPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const [tab, setTab]             = useState<OutageTab>('Ongoing')
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
        if (tab === 'Ongoing') return e.status === 'ongoing'
        if (tab === 'Country') return e.entityType === 'country'
        if (tab === 'ASN')     return e.entityType === 'asn' || e.entityType === 'geoasn'
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

      <div style={{ padding: '4px 8px', fontSize: '9.5px', color: 'var(--text3)', lineHeight: 1.45, borderBottom: '1px solid var(--border)' }}>
        % = how far the signal fell below IODA's normal level. Severe ≥ 50 %, major 20–49 %, minor &lt; 20 % (this app's bands).
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
        {filtered.map(ev => {
          const color = outageColor(ev)
          const live = ev.signals.filter(x => x.level === 'critical').map(x => OUTAGE_SOURCES[x.source]?.label ?? x.source)
          return (
          <div
            key={ev.id}
            className="intel-row"
            style={{ alignItems: 'flex-start', cursor: onGeoSearch ? 'pointer' : 'default' }}
            title={onGeoSearch ? `Fly to ${ev.location?.label ?? ev.entityName}` : undefined}
            onClick={() => onGeoSearch?.(ev.location?.precision === 'region' ? ev.location.label : ev.entityName)}
          >
            <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: color }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                {ev.entityName}
              </div>
              {ev.org && <div style={{ fontSize: '10px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.org}</div>}
              <div style={{ display: 'flex', gap: 5, fontSize: '10px', color: 'var(--text3)', marginTop: 1, flexWrap: 'wrap' }}>
                <span style={{
                  color, border: `1px solid ${tint(color)}`,
                  padding: '0 3px', fontWeight: 700, letterSpacing: '.08em', fontSize: '9.5px',
                }}>
                  {outageBadge(ev)}
                </span>
                <span style={{ fontSize: '9.5px', letterSpacing: '.06em' }}>{ENTITY_LABEL[ev.entityType] ?? ev.entityType}</span>
                {ev.start > 0 && <span>began {formatOutageTime(ev.start)}</span>}
                {ev.status === 'recovered' && ev.lastAlert > 0 && <span>· recovered {formatOutageTime(ev.lastAlert)}</span>}
                {!ev.location && <span title="IODA gives no location for this network, so it is not on the map">· not mapped</span>}
              </div>
              {live.length > 0 && <div style={{ fontSize: '9.5px', color: 'var(--text3)', marginTop: 1 }}>seen in: {live.join(', ')}</div>}
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: 4 }}>
              <div style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color, fontWeight: 700 }}>
                −{ev.dropPct}%
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text3)' }}>vs normal</div>
            </div>
          </div>
          )
        })}
      </div>
    </>
  )
}
