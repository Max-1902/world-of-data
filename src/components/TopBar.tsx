import { useState, useEffect, useSyncExternalStore } from 'react'
import { RefreshCw, Globe2 } from 'lucide-react'
import type { MapViewMode, PanelState, Stock } from '../types'
import SmartSearch from './SmartSearch'
import OSINTSearch from './OSINTSearch'
import SourceHealth from './SourceHealth'
import { healthTracker } from '../services/sourceHealth'
import { marketHudPlaceholder, summarizeMarketHud, summarizeSanctionsHud } from '../utils/marketHud'

const VIEW_MODES: { id: MapViewMode; label: string }[] = [
  { id: 'earth',       label: 'EARTH' },
  { id: 'dark',        label: 'DARK' },
  { id: 'satellite',   label: 'SAT' },
  { id: 'standard',    label: 'STD' },
  { id: 'city3d',      label: '3D' },
  { id: 'nightvision', label: 'NV' },
  { id: 'bw',          label: 'BW' },
  { id: 'infrared',    label: 'IR' },
  { id: 'snow',        label: 'SNOW' },
  { id: 'thermal',     label: 'HEAT' },
]

interface Props {
  viewMode: MapViewMode
  onViewMode: (m: MapViewMode) => void
  /** Global market-hub quotes (10 tracked index ETFs) — may be a subset while still loading. */
  stocks: Stock[]
  searchQuery: string
  onSearch: (q: string) => void
  onOpenPanel: (id: string) => void
  onOpenLibrary?: () => void
  onToggleLayer: (id: keyof PanelState) => void
  onSettingsOpen?: () => void
  onReloadAll?: () => void
  reloading?: boolean
}

export default function TopBar({ viewMode, onViewMode, stocks, searchQuery, onSearch, onOpenPanel, onOpenLibrary, onToggleLayer, onSettingsOpen, onReloadAll, reloading }: Props) {
  const sources = useSyncExternalStore(healthTracker.subscribe, healthTracker.getAll)
  const market = summarizeMarketHud(stocks)
  const sanctions = summarizeSanctionsHud()
  const feedsOk = sources.filter(s => s.status === 'ok').length
  const marketGap = marketHudPlaceholder(sources.find(s => s.id === 'markets'))
  const asOf = market.asOf ? ` · last trade ${new Date(market.asOf).toUTCString().slice(5, 22)} UTC` : ''

  return (
    <div className="topbar" style={{ height: 52 }}>
      {/* left: branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg,#e2bb78,#bd8747)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Globe2 size={15} color="#111820" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.02em', color: 'var(--text1)', lineHeight: 1.1, fontFamily: 'Inter, -apple-system, sans-serif' }}>
            MUNDUS DATORUM
          </div>
        </div>

        <span className="live-badge">LIVE</span>

        <OSINTSearch />
      </div>

      <div className="hud-sep" />

      {/* center: stats — ordered most → least important; each stat sheds with its own breakpoint (see index.css) so the box reflows instead of clipping text */}
      <div className="tb-center">
        <span className="tb-stat tb-stat-hubs" title={market.tracked ? `${market.up} of ${market.tracked} tracked global market-hub ETFs (SPY, QQQ, EWU, EWG, EWJ, EWH, FXI, EWZ, EWA, EWC) up on their last session${asOf}` : marketGap.title}>
          <HudStat label="HUBS UP" value={market.tracked ? `${market.up}/${market.tracked}` : marketGap.value} />
        </span>

        <div className="hud-sep tb-stat-hubs" />

        <span className="tb-stat tb-stat-mover" title={market.topMover ? `Largest move among tracked market hubs: ${market.topMover.symbol} ${market.topMover.changePercent > 0 ? '+' : ''}${market.topMover.changePercent.toFixed(1)}%${asOf}` : marketGap.title}>
          <HudStat
            label="TOP MOVER"
            value={market.topMover ? market.topMover.symbol : marketGap.value}
            sub={market.topMover ? `${market.topMover.changePercent > 0 ? '+' : ''}${market.topMover.changePercent.toFixed(1)}%` : undefined}
            subColor={market.topMover ? (market.topMover.changePercent >= 0 ? 'var(--green)' : 'var(--red)') : undefined}
          />
        </span>

        <div className="hud-sep tb-stat-mover" />

        <span className="tb-stat tb-stat-sanctioned" title="Countries under active economic sanctions (OFAC/EU/UN/UK and other regimes) — curated, sourced dataset">
          <HudStat label="SANCTIONED" value={sanctions.sanctioned} />
        </span>

        <div className="hud-sep tb-stat-sanctioned" />

        <span className="tb-stat tb-stat-critical" title="Countries at the critical/comprehensive sanctions tier (e.g. Iran, North Korea, Russia, Syria)">
          <HudStat label="CRITICAL" value={sanctions.critical} />
        </span>

        <div className="hud-sep tb-stat-critical" />

        <span className="tb-stat tb-stat-feeds" title={`${feedsOk} of ${sources.length} contacted data sources currently healthy this session`}>
          <HudStat label="FEEDS OK" value={sources.length ? `${feedsOk}/${sources.length}` : '—'} />
        </span>

        <div className="hud-sep tb-stat-feeds tb-clock-sep" />

        <UtcClock />
      </div>

      <div className="hud-sep" />

      {/* right: view modes + search */}
      <div className="tb-right">
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--surface2)', borderRadius: 'var(--r-md)', padding: 2 }}>
          {VIEW_MODES.map(({ id, label }) => (
            <button
              key={id}
              title={id}
              onClick={() => onViewMode(id)}
              className={`vm-btn${viewMode === id ? ' active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="hud-sep" />

        <SmartSearch searchQuery={searchQuery} onSearch={onSearch} onOpenPanel={onOpenPanel} onOpenLibrary={onOpenLibrary} onToggleLayer={onToggleLayer} onViewMode={onViewMode} />

        <div className="hud-sep" />

        <button
          onClick={onReloadAll}
          disabled={reloading}
          title="Reload all data"
          className="cy-btn"
          style={{ color: reloading ? 'var(--accent)' : 'var(--text2)' }}
        >
          <RefreshCw size={12} className={reloading ? 'animate-spin' : ''} />
          <span className="tb-btn-label">Reload</span>
        </button>

        <SourceHealth />

        <button
          onClick={onSettingsOpen}
          title="Settings"
          className="cy-btn"
        >
          Settings
        </button>
      </div>
    </div>
  )
}

/** Ticking UTC clock — own component so the per-second render doesn't touch the rest of the bar. */
function UtcClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const [day, mon, year, time] = now.toUTCString().replace(/ GMT$/, '').split(' ').slice(1, 5)
  return (
    <div className="tb-clock">
      <span className="tb-clock-tz">UTC</span>
      <span className="tb-clock-date">{day} {mon} {year}</span>
      <span className="tb-clock-time">{time}</span>
    </div>
  )
}

function HudStat({ label, value, sub, subColor }: { label: string; value: number | string; sub?: string; subColor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter, -apple-system, sans-serif' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {sub && (
          <span style={{ fontSize: 11, fontWeight: 600, color: subColor ?? 'var(--text2)', fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter, -apple-system, sans-serif' }}>
            {sub}
          </span>
        )}
      </span>
      <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '.08em', color: 'var(--text3)', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        {label}
      </span>
    </div>
  )
}
