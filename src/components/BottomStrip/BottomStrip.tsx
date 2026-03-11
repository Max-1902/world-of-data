import { TrendingUp, TrendingDown, Plus, X, Clock } from 'lucide-react'
import type { CrisisEvent, Stock, Flight } from '../../types'
import { MARKET_HUBS } from '../../services/stocks'
import { useState } from 'react'

function computeCountryRisk(crises: CrisisEvent[]): { country: string; score: number; events: number }[] {
  const map: Record<string, { events: number; score: number }> = {}
  for (const c of crises) {
    if (!c.country) continue
    if (!map[c.country]) map[c.country] = { events: 0, score: 0 }
    map[c.country].events++
    const sev = { critical: 10, high: 6, medium: 3, low: 1 }
    map[c.country].score += sev[c.severity] ?? 1
  }
  return Object.entries(map)
    .map(([country, v]) => ({ country, ...v }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
}

function riskColor(score: number) {
  if (score >= 40) return '#ff1a3e'
  if (score >= 20) return '#ff6600'
  if (score >= 10) return '#ffaa00'
  return '#00c8ff'
}

function computeThreatScore(crises: CrisisEvent[], flights: Flight[]): number {
  const base = crises.reduce((acc, c) => {
    const w = { critical: 8, high: 4, medium: 2, low: 1 }
    return acc + (w[c.severity] ?? 1)
  }, 0)
  return Math.min(100, Math.round((base / 8) + (flights.length > 5000 ? 5 : 0)))
}

interface Props {
  crises: CrisisEvent[]
  flights: Flight[]
  stocks: Stock[]
  stocksLoading: boolean
  stocksUpdated: Date | null
  onAddStock: (s: string) => void
  onRemoveStock: (s: string) => void
}

export default function BottomStrip({ crises, flights, stocks, stocksLoading, stocksUpdated, onAddStock, onRemoveStock }: Props) {
  const countryRisks = computeCountryRisk(crises)
  const threatScore  = computeThreatScore(crises, flights)
  const [addInput, setAddInput] = useState('')

  const customStocks = stocks.filter((s) => !MARKET_HUBS.some((h) => h.symbol === s.symbol))
  const hubStocks    = stocks.filter((s) =>  MARKET_HUBS.some((h) => h.symbol === s.symbol))

  const threatLabel =
    threatScore >= 80 ? 'CRITICAL' :
    threatScore >= 60 ? 'ELEVATED' :
    threatScore >= 40 ? 'HIGH'     :
    threatScore >= 20 ? 'MODERATE' : 'NORMAL'

  const threatColor =
    threatScore >= 80 ? '#ff1a3e' :
    threatScore >= 60 ? '#ff4400' :
    threatScore >= 40 ? '#ffaa00' :
    threatScore >= 20 ? '#ffcc00' : '#00c8ff'

  /* SVG gauge — 8-tick marks + arc */
  const R = 31, CX = 40, CY = 40
  const arc = (2 * Math.PI * R) * (threatScore / 100)
  const total = 2 * Math.PI * R

  return (
    <div
      className="area-bottom"
      style={{ display: 'flex', overflow: 'hidden', borderTop: '1px solid #0a1520', background: 'rgba(2,4,10,0.99)' }}
    >

      {/* ── Country Risk ─────────────────────────────────────── */}
      <CyPanel title="Country Risk Index" dot="red" flex="0 0 210px">
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
          {countryRisks.length === 0 && (
            <div style={{ fontSize: '9px', color: '#1a2535', textAlign: 'center', padding: '12px 0', letterSpacing: '0.1em' }}>
              // LOADING…
            </div>
          )}
          {countryRisks.map((r) => (
            <div key={r.country} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
              {/* score tag */}
              <span style={{
                fontSize: '8px', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                color: riskColor(r.score), minWidth: '22px', textAlign: 'right',
              }}>{r.score}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '9px', color: '#8aaccc', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.country}
                </div>
                <div className="risk-bar">
                  <div className="risk-fill" style={{ width: `${Math.min(100, r.score)}%`, background: riskColor(r.score), opacity: 0.6 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CyPanel>

      {/* ── Threat Gauge ─────────────────────────────────────── */}
      <CyPanel title="Global Threat Index" dot="orange" flex="0 0 148px">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}>

          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              {/* tick marks */}
              {Array.from({ length: 10 }).map((_, i) => {
                const a = (i / 10) * 2 * Math.PI - Math.PI / 2
                const r1 = 36, r2 = 39
                return (
                  <line
                    key={i}
                    x1={CX + r1 * Math.cos(a)} y1={CY + r1 * Math.sin(a)}
                    x2={CX + r2 * Math.cos(a)} y2={CY + r2 * Math.sin(a)}
                    stroke="#0a1520" strokeWidth="1"
                  />
                )
              })}
              {/* track */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#0a1520" strokeWidth="5" />
              {/* arc */}
              <circle
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={threatColor}
                strokeWidth="5"
                strokeDasharray={`${arc} ${total}`}
                strokeLinecap="butt"
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{ filter: `drop-shadow(0 0 4px ${threatColor}88)`, transition: 'all 1s' }}
              />
              {/* inner ring */}
              <circle cx={CX} cy={CY} r={R - 8} fill="none" stroke="#060c18" strokeWidth="1" />
            </svg>

            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: threatColor, lineHeight: 1 }}>{threatScore}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em', color: threatColor }}>{threatLabel}</div>
            <div style={{ fontSize: '8px', color: '#243545', letterSpacing: '0.1em', marginTop: '1px' }}>// TREND STABLE</div>
          </div>
        </div>
      </CyPanel>

      {/* ── Markets Watchlist ─────────────────────────────────── */}
      <CyPanel title="Global Markets" dot="" flex="1 1 0" extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {stocksUpdated && (
            <span style={{ fontSize: '8px', color: '#243545', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={7} />
              {stocksUpdated.toLocaleTimeString()}
            </span>
          )}
          {stocksLoading && <span style={{ fontSize: '8px', color: '#243545', letterSpacing: '0.08em' }}>// UPD</span>}
        </div>
      }>
        {/* Ticker strip */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid #0a1520', height: '20px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
          {stocks.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden' }}>
              <div className="ticker-track">
                {[...stocks, ...stocks].map((s, i) => {
                  const pos = s.changePercent >= 0
                  return (
                    <span key={`${s.symbol}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0 12px', fontSize: '8.5px' }}>
                      <span style={{ color: '#4a6a8a', fontWeight: 700 }}>{s.symbol}</span>
                      <span style={{ color: '#8aaccc', fontVariantNumeric: 'tabular-nums' }}>{s.price.toFixed(2)}</span>
                      <span style={{ color: pos ? '#00ff88' : '#ff1a3e' }}>{pos ? '+' : ''}{s.changePercent.toFixed(2)}%</span>
                      <span style={{ color: '#0a1520' }}>│</span>
                    </span>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '8px', color: '#1a2535', letterSpacing: '0.1em' }}>
              // FINNHUB KEY REQUIRED
            </div>
          )}
        </div>

        {/* Stock grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {[...hubStocks, ...customStocks].map((s) => {
              const pos = s.changePercent >= 0
              const isCustom = !MARKET_HUBS.some((h) => h.symbol === s.symbol)
              return (
                <div
                  key={s.symbol}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '3px 8px', borderBottom: '1px solid #0a1520', borderRight: '1px solid #0a1520',
                    borderLeft: '2px solid transparent', transition: 'all 0.1s', cursor: 'default',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,200,255,0.04)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'rgba(0,200,255,0.18)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#c0d8f0', letterSpacing: '0.04em' }}>{s.symbol}</div>
                    <div style={{ fontSize: '7.5px', color: '#243545', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72px' }}>{s.exchange || s.name}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#8aaccc', fontVariantNumeric: 'tabular-nums' }}>${s.price.toFixed(2)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', fontSize: '8px', color: pos ? '#00ff88' : '#ff1a3e' }}>
                        {pos ? <TrendingUp size={7} /> : <TrendingDown size={7} />}
                        {pos ? '+' : ''}{s.changePercent.toFixed(2)}%
                      </div>
                    </div>
                    {isCustom && (
                      <button
                        onClick={() => onRemoveStock(s.symbol)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a2535', padding: '1px', opacity: 0, transition: 'opacity 0.12s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#ff1a3e' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
                      >
                        <X size={8} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Add stock */}
        <div style={{ flexShrink: 0, borderTop: '1px solid #0a1520', padding: '3px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'rgba(0,0,0,0.35)', border: '1px solid #0a1520', padding: '2px 7px',
            transition: 'border-color 0.12s',
          }}
            onFocusCapture={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,200,255,0.22)' }}
            onBlurCapture={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#0a1520' }}
          >
            <Plus size={8} style={{ color: '#243545', flexShrink: 0 }} />
            <input
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && addInput.trim()) {
                  onAddStock(addInput.trim().toUpperCase())
                  setAddInput('')
                }
              }}
              placeholder="ADD SYMBOL  eg. AAPL · BTC-USD · SPY"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '8.5px', color: '#4a6a8a', fontFamily: 'inherit', letterSpacing: '0.06em',
              }}
            />
          </div>
        </div>
      </CyPanel>

      {/* ── World News Feed ───────────────────────────────────── */}
      <CyPanel title="World Events Feed" dot="blue" flex="0 0 250px">
        <WorldFeed crises={crises} />
      </CyPanel>
    </div>
  )
}

/* ── Panel wrapper ──────────────────────────────────────────── */
function CyPanel({
  title, dot, flex, children, extra,
}: {
  title: string; dot: string; flex: string
  children: React.ReactNode; extra?: React.ReactNode
}) {
  return (
    <div
      className="panel border-r"
      style={{ borderColor: '#0a1520', flex, display: 'flex', flexDirection: 'column' }}
    >
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {dot && <span className={`live-dot ${dot}`} />}
          <span className="panel-title">{title}</span>
        </div>
        {extra}
      </div>
      {children}
    </div>
  )
}

/* ── World events feed ──────────────────────────────────────── */
function WorldFeed({ crises }: { crises: CrisisEvent[] }) {
  const items = [...crises]
    .filter((c) => c.description)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30)

  const SEV: Record<string, string> = { critical: '#ff1a3e', high: '#ff6600', medium: '#ffaa00', low: '#243545' }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {items.map((c) => (
        <div
          key={c.id}
          style={{
            padding: '4px 10px', borderBottom: '1px solid #0a1520',
            borderLeft: `2px solid ${SEV[c.severity] || '#243545'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
            <span style={{ fontSize: '7.5px', color: '#243545', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{c.country}</span>
            <span style={{ fontSize: '7.5px', color: '#1a2535' }}>·</span>
            <span style={{ fontSize: '7.5px', color: '#1a2535' }}>{new Date(c.date).toLocaleDateString()}</span>
            {c.fatalities ? <span style={{ fontSize: '7.5px', color: '#ff1a3e' }}>⚠ {c.fatalities}</span> : null}
          </div>
          <div style={{ fontSize: '9px', color: '#8aaccc', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {c.title}
          </div>
        </div>
      ))}
    </div>
  )
}
