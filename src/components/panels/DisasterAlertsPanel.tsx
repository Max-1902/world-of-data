import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useDisasterAlerts } from '../../hooks/useDisasterAlerts'
import { DISASTER_LABELS, type DisasterType } from '../../services/gdacs'

const WINDOWS = [{ label: '7D', days: 7 }, { label: '14D', days: 14 }, { label: '30D', days: 30 }]
const ALERT_COLOR = { Red: 'var(--red)', Orange: 'var(--amber)' } as const

const fmt = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10)
}

export function DisasterAlertsPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const [days, setDays] = useState(14)
  const [type, setType] = useState<DisasterType | 'ALL'>('ALL')
  const { alerts, loading, lastUpdated, refresh } = useDisasterAlerts(days)
  const shown = type === 'ALL' ? alerts : alerts.filter(a => a.type === type)
  const present = (Object.keys(DISASTER_LABELS) as DisasterType[]).filter(t => alerts.some(a => a.type === t))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {WINDOWS.map(w => (
          <button key={w.label} onClick={() => setDays(w.days)} className={`news-tab ${days === w.days ? 'active' : ''}`}>{w.label}</button>
        ))}
        <button onClick={refresh} disabled={loading} title="Refresh" aria-label="Refresh disaster alerts"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', opacity: loading ? 0.3 : 1, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {present.length > 1 && (
        <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {(['ALL', ...present] as const).map(t => (
            <button key={t} onClick={() => setType(t)} className={`news-tab ${type === t ? 'active' : ''}`}>
              {t === 'ALL' ? 'ALL' : DISASTER_LABELS[t].toUpperCase()}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && alerts.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: 11.5, color: 'var(--text3)' }}>Querying GDACS…</div>
        )}
        {!loading && alerts.length === 0 && (
          <div style={{ padding: '10px', fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
            No Orange/Red alerts returned for this window — or GDACS could not be reached (see Data health in the top bar).
          </div>
        )}
        {shown.map(a => (
          <div key={a.id} className="intel-row" style={{ alignItems: 'flex-start', gap: 8, padding: '6px 10px', cursor: onGeoSearch ? 'pointer' : 'default' }}
            onClick={() => onGeoSearch?.(`${a.latitude}, ${a.longitude}`)}>
            <span aria-label={`${a.alert} alert`} style={{ width: 7, height: 7, borderRadius: '50%', background: ALERT_COLOR[a.alert], marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text1)', lineHeight: 1.4 }}>{a.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                <span style={{ color: ALERT_COLOR[a.alert], fontWeight: 700 }}>{a.alert.toUpperCase()}</span>
                {' · '}{DISASTER_LABELS[a.type]}
                {fmt(a.from) && ` · ${fmt(a.from)} → ${fmt(a.to)}`}
              </div>
            </div>
            {a.reportUrl && (
              <a href={a.reportUrl} target="_blank" rel="noopener noreferrer" title="GDACS report" aria-label={`GDACS report: ${a.name}`}
                onClick={e => e.stopPropagation()} style={{ color: 'var(--text3)', display: 'flex', marginTop: 2 }}>
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '3px 10px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)' }}>
        GDACS (EU JRC / UN OCHA) · Orange &amp; Red alerts only
        {lastUpdated && ` · ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`}
      </div>
    </>
  )
}
