/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useCallback, useEffect } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { CrisisEvent, NewsArticle, Flight } from '../../types'
import { fetchRSSFeed, searchGDELTNews, searchGuardian, searchNYT, searchNewsAPI, fetchAllCrisisWatch, CRISISWATCH_FEEDS, type CrisisWatchEntry, COUNTRY_NEWS_SOURCES, fetchCountryNews } from '../../services/news'
import { fetchOutageEvents, type OutageEvent } from '../../services/outages'
import { onGlobalReload } from '../../utils/reloadBus'
import { SEV_COLORS } from './OverviewPanels'
import { outageScoreColor } from './OutagesPanel'

// ── Shared helpers ─────────────────────────────────────────────────────────────
function safeTimeAgo(d: string) {
  try {
    if (!d) return ''
    const date = new Date(d)
    // Guard against epoch-zero or invalid dates (e.g. empty pubDate from RSS)
    if (isNaN(date.getTime()) || date.getTime() < 86_400_000) return ''
    return formatDistanceToNow(date, { addSuffix: true })
  } catch { return '' }
}

// ── Panel sub-components ───────────────────────────────────────────────────────

export function ArticleRow({ a }: { a: NewsArticle }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="intel-row"
      style={{ alignItems: 'flex-start', cursor: 'pointer', flexDirection: 'column', padding: 0 }}
      onClick={() => setOpen(v => !v)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ width: 2, background: open ? 'var(--accent)' : 'var(--border)', flexShrink: 0, alignSelf: 'stretch', transition: 'background .15s' }} />
        <div style={{ flex: 1, minWidth: 0, padding: '5px 8px' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text1)', lineHeight: 1.45, marginBottom: 3,
            ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
            {a.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: 'var(--text2)', fontWeight: 600, letterSpacing: '.05em' }}>{a.source}</span>
            {a.category && <span style={{ fontSize: '9.5px', color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid var(--border)', padding: '0 3px' }}>{a.category}</span>}
            <span style={{ fontSize: '10px', color: 'var(--text3)', marginLeft: 'auto' }}>{safeTimeAgo(a.publishedAt)}</span>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ width: '100%', borderTop: '1px solid var(--border)', padding: '6px 10px 8px', background: 'var(--accent-soft)' }}
          onClick={e => e.stopPropagation()}>
          {a.imageUrl && (
            <img src={a.imageUrl} alt="" style={{ width: '100%', maxHeight: 90, objectFit: 'cover', marginBottom: 6, opacity: 0.85 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          )}
          {a.description && (
            <div style={{ fontSize: '11.5px', color: 'var(--text2)', lineHeight: 1.55, marginBottom: 6 }}>{a.description}</div>
          )}
          <a href={a.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '10.5px', color: 'var(--accent)', letterSpacing: '.08em', textDecoration: 'none', textTransform: 'uppercase', padding: '3px 7px', border: '1px solid var(--accent)', background: 'var(--accent-soft)' }}>
            <ExternalLink size={8} /> OPEN ARTICLE
          </a>
        </div>
      )}
    </div>
  )
}

export function NewsPanel() {
  const [country, setCountry]     = useState('US')
  const [articles, setArticles]   = useState<NewsArticle[]>([])
  const [loading, setLoading]     = useState(false)

  const loadCountry = useCallback(async (code: string) => {
    setLoading(true); setArticles([])
    try { setArticles(await fetchCountryNews(code)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCountry(country) }, [country, loadCountry])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          className="news-country-select"
          style={{
            background: 'var(--surface2)', color: 'var(--text1)', border: '1px solid var(--border)',
            fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase',
            padding: '2px 4px', cursor: 'pointer', outline: 'none',
          }}
        >
          {COUNTRY_NEWS_SOURCES.map(c => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <span style={{ fontSize: '9.5px', color: 'var(--text3)', letterSpacing: '.08em' }}>TOP 5 SOURCES</span>
        <button onClick={() => loadCountry(country)} disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', opacity: loading ? 0.3 : 1, marginLeft: 'auto' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// LOADING…</div>}
        {!loading && articles.length === 0 && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO DATA</div>}
        {articles.map(a => <ArticleRow key={a.id} a={a} />)}
      </div>
    </>
  )
}

// ── CrisisWatch Panel ─────────────────────────────────────────────────────────
const TREND_META: Record<CrisisWatchEntry['trend'], { label: string; color: string; icon: string }> = {
  deteriorated: { label: 'DETERIORATED', color: 'var(--red)', icon: '▼' },
  alert:        { label: 'ALERT',        color: 'var(--amber)', icon: '⚠' },
  unchanged:    { label: 'UNCHANGED',    color: 'var(--amber)', icon: '●' },
  improved:     { label: 'IMPROVED',     color: 'var(--accent)', icon: '▲' },
  unknown:      { label: 'MONITOR',      color: 'var(--text2)', icon: '○' },
}

const CW_REGIONS = ['All', ...CRISISWATCH_FEEDS.map(f => f.region)] as const

type CWRegion = typeof CW_REGIONS[number]

export function CrisisWatchPanel() {
  const [entries, setEntries]     = useState<CrisisWatchEntry[]>([])
  const [loading, setLoading]     = useState(false)
  const [region, setRegion]       = useState<CWRegion>('All')
  const [filter, setFilter]       = useState<CrisisWatchEntry['trend'] | 'All'>('All')
  const [lastFetch, setLastFetch] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllCrisisWatch()
      setEntries(data)
      setLastFetch(Date.now())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  // Refresh every 60 min (ICG publishes monthly)
  useEffect(() => {
    const t = window.setInterval(load, 60 * 60_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(t); unsub() }
  }, [load])

  const filtered = entries.filter(e => {
    if (region !== 'All' && e.region !== region) return false
    if (filter !== 'All' && e.trend !== filter) return false
    return true
  })

  // Counts per trend
  const counts = entries.reduce((acc, e) => {
    acc[e.trend] = (acc[e.trend] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <>
      {/* Header: trend filter pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('All')}
          className={`news-tab ${filter === 'All' ? 'active' : ''}`}>ALL <span style={{ fontSize: '9.5px', color: 'var(--text3)' }}>{entries.length}</span>
        </button>
        {(['deteriorated', 'alert', 'improved', 'unchanged'] as const).map(t => {
          const m = TREND_META[t]
          return (
            <button key={t} onClick={() => setFilter(t)}
              className={`news-tab ${filter === t ? 'active' : ''}`}
              style={filter === t ? { color: m.color, borderColor: m.color + '44' } : {}}
            >
              {m.icon} <span style={{ fontSize: '9.5px', color: filter === t ? m.color : 'var(--text3)' }}>{counts[t] ?? 0}</span>
            </button>
          )
        })}
        <button onClick={load} disabled={loading} title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', opacity: loading ? 0.3 : 1, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Region tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {CW_REGIONS.map(r => (
          <button key={r} onClick={() => setRegion(r)}
            className={`news-tab ${region === r ? 'active' : ''}`}
            style={{ whiteSpace: 'nowrap' }}>
            {r === 'Global' ? 'CW' : r === 'All' ? 'ALL' : r.toUpperCase()}
          </button>
        ))}
        {lastFetch && (
          <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text3)', alignSelf: 'center', whiteSpace: 'nowrap', letterSpacing: '.05em' }}>
            {formatDistanceToNow(new Date(lastFetch), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && filtered.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// FETCHING ICG FEEDS…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO ENTRIES MATCHED</div>
        )}
        {filtered.map(e => {
          const m = TREND_META[e.trend]
          return (
            <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer"
              className="intel-row" style={{ alignItems: 'flex-start', textDecoration: 'none' }}>
              <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: m.color, boxShadow: `0 0 4px ${m.color}66` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', color: 'var(--text1)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {e.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: m.color, border: `1px solid ${m.color}44`, padding: '0 3px', letterSpacing: '.08em', flexShrink: 0 }}>
                    {m.icon} {m.label}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '.04em' }}>{e.source}</span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text3)', marginLeft: 'auto', flexShrink: 0 }}>{safeTimeAgo(e.publishedAt)}</span>
                  <ExternalLink size={7} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </>
  )
}

// ── Intel Brief panel (search-correlated) ─────────────────────────────────────
const BRIEF_TABS = ['INTEL', 'NEWS', 'AIR', 'NET'] as const

type BriefTab = typeof BRIEF_TABS[number]

export function IntelBriefPanel({ query, crises, flights }: { query: string; crises: CrisisEvent[]; flights: Flight[] }) {
  const [tab, setTab]         = useState<BriefTab>('INTEL')
  const [news, setNews]       = useState<NewsArticle[]>([])
  const [outages, setOutages] = useState<OutageEvent[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const q = query.trim().toLowerCase()

  // Filter crises by query
  const filteredCrises = q
    ? crises.filter(c =>
        c.title?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      )
    : crises

  // Filter flights by query
  const filteredFlights = q
    ? flights.filter(f =>
        (f.origin_country || '').toLowerCase().includes(q) ||
        (f.callsign       || '').toLowerCase().includes(q)
      )
    : flights

  // Fetch news from all sources in parallel, filtered by query
  useEffect(() => {
    if (!q) return
    setNewsLoading(true)
    setNews([])
    Promise.allSettled([
      searchGuardian(q),
      searchNYT(q),
      searchGDELTNews(q),
      searchNewsAPI(q),
      fetchRSSFeed('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC News'),
      fetchRSSFeed('https://rss.dw.com/xml/rss-en-world', 'DW News'),
      fetchRSSFeed('https://www.aljazeera.com/xml/rss/all.xml', 'Al Jazeera'),
      fetchRSSFeed('https://www.crisisgroup.org/rss.xml', 'CrisisWatch'),
      fetchRSSFeed('https://www.crisisgroup.org/rss/1',  'ICG Africa'),
      fetchRSSFeed('https://www.crisisgroup.org/rss/30', 'ICG Asia'),
      fetchRSSFeed('https://www.crisisgroup.org/rss/56', 'ICG Europe'),
      fetchRSSFeed('https://www.crisisgroup.org/rss/81', 'ICG MENA'),
    ]).then(results => {
      const seen = new Set<string>()
      const all: NewsArticle[] = []
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        for (const a of r.value) {
          if (!a.title?.toLowerCase().includes(q) && !a.description?.toLowerCase().includes(q)) continue
          if (seen.has(a.url)) continue
          seen.add(a.url)
          all.push(a)
        }
      }
      all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      setNews(all)
    }).finally(() => setNewsLoading(false))
  }, [q])

  // Fetch outages filtered by query
  useEffect(() => {
    if (!q) return
    fetchOutageEvents(48).then(data => {
      setOutages(data.filter(e => e.entityName.toLowerCase().includes(q)))
    }).catch(() => {})
  }, [q])

  if (!q) {
    return <div style={{ padding: '12px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em', textAlign: 'center' }}>// TYPE A SEARCH QUERY TO ANALYZE</div>
  }

  return (
    <>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>
        {BRIEF_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`news-tab ${tab === t ? 'active' : ''}`}>
            {t}
            <span style={{ marginLeft: 3, fontSize: '9.5px', color: 'var(--text3)' }}>
              {t === 'INTEL' ? filteredCrises.length
               : t === 'NEWS' ? news.length
               : t === 'AIR'  ? filteredFlights.length
               : outages.length}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'INTEL' && (
          filteredCrises.length === 0
            ? <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO EVENTS MATCHED</div>
            : filteredCrises.slice(0, 40).map(c => (
              <div key={c.id} className="intel-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: SEV_COLORS[c.severity] || 'var(--text3)', boxShadow: `0 0 4px ${SEV_COLORS[c.severity] || 'var(--text3)'}66` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--text1)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                  <div style={{ display: 'flex', gap: 5, fontSize: '10.5px', color: 'var(--text3)' }}>
                    <span style={{ color: SEV_COLORS[c.severity] || 'var(--text3)', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.1em', border: `1px solid ${SEV_COLORS[c.severity] || 'var(--text3)'}44`, padding: '0 3px' }}>{c.severity?.toUpperCase()}</span>
                    <span>{c.country}</span>
                    {c.fatalities ? <span style={{ color: 'var(--red)' }}>⚠ {c.fatalities}</span> : null}
                  </div>
                </div>
              </div>
            ))
        )}

        {tab === 'NEWS' && (
          newsLoading && news.length === 0
            ? <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// QUERYING ALL SOURCES…</div>
            : news.length === 0
              ? <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO NEWS MATCHED</div>
              : news.slice(0, 50).map(a => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="intel-row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, alignSelf: 'stretch' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text1)', lineHeight: 1.4, marginBottom: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{a.source}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{safeTimeAgo(a.publishedAt)}</span>
                      <ExternalLink size={7} style={{ color: 'var(--text3)' }} />
                    </div>
                  </div>
                </a>
              ))
        )}

        {tab === 'AIR' && (
          filteredFlights.length === 0
            ? <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO FLIGHTS MATCHED</div>
            : filteredFlights.slice(0, 60).map(f => (
              <div key={f.icao24} className="intel-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--accent)', fontWeight: 700 }}>{f.callsign || f.icao24}</div>
                  <div style={{ display: 'flex', gap: 6, fontSize: '10px', color: 'var(--text3)' }}>
                    <span>{f.origin_country}</span>
                    {f.altitude  != null && <span>{Math.round(f.altitude)}m</span>}
                    {f.velocity  != null && <span>{Math.round(f.velocity * 1.944)}kts</span>}
                  </div>
                </div>
              </div>
            ))
        )}

        {tab === 'NET' && (
          outages.length === 0
            ? <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO OUTAGES MATCHED</div>
            : outages.map(ev => (
              <div key={ev.id} className="intel-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: outageScoreColor(ev.score), boxShadow: `0 0 4px ${outageScoreColor(ev.score)}66` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.entityName}</div>
                  <div style={{ display: 'flex', gap: 5, fontSize: '10px', color: 'var(--text3)' }}>
                    <span style={{ color: outageScoreColor(ev.score), fontWeight: 700, fontSize: '9.5px', border: `1px solid ${outageScoreColor(ev.score)}44`, padding: '0 3px' }}>
                      {ev.score >= 500 ? 'CRITICAL' : ev.score >= 200 ? 'MAJOR' : ev.score >= 50 ? 'MODERATE' : 'MINOR'}
                    </span>
                    <span>{ev.entityType}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{ev.score}</span>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </>
  )
}
