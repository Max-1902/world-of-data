import { useState, useEffect } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import type { NewsArticle, PanelState } from '../../types'
import { fetchRSSFeed, searchGDELTNews, searchGuardian, searchNYT } from '../../services/news'
import { formatDistanceToNow } from 'date-fns'

const TABS = [
  { id: 'BBC',       label: 'BBC',     color: '#BB1919', fn: () => fetchRSSFeed('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC News') },
  { id: 'Reuters',   label: 'RTR',     color: '#FF8000', fn: () => fetchRSSFeed('https://feeds.reuters.com/reuters/worldNews', 'Reuters') },
  { id: 'DW',        label: 'DW',      color: '#0095B5', fn: () => fetchRSSFeed('https://rss.dw.com/xml/rss-en-world', 'DW News') },
  { id: 'AlJazeera', label: 'AJZ',     color: '#cc9900', fn: () => fetchRSSFeed('https://www.aljazeera.com/xml/rss/all.xml', 'Al Jazeera') },
  { id: 'France24',  label: 'F24',     color: '#003087', fn: () => fetchRSSFeed('https://www.france24.com/en/rss', 'France 24') },
  { id: 'Guardian',  label: 'GRD',     color: '#005689', fn: () => searchGuardian('world politics conflict') },
  { id: 'NYT',       label: 'NYT',     color: '#555',    fn: () => searchNYT('world news') },
  { id: 'GDELT',     label: 'GDL',     color: '#7744cc', fn: () => searchGDELTNews('war conflict crisis protest') },
]

const LAYERS: { id: keyof PanelState; label: string; color: string; tag: string }[] = [
  { id: 'flights', label: 'FLIGHT TRAFFIC',  color: '#00c8ff', tag: 'AIR' },
  { id: 'crises',  label: 'CONFLICTS',       color: '#ff1a3e', tag: 'GEO' },
  { id: 'news',    label: 'NEWS HOTSPOTS',   color: '#aa44ff', tag: 'INF' },
  { id: 'stocks',  label: 'MARKET HUBS',     color: '#00ff88', tag: 'MKT' },
]

interface Props {
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
}

export default function LeftPanel({ panelState, onToggleLayer, deepstateMode, onDeepstateToggle }: Props) {
  const [activeTab, setActiveTab] = useState('BBC')
  const [articles, setArticles]   = useState<NewsArticle[]>([])
  const [loading, setLoading]     = useState(false)

  const loadTab = async (tabId: string) => {
    const tab = TABS.find((t) => t.id === tabId)
    if (!tab) return
    setLoading(true)
    setArticles([])
    try { setArticles(await tab.fn()) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTab(activeTab) }, [activeTab]) // eslint-disable-line

  return (
    <div className="area-left panel border-r" style={{ borderColor: '#0a1520' }}>

      {/* ── Header ──────────────────────────────────── */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="live-dot" />
          <span className="panel-title">Intel Feed</span>
        </div>
        <button
          onClick={() => loadTab(activeTab)}
          disabled={loading}
          style={{ color: '#243545', background: 'none', border: 'none', cursor: 'pointer', opacity: loading ? 0.3 : 1 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#4a6a8a' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#243545' }}
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Source selector ─────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '5px 8px', borderBottom: '1px solid #0a1520' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`news-tab ${activeTab === t.id ? 'active' : ''}`}
            style={activeTab === t.id ? { color: t.color, borderColor: t.color + '44' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Article list ────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '48px', fontSize: '9px', color: '#243545', letterSpacing: '0.12em' }}>
            // LOADING {activeTab}…
          </div>
        )}
        {!loading && articles.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '48px', fontSize: '9px', color: '#1a2535', letterSpacing: '0.1em' }}>
            // NO DATA
          </div>
        )}
        {articles.map((a) => <ArticleRow key={a.id} article={a} />)}
      </div>

      {/* ── DeepState ───────────────────────────────── */}
      <div style={{ borderTop: '1px solid #0a1520', flexShrink: 0 }}>
        <button
          onClick={onDeepstateToggle}
          style={{
            width: '100%', padding: '5px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
            background: deepstateMode ? 'rgba(255,26,62,0.1)' : 'transparent',
            border: 'none', borderBottom: '1px solid #0a1520',
            borderLeft: `2px solid ${deepstateMode ? '#ff1a3e' : 'transparent'}`,
            cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
          }}
        >
          <div style={{
            width: 10, height: 10, flexShrink: 0,
            border: `1px solid ${deepstateMode ? '#ff1a3e' : '#0a1520'}`,
            background: deepstateMode ? '#ff1a3e22' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {deepstateMode && <div style={{ width: 4, height: 4, background: '#ff1a3e' }} />}
          </div>
          <span style={{ fontSize: '7.5px', fontWeight: 700, letterSpacing: '.1em', color: deepstateMode ? '#ff1a3e' : '#243545', border: `1px solid ${deepstateMode ? '#ff1a3e44' : '#0a1520'}`, padding: '0 3px', lineHeight: '14px', flexShrink: 0 }}>
            WAR
          </span>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: deepstateMode ? '#ff1a3e' : '#243545' }}>
              DeepState Ukraine
            </div>
            <div style={{ fontSize: '7.5px', color: '#1a2535', letterSpacing: '.06em' }}>
              disables other layers
            </div>
          </div>
        </button>
      </div>

      {/* ── Map layers ──────────────────────────────── */}
      <div style={{ borderTop: '1px solid #0a1520', flexShrink: 0 }}>
        <div className="panel-header">
          <span className="panel-title">Map Layers</span>
        </div>
        <div style={{ padding: '2px 0' }}>
          {LAYERS.map((layer) => {
            const on = panelState[layer.id]
            return (
              <button
                key={layer.id}
                onClick={() => onToggleLayer(layer.id)}
                className={`layer-row ${on ? 'on' : ''}`}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: on ? layer.color : '#243545' }}
              >
                {/* indicator square */}
                <div style={{
                  width: '10px', height: '10px', flexShrink: 0,
                  border: `1px solid ${on ? layer.color : '#0a1520'}`,
                  background: on ? layer.color + '22' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  {on && <div style={{ width: '4px', height: '4px', background: layer.color }} />}
                </div>

                {/* tag */}
                <span style={{
                  fontSize: '7.5px', fontWeight: 700, letterSpacing: '0.1em',
                  color: on ? layer.color + 'aa' : '#0a1520',
                  border: `1px solid ${on ? layer.color + '44' : '#0a1520'}`,
                  padding: '0 3px', lineHeight: '14px',
                  transition: 'all 0.12s', flexShrink: 0,
                }}>
                  {layer.tag}
                </span>

                <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em' }}>
                  {layer.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ArticleRow({ article }: { article: NewsArticle }) {
  const timeAgo = safeTimeAgo(article.publishedAt)
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="intel-row"
      style={{ alignItems: 'flex-start' }}
    >
      {/* left accent dash */}
      <div style={{ width: '1px', height: '100%', background: '#0a1520', flexShrink: 0, marginTop: '2px', alignSelf: 'stretch' }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', color: '#8aaccc', lineHeight: 1.45, marginBottom: '3px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {article.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '8px', color: '#243545', letterSpacing: '0.06em' }}>{timeAgo}</span>
          <ExternalLink size={7} style={{ color: '#1a2535' }} />
        </div>
      </div>
    </a>
  )
}

function safeTimeAgo(dateStr: string) {
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }) }
  catch { return '' }
}
