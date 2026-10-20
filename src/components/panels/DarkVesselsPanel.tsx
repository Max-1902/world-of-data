/**
 * Dark vessels & encounters at sea (Global Fishing Watch). Wired up in src/panels/registry.tsx.
 * Counts and flag rankings are computed here from the events GFW returned; nothing is estimated.
 */
import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fetchGfwEvents, GFW_ATTRIBUTION, GFW_PAGE, type GfwDays, type GfwEvent, type GfwKind, type GfwResult } from '../../services/gfw'
import { usePolling } from '../../hooks/usePolling'
import { tint } from './OutagesPanel'

const TABS: { id: GfwKind | 'risk'; label: string }[] = [
  { id: 'gaps', label: 'AIS OFF' },
  { id: 'encounters', label: 'ENCOUNTERS' },
  { id: 'risk', label: 'FLAGGED' },
]
const DAYS: GfwDays[] = [7, 30, 90]
const MAX_ROWS = 150

const ago = (ms: number) => { try { return formatDistanceToNow(new Date(ms), { addSuffix: true }) } catch { return '' } }
const note = (text: string, color = 'var(--text3)') => (
  <div style={{ padding: '8px 10px', fontSize: '11.5px', color, letterSpacing: '.08em', lineHeight: 1.5 }}>{text}</div>
)

/** Panel colour, the same meaning as the map pins, via the theme tokens. */
export function gfwPanelColor(e: GfwEvent): string {
  return e.kind === 'gaps' ? 'var(--accent)' : e.potentialRisk ? 'var(--red)' : 'var(--amber)'
}

/** Most frequent vessel flags among the events (ISO3 as GFW reports them). Exported for tests. */
export function topFlags(events: GfwEvent[], n = 5): { flag: string; count: number }[] {
  const by = new Map<string, number>()
  for (const e of events) if (e.vessel.flag) by.set(e.vessel.flag, (by.get(e.vessel.flag) ?? 0) + 1)
  return [...by].map(([flag, count]) => ({ flag, count })).sort((a, b) => b.count - a.count || a.flag.localeCompare(b.flag)).slice(0, n)
}

export function DarkVesselsPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const [tab, setTab] = useState<GfwKind | 'risk'>('gaps')
  const [days, setDays] = useState<GfwDays>(30)
  const kind: GfwKind = tab === 'gaps' ? 'gaps' : 'encounters'
  const { data, loading, refresh } = usePolling<GfwResult | null>(
    () => fetchGfwEvents(kind, days), { initial: null, intervalMs: 60 * 60_000, key: `${kind}:${days}`, globalReload: true },
  )
  const all = data?.status === 'ok' ? data.events : []
  const events = tab === 'risk' ? all.filter(e => e.potentialRisk) : all
  const flags = useMemo(() => topFlags(events), [events])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`news-tab ${tab === t.id ? 'active' : ''}`}>{t.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => setDays(d)} className={`news-tab ${days === d ? 'active' : ''}`}>{d}d</button>
          ))}
        </span>
        <button onClick={refresh} disabled={loading} title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', opacity: loading ? 0.3 : 1, display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div style={{ padding: '4px 8px', fontSize: '9.5px', color: 'var(--text3)', lineHeight: 1.45, borderBottom: '1px solid var(--border)' }}>
        {tab === 'gaps'
          ? 'Vessels that stopped broadcasting AIS for 12 h or more, at least 50 nm from shore. GFW classes these as likely intentional. That is a model output, not proof of wrongdoing.'
          : tab === 'encounters'
            ? 'Two vessels meeting at sea, often a fishing vessel and a carrier (possible transshipment).'
            : 'Encounters GFW flags as potential risk: on the high seas or in an RFMO area, a vessel has no matching public authorisation. GFW does not check encounters inside EEZs.'}
        {' '}<a href={GFW_ATTRIBUTION.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{GFW_ATTRIBUTION.text}</a>
      </div>

      {data?.status === 'ok' && (
        <div style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--text2)', borderBottom: '1px solid var(--border)', lineHeight: 1.5 }}>
          <b style={{ color: 'var(--text1)' }}>{events.length.toLocaleString('en-US')}</b> {tab === 'gaps' ? 'AIS-off events' : tab === 'risk' ? 'flagged encounters' : 'encounters'} in the last {days} days
          {data.newest !== null && <> · newest in GFW's data {ago(data.newest)}</>}
          {data.capped && <div style={{ color: 'var(--amber)' }}>Only the first {GFW_PAGE.toLocaleString('en-US')}{data.total !== null ? ` of ${data.total.toLocaleString('en-US')}` : ''} events are loaded, so these counts are a sample, not totals.</div>}
          {flags.length > 0 && <div style={{ color: 'var(--text3)' }}>Most common flags: {flags.map(f => `${f.flag} ${f.count}`).join(' · ')}</div>}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!data && note('// QUERYING GLOBAL FISHING WATCH…')}
        {data?.status === 'not_configured' && note('// GLOBAL FISHING WATCH NOT CONFIGURED: set GFW_TOKEN (free, non-commercial token from globalfishingwatch.org/our-apis/tokens) in .env or the deployment settings.')}
        {data?.status === 'error' && note(`// ${data.message}`, 'var(--red)')}
        {data?.status === 'ok' && events.length === 0 && note(`// NO ${tab === 'risk' ? 'FLAGGED ENCOUNTERS' : 'EVENTS'} IN THIS WINDOW`)}
        {events.slice(0, MAX_ROWS).map(e => {
          const color = gfwPanelColor(e)
          return (
            <div key={e.id} className="intel-row" style={{ alignItems: 'flex-start', cursor: onGeoSearch ? 'pointer' : 'default' }}
              title={onGeoSearch ? 'Fly to where it happened' : undefined}
              onClick={() => onGeoSearch?.(`${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}`)}>
              <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                  {e.vessel.name || 'Unnamed vessel'}
                  {e.other && <span style={{ color: 'var(--text3)' }}> ↔ {e.other.name || 'unnamed'}</span>}
                </div>
                <div style={{ display: 'flex', gap: 5, fontSize: '10px', color: 'var(--text3)', marginTop: 1, flexWrap: 'wrap' }}>
                  {e.potentialRisk && (
                    <span style={{ color, border: `1px solid ${tint(color)}`, padding: '0 3px', fontWeight: 700, letterSpacing: '.08em', fontSize: '9.5px' }}>POTENTIAL RISK</span>
                  )}
                  {e.vessel.flag && <span>flag {e.vessel.flag}{e.other?.flag ? ` / ${e.other.flag}` : ''}</span>}
                  {e.vessel.type && <span>{e.vessel.type}{e.other?.type ? ` / ${e.other.type}` : ''}</span>}
                  <span>{ago(e.start)}</span>
                  <span>· {e.highSeas ? 'high seas' : 'in an EEZ'}</span>
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: 4 }}>
                <div style={{ fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color, fontWeight: 700 }}>{Math.round(e.durationHours)} h</div>
                <div style={{ fontSize: '9.5px', color: 'var(--text3)' }}>{e.kind === 'gaps' ? 'dark' : 'together'}</div>
              </div>
            </div>
          )
        })}
        {events.length > MAX_ROWS && note(`// ${(events.length - MAX_ROWS).toLocaleString('en-US')} MORE NOT LISTED (ALL ARE ON THE MAP LAYER FOR 30 DAYS)`)}
      </div>
    </>
  )
}
