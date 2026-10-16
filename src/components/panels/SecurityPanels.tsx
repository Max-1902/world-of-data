/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { NewsArticle } from '../../types'
import { searchGDELTNews } from '../../services/news'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS, fetchSanctionsNews, type SanctionedCountry } from '../../services/sanctions'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../../services/military'
import { analyzeAirspace, FIR_STATUS_LABEL, type NOTAMAlert, type FIRStatus } from '../../services/notam'
import { onGlobalReload } from '../../utils/reloadBus'
import { ArticleRow } from './NewsPanels'

// ── Drug Trafficking Panel ─────────────────────────────────────────────────────
const DRUG_TABS = [
  { id: 'Global',   q: 'drug trafficking seizure cartel narcotics bust' },
  { id: 'Americas', q: 'cartel cocaine fentanyl smuggling Mexico Colombia' },
  { id: 'Europe',   q: 'drug seizure narcotics trafficking Europe Europol' },
  { id: 'Asia',     q: 'drug trafficking methamphetamine heroin Asia' },
  { id: 'Africa',   q: 'drug trafficking narcotics seizure Africa' },
  { id: 'MENA',     q: 'drug trafficking narcotics Captagon Middle East' },
] as const

type DrugTab = typeof DRUG_TABS[number]['id']

export function DrugTrafficPanel() {
  const [tab, setTab]         = useState<DrugTab>('Global')
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number | null>(null)

  const load = useCallback(async (t: DrugTab) => {
    const entry = DRUG_TABS.find(d => d.id === t)
    if (!entry) return
    setLoading(true); setError(null)
    try {
      // searchGDELTNews goes through our /api/gdelt proxy (GDELT sends no CORS headers, so a direct
      // browser call fails) and handles GDELT's 1-req/5s limit with queueing, caching and a 429 cooldown.
      const mapped = await searchGDELTNews(entry.q)
      setArticles(mapped.map((a, i) => ({ ...a, id: `drug-${t}-${i}` })))
      // searchGDELTNews returns [] when rate-limited/failed — don't stamp that as a live update
      setLastFetch(mapped.length > 0 ? Date.now() : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  // Auto-refresh 30 min
  useEffect(() => {
    const t = window.setInterval(() => load(tab), 30 * 60_000)
    const unsub = onGlobalReload(() => load(tab))
    return () => { clearInterval(t); unsub() }
  }, [tab, load])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {DRUG_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`news-tab ${tab === t.id ? 'active' : ''}`}
            style={tab === t.id ? { color: 'var(--red)', borderColor: 'var(--red)44' } : {}}>
            {t.id.toUpperCase()}
          </button>
        ))}
        <button onClick={() => load(tab)} disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', opacity: loading ? 0.3 : 1, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {lastFetch && (
        <div style={{ padding: '2px 8px', fontSize: '9.5px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 4, height: 4, background: 'var(--red)', borderRadius: '50%', display: 'inline-block' }} />
          LIVE · GDELT · {articles.length} REPORTS · {formatDistanceToNow(new Date(lastFetch), { addSuffix: true })}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && articles.length === 0 && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// QUERYING INTEL…</div>}
        {error && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--red)', letterSpacing: '.1em' }}>// {error.toUpperCase()}</div>}
        {!loading && !error && articles.length === 0 && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO REPORTS</div>}
        {articles.map(a => <ArticleRow key={a.id} a={a} />)}
      </div>
    </>
  )
}

// ── Sanctions Panel ────────────────────────────────────────────────────────────
const SEV_ORDER: SanctionedCountry['severity'][] = ['critical', 'high', 'medium', 'low']

export function SanctionsPanel() {
  const [filter, setFilter] = useState('')
  const [sevFilter, setSevFilter] = useState<string>('all')
  const [news, setNews] = useState<{ title: string; url: string; domain: string; seendate: string }[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState<number | null>(null)
  const q = filter.trim().toLowerCase()
  const rows = SANCTIONED_COUNTRIES
    .filter(c => sevFilter === 'all' || c.severity === sevFilter)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q) || c.regimes.some(r => r.toLowerCase().includes(q)))
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))

  const loadNews = useCallback(() => {
    setNewsLoading(true)
    fetchSanctionsNews(q || undefined)
      .then(articles => { setNews(articles); setLastFetch(Date.now()) })
      .finally(() => setNewsLoading(false))
  }, [q])

  useEffect(() => { loadNews() }, [loadNews])

  // Auto-refresh 30 min
  useEffect(() => {
    const t = window.setInterval(loadNews, 30 * 60_000)
    const unsub = onGlobalReload(loadNews)
    return () => { clearInterval(t); unsub() }
  }, [loadNews])

  return (
    <>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(['all','critical','high','medium','low'] as const).map(s => (
          <button key={s} onClick={() => setSevFilter(s)}
            className={`news-tab ${sevFilter === s ? 'active' : ''}`}
            style={sevFilter === s && s !== 'all' ? { color: s === 'critical' ? 'var(--red)' : s === 'high' ? 'var(--amber)' : s === 'medium' ? 'var(--amber)' : 'var(--blue)', borderColor: `color-mix(in srgb, ${SANCTION_COLORS[s as SanctionedCountry['severity']]} 27%, transparent)` } : {}}>
            {s.toUpperCase()}
          </button>
        ))}
        <button onClick={loadNews} disabled={newsLoading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', opacity: newsLoading ? 0.3 : 1, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={newsLoading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search country, regime…"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 11.5, padding: '2px 6px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      {lastFetch && (
        <div style={{ padding: '2px 8px', fontSize: '9.5px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 4, height: 4, background: 'var(--amber)', borderRadius: '50%', display: 'inline-block' }} />
          LIVE · GDELT · {news.length} REPORTS · {formatDistanceToNow(new Date(lastFetch), { addSuffix: true })}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map(c => {
          const color = SANCTION_COLORS[c.severity]
          return (
            <div key={c.iso2} style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ width: 2, background: color, flexShrink: 0, alignSelf: 'stretch', boxShadow: `0 0 4px ${color}66` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text1)' }}>{c.name}</span>
                  <span style={{ fontSize: '9px', color: color, border: `1px solid ${color}55`, padding: '0 3px', fontWeight: 700, letterSpacing: '.08em' }}>{c.severity.toUpperCase()}</span>
                  {c.since && <span style={{ fontSize: '9.5px', color: 'var(--text3)', marginLeft: 'auto' }}>since {c.since}</span>}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text2)', lineHeight: 1.5, marginBottom: 3 }}>{c.summary}</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {c.regimes.map(r => <span key={r} style={{ fontSize: '9px', border: '1px solid var(--accent-soft)', color: 'var(--accent)', padding: '0 3px' }}>{r}</span>)}
                  {c.categories.map(cat => <span key={cat} style={{ fontSize: '9px', border: '1px solid var(--red-soft)', color: 'var(--amber)', padding: '0 3px' }}>{cat.replace('_',' ')}</span>)}
                </div>
                {c.totalDesignations && <div style={{ fontSize: '9.5px', color: 'var(--text3)', marginTop: 2 }}>~{c.totalDesignations.toLocaleString()} designations</div>}
              </div>
            </div>
          )
        })}
        {news.length > 0 && (
          <div style={{ padding: '4px 8px', fontSize: '9.5px', color: 'var(--text3)', letterSpacing: '.1em', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            // LATEST SANCTIONS NEWS
          </div>
        )}
        {news.map((n, i) => (
          <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '5px 8px', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
            <div style={{ fontSize: '11px', color: 'var(--text1)', lineHeight: 1.4, marginBottom: 2 }}>{n.title}</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text3)' }}>{n.domain} · {formatDistanceToNow(new Date(n.seendate), { addSuffix: true })}</div>
          </a>
        ))}
      </div>
    </>
  )
}

// ── Military Bases Panel ───────────────────────────────────────────────────────
export function MilitaryPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const q = search.trim().toLowerCase()
  const types = Array.from(new Set(MILITARY_FACILITIES.map(f => f.type))).sort()
  const rows = MILITARY_FACILITIES
    .filter(f => typeFilter === 'all' || f.type === typeFilter)
    .filter(f => !q || f.name.toLowerCase().includes(q) || f.operator.toLowerCase().includes(q) || f.host.toLowerCase().includes(q) || f.notes.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <div style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`news-tab ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>ALL</button>
        {types.map(t => (
          <button key={t} className={`news-tab ${typeFilter === t ? 'active' : ''}`}
            onClick={() => setTypeFilter(t)}
            style={typeFilter === t ? { color: FACILITY_COLORS[t as keyof typeof FACILITY_COLORS], borderColor: `${FACILITY_COLORS[t as keyof typeof FACILITY_COLORS]}44` } : {}}>
            {t.replace('_',' ').toUpperCase().slice(0,4)}
          </button>
        ))}
      </div>
      <div style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, country, operator…"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 11.5, padding: '2px 6px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <div style={{ padding: '2px 8px', borderBottom: '1px solid var(--border)', fontSize: '9.5px', color: 'var(--text3)' }}>{rows.length} facilities</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map(f => {
          const color = FACILITY_COLORS[f.type]
          return (
            <div key={f.id}
              onClick={() => onGeoSearch?.(`${f.lat},${f.lng}`)}
              style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'flex-start', cursor: onGeoSearch ? 'pointer' : 'default', transition: 'background .1s' }}
              onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
              title={onGeoSearch ? `Fly to ${f.name}` : undefined}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3, boxShadow: `0 0 4px ${color}88` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>{f.name}</span>
                  {f.nuclear && <span style={{ fontSize: '9px', color: 'var(--red)', border: '1px solid var(--red)33', padding: '0 3px' }}>☢ NUC</span>}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text2)', marginBottom: 3 }}>
                  <span style={{ color }}>{FACILITY_LABELS[f.type]}</span>
                  <span style={{ color: 'var(--text3)' }}> · {f.operator} → {f.host}</span>
                  {f.personnel ? <span style={{ color: 'var(--text3)' }}> · {f.personnel.toLocaleString()} personnel</span> : null}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text2)', lineHeight: 1.5 }}>{f.notes}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Nuclear Facilities Panel ───────────────────────────────────────────────────
export function NuclearPanel() {
  const [tab, setTab]       = useState<'power'|'weapons'>('power')
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  const plants = NUCLEAR_PLANTS.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q)
  )
  const weapons = MILITARY_FACILITIES.filter(f =>
    f.type === 'nuclear_weapons' &&
    (!q || f.name.toLowerCase().includes(q) || f.operator.toLowerCase().includes(q) || f.host.toLowerCase().includes(q))
  )

  return (
    <>
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>
        <button className={`news-tab ${tab==='power'?'active':''}`} onClick={() => setTab('power')} style={tab==='power'?{color:'var(--amber)',borderColor:'var(--amber)44'}:{}}>☢ POWER PLANTS</button>
        <button className={`news-tab ${tab==='weapons'?'active':''}`} onClick={() => setTab('weapons')} style={tab==='weapons'?{color:'var(--red)',borderColor:'var(--red)44'}:{}}>✸ WEAPONS SITES</button>
      </div>
      <div style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab==='power'?'Search plant, country…':'Search facility, operator…'}
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 11.5, padding: '2px 6px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <div style={{ padding: '2px 8px', borderBottom: '1px solid var(--border)', fontSize: '9.5px', color: 'var(--text3)' }}>
        {tab === 'power' ? `${plants.length} facilities` : `${weapons.length} sites`}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'power' && plants.map(p => {
          const color = PLANT_STATUS_COLORS[p.status]
          return (
            <div key={p.id} style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: '9px', color, border: `1px solid ${color}55`, padding: '0 3px', flexShrink: 0 }}>{p.status.replace('_',' ').toUpperCase()}</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text2)', marginBottom: 3 }}>
                  {p.country} · <span style={{ color: 'var(--amber)' }}>{p.type}</span> · {p.reactors} reactor{p.reactors !== 1 ? 's' : ''} · {p.capacity.toLocaleString()} MWe
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text2)', lineHeight: 1.5 }}>{p.notes}</div>
              </div>
            </div>
          )
        })}
        {tab === 'weapons' && weapons.map(f => (
          <div key={f.id} style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: 3, boxShadow: '0 0 6px var(--red)88' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>{f.name}</span>
                {f.status === 'suspected' && <span style={{ fontSize: '9px', color: 'var(--amber)', border: '1px solid var(--amber)33', padding: '0 3px' }}>SUSPECTED</span>}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text2)', marginBottom: 3 }}>{f.operator} → {f.host}{f.since ? ` · since ${f.since}` : ''}</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text2)', lineHeight: 1.5 }}>{f.notes}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Airspace Monitor Panel ─────────────────────────────────────────────────────
const SEV_COL: Record<string, string> = { critical: 'var(--red)', warning: 'var(--amber)', info: 'var(--text2)' }

const STATUS_COL: Record<FIRStatus['status'], string> = { very_low: 'var(--amber)', low: 'var(--text2)', normal: 'var(--accent)', not_assessed: 'var(--text3)', no_data: 'var(--text3)' }

export function AirspacePanel({ flights }: { flights: { latitude: number | null; longitude: number | null }[] }) {
  const [tab, setTab] = useState<'alerts'|'regions'>('alerts')
  const { alerts, statuses, feedOk } = analyzeAirspace(flights)
  const veryLow = statuses.filter(s => s.status === 'very_low').length
  const low     = statuses.filter(s => s.status === 'low').length

  return (
    <>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {!feedOk
          ? <span style={{ fontSize: '9.5px', color: 'var(--text3)', fontWeight: 700, letterSpacing: '.1em' }}>FLIGHT FEED NOT LOADED · NOT ASSESSED</span>
          : <>
              {veryLow > 0 && <span style={{ fontSize: '9.5px', color: 'var(--amber)', fontWeight: 700, letterSpacing: '.1em' }}>{veryLow} VERY LOW</span>}
              {low > 0 && <span style={{ fontSize: '9.5px', color: 'var(--text2)', fontWeight: 700, letterSpacing: '.1em' }}>{low} LOW</span>}
            </>}
        <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text3)' }}>{new Date().toLocaleTimeString()}</span>
      </div>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>
        OpenSky aircraft counts in rough FIR boxes vs hand-set reference counts. Not NOTAMs and not closures: low counts can mean thin receiver coverage. No alerts at local night.
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>
        <button className={`news-tab ${tab==='alerts'?'active':''}`} onClick={() => setTab('alerts')}>
          LOW TRAFFIC <span style={{ fontSize: '9.5px', color: 'var(--text3)' }}>{alerts.length}</span>
        </button>
        <button className={`news-tab ${tab==='regions'?'active':''}`} onClick={() => setTab('regions')}>
          ALL FIRS <span style={{ fontSize: '9.5px', color: 'var(--text3)' }}>{statuses.length}</span>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'alerts' && alerts.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: '11.5px', color: 'var(--text3)' }}>
            {feedOk ? 'No assessed FIR is below its reference right now.' : 'Flight feed empty or partial: airspace not assessed.'}
          </div>
        )}
        {tab === 'alerts' && alerts.map((a: NOTAMAlert) => (
          <div key={a.id} style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 5 }}>
            <div style={{ width: 2, background: SEV_COL[a.severity], flexShrink: 0, alignSelf: 'stretch' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text1)' }}>{a.icao}</span>
                <span style={{ fontSize: '10px', color: 'var(--text2)' }}>|</span>
                <span style={{ fontSize: '10px', color: 'var(--text2)' }}>{a.country}</span>
                <span style={{ fontSize: '9.5px', color: SEV_COL[a.severity], border: '1px solid var(--border)', padding: '0 3px', marginLeft: 'auto' }}>{a.type === 'VERY_LOW_TRAFFIC' ? 'VERY LOW · UNVERIFIED' : 'LOW · UNVERIFIED'}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.5 }}>{a.message}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: '10px', color: 'var(--text3)' }}>
                <span>Live: <b style={{ color: 'var(--text1)' }}>{a.liveCount}</b></span>
                <span>Hand-set reference: <b style={{ color: 'var(--text2)' }}>~{a.baseline}</b></span>
              </div>
            </div>
          </div>
        ))}
        {tab === 'regions' && statuses.map((s: FIRStatus) => (
          <div key={s.icao} title={s.reason} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COL[s.status], flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text1)', minWidth: 40 }}>{s.icao}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.country}</span>
            <span style={{ fontSize: '9.5px', color: STATUS_COL[s.status], fontWeight: 700, letterSpacing: '.06em', minWidth: 60, textAlign: 'right' }}>
              {FIR_STATUS_LABEL[s.status].toUpperCase()}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{s.status === 'no_data' ? '—' : s.liveCount}</span>
          </div>
        ))}
      </div>
    </>
  )
}
