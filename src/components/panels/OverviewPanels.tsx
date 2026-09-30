/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CrisisEvent, PanelState, Flight } from '../../types'
import { computeThreatScore } from '../../utils/threat'
import { useHistory } from '../../hooks/useHistory'
import { countrySeries, threatSeries } from '../../services/history'
import Sparkline from '../Sparkline'
import { computeCountryRisk, riskColor } from '../../utils/risk'

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
const LAYERS_CONFIG: { id: keyof PanelState; label: string; color: string; tag: string }[] = [
  { id: 'flights',   label: 'AIR TRAFFIC',          color: 'var(--accent)', tag: 'AIR' },
  { id: 'crises',    label: 'CONFLICT ZONES',       color: 'var(--red)', tag: 'GEO' },
  { id: 'wildfires', label: 'WILDFIRES',             color: 'var(--amber)', tag: 'FIRE' },
  { id: 'military',  label: 'MILITARY INSTALLATIONS',color: 'var(--green)', tag: 'MIL' },
  { id: 'nuclear',   label: 'NUCLEAR SITES',         color: 'var(--amber)', tag: 'NUC' },
  { id: 'sanctions', label: 'SANCTIONED STATES',     color: 'var(--red)', tag: 'SAN' },
  { id: 'news',      label: 'MEDIA SIGNALS',         color: 'var(--series-5)', tag: 'SIG' },
  { id: 'stocks',    label: 'FINANCIAL CENTRES',     color: 'var(--accent)', tag: 'FIN' },
  { id: 'cameras',        label: 'LIVE CAMERAS',          color: 'var(--accent)', tag: 'CAM' },
  { id: 'infrastructure', label: 'CRITICAL INFRASTRUCTURE',color: 'var(--amber)', tag: 'CI' },
  { id: 'airspace',       label: 'AIRSPACE RESTRICTIONS', color: 'var(--red)', tag: 'FIR' },
  { id: 'humanitarian',  label: 'HUMANITARIAN OPS',      color: 'var(--accent)', tag: 'HUM' },
  { id: 'vessels',       label: 'MARITIME TRAFFIC',       color: 'var(--green)', tag: 'AIS' },
  { id: 'oil',            label: 'OIL RESERVES',            color: 'var(--amber)', tag: 'OIL' },
  { id: 'gas',            label: 'GAS RESERVES',            color: 'var(--accent)', tag: 'GAS' },
  { id: 'ports',          label: 'GLOBAL PORTS',             color: 'var(--accent)', tag: 'PRT' },
  { id: 'pipelines',     label: 'GAS PIPELINES',            color: 'var(--series-3)', tag: 'GAS' },
  { id: 'chokepoints',   label: 'CHOKEPOINTS',              color: 'var(--red)', tag: 'TRD' },
  { id: 'supplychain',   label: 'SUPPLY CHAIN',             color: 'var(--accent)', tag: 'TRD' },
  { id: 'gpsjam',        label: 'GPS INTERFERENCE',        color: 'var(--red)', tag: 'GPS' },
  { id: 'outages',       label: 'NETWORK OUTAGES',          color: 'var(--red)', tag: 'NET' },
  { id: 'resources',     label: 'CRITICAL MINERALS',        color: 'var(--amber)', tag: 'RES' },
  { id: 'tradeStats',    label: 'TRADE FLOWS',              color: 'var(--accent)', tag: 'TRD' },
  { id: 'militaryPersonnel', label: 'FORCE SIZE',           color: 'var(--red)', tag: 'MIL' },
]

export const SEV_COLORS: Record<string, string> = {
  critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--amber)', low: 'var(--text3)',
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
  const snaps = useHistory()
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
              <Sparkline points={countrySeries(snaps, r.country)} color={color} label={`${r.country} risk score history`} />
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
  const series = threatSeries(useHistory())
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
        {series.length >= 2 ? (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Sparkline points={series} width={120} height={28} color={color} label="Threat index history" />
            <div style={{ fontSize: '9.5px', color: 'var(--text3)' }}>
              since {formatDistanceToNow(new Date(series[0].t), { addSuffix: true })}
              {' · '}{series[series.length - 1].v - series[0].v >= 0 ? '+' : ''}{series[series.length - 1].v - series[0].v}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: 4 }}>Collecting history…</div>
        )}
      </div>
    </div>
  )
}
