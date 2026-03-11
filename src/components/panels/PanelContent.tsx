/**
 * Shared panel content components — used by both PanelDock and CornerWidget
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { ExternalLink, RefreshCw, TrendingUp, TrendingDown, Send, Square } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { CrisisEvent, NewsArticle, PanelState, Stock, Flight } from '../../types'
import { fetchRSSFeed, searchGDELTNews, searchGuardian, searchNYT, searchNewsAPI, fetchAllCrisisWatch, CRISISWATCH_FEEDS, type CrisisWatchEntry } from '../../services/news'
import { fetchMultipleQuotes } from '../../services/stocks'
import { fetchOutageEvents, type OutageEvent } from '../../services/outages'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS, type SanctionedCountry } from '../../services/sanctions'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../../services/military'
import { analyzeAirspace, type NOTAMAlert, type FIRStatus } from '../../services/notam'
import { streamAI, buildDashboardContext, QUICK_PROMPTS, FREE_MODELS, DEFAULT_MODEL, type DSMessage } from '../../services/openrouter'
import {
  UNHCR_GLOBAL_2023, TOP_HOSTING, TOP_ORIGINS, UNHCR_OFFICES, BORDER_CROSSINGS, REFUGEE_CAMPS,
  CROSSING_STATUS_COLORS, OFFICE_TYPE_COLORS,
  REFUGEE_FLOWS, COUNTRY_DISPLACEMENT,
  fetchUNHCRPopulation,
  type UNHCRStat, type UNHCROffice, type BorderCrossing, type RefugeeCamp,
} from '../../services/unhcr'

// ── Panel ID type + metadata ──────────────────────────────────────────────────
export type PanelId =
  | 'news' | 'layers' | 'intel' | 'risk' | 'threat'
  | 'indices' | 'commodities' | 'energy' | 'tech' | 'healthcare' | 'defense'
  | 'crypto' | 'forex' | 'bonds' | 'exchanges'
  | 'markets'
  | 'drugs' | 'sanctions' | 'military' | 'nuclear' | 'airspace' | 'cnn'
  | 'outages' | 'brief' | 'crisiswatch' | 'analyst' | 'humanitarian'

export const PANEL_META: Record<PanelId, { title: string; dotColor?: string; width: number; desc: string }> = {
  news:        { title: 'Signals',       dotColor: 'grn',    width: 240, desc: 'Aggregated open-source reporting' },
  layers:      { title: 'Overlays',      dotColor: 'blue',   width: 190, desc: 'Map layer configuration' },
  intel:       { title: 'Incidents',     dotColor: 'red',    width: 260, desc: 'Active conflict & event tracking' },
  risk:        { title: 'Risk Matrix',   dotColor: 'red',    width: 210, desc: 'Country-level threat assessment' },
  threat:      { title: 'Threat Level',  dotColor: 'orange', width: 152, desc: 'Composite global threat index' },
  indices:     { title: 'Indices',       width: 230, desc: 'SPY QQQ DIA EEM VGK' },
  commodities: { title: 'Commodities',   width: 200, desc: 'GLD SLV GSG DBA CPER' },
  energy:      { title: 'Energy',        width: 200, desc: 'XLE USO CVX XOM BP SLB' },
  tech:        { title: 'Technology',    width: 200, desc: 'XLK AAPL MSFT NVDA GOOGL META' },
  healthcare:  { title: 'Healthcare',    width: 200, desc: 'XLV JNJ PFE UNH MRK AMGN' },
  defense:     { title: 'Defense',       width: 200, desc: 'ITA LMT RTX NOC BA GD' },
  crypto:      { title: 'Digital Assets',width: 200, desc: 'BTC ETH SOL BNB XRP' },
  forex:       { title: 'FX Rates',      width: 210, desc: 'EUR/USD GBP JPY CNY DXY' },
  bonds:       { title: 'Fixed Income',  width: 210, desc: 'US 10Y 30Y TLT HYG LQD' },
  exchanges:   { title: 'Exchanges',     width: 280, desc: 'Global exchange indices by region' },
  markets:     { title: 'Markets',       dotColor: 'grn', width: 340, desc: 'Consolidated financial data feed' },
  drugs:       { title: 'Narcotics',     dotColor: 'red',    width: 280, desc: 'Trafficking routes & seizure data' },
  sanctions:   { title: 'Sanctions',     dotColor: 'red',    width: 280, desc: 'OFAC EU UN UK sanctions registry' },
  military:    { title: 'Installations', dotColor: 'blue',   width: 300, desc: 'Military bases & force posture' },
  nuclear:     { title: 'Nuclear',       dotColor:'yellow',  width: 300, desc: 'Reactors & weapons storage sites' },
  airspace:    { title: 'Airspace',      dotColor: 'red',    width: 300, desc: 'FIR status & NOTAM alerts' },
  cnn:         { title: 'Live Feeds',    dotColor: 'red',    width: 420, desc: 'Regional surveillance streams' },
  outages:     { title: 'Connectivity',  dotColor: 'yellow', width: 280, desc: 'Internet disruption monitoring' },
  brief:       { title: 'Briefing',      dotColor: 'red',    width: 240, desc: 'Correlated intel for active query' },
  crisiswatch: { title: 'Crisis Monitor',dotColor: 'orange', width: 290, desc: 'ICG conflict tracking — 70+ states' },
  analyst:     { title: 'Analysis',      dotColor: 'blue',   width: 360, desc: 'AI-assisted situational assessment' },
  humanitarian:{ title: 'Humanitarian',  dotColor: 'blue',   width: 320, desc: 'UNHCR displacement & border status' },
}

export const DEFAULT_ORDER: PanelId[] = [
  'news', 'crisiswatch', 'layers', 'intel', 'humanitarian', 'risk', 'threat',
  'markets',
  'analyst',
  'drugs', 'sanctions', 'military', 'nuclear', 'airspace', 'cnn',
  'outages',
]

// ── Market sectors ─────────────────────────────────────────────────────────────
export const SECTORS: Record<string, string[]> = {
  // ── Equities ──────────────────────────────────────────────────────────────
  indices:     ['SPY', 'QQQ', 'DIA', 'IWM', 'EEM', 'VGK', 'EWU', 'EWG', 'EWJ', 'EWH', 'FXI', 'EWZ', 'EWA'],
  commodities: ['GLD', 'SLV', 'GSG', 'PDBC', 'CPER', 'WEAT', 'CORN', 'UNG', 'DBA', 'SOYB'],
  energy:      ['XLE', 'USO', 'CVX', 'XOM', 'BP', 'SLB', 'HAL', 'ENB', 'MPC', 'OIH'],
  tech:        ['XLK', 'AAPL', 'MSFT', 'NVDA', 'AMD', 'GOOGL', 'META', 'AMZN', 'TSLA', 'INTC'],
  healthcare:  ['XLV', 'JNJ', 'PFE', 'UNH', 'ABT', 'MRK', 'BMY', 'AMGN', 'GILD', 'LLY'],
  defense:     ['ITA', 'LMT', 'RTX', 'NOC', 'GD', 'BA', 'HII', 'LDOS', 'KTOS', 'AXON'],
  // ── Bonds & Rates (Finnhub ETF symbols only — no Yahoo ^ prefix) ──────────
  bonds:       ['TLT', 'IEF', 'SHY', 'HYG', 'LQD', 'BND', 'EMB', 'TIPS'],
}

// ── Map layer configs ──────────────────────────────────────────────────────────
export const LAYERS_CONFIG: { id: keyof PanelState; label: string; color: string; tag: string }[] = [
  { id: 'flights',   label: 'AIR TRAFFIC',          color: '#00ff88', tag: 'AIR' },
  { id: 'crises',    label: 'CONFLICT ZONES',       color: '#ff1a3e', tag: 'GEO' },
  { id: 'wildfires', label: 'WILDFIRES',             color: '#ff6600', tag: 'FIRE' },
  { id: 'military',  label: 'MILITARY INSTALLATIONS',color: '#00cc55', tag: 'MIL' },
  { id: 'nuclear',   label: 'NUCLEAR SITES',         color: '#ffdd00', tag: 'NUC' },
  { id: 'sanctions', label: 'SANCTIONED STATES',     color: '#ff1a3e', tag: 'SAN' },
  { id: 'news',      label: 'MEDIA SIGNALS',         color: '#aa44ff', tag: 'SIG' },
  { id: 'stocks',    label: 'FINANCIAL CENTRES',     color: '#00ff88', tag: 'FIN' },
  { id: 'cameras',        label: 'LIVE CAMERAS',          color: '#00ff88', tag: 'CAM' },
  { id: 'infrastructure', label: 'CRITICAL INFRASTRUCTURE',color: '#ff8800', tag: 'CI' },
  { id: 'airspace',       label: 'AIRSPACE RESTRICTIONS', color: '#ff1a3e', tag: 'FIR' },
  { id: 'humanitarian',  label: 'HUMANITARIAN OPS',      color: '#00aaff', tag: 'HUM' },
  { id: 'vessels',       label: 'MARITIME TRAFFIC',       color: '#00cc88', tag: 'AIS' },
  { id: 'oilgas',        label: 'OIL & GAS RESERVES',     color: '#ff8800', tag: 'O&G' },
  { id: 'gpsjam',        label: 'GPS INTERFERENCE',        color: '#ff2244', tag: 'GPS' },
]

// ── Shared helpers ─────────────────────────────────────────────────────────────
export function safeTimeAgo(d: string) {
  try {
    if (!d) return ''
    const date = new Date(d)
    // Guard against epoch-zero or invalid dates (e.g. empty pubDate from RSS)
    if (isNaN(date.getTime()) || date.getTime() < 86_400_000) return ''
    return formatDistanceToNow(date, { addSuffix: true })
  } catch { return '' }
}

const SEV_COLORS: Record<string, string> = {
  critical: '#ff1a3e', high: '#ff6600', medium: '#ffaa00', low: '#2a3e2e',
}

export function computeCountryRisk(crises: CrisisEvent[]) {
  const m: Record<string, { events: number; score: number }> = {}
  for (const c of crises) {
    if (!c.country) continue
    if (!m[c.country]) m[c.country] = { events: 0, score: 0 }
    m[c.country].events++
    const sev: Record<string, number> = { critical: 10, high: 6, medium: 3, low: 1 }
    m[c.country].score += sev[c.severity] ?? 1
  }
  return Object.entries(m).map(([country, v]) => ({ country, ...v })).sort((a, b) => b.score - a.score).slice(0, 12)
}

export function riskColor(score: number) {
  if (score >= 40) return '#ff1a3e'
  if (score >= 20) return '#ff6600'
  if (score >= 10) return '#ffaa00'
  return '#00ff88'
}

export function computeThreatScore(crises: CrisisEvent[], flights: Flight[]) {
  const base = crises.reduce((acc, c) => {
    const w: Record<string, number> = { critical: 8, high: 4, medium: 2, low: 1 }
    return acc + (w[c.severity] ?? 1)
  }, 0)
  return Math.min(100, Math.round(base / 8 + (flights.length > 5000 ? 5 : 0)))
}

// ── News tabs ──────────────────────────────────────────────────────────────────
const NEWS_TABS = [
  { id: 'BBC',         label: 'BBC', color: '#BB1919', fn: () => fetchRSSFeed('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC News') },
  { id: 'Reuters',     label: 'RTR', color: '#FF8000', fn: () => fetchRSSFeed('https://feeds.reuters.com/reuters/worldNews', 'Reuters') },
  { id: 'DW',          label: 'DW',  color: '#0095B5', fn: () => fetchRSSFeed('https://rss.dw.com/xml/rss-en-world', 'DW News') },
  { id: 'AlJazeera',   label: 'AJZ', color: '#cc9900', fn: () => fetchRSSFeed('https://www.aljazeera.com/xml/rss/all.xml', 'Al Jazeera') },
  { id: 'France24',    label: 'F24', color: '#003087', fn: () => fetchRSSFeed('https://www.france24.com/en/rss', 'France 24') },
  { id: 'Guardian',    label: 'GRD', color: '#005689', fn: () => searchGuardian('world politics conflict') },
  { id: 'NYT',         label: 'NYT', color: '#555',    fn: () => searchNYT('world news') },
  { id: 'GDELT',       label: 'GDL', color: '#7744cc', fn: () => searchGDELTNews('war conflict crisis protest') },
  { id: 'CrisisWatch', label: 'CW',  color: '#ff6600', fn: () => fetchRSSFeed('https://www.crisisgroup.org/rss/crisiswatch', 'CrisisWatch') },
]

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
        <div style={{ width: 2, background: open ? 'rgba(0,255,136,0.35)' : '#141e16', flexShrink: 0, alignSelf: 'stretch', transition: 'background .15s' }} />
        <div style={{ flex: 1, minWidth: 0, padding: '5px 8px' }}>
          <div style={{ fontSize: '10px', color: '#8aac90', lineHeight: 1.45, marginBottom: 3,
            ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
            {a.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '7.5px', color: '#4a6a50', fontWeight: 600, letterSpacing: '.05em' }}>{a.source}</span>
            {a.category && <span style={{ fontSize: '7px', color: '#2a3e2e', letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid #141e16', padding: '0 3px' }}>{a.category}</span>}
            <span style={{ fontSize: '7.5px', color: '#1a2e1e', marginLeft: 'auto' }}>{safeTimeAgo(a.publishedAt)}</span>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ width: '100%', borderTop: '1px solid #0d120e', padding: '6px 10px 8px', background: 'rgba(0,255,136,0.02)' }}
          onClick={e => e.stopPropagation()}>
          {a.imageUrl && (
            <img src={a.imageUrl} alt="" style={{ width: '100%', maxHeight: 90, objectFit: 'cover', marginBottom: 6, opacity: 0.85 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          )}
          {a.description && (
            <div style={{ fontSize: '9px', color: '#6a8aaa', lineHeight: 1.55, marginBottom: 6 }}>{a.description}</div>
          )}
          <a href={a.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '8px', color: '#00ff88', letterSpacing: '.08em', textDecoration: 'none', textTransform: 'uppercase', padding: '3px 7px', border: '1px solid rgba(0,255,136,0.25)', background: 'rgba(0,255,136,0.05)' }}>
            <ExternalLink size={8} /> OPEN ARTICLE
          </a>
        </div>
      )}
    </div>
  )
}

export function NewsPanel() {
  const [activeTab, setActiveTab] = useState('BBC')
  const [articles, setArticles]   = useState<NewsArticle[]>([])
  const [loading, setLoading]     = useState(false)

  const loadTab = useCallback(async (tabId: string) => {
    const tab = NEWS_TABS.find(t => t.id === tabId)
    if (!tab) return
    setLoading(true); setArticles([])
    try { setArticles(await tab.fn()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTab(activeTab) }, [activeTab, loadTab])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16', flexWrap: 'wrap' }}>
        {NEWS_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`news-tab ${activeTab === t.id ? 'active' : ''}`}
            style={activeTab === t.id ? { color: t.color, borderColor: t.color + '44' } : {}}
          >{t.label}</button>
        ))}
        <button onClick={() => loadTab(activeTab)} disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', opacity: loading ? 0.3 : 1, marginLeft: 'auto' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '8px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.12em' }}>// LOADING…</div>}
        {!loading && articles.length === 0 && <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO DATA</div>}
        {articles.map(a => <ArticleRow key={a.id} a={a} />)}
      </div>
    </>
  )
}

function CrisisRow({ c }: { c: CrisisEvent }) {
  const [open, setOpen] = useState(false)
  const col = SEV_COLORS[c.severity] || '#2a3e2e'
  return (
    <div className="intel-row" style={{ alignItems: 'flex-start', cursor: 'pointer', flexDirection: 'column', padding: 0 }} onClick={() => setOpen(v => !v)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: col, boxShadow: `0 0 4px ${col}66` }} />
        <div style={{ flex: 1, minWidth: 0, padding: '5px 8px' }}>
          <div style={{ fontSize: '10px', color: '#8aac90', lineHeight: 1.4, ...(!open ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}) }}>{c.title}</div>
          <div style={{ display: 'flex', gap: 5, fontSize: '8px', color: '#2a3e2e', marginTop: 2 }}>
            <span style={{ color: col, fontSize: '7px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', border: `1px solid ${col}44`, padding: '0 3px' }}>{c.severity}</span>
            <span>{c.country}</span>
            {c.fatalities ? <span style={{ color: '#ff1a3e' }}>⚠ {c.fatalities}</span> : null}
          </div>
        </div>
      </div>
      {open && (
        <div style={{ width: '100%', borderTop: '1px solid #0d120e', padding: '6px 10px 8px', background: 'rgba(255,26,62,0.02)' }}
          onClick={e => e.stopPropagation()}>
          {c.description && <div style={{ fontSize: '9px', color: '#6a8aaa', lineHeight: 1.55, marginBottom: 5 }}>{c.description}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '7.5px', color: '#4a6a50' }}>
            {c.type && <span style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.type}</span>}
            {c.date && <span>{new Date(c.date).toLocaleDateString()}</span>}
            {c.source && <span style={{ color: '#2a3e2e' }}>{c.source}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

const INTEL_TABS_LIST = ['Military', 'Conflict', 'Political', 'Economic'] as const
type IntelTab = typeof INTEL_TABS_LIST[number]
const TAB_TYPES: Record<IntelTab, CrisisEvent['type'][]> = {
  Military:  ['war', 'terrorism'],
  Conflict:  ['conflict', 'war'],
  Political: ['political', 'protest'],
  Economic:  ['political'],
}
const SEV_ORD: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function IntelPanel({ crises }: { crises: CrisisEvent[] }) {
  const [tab, setTab] = useState<IntelTab>('Military')
  const filtered = crises
    .filter(c => TAB_TYPES[tab].includes(c.type))
    .sort((a, b) => (SEV_ORD[a.severity] ?? 3) - (SEV_ORD[b.severity] ?? 3))
    .slice(0, 30)

  return (
    <>
      <div style={{ display: 'flex', gap: 2, padding: '3px 8px', borderBottom: '1px solid #141e16' }}>
        {INTEL_TABS_LIST.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`news-tab ${tab === t ? 'active' : ''}`}>{t.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO EVENTS</div>}
        {filtered.map(c => <CrisisRow key={c.id} c={c} />)}
      </div>
    </>
  )
}

export function LayersPanel({ panelState, onToggleLayer, deepstateMode, onDeepstateToggle }: {
  panelState: PanelState; onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean; onDeepstateToggle: () => void
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <button onClick={onDeepstateToggle} style={{
        width: '100%', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8,
        background: deepstateMode ? 'rgba(255,26,62,0.1)' : 'transparent',
        border: 'none', borderBottom: '1px solid #141e16',
        borderLeft: `2px solid ${deepstateMode ? '#ff1a3e' : 'transparent'}`,
        cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ width: 10, height: 10, flexShrink: 0, border: `1px solid ${deepstateMode ? '#ff1a3e' : '#141e16'}`, background: deepstateMode ? '#ff1a3e22' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {deepstateMode && <div style={{ width: 4, height: 4, background: '#ff1a3e' }} />}
        </div>
        <span style={{ fontSize: '7.5px', fontWeight: 700, letterSpacing: '.1em', color: deepstateMode ? '#ff1a3e' : '#2a3e2e', border: `1px solid ${deepstateMode ? '#ff1a3e44' : '#141e16'}`, padding: '0 3px', lineHeight: '14px', flexShrink: 0 }}>WAR</span>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: deepstateMode ? '#ff1a3e' : '#2a3e2e' }}>DeepState Ukraine</div>
          <div style={{ fontSize: '7.5px', color: '#1a2e1e' }}>battlefield overlay</div>
        </div>
      </button>
      {LAYERS_CONFIG.map(layer => {
        const on = panelState[layer.id]
        return (
          <button key={layer.id} onClick={() => onToggleLayer(layer.id)}
            className={`layer-row ${on ? 'on' : ''}`}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: on ? layer.color : '#2a3e2e' }}
          >
            <div style={{ width: 10, height: 10, flexShrink: 0, border: `1px solid ${on ? layer.color : '#141e16'}`, background: on ? layer.color + '22' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {on && <div style={{ width: 4, height: 4, background: layer.color }} />}
            </div>
            <span style={{ fontSize: '7.5px', fontWeight: 700, letterSpacing: '0.1em', color: on ? layer.color + 'aa' : '#141e16', border: `1px solid ${on ? layer.color + '44' : '#141e16'}`, padding: '0 3px', lineHeight: '14px', flexShrink: 0 }}>{layer.tag}</span>
            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '.08em' }}>{layer.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function RiskPanel({ crises }: { crises: CrisisEvent[] }) {
  const risks = computeCountryRisk(crises)
  const maxScore = Math.max(1, ...risks.map(r => r.score))

  // Count crisis types per country for mini breakdown
  const typeBreakdown = (country: string) => {
    const counts: Record<string, number> = {}
    for (const c of crises) {
      if (c.country === country) counts[c.type] = (counts[c.type] ?? 0) + 1
    }
    return counts
  }

  const riskLabel = (score: number) =>
    score >= 40 ? 'CRITICAL' : score >= 20 ? 'HIGH' : score >= 10 ? 'ELEVATED' : 'MODERATE'

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {risks.length === 0 && (
        <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.1em' }}>AWAITING CRISIS DATA</div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ width: '100%', display: 'flex', gap: 6, padding: '4px 10px', opacity: 0.3 }}>
              <div style={{ width: 20, height: 10, background: '#141e16', borderRadius: 2 }} />
              <div style={{ flex: 1, height: 4, background: '#141e16', borderRadius: 2, marginTop: 3 }} />
            </div>
          ))}
        </div>
      )}
      {risks.map((r, i) => {
        const color = riskColor(r.score)
        const pct = (r.score / maxScore) * 100
        const types = typeBreakdown(r.country)
        const label = riskLabel(r.score)
        return (
          <div key={r.country} style={{
            padding: '5px 10px', borderBottom: '1px solid #0d120e',
            borderLeft: `2px solid ${color}44`,
            transition: 'all .12s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,136,0.03)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
          >
            {/* Top row: rank, country, score badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 7, color: '#1a2e1e', width: 12, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#c0dcc4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.country}
              </span>
              <span style={{
                fontSize: 7, fontWeight: 800, color, letterSpacing: '.08em',
                background: `${color}14`, border: `1px solid ${color}33`,
                padding: '1px 5px', borderRadius: 2, flexShrink: 0,
              }}>{label}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right', flexShrink: 0 }}>
                {r.score}
              </span>
            </div>

            {/* Risk bar */}
            <div style={{ marginLeft: 18, height: 3, background: '#141e16', borderRadius: 2, marginBottom: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, pct)}%`, height: '100%',
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                borderRadius: 2, transition: 'width .6s ease',
              }} />
            </div>

            {/* Event type breakdown chips */}
            <div style={{ marginLeft: 18, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 6.5, color: '#4a6a50' }}>{r.events} events</span>
              {Object.entries(types).map(([type, count]) => (
                <span key={type} style={{
                  fontSize: 6, padding: '0 3px',
                  color: SEV_COLORS[type === 'war' ? 'critical' : type === 'conflict' ? 'high' : type === 'terrorism' ? 'high' : 'medium'] ?? '#4a6a50',
                  border: '1px solid #141e16', borderRadius: 1, letterSpacing: '.05em',
                }}>
                  {type.toUpperCase().slice(0, 3)} ×{count}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ThreatPanel({ crises, flights }: { crises: CrisisEvent[]; flights: Flight[] }) {
  const score = computeThreatScore(crises, flights)
  const R = 31, CX = 40, CY = 40
  const arc   = 2 * Math.PI * R * (score / 100)
  const total = 2 * Math.PI * R
  const color = score >= 80 ? '#ff1a3e' : score >= 60 ? '#ff4400' : score >= 40 ? '#ffaa00' : score >= 20 ? '#ffcc00' : '#00ff88'
  const label = score >= 80 ? 'CRITICAL' : score >= 60 ? 'ELEVATED' : score >= 40 ? 'HIGH' : score >= 20 ? 'MODERATE' : 'NORMAL'
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }}>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * 2 * Math.PI - Math.PI / 2
            return <line key={i} x1={CX + 36 * Math.cos(a)} y1={CY + 36 * Math.sin(a)} x2={CX + 39 * Math.cos(a)} y2={CY + 39 * Math.sin(a)} stroke="#141e16" strokeWidth="1" />
          })}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#141e16" strokeWidth="5" />
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${arc} ${total}`} strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ filter: `drop-shadow(0 0 4px ${color}88)`, transition: 'all 1s' }} />
          <circle cx={CX} cy={CY} r={23} fill="none" stroke="#0d120e" strokeWidth="1" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.15em', color }}>{label}</div>
        <div style={{ fontSize: '8px', color: '#2a3e2e', letterSpacing: '.1em', marginTop: 1 }}>// TREND STABLE</div>
      </div>
    </div>
  )
}

export function StockRow({ s }: { s: Stock }) {
  const pos = s.changePercent >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid #141e16', borderLeft: '2px solid transparent', transition: 'all .1s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,136,0.04)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'rgba(0,255,136,0.18)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
    >
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#c0dcc4' }}>{s.symbol}</div>
        <div style={{ fontSize: '7.5px', color: '#2a3e2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{s.exchange || s.name}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '10px', color: '#8aac90', fontVariantNumeric: 'tabular-nums' }}>${s.price.toFixed(2)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', fontSize: '8px', color: pos ? '#00ff88' : '#ff1a3e' }}>
          {pos ? <TrendingUp size={7} /> : <TrendingDown size={7} />}
          {pos ? '+' : ''}{s.changePercent.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

export function StockList({ symbols }: { symbols: string[] }) {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const hasFinnhub = !!import.meta.env.VITE_FINNHUB_KEY
  const key = symbols.join(',')

  useEffect(() => {
    if (!hasFinnhub) return
    setLoading(true)
    fetchMultipleQuotes(symbols).then(setStocks).finally(() => setLoading(false))
    const timer = window.setInterval(() => { fetchMultipleQuotes(symbols).then(setStocks) }, 60_000)
    return () => clearInterval(timer)
  }, [key, retryCount]) // eslint-disable-line

  if (!hasFinnhub) return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.1em', textAlign: 'center' }}>MARKET DATA UNAVAILABLE</div>
      <div style={{ fontSize: 7, color: '#1a2e1e', textAlign: 'center', lineHeight: 1.6 }}>
        Add VITE_FINNHUB_KEY to .env<br />to enable live market feeds
      </div>
      {/* Skeleton rows */}
      {symbols.slice(0, 4).map((sym, i) => (
        <div key={i} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', opacity: 0.3 }}>
          <div style={{ fontSize: 8, color: '#2a3e2e', width: 36, fontWeight: 700 }}>{sym}</div>
          <div style={{ flex: 1, height: 3, background: '#141e16', borderRadius: 2 }} />
          <div style={{ width: 40, height: 8, background: '#141e16', borderRadius: 2 }} />
        </div>
      ))}
    </div>
  )
  if (loading && stocks.length === 0) return (
    <div style={{ padding: '8px 10px' }}>
      {symbols.slice(0, 6).map((sym, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid #0d120e' }}>
          <div style={{ fontSize: 8, color: '#2a3e2e', width: 36, fontWeight: 700 }}>{sym}</div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 3, background: '#141e16', borderRadius: 2, width: `${60 + (i * 7) % 30}%`, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.5 }} />
          </div>
          <div style={{ width: 44, height: 8, background: '#141e16', borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.4 }} />
        </div>
      ))}
    </div>
  )
  if (!loading && stocks.length === 0) return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.1em' }}>DATA FEED INTERRUPTED</div>
      <div style={{ fontSize: 7, color: '#1a2e1e', textAlign: 'center', lineHeight: 1.5 }}>
        Market data temporarily unavailable.<br />Finnhub may be rate-limiting.
      </div>
      <button
        onClick={() => setRetryCount(c => c + 1)}
        style={{
          background: 'rgba(0,170,255,0.08)', border: '1px solid #00aaff33',
          color: '#00aaff', cursor: 'pointer', fontSize: 7.5, padding: '3px 12px',
          letterSpacing: '.1em', fontWeight: 700, fontFamily: 'inherit',
        }}
      >↻ RETRY</button>
    </div>
  )
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {stocks.map(s => <StockRow key={s.symbol} s={s} />)}
    </div>
  )
}

// ── Outages panel ──────────────────────────────────────────────────────────────
const OUTAGE_TABS = ['All', 'Country', 'ASN', 'Region'] as const
type OutageTab = typeof OUTAGE_TABS[number]

const LOOKBACK_OPTIONS = [
  { label: '6h',  hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
]

function outageScoreColor(score: number): string {
  if (score >= 500) return '#ff1a3e'
  if (score >= 200) return '#ff6600'
  if (score >= 50)  return '#ffaa00'
  return '#00ff88'
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
    return () => clearInterval(t)
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16', flexWrap: 'wrap' }}>
        {LOOKBACK_OPTIONS.map(o => (
          <button key={o.label} onClick={() => setLookback(o.hours)}
            className={`news-tab ${lookback === o.hours ? 'active' : ''}`}>
            {o.label}
          </button>
        ))}
        <button onClick={load} disabled={loading} title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', opacity: loading ? 0.3 : 1, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Type filter tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16' }}>
        {OUTAGE_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`news-tab ${tab === t ? 'active' : ''}`}>
            {t.toUpperCase()}
          </button>
        ))}
        {lastFetch && (
          <span style={{ marginLeft: 'auto', fontSize: '7px', color: '#1a2e1e', alignSelf: 'center', letterSpacing: '.06em' }}>
            {formatDistanceToNow(new Date(lastFetch), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && events.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.12em' }}>// QUERYING IODA…</div>
        )}
        {!loading && error && (
          <div style={{ padding: '8px 10px', fontSize: '9px', color: '#ff1a3e66', letterSpacing: '.08em' }}>// {error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO OUTAGES DETECTED</div>
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
              <div style={{ fontSize: '10px', color: '#8aac90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                {ev.entityName}
              </div>
              <div style={{ display: 'flex', gap: 5, fontSize: '7.5px', color: '#2a3e2e', marginTop: 1, flexWrap: 'wrap' }}>
                <span style={{
                  color: outageScoreColor(ev.score),
                  border: `1px solid ${outageScoreColor(ev.score)}44`,
                  padding: '0 3px', fontWeight: 700, letterSpacing: '.08em',
                  textTransform: 'uppercase', fontSize: '7px',
                }}>
                  {ev.score >= 500 ? 'CRITICAL' : ev.score >= 200 ? 'MAJOR' : ev.score >= 50 ? 'MODERATE' : 'MINOR'}
                </span>
                <span style={{ color: '#1a2e1e', textTransform: 'uppercase', fontSize: '7px', letterSpacing: '.06em' }}>{ev.entityType}</span>
                {ev.duration > 0 && (
                  <span style={{ color: '#2a3e2e' }}>⏱ {formatDuration(ev.duration)}</span>
                )}
                {ev.start > 0 && (
                  <span style={{ color: '#1a2e1e' }}>{formatOutageTime(ev.start)}</span>
                )}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: 4 }}>
              <div style={{ fontSize: '10px', fontVariantNumeric: 'tabular-nums', color: outageScoreColor(ev.score), fontWeight: 700 }}>
                {ev.score}
              </div>
              <div style={{ fontSize: '7px', color: '#1a2e1e' }}>score</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── CrisisWatch Panel ─────────────────────────────────────────────────────────
const TREND_META: Record<CrisisWatchEntry['trend'], { label: string; color: string; icon: string }> = {
  deteriorated: { label: 'DETERIORATED', color: '#ff1a3e', icon: '▼' },
  alert:        { label: 'ALERT',        color: '#ff6600', icon: '⚠' },
  unchanged:    { label: 'UNCHANGED',    color: '#ffcc00', icon: '●' },
  improved:     { label: 'IMPROVED',     color: '#00ff88', icon: '▲' },
  unknown:      { label: 'MONITOR',      color: '#4a6a50', icon: '○' },
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
    return () => clearInterval(t)
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16', flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('All')}
          className={`news-tab ${filter === 'All' ? 'active' : ''}`}>ALL <span style={{ fontSize: '7px', color: '#2a3e2e' }}>{entries.length}</span>
        </button>
        {(['deteriorated', 'alert', 'improved', 'unchanged'] as const).map(t => {
          const m = TREND_META[t]
          return (
            <button key={t} onClick={() => setFilter(t)}
              className={`news-tab ${filter === t ? 'active' : ''}`}
              style={filter === t ? { color: m.color, borderColor: m.color + '44' } : {}}
            >
              {m.icon} <span style={{ fontSize: '7px', color: filter === t ? m.color : '#2a3e2e' }}>{counts[t] ?? 0}</span>
            </button>
          )
        })}
        <button onClick={load} disabled={loading} title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', opacity: loading ? 0.3 : 1, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Region tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16', overflowX: 'auto' }}>
        {CW_REGIONS.map(r => (
          <button key={r} onClick={() => setRegion(r)}
            className={`news-tab ${region === r ? 'active' : ''}`}
            style={{ whiteSpace: 'nowrap' }}>
            {r === 'Global' ? 'CW' : r === 'All' ? 'ALL' : r.toUpperCase()}
          </button>
        ))}
        {lastFetch && (
          <span style={{ marginLeft: 'auto', fontSize: '7px', color: '#1a2e1e', alignSelf: 'center', whiteSpace: 'nowrap', letterSpacing: '.05em' }}>
            {formatDistanceToNow(new Date(lastFetch), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && filtered.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.12em' }}>// FETCHING ICG FEEDS…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO ENTRIES MATCHED</div>
        )}
        {filtered.map(e => {
          const m = TREND_META[e.trend]
          return (
            <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer"
              className="intel-row" style={{ alignItems: 'flex-start', textDecoration: 'none' }}>
              <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: m.color, boxShadow: `0 0 4px ${m.color}66` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: '#8aac90', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {e.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ fontSize: '7px', fontWeight: 700, color: m.color, border: `1px solid ${m.color}44`, padding: '0 3px', letterSpacing: '.08em', flexShrink: 0 }}>
                    {m.icon} {m.label}
                  </span>
                  <span style={{ fontSize: '7.5px', color: '#2a3e2e', letterSpacing: '.04em' }}>{e.source}</span>
                  <span style={{ fontSize: '7px', color: '#1a2e1e', marginLeft: 'auto', flexShrink: 0 }}>{safeTimeAgo(e.publishedAt)}</span>
                  <ExternalLink size={7} style={{ color: '#1a2e1e', flexShrink: 0 }} />
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
      fetchRSSFeed('https://feeds.reuters.com/reuters/worldNews', 'Reuters'),
      fetchRSSFeed('https://rss.dw.com/xml/rss-en-world', 'DW News'),
      fetchRSSFeed('https://www.aljazeera.com/xml/rss/all.xml', 'Al Jazeera'),
      fetchRSSFeed('https://www.crisisgroup.org/rss/crisiswatch', 'CrisisWatch'),
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
    return <div style={{ padding: '12px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.1em', textAlign: 'center' }}>// TYPE A SEARCH QUERY TO ANALYZE</div>
  }

  return (
    <>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16' }}>
        {BRIEF_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`news-tab ${tab === t ? 'active' : ''}`}>
            {t}
            <span style={{ marginLeft: 3, fontSize: '7px', color: '#2a3e2e' }}>
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
            ? <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO EVENTS MATCHED</div>
            : filteredCrises.slice(0, 40).map(c => (
              <div key={c.id} className="intel-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: SEV_COLORS[c.severity] || '#2a3e2e', boxShadow: `0 0 4px ${SEV_COLORS[c.severity] || '#2a3e2e'}66` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', color: '#8aac90', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                  <div style={{ display: 'flex', gap: 5, fontSize: '8px', color: '#2a3e2e' }}>
                    <span style={{ color: SEV_COLORS[c.severity] || '#2a3e2e', fontSize: '7px', fontWeight: 700, letterSpacing: '.1em', border: `1px solid ${SEV_COLORS[c.severity] || '#2a3e2e'}44`, padding: '0 3px' }}>{c.severity?.toUpperCase()}</span>
                    <span>{c.country}</span>
                    {c.fatalities ? <span style={{ color: '#ff1a3e' }}>⚠ {c.fatalities}</span> : null}
                  </div>
                </div>
              </div>
            ))
        )}

        {tab === 'NEWS' && (
          newsLoading && news.length === 0
            ? <div style={{ padding: '8px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.12em' }}>// QUERYING ALL SOURCES…</div>
            : news.length === 0
              ? <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO NEWS MATCHED</div>
              : news.slice(0, 50).map(a => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="intel-row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ width: 1, background: '#141e16', flexShrink: 0, alignSelf: 'stretch' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '9.5px', color: '#8aac90', lineHeight: 1.4, marginBottom: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '7.5px', color: '#2a3e2e' }}>{a.source}</span>
                      <span style={{ fontSize: '7.5px', color: '#1a2e1e' }}>{safeTimeAgo(a.publishedAt)}</span>
                      <ExternalLink size={7} style={{ color: '#1a2e1e' }} />
                    </div>
                  </div>
                </a>
              ))
        )}

        {tab === 'AIR' && (
          filteredFlights.length === 0
            ? <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO FLIGHTS MATCHED</div>
            : filteredFlights.slice(0, 60).map(f => (
              <div key={f.icao24} className="intel-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', color: '#00ff88', fontWeight: 700 }}>{f.callsign || f.icao24}</div>
                  <div style={{ display: 'flex', gap: 6, fontSize: '7.5px', color: '#2a3e2e' }}>
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
            ? <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO OUTAGES MATCHED</div>
            : outages.map(ev => (
              <div key={ev.id} className="intel-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: outageScoreColor(ev.score), boxShadow: `0 0 4px ${outageScoreColor(ev.score)}66` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', color: '#8aac90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.entityName}</div>
                  <div style={{ display: 'flex', gap: 5, fontSize: '7.5px', color: '#2a3e2e' }}>
                    <span style={{ color: outageScoreColor(ev.score), fontWeight: 700, fontSize: '7px', border: `1px solid ${outageScoreColor(ev.score)}44`, padding: '0 3px' }}>
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

// ── Unified PanelContent renderer ─────────────────────────────────────────────
export interface PanelContentProps {
  id: PanelId
  crises: CrisisEvent[]
  flights: Flight[]
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  deepstateMode: boolean
  onDeepstateToggle: () => void
  searchQuery?: string
  onGeoSearch?: (q: string) => void
  onCountryClick?: (country: string) => void
}

// ── Drug Trafficking Panel ─────────────────────────────────────────────────────
const DRUG_TABS = [
  { id: 'Global',   q: 'drug trafficking seizure cartel narcotics bust sourcelang:english' },
  { id: 'Americas', q: 'cartel cocaine fentanyl smuggling Mexico Colombia sourcelang:english' },
  { id: 'Europe',   q: 'drug seizure narcotics trafficking Europe Europol sourcelang:english' },
  { id: 'Asia',     q: 'drug trafficking methamphetamine heroin Asia sourcelang:english' },
  { id: 'Africa',   q: 'drug trafficking narcotics seizure Africa sourcelang:english' },
  { id: 'MENA',     q: 'drug trafficking narcotics Captagon Middle East sourcelang:english' },
] as const
type DrugTab = typeof DRUG_TABS[number]['id']

export function DrugTrafficPanel() {
  const [tab, setTab]         = useState<DrugTab>('Global')
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading]   = useState(false)
  const [lastFetch, setLastFetch] = useState<number | null>(null)

  const load = useCallback(async (t: DrugTab) => {
    const entry = DRUG_TABS.find(d => d.id === t)
    if (!entry) return
    setLoading(true); setArticles([])
    try {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(entry.q)}&mode=artlist&maxrecords=50&format=json&sort=DateDesc`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`GDELT ${res.status}`)
      const json = await res.json()
      const mapped: NewsArticle[] = (json.articles || []).map((a: { url: string; title: string; seendate: string; socialimage?: string; domain: string }, i: number) => ({
        id:          `drug-${t}-${i}`,
        title:       a.title,
        description: '',
        url:         a.url,
        source:      a.domain,
        publishedAt: a.seendate,
        imageUrl:    a.socialimage,
      }))
      setArticles(mapped)
      setLastFetch(Date.now())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  // Auto-refresh 30 min
  useEffect(() => {
    const t = window.setInterval(() => load(tab), 30 * 60_000)
    return () => clearInterval(t)
  }, [tab, load])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16', flexWrap: 'wrap' }}>
        {DRUG_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`news-tab ${tab === t.id ? 'active' : ''}`}
            style={tab === t.id ? { color: '#ff1a3e', borderColor: '#ff1a3e44' } : {}}>
            {t.id.toUpperCase()}
          </button>
        ))}
        <button onClick={() => load(tab)} disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', opacity: loading ? 0.3 : 1, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {lastFetch && (
        <div style={{ padding: '2px 8px', fontSize: '7px', color: '#1a2e1e', borderBottom: '1px solid #0d120e', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 4, height: 4, background: '#ff1a3e', borderRadius: '50%', display: 'inline-block' }} />
          LIVE · GDELT · {articles.length} REPORTS · {formatDistanceToNow(new Date(lastFetch), { addSuffix: true })}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '8px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.12em' }}>// QUERYING INTEL…</div>}
        {!loading && articles.length === 0 && <div style={{ padding: '8px 10px', fontSize: '9px', color: '#1a2e1e', letterSpacing: '.1em' }}>// NO REPORTS</div>}
        {articles.map(a => <ArticleRow key={a.id} a={a} />)}
      </div>
    </>
  )
}

// ── World Exchanges Panel ──────────────────────────────────────────────────────
const WORLD_EXCHANGES: { country: string; flag: string; exchange: string; ticker: string; url: string }[] = [
  { country: 'United States', flag: '🇺🇸', exchange: 'NYSE / NASDAQ',    ticker: 'SPY',      url: 'https://finance.yahoo.com/quote/SPY' },
  { country: 'United Kingdom',flag: '🇬🇧', exchange: 'London (LSE)',      ticker: 'EWU',      url: 'https://finance.yahoo.com/quote/EWU' },
  { country: 'Germany',       flag: '🇩🇪', exchange: 'Frankfurt (DAX)',   ticker: 'EWG',      url: 'https://finance.yahoo.com/quote/EWG' },
  { country: 'France',        flag: '🇫🇷', exchange: 'Euronext Paris',    ticker: 'EWQ',      url: 'https://finance.yahoo.com/quote/EWQ' },
  { country: 'Japan',         flag: '🇯🇵', exchange: 'Tokyo (TSE)',        ticker: 'EWJ',      url: 'https://finance.yahoo.com/quote/EWJ' },
  { country: 'China',         flag: '🇨🇳', exchange: 'Shanghai / Shenzhen',ticker:'FXI',      url: 'https://finance.yahoo.com/quote/FXI' },
  { country: 'Hong Kong',     flag: '🇭🇰', exchange: 'HKEX',              ticker: 'EWH',      url: 'https://finance.yahoo.com/quote/EWH' },
  { country: 'India',         flag: '🇮🇳', exchange: 'BSE / NSE',         ticker: 'INDA',     url: 'https://finance.yahoo.com/quote/INDA' },
  { country: 'Brazil',        flag: '🇧🇷', exchange: 'B3 (Bovespa)',       ticker: 'EWZ',      url: 'https://finance.yahoo.com/quote/EWZ' },
  { country: 'Canada',        flag: '🇨🇦', exchange: 'TSX',               ticker: 'EWC',      url: 'https://finance.yahoo.com/quote/EWC' },
  { country: 'Australia',     flag: '🇦🇺', exchange: 'ASX',               ticker: 'EWA',      url: 'https://finance.yahoo.com/quote/EWA' },
  { country: 'South Korea',   flag: '🇰🇷', exchange: 'KRX (KOSPI)',        ticker: 'EWY',      url: 'https://finance.yahoo.com/quote/EWY' },
  { country: 'Taiwan',        flag: '🇹🇼', exchange: 'TWSE',              ticker: 'EWT',      url: 'https://finance.yahoo.com/quote/EWT' },
  { country: 'Switzerland',   flag: '🇨🇭', exchange: 'SIX',               ticker: 'EWL',      url: 'https://finance.yahoo.com/quote/EWL' },
  { country: 'Netherlands',   flag: '🇳🇱', exchange: 'Euronext Amsterdam', ticker: 'EWN',      url: 'https://finance.yahoo.com/quote/EWN' },
  { country: 'Sweden',        flag: '🇸🇪', exchange: 'Nasdaq Stockholm',   ticker: 'EWD',      url: 'https://finance.yahoo.com/quote/EWD' },
  { country: 'Spain',         flag: '🇪🇸', exchange: 'BME (IBEX 35)',      ticker: 'EWP',      url: 'https://finance.yahoo.com/quote/EWP' },
  { country: 'Italy',         flag: '🇮🇹', exchange: 'Borsa Italiana',     ticker: 'EWI',      url: 'https://finance.yahoo.com/quote/EWI' },
  { country: 'Mexico',        flag: '🇲🇽', exchange: 'BMV (IPC)',          ticker: 'EWW',      url: 'https://finance.yahoo.com/quote/EWW' },
  { country: 'Russia',        flag: '🇷🇺', exchange: 'MOEX',              ticker: 'ERUS',     url: 'https://finance.yahoo.com/quote/ERUS' },
  { country: 'Saudi Arabia',  flag: '🇸🇦', exchange: 'Tadawul (TASI)',     ticker: 'KSA',      url: 'https://finance.yahoo.com/quote/KSA' },
  { country: 'UAE',           flag: '🇦🇪', exchange: 'DFM / ADX',         ticker: 'UAE',      url: 'https://finance.yahoo.com/quote/UAE' },
  { country: 'South Africa',  flag: '🇿🇦', exchange: 'JSE',               ticker: 'EZA',      url: 'https://finance.yahoo.com/quote/EZA' },
  { country: 'Singapore',     flag: '🇸🇬', exchange: 'SGX',               ticker: 'EWS',      url: 'https://finance.yahoo.com/quote/EWS' },
  { country: 'Indonesia',     flag: '🇮🇩', exchange: 'IDX (JCI)',          ticker: 'EIDO',     url: 'https://finance.yahoo.com/quote/EIDO' },
  { country: 'Malaysia',      flag: '🇲🇾', exchange: 'Bursa Malaysia',     ticker: 'EWM',      url: 'https://finance.yahoo.com/quote/EWM' },
  { country: 'Thailand',      flag: '🇹🇭', exchange: 'SET',               ticker: 'THD',      url: 'https://finance.yahoo.com/quote/THD' },
  { country: 'Turkey',        flag: '🇹🇷', exchange: 'Borsa Istanbul (BIST)',ticker:'TUR',     url: 'https://finance.yahoo.com/quote/TUR' },
  { country: 'Poland',        flag: '🇵🇱', exchange: 'GPW (WIG)',          ticker: 'EPOL',     url: 'https://finance.yahoo.com/quote/EPOL' },
  { country: 'Israel',        flag: '🇮🇱', exchange: 'TASE',              ticker: 'EIS',      url: 'https://finance.yahoo.com/quote/EIS' },
  { country: 'Greece',        flag: '🇬🇷', exchange: 'Athens (ATHEX)',      ticker: 'GREK',     url: 'https://finance.yahoo.com/quote/GREK' },
  { country: 'Argentina',     flag: '🇦🇷', exchange: 'BCBA (MERVAL)',      ticker: 'ARGT',     url: 'https://finance.yahoo.com/quote/ARGT' },
  { country: 'Chile',         flag: '🇨🇱', exchange: 'Bolsa de Santiago',  ticker: 'ECH',      url: 'https://finance.yahoo.com/quote/ECH' },
  { country: 'Colombia',      flag: '🇨🇴', exchange: 'BVC',               ticker: 'GXG',      url: 'https://finance.yahoo.com/quote/GXG' },
  { country: 'Peru',          flag: '🇵🇪', exchange: 'BVL',               ticker: 'EPU',      url: 'https://finance.yahoo.com/quote/EPU' },
  { country: 'Nigeria',       flag: '🇳🇬', exchange: 'NGX',               ticker: 'NGE',      url: 'https://finance.yahoo.com/quote/NGE' },
  { country: 'Egypt',         flag: '🇪🇬', exchange: 'EGX',               ticker: 'EGPT',     url: 'https://finance.yahoo.com/quote/EGPT' },
  { country: 'Pakistan',      flag: '🇵🇰', exchange: 'PSX (KSE-100)',      ticker: 'PAK',      url: 'https://finance.yahoo.com/quote/PAK' },
  { country: 'Vietnam',       flag: '🇻🇳', exchange: 'HOSE / HNX',         ticker: 'VNM',      url: 'https://finance.yahoo.com/quote/VNM' },
  { country: 'Qatar',         flag: '🇶🇦', exchange: 'QSE',               ticker: 'QAT',      url: 'https://finance.yahoo.com/quote/QAT' },
  { country: 'Kuwait',        flag: '🇰🇼', exchange: 'Boursa Kuwait',      ticker: 'KWEB',     url: 'https://www.boursakuwait.com.kw/en' },
  { country: 'Philippines',   flag: '🇵🇭', exchange: 'PSE (PSEi)',         ticker: 'EPHE',     url: 'https://finance.yahoo.com/quote/EPHE' },
  { country: 'Czech Republic',flag: '🇨🇿', exchange: 'Prague (PX)',         ticker: 'CQQQ',     url: 'https://www.pse.cz/en' },
  { country: 'Hungary',       flag: '🇭🇺', exchange: 'Budapest (BUX)',      ticker: 'MSFE',     url: 'https://finance.yahoo.com/quote/MSFE' },
  { country: 'Romania',       flag: '🇷🇴', exchange: 'BVB',               ticker: 'MSFT',     url: 'https://www.bvb.ro' },
]

export function ExchangesPanel() {
  const [search, setSearch] = useState('')
  const tickers = WORLD_EXCHANGES.map(e => e.ticker)
  const { stocks, loading } = useStockQuotes(tickers)

  const filtered = search.trim()
    ? WORLD_EXCHANGES.filter(e =>
        e.country.toLowerCase().includes(search.toLowerCase()) ||
        e.exchange.toLowerCase().includes(search.toLowerCase()) ||
        e.ticker.toLowerCase().includes(search.toLowerCase())
      )
    : WORLD_EXCHANGES

  return (
    <>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #141e16' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search country or exchange…"
          style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #141e16', color: '#c0dcc4', fontSize: 9, padding: '3px 7px', outline: 'none', fontFamily: 'inherit', letterSpacing: '.03em' }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '8px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.12em' }}>// LOADING QUOTES…</div>}
        {filtered.map(ex => {
          const q = stocks.find(s => s.symbol === ex.ticker)
          const chg = q?.changePercent ?? null
          const chgColor = chg === null ? '#2a3e2e' : chg >= 0 ? '#00ff88' : '#ff1a3e'
          return (
            <div key={ex.ticker} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid #0d120e', transition: 'background .1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,136,0.03)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
            >
              <span style={{ fontSize: 12, flexShrink: 0 }}>{ex.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '9px', color: '#8aac90', fontWeight: 600, letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.country}</div>
                <div style={{ fontSize: '7.5px', color: '#2a3e2e', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.exchange}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '9px', color: '#8aac90', fontVariantNumeric: 'tabular-nums' }}>
                  {q ? q.price.toFixed(2) : '—'}
                </div>
                <div style={{ fontSize: '7.5px', color: chgColor, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {chg !== null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : ''}
                </div>
              </div>
              <a href={ex.url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#1a2e1e', fontSize: 8, flexShrink: 0 }}
                title={`Open ${ex.exchange}`}
                onClick={e => e.stopPropagation()}>
                <ExternalLink size={9} />
              </a>
            </div>
          )
        })}
      </div>
    </>
  )
}

// small hook used by ExchangesPanel only
function useStockQuotes(symbols: string[]) {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!symbols.length) return
    setLoading(true)
    fetchMultipleQuotes(symbols).then(s => { setStocks(s); setLoading(false) }).catch(() => setLoading(false))
  }, []) // eslint-disable-line
  return { stocks, loading }
}

// ── Sanctions Panel ────────────────────────────────────────────────────────────
const SEV_ORDER: SanctionedCountry['severity'][] = ['critical', 'high', 'medium', 'low']
export function SanctionsPanel() {
  const [filter, setFilter] = useState('')
  const [sevFilter, setSevFilter] = useState<string>('all')
  const q = filter.trim().toLowerCase()
  const rows = SANCTIONED_COUNTRIES
    .filter(c => sevFilter === 'all' || c.severity === sevFilter)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q) || c.regimes.some(r => r.toLowerCase().includes(q)))
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))

  return (
    <>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #141e16', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(['all','critical','high','medium','low'] as const).map(s => (
          <button key={s} onClick={() => setSevFilter(s)}
            className={`news-tab ${sevFilter === s ? 'active' : ''}`}
            style={sevFilter === s && s !== 'all' ? { color: s === 'critical' ? '#ff1a3e' : s === 'high' ? '#ff6600' : s === 'medium' ? '#ffcc00' : '#8888ff', borderColor: `${SANCTION_COLORS[s as SanctionedCountry['severity']]}44` } : {}}>
            {s.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ padding: '3px 8px', borderBottom: '1px solid #0d120e' }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search country, regime…"
          style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #141e16', color: '#c0dcc4', fontSize: 9, padding: '2px 6px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map(c => {
          const color = SANCTION_COLORS[c.severity]
          return (
            <div key={c.iso2} style={{ padding: '5px 8px', borderBottom: '1px solid #0d120e', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ width: 2, background: color, flexShrink: 0, alignSelf: 'stretch', boxShadow: `0 0 4px ${color}66` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#c0dcc4' }}>{c.name}</span>
                  <span style={{ fontSize: '6.5px', color: color, border: `1px solid ${color}55`, padding: '0 3px', fontWeight: 700, letterSpacing: '.08em' }}>{c.severity.toUpperCase()}</span>
                  {c.since && <span style={{ fontSize: '7px', color: '#2a3e2e', marginLeft: 'auto' }}>since {c.since}</span>}
                </div>
                <div style={{ fontSize: '8px', color: '#6a8aaa', lineHeight: 1.5, marginBottom: 3 }}>{c.summary}</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {c.regimes.map(r => <span key={r} style={{ fontSize: '6.5px', border: '1px solid #0a3050', color: '#00ff88', padding: '0 3px' }}>{r}</span>)}
                  {c.categories.map(cat => <span key={cat} style={{ fontSize: '6.5px', border: '1px solid #2a1520', color: '#ff8844', padding: '0 3px' }}>{cat.replace('_',' ')}</span>)}
                </div>
                {c.totalDesignations && <div style={{ fontSize: '7px', color: '#1a2e1e', marginTop: 2 }}>~{c.totalDesignations.toLocaleString()} designations</div>}
              </div>
            </div>
          )
        })}
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
      <div style={{ padding: '3px 8px', borderBottom: '1px solid #141e16', display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`news-tab ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>ALL</button>
        {types.map(t => (
          <button key={t} className={`news-tab ${typeFilter === t ? 'active' : ''}`}
            onClick={() => setTypeFilter(t)}
            style={typeFilter === t ? { color: FACILITY_COLORS[t as keyof typeof FACILITY_COLORS], borderColor: `${FACILITY_COLORS[t as keyof typeof FACILITY_COLORS]}44` } : {}}>
            {t.replace('_',' ').toUpperCase().slice(0,4)}
          </button>
        ))}
      </div>
      <div style={{ padding: '3px 8px', borderBottom: '1px solid #0d120e' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, country, operator…"
          style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #141e16', color: '#c0dcc4', fontSize: 9, padding: '2px 6px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <div style={{ padding: '2px 8px', borderBottom: '1px solid #0d120e', fontSize: '7px', color: '#1a2e1e' }}>{rows.length} facilities</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map(f => {
          const color = FACILITY_COLORS[f.type]
          return (
            <div key={f.id}
              onClick={() => onGeoSearch?.(`${f.lat},${f.lng}`)}
              style={{ padding: '5px 8px', borderBottom: '1px solid #0d120e', display: 'flex', gap: 6, alignItems: 'flex-start', cursor: onGeoSearch ? 'pointer' : 'default', transition: 'background .1s' }}
              onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,136,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
              title={onGeoSearch ? `Fly to ${f.name}` : undefined}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3, boxShadow: `0 0 4px ${color}88` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#c0dcc4' }}>{f.name}</span>
                  {f.nuclear && <span style={{ fontSize: '6.5px', color: '#ff4444', border: '1px solid #ff444433', padding: '0 3px' }}>☢ NUC</span>}
                </div>
                <div style={{ fontSize: '7.5px', color: '#4a6a50', marginBottom: 3 }}>
                  <span style={{ color }}>{FACILITY_LABELS[f.type]}</span>
                  <span style={{ color: '#2a3e2e' }}> · {f.operator} → {f.host}</span>
                  {f.personnel ? <span style={{ color: '#1a2e1e' }}> · {f.personnel.toLocaleString()} personnel</span> : null}
                </div>
                <div style={{ fontSize: '8px', color: '#6a8aaa', lineHeight: 1.5 }}>{f.notes}</div>
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
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16' }}>
        <button className={`news-tab ${tab==='power'?'active':''}`} onClick={() => setTab('power')} style={tab==='power'?{color:'#ffdd00',borderColor:'#ffdd0044'}:{}}>☢ POWER PLANTS</button>
        <button className={`news-tab ${tab==='weapons'?'active':''}`} onClick={() => setTab('weapons')} style={tab==='weapons'?{color:'#ff1a3e',borderColor:'#ff1a3e44'}:{}}>💣 WEAPONS SITES</button>
      </div>
      <div style={{ padding: '3px 8px', borderBottom: '1px solid #0d120e' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab==='power'?'Search plant, country…':'Search facility, operator…'}
          style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #141e16', color: '#c0dcc4', fontSize: 9, padding: '2px 6px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <div style={{ padding: '2px 8px', borderBottom: '1px solid #0d120e', fontSize: '7px', color: '#1a2e1e' }}>
        {tab === 'power' ? `${plants.length} facilities` : `${weapons.length} sites`}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'power' && plants.map(p => {
          const color = PLANT_STATUS_COLORS[p.status]
          return (
            <div key={p.id} style={{ padding: '5px 8px', borderBottom: '1px solid #0d120e', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#c0dcc4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: '6.5px', color, border: `1px solid ${color}55`, padding: '0 3px', flexShrink: 0 }}>{p.status.replace('_',' ').toUpperCase()}</span>
                </div>
                <div style={{ fontSize: '7.5px', color: '#4a6a50', marginBottom: 3 }}>
                  {p.country} · <span style={{ color: '#ffdd00' }}>{p.type}</span> · {p.reactors} reactor{p.reactors !== 1 ? 's' : ''} · {p.capacity.toLocaleString()} MWe
                </div>
                <div style={{ fontSize: '8px', color: '#6a8aaa', lineHeight: 1.5 }}>{p.notes}</div>
              </div>
            </div>
          )
        })}
        {tab === 'weapons' && weapons.map(f => (
          <div key={f.id} style={{ padding: '5px 8px', borderBottom: '1px solid #0d120e', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff0033', flexShrink: 0, marginTop: 3, boxShadow: '0 0 6px #ff003388' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#c0dcc4' }}>{f.name}</span>
                {f.status === 'suspected' && <span style={{ fontSize: '6.5px', color: '#ff8844', border: '1px solid #ff884433', padding: '0 3px' }}>SUSPECTED</span>}
              </div>
              <div style={{ fontSize: '7.5px', color: '#4a6a50', marginBottom: 3 }}>{f.operator} → {f.host}{f.since ? ` · since ${f.since}` : ''}</div>
              <div style={{ fontSize: '8px', color: '#6a8aaa', lineHeight: 1.5 }}>{f.notes}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Airspace Monitor Panel ─────────────────────────────────────────────────────
const SEV_COL: Record<string, string> = { critical: '#ff1a3e', warning: '#ff8800', info: '#ffcc00' }
const STATUS_COL: Record<string, string> = { closed: '#ff1a3e', restricted: '#ff8800', normal: '#00ff88' }

export function AirspacePanel({ flights }: { flights: { latitude: number | null; longitude: number | null }[] }) {
  const [tab, setTab] = useState<'alerts'|'regions'>('alerts')
  const { alerts, statuses } = analyzeAirspace(flights)
  const closedCount     = statuses.filter(s => s.status === 'closed').length
  const restrictedCount = statuses.filter(s => s.status === 'restricted').length

  return (
    <>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #141e16', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '7px', color: '#ff1a3e', fontWeight: 700, letterSpacing: '.1em' }}>
          {closedCount > 0 ? `⚠ ${closedCount} FIR${closedCount>1?'s':''} CLOSED` : ''}
        </span>
        {restrictedCount > 0 && <span style={{ fontSize: '7px', color: '#ff8800', fontWeight: 700, letterSpacing: '.1em' }}>⚡ {restrictedCount} RESTRICTED</span>}
        <span style={{ marginLeft: 'auto', fontSize: '7px', color: '#1a2e1e' }}>{new Date().toLocaleTimeString()}</span>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid #141e16' }}>
        <button className={`news-tab ${tab==='alerts'?'active':''}`} onClick={() => setTab('alerts')}
          style={tab==='alerts'&&alerts.length>0?{color:'#ff1a3e',borderColor:'#ff1a3e44'}:{}}>
          ALERTS <span style={{ fontSize: '7px', color: '#2a3e2e' }}>{alerts.length}</span>
        </button>
        <button className={`news-tab ${tab==='regions'?'active':''}`} onClick={() => setTab('regions')}>
          ALL FIRS <span style={{ fontSize: '7px', color: '#2a3e2e' }}>{statuses.length}</span>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'alerts' && alerts.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.1em' }}>// ALL MONITORED FIRS NORMAL</div>
        )}
        {tab === 'alerts' && alerts.map((a: NOTAMAlert) => (
          <div key={a.id} style={{ padding: '5px 8px', borderBottom: '1px solid #0d120e', display: 'flex', gap: 5 }}>
            <div style={{ width: 2, background: SEV_COL[a.severity], flexShrink: 0, alignSelf: 'stretch', boxShadow: `0 0 4px ${SEV_COL[a.severity]}88` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span style={{ fontSize: '7px', color: SEV_COL[a.severity], fontWeight: 700, border: `1px solid ${SEV_COL[a.severity]}44`, padding: '0 3px', letterSpacing: '.08em' }}>{a.severity.toUpperCase()}</span>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#c0dcc4' }}>{a.icao}</span>
                <span style={{ fontSize: '7.5px', color: '#4a6a50' }}>|</span>
                <span style={{ fontSize: '7.5px', color: '#6a8aaa' }}>{a.country}</span>
                <span style={{ fontSize: '7px', color: '#4a6a50', border: '1px solid #141e16', padding: '0 3px', marginLeft: 'auto' }}>{a.type}</span>
              </div>
              <div style={{ fontSize: '8.5px', color: '#6a8aaa', lineHeight: 1.5 }}>{a.message}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: '7.5px', color: '#2a3e2e' }}>
                <span>Live: <b style={{ color: '#c0dcc4' }}>{a.liveCount}</b></span>
                <span>Baseline: <b style={{ color: '#4a6a50' }}>~{a.baseline}</b></span>
                <span style={{ color: SEV_COL[a.severity] }}>▼ {a.dropPct}% below normal</span>
              </div>
            </div>
          </div>
        ))}
        {tab === 'regions' && statuses.map((s: FIRStatus) => (
          <div key={s.icao} style={{ padding: '4px 8px', borderBottom: '1px solid #0d120e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COL[s.status], flexShrink: 0, boxShadow: `0 0 4px ${STATUS_COL[s.status]}66` }} />
            <span style={{ fontSize: 8.5, fontWeight: 700, color: '#8aac90', minWidth: 40 }}>{s.icao}</span>
            <span style={{ fontSize: 8, color: '#4a6a50', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.country}</span>
            <span style={{ fontSize: '7px', color: STATUS_COL[s.status], fontWeight: 700, letterSpacing: '.06em', minWidth: 60, textAlign: 'right' }}>
              {s.status.toUpperCase()}
            </span>
            <span style={{ fontSize: '7.5px', color: '#1a2e1e', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{s.liveCount}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Crypto Panel (CoinGecko — no API key required) ───────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2',
  DOT: 'polkadot', MATIC: 'matic-network',
}
const CRYPTO_LIST = Object.entries(COINGECKO_IDS).map(([sym, id]) => ({ sym, id }))

export function CryptoPanel() {
  const [data, setData] = useState<{ sym: string; price: number; change: number }[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = CRYPTO_LIST.map(c => c.id).join(',')
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
        { signal: AbortSignal.timeout(10_000) }
      )
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
      const json = await res.json()
      setData(CRYPTO_LIST.map(({ sym, id }) => ({
        sym,
        price:  Number(json[id]?.usd  ?? 0),
        change: Number(json[id]?.usd_24h_change ?? 0),
      })).filter(d => d.price > 0))
    } catch (e) {
      console.warn('[CoinGecko]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(); const t = window.setInterval(load, 60_000); return () => clearInterval(t) }, [load])

  if (loading && !data.length) return <div style={{ padding: '8px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.12em' }}>// LOADING…</div>
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {data.map(d => {
        const pos = d.change >= 0
        const price = d.price >= 1 ? d.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : d.price.toFixed(4)
        return (
          <div key={d.sym} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid #141e16', borderLeft: '2px solid transparent', transition: 'all .1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,136,0.04)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'rgba(0,255,136,0.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
          >
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#c0dcc4' }}>{d.sym}</div>
              <div style={{ fontSize: '7.5px', color: '#2a3e2e' }}>crypto · USD</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: '#8aac90', fontVariantNumeric: 'tabular-nums' }}>${price}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', fontSize: '8px', color: pos ? '#00ff88' : '#ff1a3e' }}>
                {pos ? <TrendingUp size={7} /> : <TrendingDown size={7} />}
                {pos ? '+' : ''}{d.change.toFixed(2)}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Forex Panel (Open Exchange Rates — no key required) ─────────────────────
const FOREX_PAIRS = [
  { pair: 'EUR/USD', base: 'EUR', quote: 'USD', flag: '🇪🇺' },
  { pair: 'GBP/USD', base: 'GBP', quote: 'USD', flag: '🇬🇧' },
  { pair: 'USD/JPY', base: 'USD', quote: 'JPY', flag: '🇯🇵' },
  { pair: 'USD/CNY', base: 'USD', quote: 'CNY', flag: '🇨🇳' },
  { pair: 'USD/CHF', base: 'USD', quote: 'CHF', flag: '🇨🇭' },
  { pair: 'AUD/USD', base: 'AUD', quote: 'USD', flag: '🇦🇺' },
  { pair: 'USD/CAD', base: 'USD', quote: 'CAD', flag: '🇨🇦' },
  { pair: 'USD/INR', base: 'USD', quote: 'INR', flag: '🇮🇳' },
  { pair: 'USD/RUB', base: 'USD', quote: 'RUB', flag: '🇷🇺' },
  { pair: 'USD/BRL', base: 'USD', quote: 'BRL', flag: '🇧🇷' },
  { pair: 'USD/KRW', base: 'USD', quote: 'KRW', flag: '🇰🇷' },
  { pair: 'USD/MXN', base: 'USD', quote: 'MXN', flag: '🇲🇽' },
]

export function ForexPanel() {
  const [rates, setRates] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`ExchangeRate ${res.status}`)
      const json = await res.json()
      setRates(json.rates ?? {})
    } catch (e) {
      console.warn('[Forex]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(); const t = window.setInterval(load, 120_000); return () => clearInterval(t) }, [load])

  if (loading && !Object.keys(rates).length) return <div style={{ padding: '8px 10px', fontSize: '9px', color: '#2a3e2e', letterSpacing: '.12em' }}>// LOADING…</div>

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {FOREX_PAIRS.map(({ pair, base, quote, flag }) => {
        // Convert: rates are all relative to USD base
        let rate = 0
        if (base === 'USD') rate = rates[quote] ?? 0
        else if (quote === 'USD') rate = rates[base] ? 1 / rates[base] : 0
        else rate = (rates[quote] && rates[base]) ? rates[quote] / rates[base] : 0
        if (!rate) return null
        const decimals = rate > 10 ? 2 : rate > 1 ? 4 : 4
        return (
          <div key={pair} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid #141e16', borderLeft: '2px solid transparent', transition: 'all .1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,136,0.04)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'rgba(0,255,136,0.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
          >
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#c0dcc4' }}>{flag} {pair}</div>
              <div style={{ fontSize: '7.5px', color: '#2a3e2e' }}>forex · spot</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: '#8aac90', fontVariantNumeric: 'tabular-nums' }}>{rate.toFixed(decimals)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Live Streams Panel ────────────────────────────────────────────────────────
const LIVE_STREAM_REGIONS = [
  { region: 'Americas', color: '#ff1a3e', streams: [
    { id: 'cnn',      label: 'CNN',       src: 'https://www.youtube.com/embed/wq4Fb36aA2k?autoplay=1&mute=0',                                    title: 'CNN Live' },
    { id: 'stream2',  label: 'ABC',       src: 'https://www.youtube.com/embed/iipR5yUp36o?autoplay=1&mute=0',                                   title: 'ABC News Live' },
    { id: 'nbc',      label: 'NBC',       src: 'https://www.youtube.com/embed/SRYdE7zQBmg?autoplay=1&mute=0',                                   title: 'NBC News Now' },
    { id: 'cspan',    label: 'C-SPAN',    src: 'https://www.youtube.com/embed/DAPkHRRydr8?autoplay=1&mute=0',                                   title: 'C-SPAN Live' },
  ]},
  { region: 'Europe', color: '#00ff88', streams: [
    { id: 'bbcworld', label: 'BBC',       src: 'https://www.youtube.com/embed/w_Ma8oQLmSM?autoplay=1&mute=0',                                   title: 'BBC World News' },
    { id: 'euronews', label: 'EURO',      src: 'https://www.youtube.com/embed/3uVBkOSAZ4E?autoplay=1&mute=0',                                   title: 'Euronews Live' },
    { id: 'france24', label: 'FR24',      src: 'https://www.youtube.com/embed/h3MuIUNCCLI?autoplay=1&mute=0',                                   title: 'France 24 English' },
    { id: 'dwnews',   label: 'DW',        src: 'https://www.youtube.com/embed/mGnFE0-VHgw?autoplay=1&mute=0',                                   title: 'DW News Live' },
  ]},
  { region: 'MENA', color: '#ffaa00', streams: [
    { id: 'aljazeng', label: 'AJE',       src: 'https://www.youtube.com/embed/Z_8fVI7xuYo?autoplay=1&mute=0',                                   title: 'Al Jazeera English' },
    { id: 'aljazeera',label: 'AJA',       src: 'https://www.youtube.com/embed/hvFpW7QMPFE?autoplay=1&mute=0',                                   title: 'Al Jazeera Arabic' },
    { id: 'trtworld', label: 'TRT',       src: 'https://www.youtube.com/embed/K_pJJa5p-aw?autoplay=1&mute=0',                                   title: 'TRT World Live' },
  ]},
  { region: 'Asia', color: '#00ff88', streams: [
    { id: 'nhkworld', label: 'NHK',       src: 'https://www.youtube.com/embed/CTEhRdPXlKQ?autoplay=1&mute=0',                                   title: 'NHK World Japan' },
    { id: 'cgtn',     label: 'CGTN',      src: 'https://www.youtube.com/embed/ljMqpMfNgpU?autoplay=1&mute=0',                                   title: 'CGTN News Live' },
    { id: 'arirang',  label: 'ARIAN',     src: 'https://www.youtube.com/embed/h4mFKOz5ZtA?autoplay=1&mute=0',                                   title: 'Arirang Korea' },
    { id: 'wion',     label: 'WION',      src: 'https://www.youtube.com/embed/pSAPFBRbpz0?autoplay=1&mute=0',                                   title: 'WION India' },
  ]},
  { region: 'Africa', color: '#ff6600', streams: [
    { id: 'africaews',label: 'AFRC',      src: 'https://www.youtube.com/embed/XjW7iE2yy2c?autoplay=1&mute=0',                                   title: 'Africa News' },
    { id: 'aljaafr',  label: 'AJ-AFR',    src: 'https://www.youtube.com/embed/b_fzBSSwgQg?autoplay=1&mute=0',                                   title: 'Al Jazeera Africa' },
  ]},
]

// Flat list for lookup
const ALL_LIVE_STREAMS = LIVE_STREAM_REGIONS.flatMap(r => r.streams.map(s => ({ ...s, region: r.region, regionColor: r.color })))

export function CNNLivePanel() {
  const [activeRegion, setActiveRegion] = useState('Americas')
  const [activeId,     setActiveId]     = useState('cnn')

  const region  = LIVE_STREAM_REGIONS.find(r => r.region === activeRegion) ?? LIVE_STREAM_REGIONS[0]
  const active  = ALL_LIVE_STREAMS.find(s => s.id === activeId) ?? ALL_LIVE_STREAMS[0]

  function selectRegion(r: typeof LIVE_STREAM_REGIONS[0]) {
    setActiveRegion(r.region)
    setActiveId(r.streams[0].id)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
      {/* Region tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #141e16', overflowX: 'auto' }}>
        {LIVE_STREAM_REGIONS.map(r => (
          <button key={r.region} onClick={() => selectRegion(r)} style={{
            flexShrink: 0, padding: '4px 8px', fontSize: 7, fontWeight: 700, letterSpacing: '.1em',
            border: 'none', borderBottom: `2px solid ${activeRegion === r.region ? r.color : 'transparent'}`,
            background: 'transparent',
            color: activeRegion === r.region ? r.color : '#2a3e2e',
            cursor: 'pointer', fontFamily: 'monospace', transition: 'all .12s',
          }}>{r.region.toUpperCase()}</button>
        ))}
      </div>
      {/* Stream tabs for current region */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderBottom: '1px solid #141e16', flexWrap: 'wrap' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff1a3e', display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
        {region.streams.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)} style={{
            padding: '1px 6px', fontSize: 7, fontWeight: 700, letterSpacing: '.1em',
            border: `1px solid ${activeId === s.id ? region.color + '88' : '#141e16'}`,
            background: activeId === s.id ? region.color + '22' : 'transparent',
            color: activeId === s.id ? region.color : '#2a3e2e',
            cursor: 'pointer', fontFamily: 'monospace', transition: 'all .12s',
          }}>{s.label}</button>
        ))}
      </div>
      <iframe
        key={active.id}
        src={active.src}
        title={active.title}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{ flex: 1, border: 'none', minHeight: 210, width: '100%' }}
      />
    </div>
  )
}

export function PanelContent({ id, crises, flights, panelState, onToggleLayer, deepstateMode, onDeepstateToggle, searchQuery, onGeoSearch, onCountryClick }: PanelContentProps) {
  switch (id) {
    case 'news':    return <NewsPanel />
    case 'intel':   return <IntelPanel crises={crises} />
    case 'layers':  return <LayersPanel panelState={panelState} onToggleLayer={onToggleLayer} deepstateMode={deepstateMode} onDeepstateToggle={onDeepstateToggle} />
    case 'risk':    return <RiskPanel crises={crises} />
    case 'threat':  return <ThreatPanel crises={crises} flights={flights} />
    case 'outages':      return <OutagesPanel onGeoSearch={onGeoSearch} />
    case 'crisiswatch':  return <CrisisWatchPanel />
    case 'brief':        return <IntelBriefPanel query={searchQuery ?? ''} crises={crises} flights={flights} />
    case 'exchanges':    return <ExchangesPanel />
    case 'drugs':        return <DrugTrafficPanel />
    case 'sanctions':    return <SanctionsPanel />
    case 'military':     return <MilitaryPanel onGeoSearch={onGeoSearch} />
    case 'nuclear':      return <NuclearPanel />
    case 'airspace':     return <AirspacePanel flights={flights} />
    case 'cnn':          return <CNNLivePanel />
    case 'crypto':       return <CryptoPanel />
    case 'forex':        return <ForexPanel />
    case 'analyst':      return <AIAnalystPanel crises={crises} flights={flights} onGeoSearch={onGeoSearch} onCountryClick={onCountryClick} onToggleLayer={onToggleLayer} panelState={panelState} />
    case 'humanitarian': return <HumanitarianPanel crises={crises} flights={flights} onGeoSearch={onGeoSearch} />
    case 'markets':      return <MarketsPanel />

    default: {
      const syms = SECTORS[id]
      return syms ? <StockList symbols={syms} /> : null
    }
  }
}

// ── Unified Markets Panel ─────────────────────────────────────────────────
const MARKET_TABS = [
  { id: 'indices',     label: 'IDX' },
  { id: 'commodities', label: 'CMD' },
  { id: 'energy',      label: 'NRG' },
  { id: 'tech',        label: 'TCH' },
  { id: 'healthcare',  label: 'HCR' },
  { id: 'defense',     label: 'DEF' },
  { id: 'bonds',       label: 'BND' },
  { id: 'crypto',      label: 'CRY' },
  { id: 'forex',       label: 'FX' },
  { id: 'exchanges',   label: 'EXC' },
] as const

function MarketsPanel() {
  const [activeTab, setActiveTab] = useState<string>('indices')

  const renderContent = () => {
    switch (activeTab) {
      case 'crypto':    return <CryptoPanel />
      case 'forex':     return <ForexPanel />
      case 'exchanges': return <ExchangesPanel />
      default: {
        const syms = SECTORS[activeTab]
        return syms ? <StockList symbols={syms} /> : null
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar — scrollable row */}
      <div style={{ display: 'flex', borderBottom: '1px solid #141e16', flexShrink: 0, overflowX: 'auto', gap: 0 }}>
        {MARKET_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '4px 7px', fontSize: 7, fontWeight: 700, letterSpacing: '.08em',
            background: activeTab === t.id ? 'rgba(0,255,136,0.08)' : 'transparent',
            border: 'none', borderBottom: activeTab === t.id ? '2px solid #00ff88' : '2px solid transparent',
            color: activeTab === t.id ? '#00ff88' : '#2a3e2e', cursor: 'pointer',
            transition: 'all .12s', flexShrink: 0, fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>
      {/* Active content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>
    </div>
  )
}

// ── AI Analyst Panel (OpenRouter) ─────────────────────────────────────────
function AIAnalystPanel({ crises, flights, onGeoSearch, onCountryClick, onToggleLayer, panelState }: {
  crises: CrisisEvent[]; flights: Flight[]
  onGeoSearch?: (q: string) => void
  onCountryClick?: (country: string) => void
  onToggleLayer?: (id: keyof PanelState) => void
  panelState?: PanelState
}) {
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [response, setResponse]   = useState('')
  const [history, setHistory]     = useState<DSMessage[]>([])
  const [error, setError]         = useState('')
  const [model, setModel]         = useState(DEFAULT_MODEL)
  const abortRef  = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const hasKey    = !!import.meta.env.VITE_OPENROUTER_KEY

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [response])

  async function ask(prompt: string) {
    if (!prompt.trim() || streaming) return
    setError('')
    setResponse('')
    setStreaming(true)
    abortRef.current = new AbortController()

    const context  = buildDashboardContext(crises, flights)
    const sysMsg: DSMessage = {
      role: 'system',
      content: `You are an elite intelligence analyst embedded in a real-time global surveillance dashboard called WORLDVIEW. You have access to live data and should provide concise, actionable analysis. Use a professional intelligence briefing tone. Format with clear sections when appropriate. Be direct and fact-focused.

IMPORTANT: You can execute dashboard commands by including them in your response. Commands are on their own line:

[FLY:location] — Fly the map to a location (city, country, coordinates). Example: [FLY:Tehran, Iran]
[COUNTRY:name] — Open the country intelligence drawer. Example: [COUNTRY:Iran]
[LAYER:id:on] or [LAYER:id:off] — Toggle a map layer. Layer IDs: flights, crises, wildfires, military, nuclear, sanctions, cameras, infrastructure, airspace, humanitarian, vessels, oilgas, gpsjam
[DEEPSTATE:on] or [DEEPSTATE:off] — Toggle Ukraine frontline overlay

When a user asks about a specific country or region, ALWAYS include the FLY and COUNTRY commands to show it on the map. When relevant, enable related layers. For example if asked about Iran, fly there, open the country drawer, and enable relevant layers like military, crises, airspace.

Execute commands BEFORE your analysis text — put them at the very start of your response.

${context}`,
    }
    const userMsg: DSMessage = { role: 'user', content: prompt }
    const messages: DSMessage[] = [sysMsg, ...history, userMsg]

    let full = ''
    const executedCmds = new Set<string>()
    try {
      await streamAI(
        messages,
        token => {
          full += token
          // Parse and execute commands as they stream in
          const lines = full.split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            if (executedCmds.has(trimmed)) continue

            const flyMatch = trimmed.match(/^\[FLY:(.+)\]$/)
            if (flyMatch) {
              executedCmds.add(trimmed)
              onGeoSearch?.(flyMatch[1].trim())
              continue
            }

            const countryMatch = trimmed.match(/^\[COUNTRY:(.+)\]$/)
            if (countryMatch) {
              executedCmds.add(trimmed)
              onCountryClick?.(countryMatch[1].trim())
              continue
            }

            const layerMatch = trimmed.match(/^\[LAYER:(\w+):(on|off)\]$/)
            if (layerMatch && onToggleLayer && panelState) {
              const layerId = layerMatch[1] as keyof PanelState
              const wantOn = layerMatch[2] === 'on'
              if (layerId in panelState && panelState[layerId] !== wantOn) {
                executedCmds.add(trimmed)
                onToggleLayer(layerId)
              }
              continue
            }

            const dsMatch = trimmed.match(/^\[DEEPSTATE:(on|off)\]$/)
            if (dsMatch) {
              executedCmds.add(trimmed)
              // handled via deepstate toggle if needed
              continue
            }
          }
          // Display response without command lines
          const display = full.split('\n').filter(l => !l.trim().match(/^\[(FLY|COUNTRY|LAYER|DEEPSTATE):.+\]$/)).join('\n')
          setResponse(display)
        },
        abortRef.current.signal,
        model,
      )
      const cleanResponse = full.split('\n').filter(l => !l.trim().match(/^\[(FLY|COUNTRY|LAYER|DEEPSTATE):.+\]$/)).join('\n')
      setHistory(prev => [
        ...prev.slice(-10),
        userMsg,
        { role: 'assistant', content: cleanResponse },
      ])
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      setStreaming(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); setInput('') }
  }

  // Render markdown-ish text: bold **text**, bullet — text
  function renderText(text: string) {
    return text.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      const isHeader = /^#+\s/.test(line)
      const isBullet = /^[\-\•\*]\s/.test(line)
      return (
        <div key={i} style={{
          marginBottom: isHeader ? 6 : isBullet ? 1 : 0,
          paddingLeft: isBullet ? 8 : 0,
          borderLeft: isBullet ? '1px solid #141e16' : 'none',
          color: isHeader ? '#00ff88' : '#8aac90',
          fontWeight: isHeader ? 700 : 400,
          fontSize: isHeader ? 9 : 8.5,
          letterSpacing: isHeader ? '.1em' : '.03em',
          lineHeight: 1.65,
        }}
          dangerouslySetInnerHTML={{ __html: bold.replace(/^#+\s/, '').replace(/^[\-\•\*]\s/, '') }}
        />
      )
    })
  }

  if (!hasKey) return (
    <div style={{ padding: '12px 14px', fontSize: 9, color: '#1a2e1e', letterSpacing: '.1em', lineHeight: 1.7 }}>
      // OPENROUTER KEY REQUIRED<br />
      Add VITE_OPENROUTER_KEY to .env
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Model selector */}
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #0d120e', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 7.5, color: '#1a2e1e', letterSpacing: '.1em', flexShrink: 0 }}>MODEL</span>
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          disabled={streaming}
          style={{
            flex: 1, background: '#030609', border: '1px solid #0d1e30', color: '#4a6a50',
            fontSize: 8, fontFamily: 'inherit', letterSpacing: '.04em', padding: '2px 4px',
            outline: 'none', cursor: 'pointer',
          }}
        >
          {FREE_MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label} · {m.ctx} ctx · FREE</option>
          ))}
        </select>
      </div>

      {/* Quick prompts */}
      {!response && !streaming && history.length === 0 && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #141e16', flexShrink: 0 }}>
          <div style={{ fontSize: 7.5, color: '#1a2e1e', letterSpacing: '.12em', marginBottom: 6 }}>// QUICK ANALYSIS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.label}
                onClick={() => { ask(qp.prompt) }}
                style={{
                  background: 'rgba(0,255,136,0.04)', border: '1px solid #0d1e30',
                  color: '#4a6a50', fontSize: 8, padding: '3px 8px',
                  cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.07em',
                  transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 4,
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(0,255,136,0.3)'; el.style.color = '#00ff88' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#0d1e30'; el.style.color = '#4a6a50' }}
              >
                {qp.icon} {qp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation history */}
      {history.length > 0 && (
        <div style={{ padding: '8px 10px 0', flexShrink: 0 }}>
          {history.filter(m => m.role === 'user').slice(-2).map((m, i) => (
            <div key={i} style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.06em', marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#0d1e30', flexShrink: 0 }}>▸</span>
              <span style={{ color: '#4a6a50' }}>{m.content.slice(0, 80)}{m.content.length > 80 ? '…' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Response area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', minHeight: 0 }}>
        {!response && !streaming && history.length === 0 && (
          <div style={{ fontSize: 8, color: '#0d1e30', letterSpacing: '.08em', lineHeight: 1.8, paddingTop: 4 }}>
            // DEEPSEEK AI ANALYST READY<br />
            // {crises.length} active crises · {flights.length.toLocaleString()} flights tracked<br />
            // Select a quick analysis or type your query below
          </div>
        )}

        {(response || streaming) && (
          <div style={{ fontSize: 8.5, lineHeight: 1.65, letterSpacing: '.03em' }}>
            {renderText(response)}
            {streaming && (
              <span style={{ display: 'inline-block', width: 6, height: 10, background: '#00ff88', opacity: 0.8, marginLeft: 2, animation: 'blink 0.8s step-end infinite', verticalAlign: 'middle' }} />
            )}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 8, color: '#ff4444', letterSpacing: '.06em', marginTop: 4 }}>
            ⚠ {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Context pill */}
      <div style={{ padding: '3px 10px', borderTop: '1px solid #0d120e', borderBottom: '1px solid #0d120e', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 7, color: '#0d1e30', letterSpacing: '.1em', display: 'flex', gap: 8 }}>
          <span style={{ color: '#ff1a3e44' }}>⬤</span> {crises.length} CRISES
          <span style={{ color: '#00ff8844' }}>⬤</span> {flights.length.toLocaleString()} FLIGHTS
          <span style={{ color: '#00ff8844' }}>⬤</span> LIVE
        </div>
        {history.length > 0 && (
          <button
            onClick={() => { setHistory([]); setResponse(''); setError('') }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#1a2e1e', fontSize: 7, letterSpacing: '.08em', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff4444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#1a2e1e' }}
          >↺ CLEAR</button>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid #141e16', display: 'flex', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about current events, threats, markets…"
          rows={2}
          style={{
            flex: 1, background: 'rgba(0,255,136,0.03)', border: '1px solid #0d1e30',
            color: '#c0dcc4', fontSize: 8.5, fontFamily: 'inherit', letterSpacing: '.04em',
            padding: '5px 8px', resize: 'none', outline: 'none', lineHeight: 1.5,
            transition: 'border-color .12s',
          }}
          onFocus={e  => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'rgba(0,255,136,0.3)' }}
          onBlur={e   => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#0d1e30' }}
        />
        {streaming ? (
          <button onClick={stop} style={{ background: 'rgba(255,26,62,0.1)', border: '1px solid rgba(255,26,62,0.3)', color: '#ff1a3e', cursor: 'pointer', padding: '5px 7px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Square size={10} />
          </button>
        ) : (
          <button
            onClick={() => { ask(input); setInput('') }}
            disabled={!input.trim()}
            style={{ background: input.trim() ? 'rgba(0,255,136,0.1)' : 'transparent', border: `1px solid ${input.trim() ? 'rgba(0,255,136,0.3)' : '#0d1e30'}`, color: input.trim() ? '#00ff88' : '#1a2e1e', cursor: input.trim() ? 'pointer' : 'default', padding: '5px 7px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
          >
            <Send size={10} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Humanitarian Panel (UNHCR) ─────────────────────────────────────────────────
const HUM_TABS = ['OVERVIEW', 'NEXUS', 'FLOWS', 'OFFICES', 'CROSSINGS', 'CAMPS'] as const
type HumTab = typeof HUM_TABS[number]

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString()
}

function HumanitarianPanel({ crises, flights, onGeoSearch }: { crises: CrisisEvent[]; flights: Flight[]; onGeoSearch?: (q: string) => void }) {
  const [tab, setTab]         = useState<HumTab>('OVERVIEW')
  const [stats, setStats]     = useState<UNHCRStat[]>(TOP_HOSTING)
  const [showOrigin, setShowOrigin] = useState(false)
  const [officeFilter, setOfficeFilter] = useState('')
  const [crossFilter, setCrossFilter]   = useState<'all'|'open'|'restricted'|'closed'>('all')
  const [campSearch, setCampSearch]     = useState('')

  useEffect(() => {
    fetchUNHCRPopulation().then(data => { if (data.length) setStats(data) })
  }, [])

  const g = UNHCR_GLOBAL_2023

  const filteredOffices = UNHCR_OFFICES.filter(o =>
    !officeFilter || o.country.toLowerCase().includes(officeFilter.toLowerCase()) ||
    o.city.toLowerCase().includes(officeFilter.toLowerCase()) ||
    o.name.toLowerCase().includes(officeFilter.toLowerCase())
  )

  const filteredCrossings = BORDER_CROSSINGS.filter(c =>
    crossFilter === 'all' || c.status === crossFilter
  )

  const filteredCamps = REFUGEE_CAMPS
    .filter(c => !campSearch || c.name.toLowerCase().includes(campSearch.toLowerCase()) || c.country.toLowerCase().includes(campSearch.toLowerCase()))
    .sort((a, b) => b.population - a.population)

  const maxHosting = Math.max(...TOP_HOSTING.map(s => s.total))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: 9 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #141e16', flexShrink: 0 }}>
        {HUM_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '4px 2px', fontSize: 7.5, fontWeight: 700, letterSpacing: '.1em',
            background: tab === t ? 'rgba(0,170,255,0.1)' : 'transparent',
            border: 'none', borderBottom: tab === t ? '2px solid #00aaff' : '2px solid transparent',
            color: tab === t ? '#00aaff' : '#2a3e2e', cursor: 'pointer', transition: 'all .12s',
          }}>{t}</button>
        ))}
      </div>

      {/* ─ OVERVIEW ─ */}
      {tab === 'OVERVIEW' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {/* Global summary */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 7, color: '#2a3e2e', letterSpacing: '.15em', marginBottom: 5 }}>// GLOBAL DISPLACEMENT · {g.year}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
              {[
                { label: 'FORCIBLY DISPLACED', value: g.total_forcibly_displaced, color: '#ff4444' },
                { label: 'REFUGEES (UNHCR)',   value: g.refugees_unhcr,           color: '#ff8800' },
                { label: 'INT. DISPLACED',     value: g.idps,                     color: '#ffaa00' },
                { label: 'ASYLUM SEEKERS',     value: g.asylum_seekers,           color: '#00ff88' },
                { label: 'STATELESS',          value: g.stateless,                color: '#aa44ff' },
                { label: 'RETURNEES',          value: g.returnees,                color: '#00ff88' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(0,0,0,0.3)', padding: '5px 7px', border: '1px solid #141e16' }}>
                  <div style={{ fontSize: 6.5, color: '#2a3e2e', letterSpacing: '.1em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>{fmt(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Toggle hosting / origin */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button onClick={() => setShowOrigin(false)} style={{
              flex: 1, padding: '3px 6px', fontSize: 7.5, fontWeight: 700, letterSpacing: '.1em',
              border: `1px solid ${!showOrigin ? '#00aaff55' : '#141e16'}`,
              background: !showOrigin ? 'rgba(0,170,255,0.1)' : 'transparent',
              color: !showOrigin ? '#00aaff' : '#2a3e2e', cursor: 'pointer',
            }}>TOP HOSTING</button>
            <button onClick={() => setShowOrigin(true)} style={{
              flex: 1, padding: '3px 6px', fontSize: 7.5, fontWeight: 700, letterSpacing: '.1em',
              border: `1px solid ${showOrigin ? '#ff884455' : '#141e16'}`,
              background: showOrigin ? 'rgba(255,136,0,0.1)' : 'transparent',
              color: showOrigin ? '#ff8844' : '#2a3e2e', cursor: 'pointer',
            }}>TOP ORIGINS</button>
          </div>

          {/* Country ranking */}
          <div style={{ fontSize: 7, color: '#2a3e2e', letterSpacing: '.12em', marginBottom: 4 }}>
            {!showOrigin ? '// COUNTRIES HOSTING MOST DISPLACED (2023)' : '// TOP COUNTRIES OF ORIGIN (2023)'}
          </div>
          {(!showOrigin ? (stats.length ? stats : TOP_HOSTING) : TOP_ORIGINS).map((s, i) => {
            const pct = (s.total / (showOrigin ? 16_000_000 : maxHosting)) * 100
            const color = showOrigin ? '#ff8844' : '#00aaff'
            return (
              <div key={s.iso3 + i} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 7, color: '#1a2e1e', width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 8, color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.country}</span>
                  <span style={{ fontSize: 8, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(s.total)}</span>
                </div>
                <div style={{ marginLeft: 19, height: 2, background: '#141e16', borderRadius: 1 }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, opacity: 0.55, borderRadius: 1, transition: 'width .5s' }} />
                </div>
                {s.refugees > 0 && s.idps > 0 && (
                  <div style={{ marginLeft: 19, marginTop: 1, display: 'flex', gap: 6 }}>
                    {s.refugees > 0     && <span style={{ fontSize: 6.5, color: '#ff8800' }}>REF {fmt(s.refugees)}</span>}
                    {s.idps > 0         && <span style={{ fontSize: 6.5, color: '#ffaa00' }}>IDP {fmt(s.idps)}</span>}
                    {s.asylum_seekers > 0 && <span style={{ fontSize: 6.5, color: '#00ff88' }}>ASY {fmt(s.asylum_seekers)}</span>}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #0d120e' }}>
            <div style={{ fontSize: 6.5, color: '#1a2e1e', letterSpacing: '.05em', lineHeight: 1.7 }}>
              SOURCE: UNHCR GLOBAL TRENDS {g.year} · api.unhcr.org<br />
              DATA: MID-YEAR ESTIMATES · UNHCR POPULATION STATISTICS
            </div>
          </div>
        </div>
      )}

      {/* ─ NEXUS: cross-link refugee flows ↔ active crises ↔ flights ─ */}
      {tab === 'NEXUS' && (() => {
        // Group flows by origin country (extract from "Origin → Dest" label)
        const originCountries = [...new Set(REFUGEE_FLOWS.map(f => f.label.split(' → ')[0]))]

        // Match crises to origin countries (fuzzy — country name substring)
        const matchCrises = (origin: string) =>
          crises.filter(c => c.country.toLowerCase().includes(origin.toLowerCase())
            || origin.toLowerCase().includes(c.country.toLowerCase()))

        // Count flights near camps in host countries
        const countFlightsNear = (lat: number, lng: number, radius = 2) =>
          flights.filter(f => f.latitude && f.longitude
            && Math.abs(f.latitude - lat) < radius && Math.abs(f.longitude - lng) < radius).length

        // Get displacement data for a country
        const getDisp = (name: string) => {
          const entry = Object.entries(COUNTRY_DISPLACEMENT).find(([, d]) => {
            const stat = [...TOP_HOSTING, ...TOP_ORIGINS].find(s => s.iso3 === Object.keys(COUNTRY_DISPLACEMENT).find(k => COUNTRY_DISPLACEMENT[k] === d))
            return stat?.country.toLowerCase().includes(name.toLowerCase())
              || name.toLowerCase().includes(stat?.country.toLowerCase() ?? '')
          })
          return entry ? entry[1] : null
        }

        // Get camps in a country (host side)
        const getCamps = (dest: string) =>
          REFUGEE_CAMPS.filter(c => c.country.toLowerCase().includes(dest.toLowerCase())
            || dest.toLowerCase().includes(c.country.toLowerCase()))

        return (
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            <div style={{ fontSize: 7, color: '#2a3e2e', letterSpacing: '.12em', marginBottom: 6 }}>
              // CRISIS → DISPLACEMENT NEXUS · LIVE CORRELATION
            </div>
            {originCountries.map(origin => {
              const flows = REFUGEE_FLOWS.filter(f => f.label.startsWith(origin + ' →'))
              const linked = matchCrises(origin)
              const totalDisplaced = flows.reduce((s, f) => s + f.count, 0)
              const disp = getDisp(origin)
              const severity = linked.length > 0
                ? (linked.some(c => c.severity === 'critical') ? 'critical'
                  : linked.some(c => c.severity === 'high') ? 'high' : 'medium')
                : 'low'
              const sevColor = severity === 'critical' ? '#ff1a3e' : severity === 'high' ? '#ff8800' : severity === 'medium' ? '#ffcc00' : '#4a6a50'

              return (
                <div key={origin} style={{ marginBottom: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.25)', border: `1px solid ${sevColor}22` }}>
                  {/* Origin header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#c0dcc4', flex: 1 }}>{origin.toUpperCase()}</span>
                    <span style={{ fontSize: 7, color: sevColor, fontWeight: 700, letterSpacing: '.08em' }}>{severity.toUpperCase()}</span>
                  </div>

                  {/* Displacement total */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4, marginLeft: 13 }}>
                    <span style={{ fontSize: 8, color: '#ff8844' }}>DISPLACED: <b>{fmt(totalDisplaced)}</b></span>
                    {disp && disp.origin > 0 && <span style={{ fontSize: 7, color: '#4a6a50' }}>UNHCR ORIGIN: {fmt(disp.origin)}</span>}
                  </div>

                  {/* Active crises linked */}
                  {linked.length > 0 && (
                    <div style={{ marginLeft: 13, marginBottom: 4 }}>
                      <div style={{ fontSize: 6.5, color: '#ff1a3e', letterSpacing: '.1em', marginBottom: 2 }}>ACTIVE CRISES ({linked.length})</div>
                      {linked.slice(0, 4).map((c, i) => (
                        <div key={c.id + i}
                          onClick={() => onGeoSearch?.(`${c.latitude},${c.longitude}`)}
                          style={{ fontSize: 7.5, color: '#8aac90', marginBottom: 1, cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', gap: 4, alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = '#c0dcc4' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = '#8aac90' }}
                        >
                          <span style={{ fontSize: 6, color: c.severity === 'critical' ? '#ff1a3e' : c.severity === 'high' ? '#ff8800' : '#ffcc00', fontWeight: 700 }}>
                            {c.type.toUpperCase().slice(0, 3)}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                          {c.fatalities ? <span style={{ fontSize: 6.5, color: '#ff1a3e', flexShrink: 0 }}>†{c.fatalities}</span> : null}
                        </div>
                      ))}
                      {linked.length > 4 && <div style={{ fontSize: 6.5, color: '#2a3e2e' }}>+{linked.length - 4} more</div>}
                    </div>
                  )}
                  {linked.length === 0 && (
                    <div style={{ marginLeft: 13, fontSize: 7, color: '#2a3e2e', fontStyle: 'italic', marginBottom: 4 }}>No live crisis events detected</div>
                  )}

                  {/* Flow corridors */}
                  <div style={{ marginLeft: 13 }}>
                    <div style={{ fontSize: 6.5, color: '#00aaff', letterSpacing: '.1em', marginBottom: 2 }}>CORRIDORS ({flows.length})</div>
                    {flows.map(f => {
                      const dest = f.label.split(' → ')[1]
                      const camps = getCamps(dest)
                      const nearbyFlights = camps.length > 0 ? countFlightsNear(camps[0].lat, camps[0].lng) : 0
                      return (
                        <div key={f.label}
                          onClick={() => onGeoSearch?.(`${f.dest[1]},${f.dest[0]}`)}
                          style={{ fontSize: 7.5, color: '#6a8aaa', marginBottom: 2, cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', gap: 4, alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = '#c0dcc4' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = '#6a8aaa' }}
                        >
                          <span style={{ color: '#00ff88', fontWeight: 700 }}>→</span>
                          <span style={{ flex: 1 }}>{dest}</span>
                          <span style={{ fontSize: 7, color: '#ffcc00', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
                          {camps.length > 0 && <span style={{ fontSize: 6, color: '#00ff88' }}>{camps.length} sites</span>}
                          {nearbyFlights > 0 && <span style={{ fontSize: 6, color: '#aa44ff' }}>✈{nearbyFlights}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 6, fontSize: 6.5, color: '#1a2e1e', letterSpacing: '.05em', lineHeight: 1.7 }}>
              CORRELATION: UNHCR GLOBAL TRENDS × ACLED LIVE EVENTS × OPENSKY<br />
              NEXUS UPDATES IN REAL-TIME WITH INCOMING DATA
            </div>
          </div>
        )
      })()}

      {/* ─ FLOWS: refugee corridor listing ─ */}
      {tab === 'FLOWS' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          <div style={{ fontSize: 7, color: '#2a3e2e', letterSpacing: '.12em', marginBottom: 6 }}>
            // MAJOR REFUGEE CORRIDORS · {REFUGEE_FLOWS.length} ROUTES
          </div>
          {REFUGEE_FLOWS
            .sort((a, b) => b.count - a.count)
            .map((f, i) => {
              const maxCount = REFUGEE_FLOWS[0].count  // already sorted
              const pct = (f.count / (maxCount || 1)) * 100
              const origin = f.label.split(' → ')[0]
              const dest = f.label.split(' → ')[1]
              const linked = crises.filter(c =>
                c.country.toLowerCase().includes(origin.toLowerCase())
                || origin.toLowerCase().includes(c.country.toLowerCase()))
              const isActive = linked.length > 0
              // Color gradient by count
              const t = Math.min(1, f.count / 4_000_000)
              const color = t > 0.6 ? '#ff4444' : t > 0.3 ? '#ffaa00' : '#00ff88'

              return (
                <div key={f.label}
                  onClick={() => onGeoSearch?.(`${f.origin[1]},${f.origin[0]}`)}
                  style={{ marginBottom: 5, cursor: onGeoSearch ? 'pointer' : 'default' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,170,255,0.05)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 7, color: '#1a2e1e', width: 16, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                    <span style={{ fontSize: 8, color: '#c0dcc4', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {origin} <span style={{ color: '#4a6a50' }}>→</span> {dest}
                    </span>
                    <span style={{ fontSize: 8, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(f.count)}</span>
                    {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff1a3e', flexShrink: 0, animation: 'blink 1s step-end infinite' }} title={`${linked.length} active crises in ${origin}`} />}
                  </div>
                  <div style={{ marginLeft: 21, height: 2, background: '#141e16', borderRadius: 1, marginBottom: 2 }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, opacity: 0.55, borderRadius: 1, transition: 'width .5s' }} />
                  </div>
                  {isActive && (
                    <div style={{ marginLeft: 21, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {linked.slice(0, 3).map((c, j) => (
                        <span key={j} style={{
                          fontSize: 6, padding: '1px 4px', borderRadius: 2,
                          background: c.severity === 'critical' ? 'rgba(255,26,62,0.15)' : 'rgba(255,136,0,0.1)',
                          color: c.severity === 'critical' ? '#ff1a3e' : '#ff8800',
                          border: `1px solid ${c.severity === 'critical' ? '#ff1a3e22' : '#ff880022'}`,
                        }}>
                          {c.type.toUpperCase().slice(0, 3)} · {c.title.slice(0, 30)}{c.title.length > 30 ? '…' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          <div style={{ marginTop: 6, fontSize: 6.5, color: '#1a2e1e', letterSpacing: '.05em', lineHeight: 1.7 }}>
            SOURCE: UNHCR GLOBAL TRENDS 2023 · CRISIS TAGS FROM ACLED LIVE
          </div>
        </div>
      )}

      {/* ─ OFFICES ─ */}
      {tab === 'OFFICES' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '5px 8px', borderBottom: '1px solid #141e16', flexShrink: 0 }}>
            <input
              placeholder="Filter by country or city…"
              value={officeFilter}
              onChange={e => setOfficeFilter(e.target.value)}
              style={{
                width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #0d1e30',
                color: '#c0dcc4', fontSize: 8, padding: '3px 6px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOffices.map(o => (
              <div
                key={o.id}
                onClick={() => onGeoSearch?.(`${o.lat},${o.lng}`)}
                style={{ padding: '5px 10px', borderBottom: '1px solid #0d120e', cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,170,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                title={onGeoSearch ? `Fly to ${o.name}` : undefined}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: OFFICE_TYPE_COLORS[o.type], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 8, color: '#8aac90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                  <div style={{ fontSize: 7, color: '#4a6a50', marginTop: 1 }}>{o.city} · {o.country}</div>
                </div>
                <span style={{ fontSize: 6.5, color: '#1a2e1e', letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>
                  {o.type === 'hq' ? 'HQ' : o.type === 'regional' ? 'REG' : o.type === 'liaison' ? 'LNK' : 'CO'}
                </span>
              </div>
            ))}
            {filteredOffices.length === 0 && (
              <div style={{ padding: 10, fontSize: 8, color: '#2a3e2e', textAlign: 'center' }}>No offices match filter</div>
            )}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid #0d120e', fontSize: 6.5, color: '#1a2e1e', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredOffices.length} OFFICES · UNHCR PRESENCE MAP
          </div>
        </div>
      )}

      {/* ─ CROSSINGS ─ */}
      {tab === 'CROSSINGS' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Status filter */}
          <div style={{ padding: '5px 8px', borderBottom: '1px solid #141e16', display: 'flex', gap: 4, flexShrink: 0 }}>
            {(['all', 'open', 'restricted', 'closed'] as const).map(s => (
              <button key={s} onClick={() => setCrossFilter(s)} style={{
                flex: 1, padding: '2px 3px', fontSize: 7, fontWeight: 700, letterSpacing: '.08em',
                border: `1px solid ${crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? '#00ff88') + '55' : '#141e16'}`,
                background: crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? 'rgba(0,255,136,0.1)') + '14' : 'transparent',
                color: crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? '#00ff88') : '#2a3e2e',
                cursor: 'pointer', textTransform: 'uppercase',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredCrossings.map(c => (
              <div
                key={c.id}
                onClick={() => onGeoSearch?.(`${c.lat},${c.lng}`)}
                style={{ padding: '5px 10px', borderBottom: '1px solid #0d120e', cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,170,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                title={onGeoSearch ? `Fly to ${c.name}` : undefined}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: CROSSING_STATUS_COLORS[c.status], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 8, color: '#8aac90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 7, color: '#4a6a50', marginTop: 1 }}>{c.country1} ↔ {c.country2}</div>
                </div>
                <span style={{ fontSize: 7, color: CROSSING_STATUS_COLORS[c.status], fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>{c.status}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid #0d120e', fontSize: 6.5, color: '#1a2e1e', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredCrossings.length} CROSSINGS · UNHCR BORDER MONITORING
          </div>
        </div>
      )}

      {/* ─ CAMPS ─ */}
      {tab === 'CAMPS' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '5px 8px', borderBottom: '1px solid #141e16', flexShrink: 0 }}>
            <input
              placeholder="Search camps or countries…"
              value={campSearch}
              onChange={e => setCampSearch(e.target.value)}
              style={{
                width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #0d1e30',
                color: '#c0dcc4', fontSize: 8, padding: '3px 6px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredCamps.map((c, i) => {
              const maxPop = REFUGEE_CAMPS[0].population
              const pct = (c.population / maxPop) * 100
              const color = c.type === 'camp' ? '#00ff88' : c.type === 'settlement' ? '#00ff88' : c.type === 'poc_site' ? '#ffdd00' : c.type === 'transit' ? '#ffaa00' : '#8844ff'
              return (
                <div
                  key={c.id}
                  onClick={() => onGeoSearch?.(`${c.lat},${c.lng}`)}
                  style={{ padding: '5px 10px', borderBottom: '1px solid #0d120e', cursor: onGeoSearch ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,170,255,0.05)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                  title={onGeoSearch ? `Fly to ${c.name}` : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 7, color: '#1a2e1e', width: 16, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 8, color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 8, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(c.population)}</span>
                  </div>
                  <div style={{ marginLeft: 27, height: 2, background: '#141e16', borderRadius: 1, marginBottom: 2 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, opacity: 0.5, borderRadius: 1 }} />
                  </div>
                  <div style={{ marginLeft: 27, display: 'flex', gap: 5 }}>
                    <span style={{ fontSize: 6.5, color: '#4a6a50' }}>{c.country}</span>
                    <span style={{ fontSize: 6.5, color: color, opacity: 0.7, textTransform: 'uppercase' }}>{c.type.replace('_', ' ')}</span>
                    {c.notes && <span style={{ fontSize: 6.5, color: '#1a2e1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid #0d120e', fontSize: 6.5, color: '#1a2e1e', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredCamps.length} SITES · UNHCR POPULATION REFERENCE POINTS
          </div>
        </div>
      )}
    </div>
  )
}
