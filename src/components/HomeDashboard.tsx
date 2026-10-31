import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowRight, BarChart3, BookOpen, Globe2, Map, Table, Users, Wind } from 'lucide-react'
import { fetchGlobalTrend, type GlobalTrendPoint } from '../services/globalTrends'
import { selectForMap } from '../services/countryAnalytics'
import { ForecastHome } from './home/ForecastHome'
import { WorldOutlook } from './home/WorldOutlook'
import OutlookNav from './home/OutlookNav'
import HomeTier from './home/HomeTier'

interface Props {
  map: ReactNode
  onOpenPanel: (id: string) => void
  onOpenMap: () => void
  onOpenCountry: (name: string) => void
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

/** Each card shows the World Bank's world aggregate; a click opens the same indicator country by country (Country Analytics). */
const GLOBAL_TRENDS = [
  { id: 'gdp', indicator: 'NY.GDP.MKTP.KD.ZG', label: 'Global GDP Growth', unit: 'percent', color: '#28c9f3' },
  { id: 'co2', indicator: 'EN.GHG.CO2.MT.CE.AR5', label: 'CO₂ Emissions', unit: 'gigatonnes', color: '#42d8a5' },
  { id: 'renewables', indicator: 'EG.FEC.RNEW.ZS', label: 'Renewable Energy', unit: 'percent', color: '#ff982f' },
  { id: 'life', indicator: 'SP.DYN.LE00.IN', label: 'Life Expectancy', unit: 'years', color: '#a680ff' },
] as const

type TrendId = typeof GLOBAL_TRENDS[number]['id']
type TrendState = Partial<Record<TrendId, GlobalTrendPoint[]>>

export default function HomeDashboard({ map, onOpenPanel, onOpenMap, onOpenCountry, onOpenLibrary, onColorCountries, projectionMode, onProjectionMode }: Props) {
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
        <OutlookNav />
        <WorldOutlook />
        <HomeTier label="One economy" note="This app’s own forecast for a country you pick, with the IMF’s figure beside it." />
        <ForecastHome onOpenPanel={onOpenPanel} onOpenCountry={onOpenCountry} />

        <HomeTier label="Context" note="The wider picture. Not forecast evidence." />
        <section id="outlook-map" className="home-section world-section">
          <div className="home-section-heading map-heading"><div><span className="section-kicker">COUNTRIES ON THE MAP</span><h2>Compare countries</h2><p>Colour the map by an indicator to see where a country sits. The map supports the forecast; it is not the product.</p></div><div className="map-heading-actions"><span className="map-period">Latest reported</span><button className="text-link" onClick={onOpenMap}>Full map <ArrowRight size={14} /></button></div></div>
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

        <section id="outlook-world" className="home-section trend-section">
          <div className="home-section-heading"><div><span className="section-kicker">GLOBAL CONTEXT</span><h2>The world so far</h2></div><button className="text-link" onClick={() => onOpenPanel('predictions')}>Forecasts <ArrowRight size={14} /></button></div>
          <div className="trend-grid">
            {GLOBAL_TRENDS.map(trend => <GlobalTrendCard key={trend.id} trend={trend} points={globalTrend[trend.id]} onClick={() => { selectForMap(trend.indicator); onOpenPanel('countryAnalytics') }} />)}
          </div>
          <div className="home-footnote">World Bank World aggregate · annual observations · each card shows its latest reported year. Country-level maps use each country’s latest available year.</div>
        </section>
        <section id="outlook-browse" className="home-section topics-section">
          <div className="home-section-heading"><div><span className="section-kicker">EXPLORE</span><h2>Browse the data behind the forecast</h2><p>Indicators by theme. Each opens the panel with its sources.</p></div><button className="text-link" onClick={onOpenLibrary}>All datasets <ArrowRight size={14} /></button></div>
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
    <button className="signal-card" onClick={onClick} style={{ '--trend-color': trend.color } as CSSProperties} title={last ? `${trend.label}: ${value} in ${last.year}. World Bank World aggregate. Click to see this indicator for every country.` : `${trend.label}: World Bank series unavailable`}>
      <span className="signal-label"><span className="signal-dot" />{trend.label}</span>
      <strong>{value}</strong>
      <span className="signal-detail">{last ? `in ${last.year} · World Bank · by country →` : 'Loading World Bank data'}</span>
      {path && <svg className="signal-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-label={`${trend.label} annual trend, ${recent[0]?.year} to ${last?.year}`}><path d={path} /></svg>}
    </button>
  )
}

function formatGlobalValue(unit: typeof GLOBAL_TRENDS[number]['unit'], value: number) {
  if (unit === 'gigatonnes') return `${(value / 1_000).toFixed(1)} Gt` // series is in Mt CO₂e
  if (unit === 'percent') return `${value.toFixed(1)}%`
  return `${value.toFixed(1)} yrs`
}
