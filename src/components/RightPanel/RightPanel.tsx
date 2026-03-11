import { useState, useRef } from 'react'
import { Search, ExternalLink, TrendingUp, TrendingDown, X, Loader } from 'lucide-react'
import type { CrisisEvent, NewsArticle, Stock } from '../../types'
import { searchAllSources } from '../../services/news'
import { formatDistanceToNow } from 'date-fns'

const INTEL_TABS = ['Military', 'Conflict', 'Political', 'Economic'] as const
type IntelTab = typeof INTEL_TABS[number]

const TAB_TYPES: Record<IntelTab, CrisisEvent['type'][]> = {
  Military:  ['war', 'terrorism'],
  Conflict:  ['conflict', 'war'],
  Political: ['political', 'protest'],
  Economic:  ['political'],
}

const SEV_COLORS: Record<string, string> = {
  critical: '#ff1a3e', high: '#ff6600', medium: '#ffaa00', low: '#243545',
}

interface Props {
  crises: CrisisEvent[]
  stocks: Stock[]
  onCrisisSelect: (c: CrisisEvent) => void
}

export default function RightPanel({ crises, stocks, onCrisisSelect }: Props) {
  const [intelTab, setIntelTab]       = useState<IntelTab>('Military')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NewsArticle[]>([])
  const [searching, setSearching]     = useState(false)
  const timerRef = useRef<number | null>(null)

  const filteredCrises = crises
    .filter((c) => TAB_TYPES[intelTab].includes(c.type))
    .sort((a, b) => {
      const ord = { critical: 0, high: 1, medium: 2, low: 3 }
      return ord[a.severity] - ord[b.severity]
    })
    .slice(0, 30)

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!q.trim()) { setSearchResults([]); return }
    timerRef.current = window.setTimeout(async () => {
      setSearching(true)
      try { setSearchResults((await searchAllSources(q)).slice(0, 40)) }
      finally { setSearching(false) }
    }, 500)
  }

  const showSearch = searchQuery.length > 0

  return (
    <div className="area-right panel border-l" style={{ borderColor: '#0a1520' }}>

      {/* ── Search bar ──────────────────────────────── */}
      <div className="search-wrap">
        <Search size={9} style={{ color: '#243545', flexShrink: 0 }} />
        <span style={{ fontSize: '9px', color: '#1a2535', marginRight: '-2px', flexShrink: 0 }}>&gt;</span>
        <input
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="search global intel…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: '10px', color: '#c0d8f0', fontFamily: 'inherit',
          }}
          className="placeholder:text-[#1a2535]"
        />
        {searching && <Loader size={8} style={{ color: '#4a6a8a', flexShrink: 0, animation: 'spin 1s linear infinite' }} />}
        {searchQuery && !searching && (
          <button onClick={() => { setSearchQuery(''); setSearchResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#243545', padding: 0 }}>
            <X size={9} />
          </button>
        )}
      </div>

      {/* ── Quick tags ───────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '4px 8px', borderBottom: '1px solid #0a1520' }}>
        {['Gaza', 'Ukraine', 'Iran', 'China', 'NATO', 'Oil', 'Sanctions', 'Elections'].map((tag) => (
          <button
            key={tag}
            onClick={() => handleSearch(tag)}
            className={`news-tab ${searchQuery === tag ? 'active' : ''}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {showSearch ? (
        /* ── Search results ───────────────────────── */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '3px 10px', fontSize: '8px', color: '#243545', borderBottom: '1px solid #0a1520', letterSpacing: '0.1em' }}>
            {searching ? '// QUERYING…' : `// ${searchResults.length} RESULTS`}
          </div>
          {searchResults.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="intel-row"
              style={{ flexDirection: 'column', gap: '3px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                <span style={{ fontSize: '8px', color: '#243545', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{a.source}</span>
                <span style={{ fontSize: '8px', color: '#1a2535' }}>{safeTimeAgo(a.publishedAt)}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#8aaccc', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {a.title}
              </div>
              <ExternalLink size={7} style={{ color: '#1a2535', alignSelf: 'flex-end' }} />
            </a>
          ))}
        </div>
      ) : (
        <>
          {/* ── Live Intelligence ─────────────────── */}
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="live-dot red" />
              <span className="panel-title">Live Intelligence</span>
            </div>
            <span style={{ fontSize: '9px', color: '#243545', fontVariantNumeric: 'tabular-nums' }}>
              [{filteredCrises.length}]
            </span>
          </div>

          {/* Intel tabs */}
          <div style={{ display: 'flex', gap: '2px', padding: '4px 8px', borderBottom: '1px solid #0a1520' }}>
            {INTEL_TABS.map((t) => (
              <button key={t} onClick={() => setIntelTab(t)} className={`news-tab ${intelTab === t ? 'active' : ''}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Crisis list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredCrises.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '48px', fontSize: '9px', color: '#1a2535', letterSpacing: '0.1em' }}>
                // LOADING EVENTS…
              </div>
            )}
            {filteredCrises.map((c) => (
              <button
                key={c.id}
                onClick={() => onCrisisSelect(c)}
                className="intel-row"
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', display: 'flex', gap: '8px', alignItems: 'flex-start' }}
              >
                {/* severity bar */}
                <div style={{
                  width: '2px', alignSelf: 'stretch', flexShrink: 0,
                  background: SEV_COLORS[c.severity] || '#243545',
                  boxShadow: `0 0 4px ${SEV_COLORS[c.severity] || '#243545'}66`,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', color: '#8aaccc', lineHeight: 1.4, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '8px', color: '#243545', letterSpacing: '0.06em' }}>
                    <span>{c.country}</span>
                    <span style={{ color: '#1a2535' }}>·</span>
                    <span>{new Date(c.date).toLocaleDateString()}</span>
                    {c.fatalities ? <span style={{ color: '#ff1a3e' }}>⚠ {c.fatalities}</span> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ── Markets mini ───────────────────────── */}
          {stocks.length > 0 && (
            <>
              <div className="panel-header" style={{ borderTop: '1px solid #0a1520', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="live-dot" style={{ background: '#00ff88' }} />
                  <span className="panel-title">Markets</span>
                </div>
              </div>
              <div style={{ overflowY: 'auto', flexShrink: 0, maxHeight: '130px' }}>
                {stocks.slice(0, 6).map((s) => {
                  const pos = s.changePercent >= 0
                  return (
                    <div
                      key={s.symbol}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 10px', borderBottom: '1px solid #0a1520',
                        borderLeft: '2px solid transparent', transition: 'all 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,200,255,0.04)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'rgba(0,200,255,0.2)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
                    >
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#c0d8f0' }}>{s.symbol}</div>
                        <div style={{ fontSize: '8px', color: '#243545', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: '#8aaccc', fontVariantNumeric: 'tabular-nums' }}>${s.price.toFixed(2)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', fontSize: '9px', color: pos ? '#00ff88' : '#ff1a3e' }}>
                          {pos ? <TrendingUp size={7} /> : <TrendingDown size={7} />}
                          {pos ? '+' : ''}{s.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function safeTimeAgo(dateStr: string) {
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }) } catch { return '' }
}
