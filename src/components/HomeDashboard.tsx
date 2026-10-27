import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowRight, BarChart3, BookOpen, Globe2, Leaf, Map, Table, Users, Wind } from 'lucide-react'
import { fetchGlobalTrend, type GlobalTrendPoint } from '../services/globalTrends'

interface Props {
  map: ReactNode
  onOpenPanel: (id: string) => void
  onOpenMap: () => void
  onOpenLibrary: () => void
  onColorCountries: (indicatorId: string) => void
  projectionMode: 'globe' | 'mercator'
  onProjectionMode: (mode: 'globe' | 'mercator') => void
}

const TOPICS = [
  { title: 'Global Economy', subtitle: 'GDP · trade · inflation', icon: BarChart3, tone: 'cyan', panel: 'economy' },
  { title: 'Climate & Energy', subtitle: 'Emissions · renewables', icon: Wind, tone: 'green', panel: 'owid' },
  { title: 'Health & Society', subtitle: 'Life expectancy · healthcare', icon: Users, tone: 'violet', panel: 'countryAnalytics' },
  { title: 'Education', subtitle: 'Enrollment · literacy', icon: BookOpen, tone: 'orange', panel: 'countryLookup' },
]

const INDICATORS = [
  { label: 'GDP per capita', id: 'NY.GDP.PCAP.CD' },
  { label: 'Life expectancy', id: 'SP.DYN.LE00.IN' },
  { label: 'CO₂ emissions', id: 'EN.GHG.CO2.MT.CE.AR5' },
  { label: 'Renewable energy', id: 'EG.FEC.RNEW.ZS' },
]

const GLOBAL_TRENDS = [
  { id: 'gdp', indicator: 'NY.GDP.MKTP.KD.ZG', label: 'Global GDP Growth', unit: 'percent', panel: 'predictions', color: '#28c9f3', panelCard: true },
  { id: 'co2', indicator: 'EN.GHG.CO2.MT.CE.AR5', label: 'CO₂ Emissions', unit: 'gigatonnes', panel: 'owid', color: '#42d8a5', panelCard: true },
  { id: 'renewables', indicator: 'EG.FEC.RNEW.ZS', label: 'Renewable Energy', unit: 'percent', panel: 'owid', color: '#ff982f', panelCard: true },
  { id: 'life', indicator: 'SP.DYN.LE00.IN', label: 'Life Expectancy', unit: 'years', panel: 'countryAnalytics', color: '#a680ff', panelCard: true },
  { id: 'worldgdp', indicator: 'NY.GDP.MKTP.CD', label: 'Global GDP', unit: 'trillions', panel: 'economy', color: '#28c9f3', panelCard: false },
  { id: 'population', indicator: 'SP.POP.TOTL', label: 'Population', unit: 'billions', panel: 'economy', color: '#42d8a5', panelCard: false },
] as const

type TrendId = typeof GLOBAL_TRENDS[number]['id']
type TrendState = Partial<Record<TrendId, GlobalTrendPoint[]>>

export default function HomeDashboard({ map, onOpenPanel, onOpenMap, onOpenLibrary, onColorCountries, projectionMode, onProjectionMode }: Props) {
  const [selectedIndicator, setSelectedIndicator] = useState(INDICATORS[0].id)
  const [globalTrend, setGlobalTrend] = useState<TrendState>({})

  useEffect(() => { onColorCountries(INDICATORS[0].id) }, [onColorCountries])
  useEffect(() => {
    let mounted = true
    void Promise.all(GLOBAL_TRENDS.map(async trend => {
      try {
        const points = await fetchGlobalTrend(trend.indicator)
        if (mounted) setGlobalTrend(prev => ({ ...prev, [trend.id]: points }))
      } catch {
        if (mounted) setGlobalTrend(prev => ({ ...prev, [trend.id]: [] }))
      }
    }))
    return () => { mounted = false }
  }, [])

  return (
    <main className="home-scroll">
      <div className="home-content">
        <section className="home-hero">
          <div className="hero-copy">
            <div className="home-eyebrow"><span className="new-live-dot" /> GLOBAL DATA, CONNECTED</div>
            <h1>Global data.<br /><em>Real insights.</em></h1>
            <p>Explore countries, compare indicators, and uncover the stories behind the numbers.</p>
            <button className="home-primary-cta" onClick={() => onOpenPanel('economy')}>Start exploring <ArrowRight size={16} /></button>
          </div>
          <aside className="live-indicator-card" aria-label="Latest global indicators">
            <div className="live-card-heading"><strong>Global indicators</strong><span><i />Annual data</span></div>
            {(['worldgdp', 'population', 'co2', 'renewables', 'life'] as const).map(id => {
              const trend = GLOBAL_TRENDS.find(item => item.id === id)!
              return <GlobalIndicatorRow key={id} trend={trend} points={globalTrend[id]} onClick={() => onOpenPanel(trend.panel)} />
            })}
            <button className="live-card-link" onClick={() => onOpenPanel('economy')}>Browse indicators <ArrowRight size={13} /></button>
          </aside>
        </section>

        <section className="home-section topics-section">
          <div className="home-section-heading"><div><h2>Featured Topics</h2></div><button className="text-link" onClick={onOpenLibrary}>View all <ArrowRight size={14} /></button></div>
          <div className="topic-grid">
            {TOPICS.map(({ title, subtitle, icon: Icon, tone, panel }) => (
              <button className={`topic-card topic-${tone}`} key={title} onClick={() => onOpenPanel(panel)}>
                <div className="topic-art"><Icon size={24} strokeWidth={1.6} /></div>
                <div className="topic-card-copy"><strong>{title}</strong><span>{subtitle}</span></div>
                <ArrowRight className="topic-arrow" size={15} />
              </button>
            ))}
          </div>
        </section>

        <section className="home-section world-section">
          <div className="home-section-heading map-heading"><div><span className="section-kicker">COUNTRY INDICATORS</span><h2>Explore the world</h2><p>Compare country data on the map. Select an indicator to change the view.</p></div><div className="map-heading-actions"><span className="map-period">Latest reported</span><button className="text-link" onClick={onOpenMap}>Full map <ArrowRight size={14} /></button></div></div>
          <div className="indicator-tabs" role="group" aria-label="Map indicator">
            {INDICATORS.map(indicator => <button key={indicator.id} className={selectedIndicator === indicator.id ? 'selected' : ''} onClick={() => { setSelectedIndicator(indicator.id); onColorCountries(indicator.id) }}>{indicator.label}</button>)}
          </div>
          <div className="home-map-frame">
            {map}
            <div className="map-display-tools" role="group" aria-label="Map display mode">
              <button className={projectionMode === 'mercator' ? 'active' : ''} onClick={() => onProjectionMode('mercator')}><Map size={12} />Map</button>
              <button className={projectionMode === 'globe' ? 'active' : ''} onClick={() => onProjectionMode('globe')}><Globe2 size={12} />Globe</button>
              <button onClick={() => onOpenPanel('economy')}><Table size={12} />Table</button>
              <button onClick={() => onOpenPanel('countryAnalytics')}><BarChart3 size={12} />Chart</button>
            </div>
            <div className="map-frame-caption">World Bank · latest available year varies by country</div>
          </div>
        </section>

        <section className="home-section trend-section">
          <div className="home-section-heading"><div><h2>Key Global Trends</h2></div><button className="text-link" onClick={() => onOpenPanel('predictions')}>Forecasts & analysis <ArrowRight size={14} /></button></div>
          <div className="trend-grid">
            {GLOBAL_TRENDS.filter(trend => trend.panelCard).map(trend => <GlobalTrendCard key={trend.id} trend={trend} points={globalTrend[trend.id]} onClick={() => onOpenPanel(trend.panel)} />)}
          </div>
          <div className="home-footnote">World Bank World aggregate · annual observations · each card shows its latest reported year. Country-level maps use each country’s latest available year.</div>
        </section>
      </div>
    </main>
  )
}

function GlobalTrendCard({ trend, points = [], onClick }: {
  trend: typeof GLOBAL_TRENDS[number]
  points?: GlobalTrendPoint[]
  onClick: () => void
}) {
  const last = points[points.length - 1]
  const recent = points.slice(-14)
  const min = Math.min(...recent.map(point => point.value))
  const max = Math.max(...recent.map(point => point.value))
  const path = recent.map((point, index) => {
    const x = recent.length <= 1 ? 0 : index / (recent.length - 1) * 100
    const y = max === min ? 16 : 30 - (point.value - min) / (max - min) * 25
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const value = last ? formatGlobalValue(trend.unit, last.value) : '—'
  return (
    <button className="signal-card" onClick={onClick} style={{ '--trend-color': trend.color } as CSSProperties} title={last ? `${trend.label}: ${value} in ${last.year}. World Bank World aggregate.` : `${trend.label}: World Bank series unavailable`}>
      <span className="signal-label"><span className="signal-dot" />{trend.label}</span>
      <strong>{value}</strong>
      <span className="signal-detail">{last ? `in ${last.year} · World Bank` : 'Loading World Bank data'}</span>
      {path && <svg className="signal-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-label={`${trend.label} annual trend, ${recent[0]?.year} to ${last?.year}`}><path d={path} /></svg>}
    </button>
  )
}

function GlobalIndicatorRow({ trend, points = [], onClick }: {
  trend: typeof GLOBAL_TRENDS[number]
  points?: GlobalTrendPoint[]
  onClick: () => void
}) {
  const last = points[points.length - 1]
  const previous = points[points.length - 2]
  const delta = last && previous ? formatGlobalDelta(trend.unit, last.value, previous.value) : null
  const Icon = trend.id === 'worldgdp' ? BarChart3 : trend.id === 'population' || trend.id === 'life' ? Users : trend.id === 'renewables' ? Wind : Leaf
  return (
    <button className="live-indicator-row" onClick={onClick} title={last ? `${trend.label}: ${formatGlobalValue(trend.unit, last.value)} in ${last.year}, World Bank World aggregate` : `${trend.label}: loading World Bank data`}>
      <span className="live-indicator-name"><span className="live-indicator-icon" style={{ '--trend-color': trend.color } as CSSProperties}><Icon size={12} /></span>{trend.label}</span>
      <b>{last ? formatGlobalValue(trend.unit, last.value) : '—'}</b>
      <em>{last ? `${last.year}${delta ? ` · ${delta}` : ''}` : 'Loading'}</em>
    </button>
  )
}

function formatGlobalValue(unit: typeof GLOBAL_TRENDS[number]['unit'], value: number) {
  if (unit === 'gigatonnes') return `${(value / 1_000).toFixed(1)} Gt` // series is in Mt CO₂e
  if (unit === 'percent') return `${value.toFixed(1)}%`
  if (unit === 'trillions') return `$${(value / 1_000_000_000_000).toFixed(1)}T`
  if (unit === 'billions') return `${(value / 1_000_000_000).toFixed(2)}B`
  return `${value.toFixed(1)} yrs`
}

function formatGlobalDelta(unit: typeof GLOBAL_TRENDS[number]['unit'], current: number, previous: number) {
  if (unit === 'percent') return `${current - previous >= 0 ? '+' : ''}${(current - previous).toFixed(1)} pp`
  if (unit === 'years') return `${current - previous >= 0 ? '+' : ''}${(current - previous).toFixed(1)} yr`
  if (unit === 'gigatonnes') return `${current - previous >= 0 ? '+' : ''}${(((current - previous) / 1_000)).toFixed(1)} Gt`
  const pct = (current - previous) / Math.abs(previous) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

