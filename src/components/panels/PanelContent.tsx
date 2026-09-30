/**
 * Shared panel content components — used by both PanelDock and CornerWidget
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, RefreshCw, TrendingUp, TrendingDown, Minus, Send, Square, History, Trash2, Plus, Navigation, Layers, Info, Radio, Terminal, Sparkles } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { CrisisEvent, NewsArticle, PanelState, Stock, Flight } from '../../types'
import { fetchRSSFeed, searchGDELTNews, searchGuardian, searchNYT, searchNewsAPI, fetchAllCrisisWatch, CRISISWATCH_FEEDS, type CrisisWatchEntry, COUNTRY_NEWS_SOURCES, fetchCountryNews } from '../../services/news'
import { fetchMultipleQuotes } from '../../services/stocks'
import { fetchOutageEvents, type OutageEvent } from '../../services/outages'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS, fetchSanctionsNews, type SanctionedCountry } from '../../services/sanctions'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../../services/military'
import { analyzeAirspace, type NOTAMAlert, type FIRStatus } from '../../services/notam'
import { streamAI, buildDashboardContext, QUICK_PROMPTS, FREE_MODELS, DEFAULT_MODEL, type DSMessage } from '../../services/openrouter'
import { listSessions, saveSession, deleteSession, newSessionId, type ChatSession } from '../../services/chatHistory'
import { TRADE_PROFILES } from '../../services/tradeStats'
import { fetchCountryEcon, formatEconValue, groupIndicators, type CountryEconData } from '../../services/worldbank'
import { onGlobalReload } from '../../utils/reloadBus'
import { computeTrajectories, type TrajectoryEntry } from '../../utils/trajectory'
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
  | 'outages' | 'brief' | 'crisiswatch' | 'analyst' | 'humanitarian' | 'webcams'

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
  analyst:     { title: 'Analysis',      dotColor: 'blue',   width: 480, desc: 'AI-assisted situational assessment' },
  humanitarian:{ title: 'Humanitarian',  dotColor: 'blue',   width: 320, desc: 'UNHCR displacement & border status' },
  webcams:     { title: 'US Webcams',    dotColor: 'grn',    width: 320, desc: 'SkylineWebcams & EarthCam — live US grid' },
}

export const DEFAULT_ORDER: PanelId[] = [
  'news', 'crisiswatch', 'layers', 'intel', 'humanitarian', 'risk', 'threat',
  'markets',
  'analyst',
  'drugs', 'sanctions', 'military', 'nuclear', 'airspace', 'cnn', 'webcams',
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
  { id: 'flights',   label: 'AIR TRAFFIC',          color: 'var(--accent)', tag: 'AIR' },
  { id: 'crises',    label: 'CONFLICT ZONES',       color: 'var(--red)', tag: 'GEO' },
  { id: 'wildfires', label: 'WILDFIRES',             color: 'var(--amber)', tag: 'FIRE' },
  { id: 'military',  label: 'MILITARY INSTALLATIONS',color: 'var(--green)', tag: 'MIL' },
  { id: 'nuclear',   label: 'NUCLEAR SITES',         color: 'var(--amber)', tag: 'NUC' },
  { id: 'sanctions', label: 'SANCTIONED STATES',     color: 'var(--red)', tag: 'SAN' },
  { id: 'news',      label: 'MEDIA SIGNALS',         color: '#aa44ff', tag: 'SIG' },
  { id: 'stocks',    label: 'FINANCIAL CENTRES',     color: 'var(--accent)', tag: 'FIN' },
  { id: 'cameras',        label: 'LIVE CAMERAS',          color: 'var(--accent)', tag: 'CAM' },
  { id: 'infrastructure', label: 'CRITICAL INFRASTRUCTURE',color: 'var(--amber)', tag: 'CI' },
  { id: 'airspace',       label: 'AIRSPACE RESTRICTIONS', color: 'var(--red)', tag: 'FIR' },
  { id: 'humanitarian',  label: 'HUMANITARIAN OPS',      color: 'var(--accent)', tag: 'HUM' },
  { id: 'vessels',       label: 'MARITIME TRAFFIC',       color: 'var(--green)', tag: 'AIS' },
  { id: 'oil',            label: 'OIL RESERVES',            color: 'var(--amber)', tag: 'OIL' },
  { id: 'gas',            label: 'GAS RESERVES',            color: 'var(--accent)', tag: 'GAS' },
  { id: 'ports',          label: 'GLOBAL PORTS',             color: 'var(--accent)', tag: 'PRT' },
  { id: 'pipelines',     label: 'GAS PIPELINES',            color: '#44ddaa', tag: 'GAS' },
  { id: 'chokepoints',   label: 'CHOKEPOINTS',              color: 'var(--red)', tag: 'TRD' },
  { id: 'supplychain',   label: 'SUPPLY CHAIN',             color: 'var(--accent)', tag: 'TRD' },
  { id: 'shippingRoutes',label: 'SHIPPING ROUTES',          color: 'var(--accent)', tag: 'TRD' },
  { id: 'gpsjam',        label: 'GPS INTERFERENCE',        color: 'var(--red)', tag: 'GPS' },
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
  critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--amber)', low: 'var(--text3)',
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
  if (score >= 40) return 'var(--red)'
  if (score >= 20) return 'var(--amber)'
  if (score >= 10) return 'var(--amber)'
  return 'var(--accent)'
}

export function computeThreatScore(crises: CrisisEvent[], flights: Flight[]) {
  const base = crises.reduce((acc, c) => {
    const w: Record<string, number> = { critical: 8, high: 4, medium: 2, low: 1 }
    return acc + (w[c.severity] ?? 1)
  }, 0)
  return Math.min(100, Math.round(base / 8 + (flights.length > 5000 ? 5 : 0)))
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

function CrisisRow({ c }: { c: CrisisEvent }) {
  const [open, setOpen] = useState(false)
  const col = SEV_COLORS[c.severity] || 'var(--text3)'
  return (
    <div className="intel-row" style={{ alignItems: 'flex-start', cursor: 'pointer', flexDirection: 'column', padding: 0 }} onClick={() => setOpen(v => !v)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: col, boxShadow: `0 0 4px ${col}66` }} />
        <div style={{ flex: 1, minWidth: 0, padding: '5px 8px' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text1)', lineHeight: 1.4, ...(!open ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}) }}>{c.title}</div>
          <div style={{ display: 'flex', gap: 5, fontSize: '10.5px', color: 'var(--text3)', marginTop: 2 }}>
            <span style={{ color: col, fontSize: '9.5px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', border: `1px solid ${col}44`, padding: '0 3px' }}>{c.severity}</span>
            <span>{c.country}</span>
            {c.fatalities ? <span style={{ color: 'var(--red)' }}>⚠ {c.fatalities}</span> : null}
          </div>
        </div>
      </div>
      {open && (
        <div style={{ width: '100%', borderTop: '1px solid var(--border)', padding: '6px 10px 8px', background: 'var(--red-soft)' }}
          onClick={e => e.stopPropagation()}>
          {c.description && <div style={{ fontSize: '11.5px', color: 'var(--text2)', lineHeight: 1.55, marginBottom: 5 }}>{c.description}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '10px', color: 'var(--text2)' }}>
            {c.type && <span style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.type}</span>}
            {c.date && <span>{new Date(c.date).toLocaleDateString()}</span>}
            {c.source && <span style={{ color: 'var(--text3)' }}>{c.source}</span>}
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
      <div style={{ display: 'flex', gap: 2, padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        {INTEL_TABS_LIST.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`news-tab ${tab === t ? 'active' : ''}`}>{t.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO EVENTS</div>}
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
        background: deepstateMode ? 'var(--red-soft)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--border)',
        borderLeft: `2px solid ${deepstateMode ? 'var(--red)' : 'transparent'}`,
        cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ width: 10, height: 10, flexShrink: 0, border: `1px solid ${deepstateMode ? 'var(--red)' : 'var(--border)'}`, background: deepstateMode ? 'var(--red)22' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {deepstateMode && <div style={{ width: 4, height: 4, background: 'var(--red)' }} />}
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.1em', color: deepstateMode ? 'var(--red)' : 'var(--text3)', border: `1px solid ${deepstateMode ? 'var(--red)44' : 'var(--border)'}`, padding: '0 3px', lineHeight: '14px', flexShrink: 0 }}>WAR</span>
        <div>
          <div style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: deepstateMode ? 'var(--red)' : 'var(--text3)' }}>DeepState Ukraine</div>
          <div style={{ fontSize: '10px', color: 'var(--text3)' }}>battlefield overlay</div>
        </div>
      </button>
      {LAYERS_CONFIG.map(layer => {
        const on = panelState[layer.id]
        return (
          <button key={layer.id} onClick={() => onToggleLayer(layer.id)}
            className={`layer-row ${on ? 'on' : ''}`}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: on ? layer.color : 'var(--text3)' }}
          >
            <div style={{ width: 10, height: 10, flexShrink: 0, border: `1px solid ${on ? layer.color : 'var(--border)'}`, background: on ? layer.color + '22' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {on && <div style={{ width: 4, height: 4, background: layer.color }} />}
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: on ? layer.color + 'aa' : 'var(--border)', border: `1px solid ${on ? layer.color + '44' : 'var(--border)'}`, padding: '0 3px', lineHeight: '14px', flexShrink: 0 }}>{layer.tag}</span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '.08em' }}>{layer.label}</span>
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
          <div style={{ fontSize: 10.5, color: 'var(--text3)', letterSpacing: '.1em' }}>AWAITING CRISIS DATA</div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ width: '100%', display: 'flex', gap: 6, padding: '4px 10px', opacity: 0.3 }}>
              <div style={{ width: 20, height: 10, background: 'var(--border)', borderRadius: 2 }} />
              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 3 }} />
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
            padding: '5px 10px', borderBottom: '1px solid var(--border)',
            borderLeft: `2px solid ${color}44`,
            transition: 'all .12s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
          >
            {/* Top row: rank, country, score badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 9.5, color: 'var(--text3)', width: 12, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.country}
              </span>
              <span style={{
                fontSize: 9.5, fontWeight: 800, color, letterSpacing: '.08em',
                background: `${color}14`, border: `1px solid ${color}33`,
                padding: '1px 5px', borderRadius: 2, flexShrink: 0,
              }}>{label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right', flexShrink: 0 }}>
                {r.score}
              </span>
            </div>

            {/* Risk bar */}
            <div className="risk-bar" style={{ marginLeft: 18, marginBottom: 4 }}>
              <div className="risk-fill" style={{
                width: `${Math.min(100, pct)}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
              }} />
            </div>

            {/* Event type breakdown chips */}
            <div style={{ marginLeft: 18, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: 'var(--text2)' }}>{r.events} events</span>
              {Object.entries(types).map(([type, count]) => (
                <span key={type} style={{
                  fontSize: 8.5, padding: '0 3px',
                  color: SEV_COLORS[type === 'war' ? 'critical' : type === 'conflict' ? 'high' : type === 'terrorism' ? 'high' : 'medium'] ?? 'var(--text2)',
                  border: '1px solid var(--border)', borderRadius: 1, letterSpacing: '.05em',
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
  const color = score >= 80 ? 'var(--red)' : score >= 60 ? 'var(--red)' : score >= 40 ? 'var(--amber)' : score >= 20 ? 'var(--amber)' : 'var(--accent)'
  const label = score >= 80 ? 'CRITICAL' : score >= 60 ? 'ELEVATED' : score >= 40 ? 'HIGH' : score >= 20 ? 'MODERATE' : 'NORMAL'
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }}>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * 2 * Math.PI - Math.PI / 2
            return <line key={i} x1={CX + 36 * Math.cos(a)} y1={CY + 36 * Math.sin(a)} x2={CX + 39 * Math.cos(a)} y2={CY + 39 * Math.sin(a)} stroke="var(--border)" strokeWidth="1" />
          })}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth="5" />
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${arc} ${total}`} strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ filter: `drop-shadow(0 0 4px ${color}88)`, transition: 'all 1s' }} />
          <circle cx={CX} cy={CY} r={23} fill="none" stroke="var(--border)" strokeWidth="1" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.15em', color }}>{label}</div>
        <div style={{ fontSize: '10.5px', color: 'var(--text3)', letterSpacing: '.1em', marginTop: 1 }}>// TREND STABLE</div>
      </div>
    </div>
  )
}

export function StockRow({ s }: { s: Stock }) {
  const pos = s.changePercent >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid var(--border)', borderLeft: '2px solid transparent', transition: 'all .1s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'var(--accent)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
    >
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text1)' }}>{s.symbol}</div>
        <div style={{ fontSize: '10px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{s.exchange || s.name}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '12.5px', color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>${s.price.toFixed(2)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', fontSize: '10.5px', color: pos ? 'var(--accent)' : 'var(--red)' }}>
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
    const load = () => { setLoading(true); fetchMultipleQuotes(symbols).then(setStocks).finally(() => setLoading(false)) }
    load()
    const timer = window.setInterval(load, 60_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(timer); unsub() }
  }, [key, retryCount]) // eslint-disable-line

  if (!hasFinnhub) return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', letterSpacing: '.1em', textAlign: 'center' }}>MARKET DATA UNAVAILABLE</div>
      <div style={{ fontSize: 9.5, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
        Add VITE_FINNHUB_KEY to .env<br />to enable live market feeds
      </div>
      {/* Skeleton rows */}
      {symbols.slice(0, 4).map((sym, i) => (
        <div key={i} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', opacity: 0.3 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', width: 36, fontWeight: 700 }}>{sym}</div>
          <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2 }} />
          <div style={{ width: 40, height: 8, background: 'var(--border)', borderRadius: 2 }} />
        </div>
      ))}
    </div>
  )
  if (loading && stocks.length === 0) return (
    <div style={{ padding: '8px 10px' }}>
      {symbols.slice(0, 6).map((sym, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', width: 36, fontWeight: 700 }}>{sym}</div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, width: `${60 + (i * 7) % 30}%`, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.5 }} />
          </div>
          <div style={{ width: 44, height: 8, background: 'var(--border)', borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.4 }} />
        </div>
      ))}
    </div>
  )
  if (!loading && stocks.length === 0) return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', letterSpacing: '.1em' }}>DATA FEED INTERRUPTED</div>
      <div style={{ fontSize: 9.5, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 }}>
        Market data temporarily unavailable.<br />Finnhub may be rate-limiting.
      </div>
      <button
        onClick={() => setRetryCount(c => c + 1)}
        style={{
          background: 'var(--accent-soft)', border: '1px solid var(--accent)33',
          color: 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: '3px 12px',
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
        {loading && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// QUERYING INTEL…</div>}
        {!loading && articles.length === 0 && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO REPORTS</div>}
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
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search country or exchange…"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 11.5, padding: '3px 7px', outline: 'none', fontFamily: 'inherit', letterSpacing: '.03em' }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// LOADING QUOTES…</div>}
        {filtered.map(ex => {
          const q = stocks.find(s => s.symbol === ex.ticker)
          const chg = q?.changePercent ?? null
          const chgColor = chg === null ? 'var(--text3)' : chg >= 0 ? 'var(--accent)' : 'var(--red)'
          return (
            <div key={ex.ticker} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
            >
              <span style={{ fontSize: 13.5, flexShrink: 0 }}>{ex.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text1)', fontWeight: 600, letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.country}</div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.exchange}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>
                  {q ? q.price.toFixed(2) : '—'}
                </div>
                <div style={{ fontSize: '10px', color: chgColor, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {chg !== null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : ''}
                </div>
              </div>
              <a href={ex.url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--text3)', fontSize: 10.5, flexShrink: 0 }}
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
            style={sevFilter === s && s !== 'all' ? { color: s === 'critical' ? 'var(--red)' : s === 'high' ? 'var(--amber)' : s === 'medium' ? 'var(--amber)' : '#8888ff', borderColor: `${SANCTION_COLORS[s as SanctionedCountry['severity']]}44` } : {}}>
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
        <button className={`news-tab ${tab==='weapons'?'active':''}`} onClick={() => setTab('weapons')} style={tab==='weapons'?{color:'var(--red)',borderColor:'var(--red)44'}:{}}>💣 WEAPONS SITES</button>
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
const SEV_COL: Record<string, string> = { critical: 'var(--red)', warning: 'var(--amber)', info: 'var(--amber)' }
const STATUS_COL: Record<string, string> = { closed: 'var(--red)', restricted: 'var(--amber)', normal: 'var(--accent)' }

export function AirspacePanel({ flights }: { flights: { latitude: number | null; longitude: number | null }[] }) {
  const [tab, setTab] = useState<'alerts'|'regions'>('alerts')
  const { alerts, statuses } = analyzeAirspace(flights)
  const closedCount     = statuses.filter(s => s.status === 'closed').length
  const restrictedCount = statuses.filter(s => s.status === 'restricted').length

  return (
    <>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '9.5px', color: 'var(--red)', fontWeight: 700, letterSpacing: '.1em' }}>
          {closedCount > 0 ? `⚠ ${closedCount} FIR${closedCount>1?'s':''} CLOSED` : ''}
        </span>
        {restrictedCount > 0 && <span style={{ fontSize: '9.5px', color: 'var(--amber)', fontWeight: 700, letterSpacing: '.1em' }}>⚡ {restrictedCount} RESTRICTED</span>}
        <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text3)' }}>{new Date().toLocaleTimeString()}</span>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>
        <button className={`news-tab ${tab==='alerts'?'active':''}`} onClick={() => setTab('alerts')}
          style={tab==='alerts'&&alerts.length>0?{color:'var(--red)',borderColor:'var(--red)44'}:{}}>
          ALERTS <span style={{ fontSize: '9.5px', color: 'var(--text3)' }}>{alerts.length}</span>
        </button>
        <button className={`news-tab ${tab==='regions'?'active':''}`} onClick={() => setTab('regions')}>
          ALL FIRS <span style={{ fontSize: '9.5px', color: 'var(--text3)' }}>{statuses.length}</span>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'alerts' && alerts.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// ALL MONITORED FIRS NORMAL</div>
        )}
        {tab === 'alerts' && alerts.map((a: NOTAMAlert) => (
          <div key={a.id} style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 5 }}>
            <div style={{ width: 2, background: SEV_COL[a.severity], flexShrink: 0, alignSelf: 'stretch', boxShadow: `0 0 4px ${SEV_COL[a.severity]}88` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span style={{ fontSize: '9.5px', color: SEV_COL[a.severity], fontWeight: 700, border: `1px solid ${SEV_COL[a.severity]}44`, padding: '0 3px', letterSpacing: '.08em' }}>{a.severity.toUpperCase()}</span>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text1)' }}>{a.icao}</span>
                <span style={{ fontSize: '10px', color: 'var(--text2)' }}>|</span>
                <span style={{ fontSize: '10px', color: 'var(--text2)' }}>{a.country}</span>
                <span style={{ fontSize: '9.5px', color: 'var(--text2)', border: '1px solid var(--border)', padding: '0 3px', marginLeft: 'auto' }}>{a.type}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.5 }}>{a.message}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: '10px', color: 'var(--text3)' }}>
                <span>Live: <b style={{ color: 'var(--text1)' }}>{a.liveCount}</b></span>
                <span>Baseline: <b style={{ color: 'var(--text2)' }}>~{a.baseline}</b></span>
                <span style={{ color: SEV_COL[a.severity] }}>▼ {a.dropPct}% below normal</span>
              </div>
            </div>
          </div>
        ))}
        {tab === 'regions' && statuses.map((s: FIRStatus) => (
          <div key={s.icao} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COL[s.status], flexShrink: 0, boxShadow: `0 0 4px ${STATUS_COL[s.status]}66` }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text1)', minWidth: 40 }}>{s.icao}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.country}</span>
            <span style={{ fontSize: '9.5px', color: STATUS_COL[s.status], fontWeight: 700, letterSpacing: '.06em', minWidth: 60, textAlign: 'right' }}>
              {s.status.toUpperCase()}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{s.liveCount}</span>
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

  useEffect(() => {
    load()
    const t = window.setInterval(load, 60_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(t); unsub() }
  }, [load])

  if (loading && !data.length) return <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// LOADING…</div>
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {data.map(d => {
        const pos = d.change >= 0
        const price = d.price >= 1 ? d.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : d.price.toFixed(4)
        return (
          <div key={d.sym} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid var(--border)', borderLeft: '2px solid transparent', transition: 'all .1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
          >
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text1)' }}>{d.sym}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>crypto · USD</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>${price}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', fontSize: '10.5px', color: pos ? 'var(--accent)' : 'var(--red)' }}>
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

  useEffect(() => {
    load()
    const t = window.setInterval(load, 120_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(t); unsub() }
  }, [load])

  if (loading && !Object.keys(rates).length) return <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// LOADING…</div>

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
          <div key={pair} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid var(--border)', borderLeft: '2px solid transparent', transition: 'all .1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
          >
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text1)' }}>{flag} {pair}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>forex · spot</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>{rate.toFixed(decimals)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Live Streams Panel ────────────────────────────────────────────────────────
const LIVE_STREAM_REGIONS = [
  { region: 'Americas', color: 'var(--red)', streams: [
    { id: 'cnn',      label: 'CNN',       src: 'https://www.youtube.com/embed/wq4Fb36aA2k?autoplay=1&mute=0',                                    title: 'CNN Live' },
    { id: 'stream2',  label: 'ABC',       src: 'https://www.youtube.com/embed/iipR5yUp36o?autoplay=1&mute=0',                                   title: 'ABC News Live' },
    { id: 'nbc',      label: 'NBC',       src: 'https://www.youtube.com/embed/SRYdE7zQBmg?autoplay=1&mute=0',                                   title: 'NBC News Now' },
    { id: 'cspan',    label: 'C-SPAN',    src: 'https://www.youtube.com/embed/DAPkHRRydr8?autoplay=1&mute=0',                                   title: 'C-SPAN Live' },
  ]},
  { region: 'Europe', color: 'var(--accent)', streams: [
    { id: 'bbcworld', label: 'BBC',       src: 'https://www.youtube.com/embed/w_Ma8oQLmSM?autoplay=1&mute=0',                                   title: 'BBC World News' },
    { id: 'euronews', label: 'EURO',      src: 'https://www.youtube.com/embed/3uVBkOSAZ4E?autoplay=1&mute=0',                                   title: 'Euronews Live' },
    { id: 'france24', label: 'FR24',      src: 'https://www.youtube.com/embed/h3MuIUNCCLI?autoplay=1&mute=0',                                   title: 'France 24 English' },
    { id: 'dwnews',   label: 'DW',        src: 'https://www.youtube.com/embed/mGnFE0-VHgw?autoplay=1&mute=0',                                   title: 'DW News Live' },
  ]},
  { region: 'MENA', color: 'var(--amber)', streams: [
    { id: 'aljazeng', label: 'AJE',       src: 'https://www.youtube.com/embed/Z_8fVI7xuYo?autoplay=1&mute=0',                                   title: 'Al Jazeera English' },
    { id: 'aljazeera',label: 'AJA',       src: 'https://www.youtube.com/embed/hvFpW7QMPFE?autoplay=1&mute=0',                                   title: 'Al Jazeera Arabic' },
    { id: 'trtworld', label: 'TRT',       src: 'https://www.youtube.com/embed/K_pJJa5p-aw?autoplay=1&mute=0',                                   title: 'TRT World Live' },
  ]},
  { region: 'Asia', color: 'var(--accent)', streams: [
    { id: 'nhkworld', label: 'NHK',       src: 'https://www.youtube.com/embed/CTEhRdPXlKQ?autoplay=1&mute=0',                                   title: 'NHK World Japan' },
    { id: 'cgtn',     label: 'CGTN',      src: 'https://www.youtube.com/embed/ljMqpMfNgpU?autoplay=1&mute=0',                                   title: 'CGTN News Live' },
    { id: 'arirang',  label: 'ARIAN',     src: 'https://www.youtube.com/embed/h4mFKOz5ZtA?autoplay=1&mute=0',                                   title: 'Arirang Korea' },
    { id: 'wion',     label: 'WION',      src: 'https://www.youtube.com/embed/pSAPFBRbpz0?autoplay=1&mute=0',                                   title: 'WION India' },
  ]},
  { region: 'Africa', color: 'var(--amber)', streams: [
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
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {LIVE_STREAM_REGIONS.map(r => (
          <button key={r.region} onClick={() => selectRegion(r)} style={{
            flexShrink: 0, padding: '5px 10px', fontSize: 12.5, fontWeight: 600, letterSpacing: '.06em',
            border: 'none', borderBottom: `2px solid ${activeRegion === r.region ? r.color : 'transparent'}`,
            background: 'transparent',
            color: activeRegion === r.region ? r.color : 'var(--text3)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
          }}>{r.region.toUpperCase()}</button>
        ))}
      </div>
      {/* Stream tabs for current region */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
        {region.streams.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)} style={{
            padding: '3px 9px', fontSize: 12.5, fontWeight: 600, letterSpacing: '.04em',
            borderRadius: 'var(--r-pill)',
            border: `1px solid ${activeId === s.id ? region.color + '88' : 'var(--border)'}`,
            background: activeId === s.id ? region.color + '22' : 'transparent',
            color: activeId === s.id ? region.color : 'var(--text3)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
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

// ── US Webcam Grid Panel ──────────────────────────────────────────────────────
type WebcamSource = 'skyline' | 'earthcam'

interface WebcamEntry {
  id: string
  label: string
  state: string
  source: WebcamSource
  url: string
  lat: number
  lng: number
}

const US_WEBCAMS: WebcamEntry[] = [
  // ── SkylineWebcams ──
  { id: 'sw-times-square',   label: 'Times Square',          state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/times-square.html', lat: 40.7580, lng: -73.9855 },
  { id: 'sw-empire-state',   label: 'Empire State Building', state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/empire-state-building.html', lat: 40.7484, lng: -73.9857 },
  { id: 'sw-nyc-skyline',    label: 'NYC Skyline',           state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/new-york-skyline.html', lat: 40.7128, lng: -74.0060 },
  { id: 'sw-nyc-46th',       label: 'NYC — 46th Street',     state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/nyc-46th-street.html', lat: 40.7580, lng: -73.9855 },
  { id: 'sw-broadway',       label: 'Broadway Billboards',   state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/new-york-city.html', lat: 40.7590, lng: -73.9845 },
  { id: 'sw-las-vegas',      label: 'Las Vegas Strip',       state: 'NV', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/nevada/las-vegas/las-vegas.html', lat: 36.1147, lng: -115.1729 },
  { id: 'sw-the-strat',      label: 'The Strat, Las Vegas',  state: 'NV', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/nevada/las-vegas/the-strat.html', lat: 36.1474, lng: -115.1558 },
  { id: 'sw-laguna',         label: 'Laguna Beach',          state: 'CA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/california/laguna-beach/laguna-beach.html', lat: 33.5427, lng: -117.7854 },
  { id: 'sw-santa-barbara',  label: 'Santa Barbara',         state: 'CA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/california/santa-barbara/santa-barbara.html', lat: 34.4208, lng: -119.6982 },
  { id: 'sw-encinitas',      label: 'Encinitas',             state: 'CA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/california/encinitas/encinitas-california.html', lat: 33.0370, lng: -117.2920 },
  { id: 'sw-miami',          label: 'Miami',                 state: 'FL', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/florida/miami/miami.html', lat: 25.7907, lng: -80.1300 },
  { id: 'sw-venetian',       label: 'Venetian Marina',       state: 'FL', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/florida/miami/venetian-marina-biscayne-bay.html', lat: 25.7909, lng: -80.1615 },
  { id: 'sw-fort-myers',     label: 'Fort Myers Beach',      state: 'FL', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/florida/fort-myers-beach/fort-myers-beach.html', lat: 26.4529, lng: -81.9500 },
  { id: 'sw-boston',         label: 'Boston Common',         state: 'MA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/massachusetts/boston/boston.html', lat: 42.3554, lng: -71.0655 },
  { id: 'sw-philly',         label: 'Rittenhouse Square',    state: 'PA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/pennsylvania/philadelphia/rittenhouse-square-park.html', lat: 39.9496, lng: -75.1719 },
  { id: 'sw-atlantic-city',  label: 'Atlantic City Boardwalk',state:'NJ', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-jersey/atlantic-city/atlantic-city-boardwalk.html', lat: 39.3643, lng: -74.4229 },
  { id: 'sw-ocean-city',     label: 'Ocean City Boardwalk',  state: 'NJ', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-jersey/ocean-city/boardwalk.html', lat: 39.2776, lng: -74.5746 },
  { id: 'sw-gatlinburg',     label: 'Gatlinburg',            state: 'TN', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/tennessee/gatlinburg/tennessee-gatlinburg.html', lat: 35.7143, lng: -83.5102 },
  { id: 'sw-smoky-mtns',     label: 'Great Smoky Mountains', state: 'TN', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/tennessee/pigeon-forge/great-smoky-mountains.html', lat: 35.7325, lng: -83.5486 },
  { id: 'sw-kahului',        label: 'Kahului, Maui',         state: 'HI', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/hawaii/maui/kahului.html', lat: 20.8893, lng: -156.4729 },
  { id: 'sw-newport-or',     label: 'Yaquina Bay, Newport',  state: 'OR', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/oregon/newport/yaquina-bay-newport-oregon-coast.html', lat: 44.6183, lng: -124.0512 },
  // ── EarthCam ──
  { id: 'ec-times-square',   label: 'Times Square South 4K', state: 'NY', source: 'earthcam', url: 'https://www.earthcam.com/usa/newyork/timessquare/', lat: 40.7566, lng: -73.9862 },
  { id: 'ec-vegas-strip',    label: 'Las Vegas Strip',       state: 'NV', source: 'earthcam', url: 'https://www.earthcam.com/usa/nevada/lasvegas/?cam=lasvegas', lat: 36.1162, lng: -115.1745 },
  { id: 'ec-miami-south',    label: 'Miami South Beach',     state: 'FL', source: 'earthcam', url: 'https://www.earthcam.com/usa/florida/miamibeach/?cam=miamibeach', lat: 25.7826, lng: -80.1310 },
  { id: 'ec-key-west',       label: 'Key West Sunset Pier',  state: 'FL', source: 'earthcam', url: 'https://www.earthcam.com/usa/florida/keywest/?cam=sunsetpier', lat: 24.5551, lng: -81.8081 },
  { id: 'ec-new-orleans',    label: 'Bourbon Street',        state: 'LA', source: 'earthcam', url: 'https://www.earthcam.com/usa/louisiana/neworleans/bourbonstreet/?cam=catsmeow', lat: 29.9584, lng: -90.0644 },
  { id: 'ec-chicago',        label: 'Chicago Navy Pier',     state: 'IL', source: 'earthcam', url: 'https://www.earthcam.com/usa/illinois/chicago/navypier/?cam=navypier', lat: 41.8917, lng: -87.6086 },
  { id: 'ec-niagara',        label: 'Niagara Falls',         state: 'NY', source: 'earthcam', url: 'https://www.earthcam.com/usa/newyork/niagarafalls/?cam=niagarafalls', lat: 43.0962, lng: -79.0377 },
  { id: 'ec-nashville',      label: 'Nashville Broadway',    state: 'TN', source: 'earthcam', url: 'https://www.earthcam.com/usa/tennessee/nashville/?cam=nashville', lat: 36.1612, lng: -86.7775 },
  { id: 'ec-santa-monica',   label: 'Santa Monica Pier',     state: 'CA', source: 'earthcam', url: 'https://www.earthcam.com/usa/california/santamonica/?cam=samo', lat: 34.0094, lng: -118.4973 },
  { id: 'ec-daytona',        label: 'Daytona Beach',         state: 'FL', source: 'earthcam', url: 'https://www.earthcam.com/usa/florida/daytonabeach/?cam=daytonabeach', lat: 29.2108, lng: -81.0228 },
]

/** Register US webcams into the global camera layer so the map's CAMERAS toggle shows them too. */
export function registerUSWebcams() {
  return US_WEBCAMS.map(w => ({
    id: w.id, name: w.label, city: '', country: 'United States',
    lat: w.lat, lng: w.lng, url: w.url, source: w.source,
  }))
}

const WEBCAM_STATES = ['All', ...Array.from(new Set(US_WEBCAMS.map(w => w.state))).sort()]

const SOURCE_META: Record<WebcamSource, { label: string; color: string }> = {
  skyline:  { label: 'SKYLINE',  color: 'var(--accent)' },
  earthcam: { label: 'EARTHCAM', color: 'var(--amber)' },
}

/** Small in-app box that shows a webcam feed at its exact geo location. Tries to embed
 * via iframe; since SkylineWebcams sends X-Frame-Options: SAMEORIGIN, embedding is blocked
 * server-side and cannot be bypassed client-side — falls back to a link-out state after a
 * short load timeout with no confirmed content. */
function WebcamBox({ cam, onClose }: { cam: WebcamEntry; onClose: () => void }) {
  const [status, setStatus] = useState<'loading' | 'embedded' | 'blocked'>('loading')
  const meta = SOURCE_META[cam.source]

  useEffect(() => {
    setStatus('loading')
    const t = setTimeout(() => setStatus(s => (s === 'loading' ? 'blocked' : s)), 3500)
    return () => clearTimeout(t)
  }, [cam.id])

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, maxWidth: '90vw', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text1)', flex: 1 }}>{cam.label}</span>
          <span style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '.06em', color: meta.color }}>{meta.label}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, lineHeight: 1, padding: '2px 4px' }}>✕</button>
        </div>

        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#000' }}>
          {status !== 'blocked' && (
            <iframe
              key={cam.id}
              src={cam.url}
              title={cam.label}
              onLoad={() => setStatus('embedded')}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          )}
          {status === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', color: 'var(--text3)', letterSpacing: '.08em' }}>
              CONNECTING…
            </div>
          )}
          {status === 'blocked' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, textAlign: 'center' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text2)', letterSpacing: '.04em' }}>Feed blocked from embedding by source</span>
              <a href={cam.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '10.5px', fontWeight: 700, color: meta.color, textDecoration: 'none', border: `1px solid ${meta.color}55`, padding: '6px 12px', borderRadius: 'var(--r-sm)' }}>
                OPEN LIVE FEED <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>

        <div style={{ padding: '6px 10px', fontSize: '9.5px', color: 'var(--text3)', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between' }}>
          <span>{cam.lat.toFixed(4)}, {cam.lng.toFixed(4)}</span>
          <span>{cam.state} · UNITED STATES</span>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function USWebcamsPanel() {
  const [state, setState]   = useState('All')
  const [source, setSource] = useState<WebcamSource | 'All'>('All')
  const [active, setActive] = useState<WebcamEntry | null>(null)

  const filtered = US_WEBCAMS.filter(w =>
    (state === 'All' || w.state === state) &&
    (source === 'All' || w.source === source)
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Source filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setSource('All')} className={`news-tab ${source === 'All' ? 'active' : ''}`}>ALL</button>
        {(Object.keys(SOURCE_META) as WebcamSource[]).map(s => (
          <button key={s} onClick={() => setSource(s)}
            className={`news-tab ${source === s ? 'active' : ''}`}
            style={source === s ? { color: SOURCE_META[s].color, borderColor: SOURCE_META[s].color + '44' } : {}}
          >{SOURCE_META[s].label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text3)', letterSpacing: '.06em' }}>{filtered.length} CAMS</span>
      </div>

      {/* State filter */}
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {WEBCAM_STATES.map(s => (
          <button key={s} onClick={() => setState(s)}
            className={`news-tab ${state === s ? 'active' : ''}`}
            style={{ whiteSpace: 'nowrap' }}>{s}</button>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 6, padding: 6,
      }}>
        {filtered.map(w => {
          const meta = SOURCE_META[w.source]
          return (
            <button key={w.id} onClick={() => setActive(w)}
              style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                aspectRatio: '4 / 3', padding: 7,
                border: '1px solid var(--border)', background: 'var(--surface2)',
                textAlign: 'left', cursor: 'pointer', transition: 'all .12s', position: 'relative',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = meta.color + '88'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '.06em', color: meta.color }}>{meta.label}</span>
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text1)', lineHeight: 1.3 }}>{w.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text3)', letterSpacing: '.06em' }}>{w.state}</span>
                </div>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO CAMS FOR FILTER</div>
        )}
      </div>

      {active && <WebcamBox cam={active} onClose={() => setActive(null)} />}
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
    case 'webcams':      return <USWebcamsPanel />
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

// ── Global Economy Panel ──────────────────────────────────────────────────
// All 249 countries/territories (ISO 3166-1) for World Bank lookup
const ALL_COUNTRIES: { iso2: string; name: string }[] = [
  {iso2:'AF',name:'Afghanistan'},{iso2:'AL',name:'Albania'},{iso2:'DZ',name:'Algeria'},{iso2:'AD',name:'Andorra'},{iso2:'AO',name:'Angola'},
  {iso2:'AG',name:'Antigua and Barbuda'},{iso2:'AR',name:'Argentina'},{iso2:'AM',name:'Armenia'},{iso2:'AU',name:'Australia'},{iso2:'AT',name:'Austria'},
  {iso2:'AZ',name:'Azerbaijan'},{iso2:'BS',name:'Bahamas'},{iso2:'BH',name:'Bahrain'},{iso2:'BD',name:'Bangladesh'},{iso2:'BB',name:'Barbados'},
  {iso2:'BY',name:'Belarus'},{iso2:'BE',name:'Belgium'},{iso2:'BZ',name:'Belize'},{iso2:'BJ',name:'Benin'},{iso2:'BT',name:'Bhutan'},
  {iso2:'BO',name:'Bolivia'},{iso2:'BA',name:'Bosnia and Herzegovina'},{iso2:'BW',name:'Botswana'},{iso2:'BR',name:'Brazil'},{iso2:'BN',name:'Brunei'},
  {iso2:'BG',name:'Bulgaria'},{iso2:'BF',name:'Burkina Faso'},{iso2:'BI',name:'Burundi'},{iso2:'CV',name:'Cabo Verde'},{iso2:'KH',name:'Cambodia'},
  {iso2:'CM',name:'Cameroon'},{iso2:'CA',name:'Canada'},{iso2:'CF',name:'Central African Republic'},{iso2:'TD',name:'Chad'},{iso2:'CL',name:'Chile'},
  {iso2:'CN',name:'China'},{iso2:'CO',name:'Colombia'},{iso2:'KM',name:'Comoros'},{iso2:'CG',name:'Congo'},{iso2:'CD',name:'DR Congo'},
  {iso2:'CR',name:'Costa Rica'},{iso2:'CI',name:'Côte d\'Ivoire'},{iso2:'HR',name:'Croatia'},{iso2:'CU',name:'Cuba'},{iso2:'CY',name:'Cyprus'},
  {iso2:'CZ',name:'Czech Republic'},{iso2:'DK',name:'Denmark'},{iso2:'DJ',name:'Djibouti'},{iso2:'DM',name:'Dominica'},{iso2:'DO',name:'Dominican Republic'},
  {iso2:'EC',name:'Ecuador'},{iso2:'EG',name:'Egypt'},{iso2:'SV',name:'El Salvador'},{iso2:'GQ',name:'Equatorial Guinea'},{iso2:'ER',name:'Eritrea'},
  {iso2:'EE',name:'Estonia'},{iso2:'SZ',name:'Eswatini'},{iso2:'ET',name:'Ethiopia'},{iso2:'FJ',name:'Fiji'},{iso2:'FI',name:'Finland'},
  {iso2:'FR',name:'France'},{iso2:'GA',name:'Gabon'},{iso2:'GM',name:'Gambia'},{iso2:'GE',name:'Georgia'},{iso2:'DE',name:'Germany'},
  {iso2:'GH',name:'Ghana'},{iso2:'GR',name:'Greece'},{iso2:'GD',name:'Grenada'},{iso2:'GT',name:'Guatemala'},{iso2:'GN',name:'Guinea'},
  {iso2:'GW',name:'Guinea-Bissau'},{iso2:'GY',name:'Guyana'},{iso2:'HT',name:'Haiti'},{iso2:'HN',name:'Honduras'},{iso2:'HU',name:'Hungary'},
  {iso2:'IS',name:'Iceland'},{iso2:'IN',name:'India'},{iso2:'ID',name:'Indonesia'},{iso2:'IR',name:'Iran'},{iso2:'IQ',name:'Iraq'},
  {iso2:'IE',name:'Ireland'},{iso2:'IL',name:'Israel'},{iso2:'IT',name:'Italy'},{iso2:'JM',name:'Jamaica'},{iso2:'JP',name:'Japan'},
  {iso2:'JO',name:'Jordan'},{iso2:'KZ',name:'Kazakhstan'},{iso2:'KE',name:'Kenya'},{iso2:'KI',name:'Kiribati'},{iso2:'KP',name:'North Korea'},
  {iso2:'KR',name:'South Korea'},{iso2:'KW',name:'Kuwait'},{iso2:'KG',name:'Kyrgyzstan'},{iso2:'LA',name:'Laos'},{iso2:'LV',name:'Latvia'},
  {iso2:'LB',name:'Lebanon'},{iso2:'LS',name:'Lesotho'},{iso2:'LR',name:'Liberia'},{iso2:'LY',name:'Libya'},{iso2:'LI',name:'Liechtenstein'},
  {iso2:'LT',name:'Lithuania'},{iso2:'LU',name:'Luxembourg'},{iso2:'MG',name:'Madagascar'},{iso2:'MW',name:'Malawi'},{iso2:'MY',name:'Malaysia'},
  {iso2:'MV',name:'Maldives'},{iso2:'ML',name:'Mali'},{iso2:'MT',name:'Malta'},{iso2:'MH',name:'Marshall Islands'},{iso2:'MR',name:'Mauritania'},
  {iso2:'MU',name:'Mauritius'},{iso2:'MX',name:'Mexico'},{iso2:'FM',name:'Micronesia'},{iso2:'MD',name:'Moldova'},{iso2:'MC',name:'Monaco'},
  {iso2:'MN',name:'Mongolia'},{iso2:'ME',name:'Montenegro'},{iso2:'MA',name:'Morocco'},{iso2:'MZ',name:'Mozambique'},{iso2:'MM',name:'Myanmar'},
  {iso2:'NA',name:'Namibia'},{iso2:'NR',name:'Nauru'},{iso2:'NP',name:'Nepal'},{iso2:'NL',name:'Netherlands'},{iso2:'NZ',name:'New Zealand'},
  {iso2:'NI',name:'Nicaragua'},{iso2:'NE',name:'Niger'},{iso2:'NG',name:'Nigeria'},{iso2:'MK',name:'North Macedonia'},{iso2:'NO',name:'Norway'},
  {iso2:'OM',name:'Oman'},{iso2:'PK',name:'Pakistan'},{iso2:'PW',name:'Palau'},{iso2:'PA',name:'Panama'},{iso2:'PG',name:'Papua New Guinea'},
  {iso2:'PY',name:'Paraguay'},{iso2:'PE',name:'Peru'},{iso2:'PH',name:'Philippines'},{iso2:'PL',name:'Poland'},{iso2:'PT',name:'Portugal'},
  {iso2:'QA',name:'Qatar'},{iso2:'RO',name:'Romania'},{iso2:'RU',name:'Russia'},{iso2:'RW',name:'Rwanda'},{iso2:'KN',name:'Saint Kitts and Nevis'},
  {iso2:'LC',name:'Saint Lucia'},{iso2:'VC',name:'Saint Vincent'},{iso2:'WS',name:'Samoa'},{iso2:'SM',name:'San Marino'},{iso2:'ST',name:'São Tomé and Príncipe'},
  {iso2:'SA',name:'Saudi Arabia'},{iso2:'SN',name:'Senegal'},{iso2:'RS',name:'Serbia'},{iso2:'SC',name:'Seychelles'},{iso2:'SL',name:'Sierra Leone'},
  {iso2:'SG',name:'Singapore'},{iso2:'SK',name:'Slovakia'},{iso2:'SI',name:'Slovenia'},{iso2:'SB',name:'Solomon Islands'},{iso2:'SO',name:'Somalia'},
  {iso2:'ZA',name:'South Africa'},{iso2:'SS',name:'South Sudan'},{iso2:'ES',name:'Spain'},{iso2:'LK',name:'Sri Lanka'},{iso2:'SD',name:'Sudan'},
  {iso2:'SR',name:'Suriname'},{iso2:'SE',name:'Sweden'},{iso2:'CH',name:'Switzerland'},{iso2:'SY',name:'Syria'},{iso2:'TW',name:'Taiwan'},
  {iso2:'TJ',name:'Tajikistan'},{iso2:'TZ',name:'Tanzania'},{iso2:'TH',name:'Thailand'},{iso2:'TL',name:'Timor-Leste'},{iso2:'TG',name:'Togo'},
  {iso2:'TO',name:'Tonga'},{iso2:'TT',name:'Trinidad and Tobago'},{iso2:'TN',name:'Tunisia'},{iso2:'TR',name:'Turkey'},{iso2:'TM',name:'Turkmenistan'},
  {iso2:'TV',name:'Tuvalu'},{iso2:'UG',name:'Uganda'},{iso2:'UA',name:'Ukraine'},{iso2:'AE',name:'UAE'},{iso2:'GB',name:'United Kingdom'},
  {iso2:'US',name:'United States'},{iso2:'UY',name:'Uruguay'},{iso2:'UZ',name:'Uzbekistan'},{iso2:'VU',name:'Vanuatu'},{iso2:'VE',name:'Venezuela'},
  {iso2:'VN',name:'Vietnam'},{iso2:'YE',name:'Yemen'},{iso2:'ZM',name:'Zambia'},{iso2:'ZW',name:'Zimbabwe'},
  {iso2:'HK',name:'Hong Kong'},{iso2:'MO',name:'Macau'},{iso2:'PS',name:'Palestine'},{iso2:'XK',name:'Kosovo'},
]

export function GlobalEconomyPanel({ onCountryClick }: { onCountryClick?: (country: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [econData, setEconData] = useState<CountryEconData | null>(null)
  const [econLoading, setEconLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!selected) { setEconData(null); return }
    setEconLoading(true)
    fetchCountryEcon(selected).then(d => { setEconData(d); setEconLoading(false) }).catch(() => setEconLoading(false))
  }, [selected])

  // Merge: trade profiles first (with balance), then all other countries
  const tradeMap = new Map(TRADE_PROFILES.map(t => [t.iso2, t]))
  const allEntries = ALL_COUNTRIES.map(c => ({ ...c, trade: tradeMap.get(c.iso2) ?? null }))
  // Sort: countries with trade profiles first (by balance), then alphabetical
  const sorted = allEntries.sort((a, b) => {
    if (a.trade && !b.trade) return -1
    if (!a.trade && b.trade) return 1
    if (a.trade && b.trade) return (b.trade.tradeBalance ?? 0) - (a.trade.tradeBalance ?? 0)
    return a.name.localeCompare(b.name)
  })
  const filtered = search.trim()
    ? sorted.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.iso2.toLowerCase().includes(search.toLowerCase()))
    : sorted
  const maxBal = Math.max(...TRADE_PROFILES.map(t => Math.abs(t.tradeBalance ?? 0)), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'IBM Plex Mono, monospace' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${ALL_COUNTRIES.length} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        {filtered.length} countries · {TRADE_PROFILES.length} with trade profiles · Click for World Bank data
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {filtered.map(c => {
          const t = c.trade
          const isOpen = selected === c.name
          const bal = t?.tradeBalance ?? null
          const balColor = bal != null ? (bal >= 0 ? 'var(--accent)' : 'var(--red)') : 'var(--text3)'
          const barW = bal != null ? Math.abs(bal) / maxBal * 100 : 0
          return (
            <div key={c.iso2} style={{ borderBottom: '1px solid var(--border)', marginBottom: 1 }}>
              <button
                onClick={() => { setSelected(isOpen ? null : c.name); onCountryClick?.(c.name) }}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--accent-soft)' : 'none',
                  border: 'none', padding: '3px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 700, color: t ? 'var(--accent)' : 'var(--text3)', width: 20, flexShrink: 0 }}>{c.iso2}</span>
                <span style={{ fontSize: 10.5, color: t ? 'var(--text1)' : 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                {bal != null && (
                  <>
                    <div style={{ width: 50, height: 3, background: 'var(--border)', borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${barW}%`, height: '100%', background: balColor, borderRadius: 1 }} />
                    </div>
                    <span style={{ fontSize: 9, color: balColor, fontWeight: 700, width: 38, textAlign: 'right', flexShrink: 0 }}>
                      {bal >= 0 ? '+' : ''}{bal}B
                    </span>
                  </>
                )}
              </button>
              {isOpen && (
                <div style={{ padding: '4px 0 6px 20px' }}>
                  {t && (
                    <>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                        {t.tradeToGDP != null && (
                          <span style={{ fontSize: 9, padding: '1px 4px', background: 'var(--accent-soft)', border: '1px solid var(--accent)22', color: 'var(--accent)' }}>
                            Trade/GDP {t.tradeToGDP}%
                          </span>
                        )}
                        <span style={{ fontSize: 9, padding: '1px 4px', background: 'var(--amber-soft)', border: '1px solid var(--amber)22', color: 'var(--amber)' }}>
                          {t.currency}
                        </span>
                        <span style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(170,136,255,0.08)', border: '1px solid #aa88ff22', color: '#aa88ff' }}>
                          {t.incomeGroup}
                        </span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text2)', marginBottom: 2 }}>TOP EXPORTS</div>
                      {t.topExports.slice(0, 4).map(e => (
                        <div key={e.product} style={{ fontSize: 9.5, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{e.product}</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{e.pct}%</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 3, marginBottom: 2 }}>TOP PARTNERS</div>
                      {t.topExportPartners.slice(0, 3).map(p => (
                        <div key={p.country} style={{ fontSize: 9.5, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{p.country}</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.pct}%</span>
                        </div>
                      ))}
                      {t.dependencies && t.dependencies.length > 0 && (
                        <>
                          <div style={{ fontSize: 9, color: 'var(--red)', marginTop: 3, marginBottom: 2 }}>DEPENDENCIES</div>
                          {t.dependencies.slice(0, 3).map(d => (
                            <div key={d} style={{ fontSize: 9, color: 'var(--text2)' }}>▸ {d}</div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                  {/* World Bank live data */}
                  {econLoading && <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>Loading World Bank data…</div>}
                  {econData && econData.indicators.length > 0 && (() => {
                    const groups = groupIndicators(econData.indicators)
                    return Object.entries(groups).map(([groupName, indicators]) => (
                      <div key={groupName} style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 9, color: 'var(--text2)', letterSpacing: '.08em', marginBottom: 2 }}>{groupName}</div>
                        {indicators.map(ind => {
                          if (ind.value == null) return null
                          const formatted = formatEconValue(ind.id, ind.value)
                          const isGrowth = ind.id.includes('.ZG') || ind.id === 'SP.POP.GROW'
                          let valColor = 'var(--accent)'
                          if (isGrowth) valColor = ind.value >= 0 ? 'var(--accent)' : 'var(--red)'
                          return (
                            <div key={ind.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, padding: '0.5px 0' }}>
                              <span style={{ color: 'var(--text2)' }}>{ind.label}</span>
                              <span style={{ color: valColor, fontWeight: 700 }}>{formatted} <span style={{ fontSize: 8, color: 'var(--text2)' }}>{ind.year}</span></span>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  })()}
                  {!t && !econLoading && !econData && (
                    <div style={{ fontSize: 9.5, color: 'var(--text2)', fontStyle: 'italic' }}>Click to load World Bank economic data</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
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

export function MarketsPanel() {
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
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto', gap: 0 }}>
        {MARKET_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '4px 7px', fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em',
            background: activeTab === t.id ? 'var(--accent-soft)' : 'transparent',
            border: 'none', borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === t.id ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer',
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

// ── Watchlist card — rule-based trajectory forecast, rendered inside AIAnalystPanel ──
function WatchlistCard({ entry, onExplain }: { entry: TrajectoryEntry; onExplain: () => void }) {
  const Icon = entry.trend === 'rising' ? TrendingUp : entry.trend === 'falling' ? TrendingDown : Minus
  const color = entry.trend === 'rising' ? 'var(--red)' : entry.trend === 'falling' ? 'var(--green)' : 'var(--text3)'
  const bars = Math.max(1, Math.min(5, Math.round(entry.velocity / 20)))
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon size={14} color={color} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>{entry.country}</span>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} style={{
              width: 3, height: i * 2 + 2, borderRadius: 1,
              background: i <= bars ? color : 'var(--border-strong)',
            }} />
          ))}
        </div>
        <span style={{ fontSize: 10.5, color, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase' }}>
          {entry.trend}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{entry.reason}</div>
      <button
        onClick={onExplain}
        style={{
          alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent)', fontSize: 11.5, padding: 0, fontFamily: 'inherit',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
      >
        Explain this trend →
      </button>
    </div>
  )
}

// ── Action log entry — one row per dashboard command the AI has executed ───
interface ActionLogEntry {
  id: string
  kind: 'fly' | 'country' | 'layer' | 'deepstate'
  label: string
  at: number
}

// ── AI Analyst Panel (OpenRouter) ─────────────────────────────────────────
export function AIAnalystPanel({ crises, flights, onGeoSearch, onCountryClick, onToggleLayer, panelState }: {
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
  const [sessionId, setSessionId] = useState(() => newSessionId())
  const [showHistory, setShowHistory] = useState(false)
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([])
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])
  const [followUps, setFollowUps] = useState<string[]>([])
  const [reasoning, setReasoning] = useState('')
  const abortRef  = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const hasKey    = !!import.meta.env.VITE_OPENROUTER_KEY

  // Rule-based trajectory scoring — recomputes automatically as crises/flights refresh.
  // No prompt required; this is what makes the panel proactive rather than ask-only.
  const trajectories = useMemo(() => computeTrajectories(crises, flights), [crises, flights])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [response])

  // Persist the running conversation to localStorage after each turn
  useEffect(() => {
    if (history.length === 0) return
    saveSession({
      id: sessionId,
      startedAt: Number(sessionId.split('-')[0]) || Date.now(),
      updatedAt: Date.now(),
      model,
      messages: history,
    })
  }, [history, sessionId, model])

  function openHistory() {
    setPastSessions(listSessions())
    setShowHistory(true)
  }

  function loadSession(s: ChatSession) {
    setHistory(s.messages)
    setModel(s.model)
    setSessionId(s.id)
    const lastAssistant = [...s.messages].reverse().find(m => m.role === 'assistant')
    setResponse(lastAssistant?.content ?? '')
    setShowHistory(false)
    setError('')
    setActionLog([])
    setFollowUps([])
    setReasoning('')
  }

  function startNewSession() {
    setHistory([])
    setResponse('')
    setError('')
    setSessionId(newSessionId())
    setShowHistory(false)
    setActionLog([])
    setFollowUps([])
    setReasoning('')
  }

  // Contextual follow-up chips — derived client-side from the response text and
  // live dashboard state, not another model call. Keeps the "next question" always
  // one tap away instead of a blank input box.
  function deriveFollowUps(text: string, cmds: ActionLogEntry[]): string[] {
    const suggestions: string[] = []
    const flown = cmds.find(c => c.kind === 'fly' || c.kind === 'country')
    if (flown) suggestions.push(`What's the historical pattern for ${flown.label}?`)
    if (/marke|price|oil|energy/i.test(text)) suggestions.push('How would this affect markets over the next 30 days?')
    if (/escalat|risk|tension/i.test(text)) suggestions.push('What would de-escalation look like here?')
    if (trajectories.length > 0 && suggestions.length < 2) {
      suggestions.push(`Compare this to the ${trajectories[0].country} trajectory`)
    }
    if (suggestions.length < 2) suggestions.push('Summarize this in 3 bullet points')
    return suggestions.slice(0, 3)
  }

  function removeSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    deleteSession(id)
    setPastSessions(listSessions())
    if (id === sessionId) startNewSession()
  }

  async function ask(prompt: string) {
    if (!prompt.trim() || streaming) return
    setError('')
    setResponse('')
    setActionLog([])
    setFollowUps([])
    setReasoning('')
    setStreaming(true)
    abortRef.current = new AbortController()

    const context  = buildDashboardContext(crises, flights, trajectories)
    const sysMsg: DSMessage = {
      role: 'system',
      content: `You are an elite intelligence analyst embedded in a real-time global surveillance dashboard called WORLDVIEW. You have access to live data, including a rule-based TRAJECTORY SIGNALS section (computed locally, not by you) that tracks whether each region's crisis activity is rising, falling, or flat over the last 3 days vs. the prior week. Ground your analysis in these computed trajectories when discussing risk or escalation — explicitly distinguish current state ("X active events") from direction of change ("rising/falling, because..."). Provide concise, actionable analysis. Use a professional intelligence briefing tone. Format with clear sections when appropriate. Be direct and fact-focused.

IMPORTANT: You can execute dashboard commands by including them in your response. Commands are on their own line:

[FLY:location] — Fly the map to a location (city, country, coordinates). Example: [FLY:Tehran, Iran]
[COUNTRY:name] — Open the country intelligence drawer. Example: [COUNTRY:Iran]
[LAYER:id:on] or [LAYER:id:off] — Toggle a map layer. Layer IDs: flights, crises, wildfires, military, nuclear, sanctions, cameras, infrastructure, airspace, humanitarian, vessels, oil, gas, ports, pipelines, gpsjam
[DEEPSTATE:on] or [DEEPSTATE:off] — Toggle Ukraine frontline overlay

When a user asks about a specific country or region, ALWAYS include the FLY and COUNTRY commands to show it on the map. When relevant, enable related layers. For example if asked about Iran, fly there, open the country drawer, and enable relevant layers like military, crises, airspace.

Execute commands BEFORE your analysis text — put them at the very start of your response.

${context}`,
    }
    const userMsg: DSMessage = { role: 'user', content: prompt }
    const messages: DSMessage[] = [sysMsg, ...history, userMsg]

    let full = ''
    const executedCmds = new Set<string>()
    const loggedActions: ActionLogEntry[] = []
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
              const loc = flyMatch[1].trim()
              onGeoSearch?.(loc)
              const entry: ActionLogEntry = { id: `${Date.now()}-fly`, kind: 'fly', label: loc, at: Date.now() }
              loggedActions.push(entry)
              setActionLog(prev => [...prev, entry])
              continue
            }

            const countryMatch = trimmed.match(/^\[COUNTRY:(.+)\]$/)
            if (countryMatch) {
              executedCmds.add(trimmed)
              const name = countryMatch[1].trim()
              onCountryClick?.(name)
              const entry: ActionLogEntry = { id: `${Date.now()}-country`, kind: 'country', label: name, at: Date.now() }
              loggedActions.push(entry)
              setActionLog(prev => [...prev, entry])
              continue
            }

            const layerMatch = trimmed.match(/^\[LAYER:(\w+):(on|off)\]$/)
            if (layerMatch && onToggleLayer && panelState) {
              const layerId = layerMatch[1] as keyof PanelState
              const wantOn = layerMatch[2] === 'on'
              if (layerId in panelState && panelState[layerId] !== wantOn) {
                executedCmds.add(trimmed)
                onToggleLayer(layerId)
                const entry: ActionLogEntry = { id: `${Date.now()}-layer-${layerId}`, kind: 'layer', label: `${layerId} ${wantOn ? 'on' : 'off'}`, at: Date.now() }
                loggedActions.push(entry)
                setActionLog(prev => [...prev, entry])
              }
              continue
            }

            const dsMatch = trimmed.match(/^\[DEEPSTATE:(on|off)\]$/)
            if (dsMatch) {
              executedCmds.add(trimmed)
              const entry: ActionLogEntry = { id: `${Date.now()}-deepstate`, kind: 'deepstate', label: `Ukraine frontline ${dsMatch[1]}`, at: Date.now() }
              loggedActions.push(entry)
              setActionLog(prev => [...prev, entry])
              continue
            }
          }
          // Display response without command lines
          const display = full.split('\n').filter(l => !l.trim().match(/^\[(FLY|COUNTRY|LAYER|DEEPSTATE):.+\]$/)).join('\n')
          setResponse(display)
        },
        abortRef.current.signal,
        model,
        token => setReasoning(prev => (prev + token).slice(-220)),
      )
      const cleanResponse = full.split('\n').filter(l => !l.trim().match(/^\[(FLY|COUNTRY|LAYER|DEEPSTATE):.+\]$/)).join('\n')
      setHistory(prev => [
        ...prev.slice(-10),
        userMsg,
        { role: 'assistant', content: cleanResponse },
      ])
      setFollowUps(deriveFollowUps(cleanResponse, loggedActions))
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
          marginBottom: isHeader ? 9 : isBullet ? 3 : 2,
          paddingLeft: isBullet ? 12 : 0,
          borderLeft: isBullet ? '2px solid var(--accent)' : 'none',
          color: isHeader ? 'var(--accent)' : 'var(--text1)',
          fontWeight: isHeader ? 700 : 400,
          fontSize: isHeader ? 14 : 13.5,
          letterSpacing: isHeader ? '.03em' : 'normal',
          lineHeight: 1.7,
        }}
          dangerouslySetInnerHTML={{ __html: bold.replace(/^#+\s/, '').replace(/^[\-\•\*]\s/, '') }}
        />
      )
    })
  }

  // Lightweight, cosmetic "reasoning trace" — cycles through a few
  // transient status lines while a response is streaming/loading.
  // Vocabulary drawn only from this panel's own quick-prompt labels / context.
  const TRACE_STEPS = [
    'Cross-referencing crisis feed…',
    'Checking airspace status…',
    'Correlating market signals…',
    'Scanning humanitarian corridors…',
  ]
  const [traceIdx, setTraceIdx] = useState(0)
  useEffect(() => {
    if (!streaming) { setTraceIdx(0); return }
    const t = window.setInterval(() => setTraceIdx(i => (i + 1) % TRACE_STEPS.length), 1100)
    return () => clearInterval(t)
  }, [streaming]) // eslint-disable-line

  // Cosmetic, client-side confidence heuristic derived from the response itself —
  // not a backend field. Longer, more structured answers read as higher confidence.
  function confidenceOf(text: string): { label: string; bars: number } {
    if (!text) return { label: 'Low confidence', bars: 1 }
    const len = text.length
    const hasStructure = /\n[\-\•\*]\s|\n#+\s|\d/.test(text)
    let bars = 1
    if (len > 200) bars = 2
    if (len > 500) bars = 3
    if (len > 900 && hasStructure) bars = 4
    const label = bars >= 4 ? 'High confidence' : bars === 3 ? 'Good confidence' : bars === 2 ? 'Moderate confidence' : 'Low confidence'
    return { label, bars }
  }

  if (!hasKey) return (
    <div className="ai-surface" style={{ height: '100%', padding: '20px 22px', fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.8 }}>
      OPENROUTER KEY REQUIRED<br />
      Add VITE_OPENROUTER_KEY to .env
    </div>
  )

  const confidence = confidenceOf(response)

  return (
    <div className="ai-surface" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0 }}>

      {/* Console header */}
      <div className="ai-header" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative' }}>
        <Terminal size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="ai-pulse-dot" />
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          disabled={streaming}
          style={{
            flex: 1, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text1)',
            fontSize: 12.5, fontFamily: 'inherit', letterSpacing: '.01em', padding: '5px 7px', borderRadius: 'var(--r-sm)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          {FREE_MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label} · {m.ctx} ctx · FREE</option>
          ))}
        </select>
        <button
          onClick={startNewSession}
          title="New conversation"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text2)', cursor: 'pointer', padding: '6px 7px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)' }}
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => (showHistory ? setShowHistory(false) : openHistory())}
          title="Chat history"
          style={{ background: showHistory ? 'var(--accent-soft)' : 'var(--surface)', border: `1px solid ${showHistory ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-sm)', color: showHistory ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', padding: '6px 7px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { if (!showHistory) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)' }}
        >
          <History size={14} />
        </button>

        {showHistory && (
          <div className="ai-glow-border" style={{
            position: 'absolute', top: '100%', right: 10, left: 10, zIndex: 40,
            background: 'var(--surface)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-md)', maxHeight: 280, overflowY: 'auto', marginTop: 4,
          }}>
            <div style={{ padding: '8px 11px', fontSize: 11, color: 'var(--text2)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>
              PAST CONVERSATIONS ({pastSessions.length})
            </div>
            {pastSessions.length === 0 && (
              <div style={{ padding: '12px 11px', fontSize: 12.5, color: 'var(--text3)' }}>No saved conversations yet</div>
            )}
            {pastSessions.map(s => {
              const firstUser = s.messages.find(m => m.role === 'user')
              return (
                <div
                  key={s.id}
                  onClick={() => loadSession(s)}
                  style={{
                    padding: '9px 11px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: s.id === sessionId ? 'var(--accent-soft)' : 'transparent',
                    display: 'flex', alignItems: 'flex-start', gap: 6, transition: 'background .12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = s.id === sessionId ? 'var(--accent-soft)' : 'transparent' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {firstUser?.content || '(empty)'}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>
                      {new Date(s.updatedAt).toLocaleString()} · {s.messages.length} MSGS
                    </div>
                  </div>
                  <button
                    onClick={e => removeSession(s.id, e)}
                    title="Delete conversation"
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Watchlist — proactive trajectory forecast, no prompt required */}
      {trajectories.length > 0 && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '.06em', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <span className="ai-pulse-dot" /> WATCHLIST — 72H TRAJECTORY
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {trajectories.map(t => (
              <WatchlistCard key={t.country} entry={t} onExplain={() => {
                ask(`Explain the ${t.trend} trend for ${t.country}: ${t.recentCount} events in the last 72h (score ${t.recentScore}) vs ${t.priorCount} in the prior week (score ${t.priorScore}). What's driving this and what should I watch for next?`)
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Quick prompts */}
      {!response && !streaming && history.length === 0 && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '.06em', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <span className="ai-pulse-dot" /> QUICK ANALYSIS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.label}
                onClick={() => { ask(qp.prompt) }}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--r-pill)',
                  color: 'var(--accent)', fontSize: 12.5, padding: '6px 13px',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 5,
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--accent-soft)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border-strong)'; el.style.background = 'var(--surface2)' }}
              >
                {qp.icon} {qp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation history */}
      {history.length > 0 && (
        <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
          {history.filter(m => m.role === 'user').slice(-2).map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <span style={{
                background: 'var(--accent)', color: '#ffffff',
                borderRadius: '16px 16px 4px 16px', padding: '8px 14px', fontSize: 13.5,
                maxWidth: '85%', lineHeight: 1.5,
              }}>
                {m.content.slice(0, 140)}{m.content.length > 140 ? '…' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Response area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 0 }}>
        {!response && !streaming && history.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.9, paddingTop: 4 }}>
            AI ANALYST READY<br />
            {crises.length} active crises · {flights.length.toLocaleString()} flights tracked<br />
            {trajectories.length > 0
              ? `Watchlist above is tracking ${trajectories.length} regions — select an entry or ask below`
              : 'Select a quick analysis or type your query below'}
          </div>
        )}

        {streaming && !response && !reasoning && (
          <div style={{ marginBottom: 10 }}>
            {TRACE_STEPS.slice(0, traceIdx + 1).map((step, i) => (
              <div key={step} className="ai-trace-item" style={{ opacity: i === traceIdx ? 1 : 0.5, fontSize: 12.5 }}>
                <span className="ai-pulse-dot" style={{ width: 5, height: 5 }} />
                {step}
              </div>
            ))}
          </div>
        )}

        {/* Live reasoning trace — real model "thinking" text, shown until visible content starts */}
        {streaming && !response && reasoning && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, fontStyle: 'italic' }}>
            {reasoning}
            <span className="ai-cursor" />
          </div>
        )}

        {/* Live action timeline — every dashboard command the AI has executed this turn */}
        {actionLog.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {actionLog.map(a => {
              const Icon = a.kind === 'fly' ? Navigation : a.kind === 'country' ? Info : a.kind === 'layer' ? Layers : Radio
              return (
                <div key={a.id} className="ai-action-row" style={{
                  display: 'flex', alignItems: 'center', gap: 7, fontSize: 12,
                  padding: '6px 10px', borderRadius: 'var(--r-sm)',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  border: '1px solid rgba(37,99,235,0.18)',
                }}>
                  <Icon size={12} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>
                    {a.kind === 'fly' ? 'Flew to' : a.kind === 'country' ? 'Opened' : a.kind === 'layer' ? 'Toggled layer' : 'Toggled overlay'}
                  </span>
                  <span style={{ color: 'var(--text1)' }}>{a.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {(response || streaming) && (
          <div style={{ padding: '2px 0' }}>
            {renderText(response)}
            {streaming && <span className="ai-cursor" />}
            {!streaming && response && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1, 2, 3, 4].map(i => (
                    <span key={i} style={{
                      width: 4, height: i * 2 + 3, borderRadius: 1, alignSelf: 'flex-end',
                      background: i <= confidence.bars ? 'var(--accent)' : 'var(--border-strong)',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{confidence.label}</span>
              </div>
            )}
          </div>
        )}

        {/* Auto-suggested follow-ups — derived from the response, one tap to continue */}
        {!streaming && followUps.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {followUps.map(fu => (
              <button
                key={fu}
                onClick={() => ask(fu)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--surface)', border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--r-pill)', color: 'var(--text2)', fontSize: 12,
                  padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .12s',
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--accent)'; el.style.color = 'var(--accent)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border-strong)'; el.style.color = 'var(--text2)' }}
              >
                <Sparkles size={11} /> {fu}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 8 }}>
            ⚠ {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Context pill */}
      <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 11, alignItems: 'center' }}>
          <span style={{ color: 'var(--red)' }}>⬤</span> {crises.length} CRISES
          <span style={{ color: 'var(--accent)' }}>⬤</span> {flights.length.toLocaleString()} FLIGHTS
          <span className="ai-pulse-dot" /> LIVE
        </div>
        {history.length > 0 && (
          <button
            onClick={startNewSession}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)' }}
          >↺ CLEAR</button>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about current events, threats, markets…"
          rows={3}
          style={{
            flex: 1, background: 'var(--surface)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-md)',
            color: 'var(--text1)', fontSize: 13.5, fontFamily: 'inherit',
            padding: '9px 12px', resize: 'none', outline: 'none', lineHeight: 1.5,
            transition: 'border-color .12s',
          }}
          onFocus={e  => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--accent)' }}
          onBlur={e   => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border-strong)' }}
        />
        {streaming ? (
          <button onClick={stop} style={{ background: 'var(--red-soft)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 'var(--r-md)', color: 'var(--red)', cursor: 'pointer', padding: '9px 11px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={() => { ask(input); setInput('') }}
            disabled={!input.trim()}
            style={{ background: input.trim() ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${input.trim() ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', color: input.trim() ? '#ffffff' : 'var(--text3)', cursor: input.trim() ? 'pointer' : 'default', padding: '9px 11px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
          >
            <Send size={14} />
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

export function HumanitarianPanel({ crises, flights, onGeoSearch }: { crises: CrisisEvent[]; flights: Flight[]; onGeoSearch?: (q: string) => void }) {
  const [tab, setTab]         = useState<HumTab>('OVERVIEW')
  const [stats, setStats]     = useState<UNHCRStat[]>(TOP_HOSTING)
  const [showOrigin, setShowOrigin] = useState(false)
  const [officeFilter, setOfficeFilter] = useState('')
  const [crossFilter, setCrossFilter]   = useState<'all'|'open'|'restricted'|'closed'>('all')
  const [campSearch, setCampSearch]     = useState('')

  useEffect(() => {
    const load = () => { fetchUNHCRPopulation().then(data => { if (data.length) setStats(data) }) }
    load()
    const t = window.setInterval(load, 30 * 60_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(t); unsub() }
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: 11.5 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {HUM_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '4px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            background: tab === t ? 'var(--accent-soft)' : 'transparent',
            border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', transition: 'all .12s',
          }}>{t}</button>
        ))}
      </div>

      {/* ─ OVERVIEW ─ */}
      {tab === 'OVERVIEW' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {/* Global summary */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.15em', marginBottom: 5 }}>// GLOBAL DISPLACEMENT · {g.year}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
              {[
                { label: 'FORCIBLY DISPLACED', value: g.total_forcibly_displaced, color: 'var(--red)' },
                { label: 'REFUGEES (UNHCR)',   value: g.refugees_unhcr,           color: 'var(--amber)' },
                { label: 'INT. DISPLACED',     value: g.idps,                     color: 'var(--amber)' },
                { label: 'ASYLUM SEEKERS',     value: g.asylum_seekers,           color: 'var(--accent)' },
                { label: 'STATELESS',          value: g.stateless,                color: '#aa44ff' },
                { label: 'RETURNEES',          value: g.returnees,                color: 'var(--accent)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--surface2)', padding: '5px 7px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>{fmt(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Toggle hosting / origin */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button onClick={() => setShowOrigin(false)} style={{
              flex: 1, padding: '3px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              border: `1px solid ${!showOrigin ? 'var(--accent)55' : 'var(--border)'}`,
              background: !showOrigin ? 'var(--accent-soft)' : 'transparent',
              color: !showOrigin ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer',
            }}>TOP HOSTING</button>
            <button onClick={() => setShowOrigin(true)} style={{
              flex: 1, padding: '3px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              border: `1px solid ${showOrigin ? 'var(--amber)55' : 'var(--border)'}`,
              background: showOrigin ? 'var(--amber-soft)' : 'transparent',
              color: showOrigin ? 'var(--amber)' : 'var(--text3)', cursor: 'pointer',
            }}>TOP ORIGINS</button>
          </div>

          {/* Country ranking */}
          <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 4 }}>
            {!showOrigin ? '// COUNTRIES HOSTING MOST DISPLACED (2023)' : '// TOP COUNTRIES OF ORIGIN (2023)'}
          </div>
          {(!showOrigin ? (stats.length ? stats : TOP_HOSTING) : TOP_ORIGINS).map((s, i) => {
            const pct = (s.total / (showOrigin ? 16_000_000 : maxHosting)) * 100
            const color = showOrigin ? 'var(--amber)' : 'var(--accent)'
            return (
              <div key={s.iso3 + i} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, color: 'var(--text3)', width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.country}</span>
                  <span style={{ fontSize: 10.5, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(s.total)}</span>
                </div>
                <div style={{ marginLeft: 19, height: 2, background: 'var(--border)', borderRadius: 1 }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, opacity: 0.55, borderRadius: 1, transition: 'width .5s' }} />
                </div>
                {s.refugees > 0 && s.idps > 0 && (
                  <div style={{ marginLeft: 19, marginTop: 1, display: 'flex', gap: 6 }}>
                    {s.refugees > 0     && <span style={{ fontSize: 9, color: 'var(--amber)' }}>REF {fmt(s.refugees)}</span>}
                    {s.idps > 0         && <span style={{ fontSize: 9, color: 'var(--amber)' }}>IDP {fmt(s.idps)}</span>}
                    {s.asylum_seekers > 0 && <span style={{ fontSize: 9, color: 'var(--accent)' }}>ASY {fmt(s.asylum_seekers)}</span>}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.05em', lineHeight: 1.7 }}>
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
            <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 6 }}>
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
              const sevColor = severity === 'critical' ? 'var(--red)' : severity === 'high' ? 'var(--amber)' : severity === 'medium' ? 'var(--amber)' : 'var(--text2)'

              return (
                <div key={origin} style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--surface2)', border: `1px solid ${sevColor}22` }}>
                  {/* Origin header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text1)', flex: 1 }}>{origin.toUpperCase()}</span>
                    <span style={{ fontSize: 9.5, color: sevColor, fontWeight: 700, letterSpacing: '.08em' }}>{severity.toUpperCase()}</span>
                  </div>

                  {/* Displacement total */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4, marginLeft: 13 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>DISPLACED: <b>{fmt(totalDisplaced)}</b></span>
                    {disp && disp.origin > 0 && <span style={{ fontSize: 9.5, color: 'var(--text2)' }}>UNHCR ORIGIN: {fmt(disp.origin)}</span>}
                  </div>

                  {/* Active crises linked */}
                  {linked.length > 0 && (
                    <div style={{ marginLeft: 13, marginBottom: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--red)', letterSpacing: '.1em', marginBottom: 2 }}>ACTIVE CRISES ({linked.length})</div>
                      {linked.slice(0, 4).map((c, i) => (
                        <div key={c.id + i}
                          onClick={() => onGeoSearch?.(`${c.latitude},${c.longitude}`)}
                          style={{ fontSize: 10, color: 'var(--text1)', marginBottom: 1, cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', gap: 4, alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--text1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--text1)' }}
                        >
                          <span style={{ fontSize: 8.5, color: c.severity === 'critical' ? 'var(--red)' : c.severity === 'high' ? 'var(--amber)' : 'var(--amber)', fontWeight: 700 }}>
                            {c.type.toUpperCase().slice(0, 3)}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                          {c.fatalities ? <span style={{ fontSize: 9, color: 'var(--red)', flexShrink: 0 }}>†{c.fatalities}</span> : null}
                        </div>
                      ))}
                      {linked.length > 4 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{linked.length - 4} more</div>}
                    </div>
                  )}
                  {linked.length === 0 && (
                    <div style={{ marginLeft: 13, fontSize: 9.5, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 4 }}>No live crisis events detected</div>
                  )}

                  {/* Flow corridors */}
                  <div style={{ marginLeft: 13 }}>
                    <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '.1em', marginBottom: 2 }}>CORRIDORS ({flows.length})</div>
                    {flows.map(f => {
                      const dest = f.label.split(' → ')[1]
                      const camps = getCamps(dest)
                      const nearbyFlights = camps.length > 0 ? countFlightsNear(camps[0].lat, camps[0].lng) : 0
                      return (
                        <div key={f.label}
                          onClick={() => onGeoSearch?.(`${f.dest[1]},${f.dest[0]}`)}
                          style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2, cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', gap: 4, alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--text1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--text2)' }}
                        >
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>→</span>
                          <span style={{ flex: 1 }}>{dest}</span>
                          <span style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
                          {camps.length > 0 && <span style={{ fontSize: 8.5, color: 'var(--accent)' }}>{camps.length} sites</span>}
                          {nearbyFlights > 0 && <span style={{ fontSize: 8.5, color: '#aa44ff' }}>✈{nearbyFlights}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text3)', letterSpacing: '.05em', lineHeight: 1.7 }}>
              CORRELATION: UNHCR GLOBAL TRENDS × ACLED LIVE EVENTS × OPENSKY<br />
              NEXUS UPDATES IN REAL-TIME WITH INCOMING DATA
            </div>
          </div>
        )
      })()}

      {/* ─ FLOWS: refugee corridor listing ─ */}
      {tab === 'FLOWS' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 6 }}>
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
              const color = t > 0.6 ? 'var(--red)' : t > 0.3 ? 'var(--amber)' : 'var(--accent)'

              return (
                <div key={f.label}
                  onClick={() => onGeoSearch?.(`${f.origin[1]},${f.origin[0]}`)}
                  style={{ marginBottom: 5, cursor: onGeoSearch ? 'pointer' : 'default' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 9.5, color: 'var(--text3)', width: 16, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text1)', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {origin} <span style={{ color: 'var(--text2)' }}>→</span> {dest}
                    </span>
                    <span style={{ fontSize: 10.5, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(f.count)}</span>
                    {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, animation: 'blink 1s step-end infinite' }} title={`${linked.length} active crises in ${origin}`} />}
                  </div>
                  <div style={{ marginLeft: 21, height: 2, background: 'var(--border)', borderRadius: 1, marginBottom: 2 }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, opacity: 0.55, borderRadius: 1, transition: 'width .5s' }} />
                  </div>
                  {isActive && (
                    <div style={{ marginLeft: 21, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {linked.slice(0, 3).map((c, j) => (
                        <span key={j} style={{
                          fontSize: 8.5, padding: '1px 4px', borderRadius: 2,
                          background: c.severity === 'critical' ? 'var(--red-soft)' : 'var(--amber-soft)',
                          color: c.severity === 'critical' ? 'var(--red)' : 'var(--amber)',
                          border: `1px solid ${c.severity === 'critical' ? 'var(--red)22' : 'var(--amber)22'}`,
                        }}>
                          {c.type.toUpperCase().slice(0, 3)} · {c.title.slice(0, 30)}{c.title.length > 30 ? '…' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text3)', letterSpacing: '.05em', lineHeight: 1.7 }}>
            SOURCE: UNHCR GLOBAL TRENDS 2023 · CRISIS TAGS FROM ACLED LIVE
          </div>
        </div>
      )}

      {/* ─ OFFICES ─ */}
      {tab === 'OFFICES' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              placeholder="Filter by country or city…"
              value={officeFilter}
              onChange={e => setOfficeFilter(e.target.value)}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text1)', fontSize: 10.5, padding: '3px 6px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOffices.map(o => (
              <div
                key={o.id}
                onClick={() => onGeoSearch?.(`${o.lat},${o.lng}`)}
                style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                title={onGeoSearch ? `Fly to ${o.name}` : undefined}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: OFFICE_TYPE_COLORS[o.type], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 1 }}>{o.city} · {o.country}</div>
                </div>
                <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>
                  {o.type === 'hq' ? 'HQ' : o.type === 'regional' ? 'REG' : o.type === 'liaison' ? 'LNK' : 'CO'}
                </span>
              </div>
            ))}
            {filteredOffices.length === 0 && (
              <div style={{ padding: 10, fontSize: 10.5, color: 'var(--text3)', textAlign: 'center' }}>No offices match filter</div>
            )}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredOffices.length} OFFICES · UNHCR PRESENCE MAP
          </div>
        </div>
      )}

      {/* ─ CROSSINGS ─ */}
      {tab === 'CROSSINGS' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Status filter */}
          <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexShrink: 0 }}>
            {(['all', 'open', 'restricted', 'closed'] as const).map(s => (
              <button key={s} onClick={() => setCrossFilter(s)} style={{
                flex: 1, padding: '2px 3px', fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em',
                border: `1px solid ${crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? 'var(--accent)') + '55' : 'var(--border)'}`,
                background: crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? 'var(--accent-soft)') + '14' : 'transparent',
                color: crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? 'var(--accent)') : 'var(--text3)',
                cursor: 'pointer', textTransform: 'uppercase',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredCrossings.map(c => (
              <div
                key={c.id}
                onClick={() => onGeoSearch?.(`${c.lat},${c.lng}`)}
                style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                title={onGeoSearch ? `Fly to ${c.name}` : undefined}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: CROSSING_STATUS_COLORS[c.status], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 1 }}>{c.country1} ↔ {c.country2}</div>
                </div>
                <span style={{ fontSize: 9.5, color: CROSSING_STATUS_COLORS[c.status], fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>{c.status}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredCrossings.length} CROSSINGS · UNHCR BORDER MONITORING
          </div>
        </div>
      )}

      {/* ─ CAMPS ─ */}
      {tab === 'CAMPS' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              placeholder="Search camps or countries…"
              value={campSearch}
              onChange={e => setCampSearch(e.target.value)}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text1)', fontSize: 10.5, padding: '3px 6px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredCamps.map((c, i) => {
              const maxPop = REFUGEE_CAMPS[0].population
              const pct = (c.population / maxPop) * 100
              const color = c.type === 'camp' ? 'var(--accent)' : c.type === 'settlement' ? 'var(--accent)' : c.type === 'poc_site' ? 'var(--amber)' : c.type === 'transit' ? 'var(--amber)' : '#8844ff'
              return (
                <div
                  key={c.id}
                  onClick={() => onGeoSearch?.(`${c.lat},${c.lng}`)}
                  style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', cursor: onGeoSearch ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                  title={onGeoSearch ? `Fly to ${c.name}` : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 9.5, color: 'var(--text3)', width: 16, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 10.5, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(c.population)}</span>
                  </div>
                  <div style={{ marginLeft: 27, height: 2, background: 'var(--border)', borderRadius: 1, marginBottom: 2 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, opacity: 0.5, borderRadius: 1 }} />
                  </div>
                  <div style={{ marginLeft: 27, display: 'flex', gap: 5 }}>
                    <span style={{ fontSize: 9, color: 'var(--text2)' }}>{c.country}</span>
                    <span style={{ fontSize: 9, color: color, opacity: 0.7, textTransform: 'uppercase' }}>{c.type.replace('_', ' ')}</span>
                    {c.notes && <span style={{ fontSize: 9, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredCamps.length} SITES · UNHCR POPULATION REFERENCE POINTS
          </div>
        </div>
      )}
    </div>
  )
}
