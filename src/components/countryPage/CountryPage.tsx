import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Map as MapIcon, ArrowRight } from 'lucide-react'
import type { ConflictFeed, CrisisEvent, Flight, NewsArticle } from '../../types'
import type { Earthquake } from '../../services/earthquakes'
import type { FirePoint } from '../../services/wildfires'
import { formatEconValue, groupIndicators, resolveISO2, type EconIndicator } from '../../services/worldbank'
import { useCountryLiveData } from '../countryDrawer/useCountryDrawerData'
import { freshness } from '../../utils/freshness'
import { computeTrajectories } from '../../utils/trajectory'
import { Metric, MetricRow, SectionLabel, StatusLabel } from '../DataLabels'
import PanelSources from '../PanelSources'
import WatchButton from '../WatchButton'
import CloseButton from '../CloseButton'
import CountryBrief from '../CountryBrief'
import type { PanelSource } from '../../panels/types'
import { ForecastsTab, TradeTab } from './tabs'
import { ActivityMore, InfraMore, NewsMore, RiskMore, TradeMore } from './moreData'

const CountryDrawer = lazy(() => import('../CountryDrawer'))
const CountryLookupPanel = lazy(() => import('../panels/CountryLookupPanel').then(m => ({ default: m.CountryLookupPanel })))

export type CountryTab = 'economy' | 'forecasts' | 'trade' | 'risk' | 'infrastructure' | 'activity' | 'news'

const TABS: { id: CountryTab; label: string; sources: PanelSource[] }[] = [
  { id: 'economy', label: 'Economy', sources: ['worldbank', 'ecb', 'eurostat', 'bis'] },
  { id: 'forecasts', label: 'Forecasts', sources: ['worldbank', 'imfweo', 'eurostat'] },
  { id: 'trade', label: 'Trade & exposure', sources: ['worldbank', { name: 'UN Comtrade and World Bank (trade snapshot)', asOf: 'retrieved 2026-10-08' }, { name: 'USGS Mineral Commodity Summaries and BGS', asOf: 'MCS 2025/2026 editions' }, { name: 'CIA World Factbook, energy' }, { name: 'IMF PortWatch (ports)' }] },
  { id: 'risk', label: 'Risk & security', sources: ['acled', 'unhcr', 'rss', { name: 'Sanctions, military and nuclear datasets (curated)', asOf: 'spot-checked 2026-10' }] },
  { id: 'infrastructure', label: 'Infrastructure', sources: ['worldbank', 'wri', 'osm'] },
  { id: 'activity', label: 'Live activity', sources: ['opensky', 'usgs', 'firms', 'gdacs', 'ioda', 'radar'] },
  { id: 'news', label: 'News', sources: ['rss', 'gnews', 'gdelt', 'nyt'] },
]

/** The figures that lead the page, in order. */
const HEADLINE: { id: EconIndicator['id']; label: string }[] = [
  { id: 'NY.GDP.MKTP.CD', label: 'GDP' },
  { id: 'NY.GDP.MKTP.KD.ZG', label: 'Real GDP growth' },
  { id: 'FP.CPI.TOTL.ZG', label: 'Inflation' },
  { id: 'SL.UEM.TOTL.ZS', label: 'Unemployment' },
]

interface Props {
  country: string
  crises: CrisisEvent[]
  conflictFeed?: ConflictFeed
  flights: Flight[]
  articles: NewsArticle[]
  earthquakes?: Earthquake[]
  fires?: FirePoint[]
  onClose: () => void
  /** switch the main area to the map with this country highlighted */
  onShowMap: () => void
  onOpenPanel: (id: string) => void
  onFlyTo?: (q: string) => void
  initialTab?: CountryTab
}

/**
 * A country's data as a page in the main area (the map is one click away, not underneath): economy first, then
 * forecasts, trade and exposure, and the context tabs. Built from the same data and sections as the map's country
 * card, so nothing here is a second source of truth.
 */
export default function CountryPage({ country, crises, conflictFeed, flights, articles, earthquakes, fires, onClose, onShowMap, onOpenPanel, onFlyTo, initialTab = 'economy' }: Props) {
  const [tab, setTab] = useState<CountryTab>(initialTab)
  useEffect(() => { setTab(initialTab) }, [country, initialTab])
  const iso2 = resolveISO2(country)
  const { econData, econLoading } = useCountryLiveData(country)
  const byId = useMemo(() => new Map((econData?.indicators ?? []).map(i => [i.id, i])), [econData])
  const trend = useMemo(() => computeTrajectories(conflictFeed?.events.length ? conflictFeed.events : crises, { limit: 6, articles, focusCountry: country, capped: conflictFeed?.capped })[0], [conflictFeed, crises, articles, country])
  const current = TABS.find(t => t.id === tab)!
  const drawerProps = { country, crises, flights, earthquakes, fires, onClose, onFlyTo, embedded: true }

  return (
    <section className="country-page" aria-label={`${country} country data`}>
      <header className="cp-head">
        <div className="cp-title">
          <h2>{country}</h2>
          <span>Country data · every figure with its source and year</span>
        </div>
        <div className="cp-actions">
          <WatchButton country={country} />
          <button className="cy-btn" onClick={onShowMap} title={`Show ${country} on the map`}><MapIcon size={12} /> Show on map</button>
          <CloseButton onClick={onClose} label={`Close ${country}`} />
        </div>
      </header>

      <div className="cp-kpis viz-kpis">
        {HEADLINE.map(h => {
          const ind = byId.get(h.id)
          const fresh = ind?.value != null && ind.year ? freshness(ind.year, 'macro', iso2) : null
          return (
            <Metric key={h.id} label={h.label} evidence="observed"
              value={ind?.value != null ? formatEconValue(h.id, ind.value) : econLoading ? '…' : '—'}
              asOf={ind?.value != null ? `World Bank, ${ind.year}${fresh?.stale ? ` · ⚠ ${fresh.label}` : ''}` : econLoading ? 'loading' : 'not reported'} />
          )
        })}
      </div>

      <nav className="cp-tabs" role="tablist" aria-label={`${country} sections`}>
        {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </nav>

      <div className="cp-body" role="tabpanel" aria-label={current.label}>
        {tab === 'economy' && (<>
          {econLoading ? <StatusLabel status="loading">World Bank data for {country}…</StatusLabel>
            : !econData ? <StatusLabel status="empty">The World Bank has no economic data for {country}.</StatusLabel>
            : Object.entries(groupIndicators(econData.indicators)).map(([group, inds]) => (
                <div key={group}>
                  <SectionLabel>{group}</SectionLabel>
                  {inds.filter(i => i.value != null).map(i => {
                    const fresh = i.year ? freshness(i.year, 'macro', iso2) : null
                    const growth = i.id.includes('.ZG') || i.id === 'SP.POP.GROW'
                    return <MetricRow key={i.id} label={i.label} value={formatEconValue(i.id, i.value!)} year={i.year}
                      tone={growth ? (i.value! >= 0 ? 'up' : 'down') : 'neutral'} stale={fresh?.stale} staleLabel={fresh?.label ?? undefined} />
                  })}
                </div>
              ))}
          {/* the overview above stays; everything else we hold on this economy follows it */}
          <SectionLabel>Full record</SectionLabel>
          {iso2
            ? <Suspense fallback={<StatusLabel status="loading">The full record for {country}…</StatusLabel>}><CountryLookupPanel iso2={iso2} /></Suspense>
            : <StatusLabel status="empty">No country code for {country}, so the full record cannot be loaded.</StatusLabel>}
        </>)}
        {tab === 'forecasts' && <ForecastsTab country={country} iso2={iso2} onOpenPanel={onOpenPanel} />}
        {tab === 'trade' && <>
          <TradeTab country={country} iso2={iso2} onOpenPanel={onOpenPanel} drawer={<Suspense fallback={null}><CountryDrawer {...drawerProps} only="trade" /></Suspense>} />
          <TradeMore country={country} iso2={iso2} />
        </>}
        {(tab === 'risk' || tab === 'infrastructure' || tab === 'activity') && (
          <Suspense fallback={<StatusLabel status="loading">{current.label}…</StatusLabel>}><CountryDrawer {...drawerProps} only={tab} /></Suspense>
        )}
        {/* the overview above stays as it was; what else we hold on the country follows it */}
        {tab === 'risk' && <RiskMore country={country} crises={crises} />}
        {tab === 'infrastructure' && <InfraMore country={country} iso2={iso2} />}
        {tab === 'activity' && <ActivityMore country={country} iso2={iso2} />}
        {tab === 'news' && <>
          <CountryBrief country={country} crises={crises} articles={articles} earthquakes={earthquakes} trend={trend} />
          <NewsMore country={country} articles={articles} />
        </>}
      </div>

      <PanelSources sources={current.sources} />
      <button className="cp-mapcta" onClick={onShowMap}>Explore {country} on the map <ArrowRight size={12} /></button>
    </section>
  )
}

