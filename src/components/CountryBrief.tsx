import { useMemo } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { useCountryBrief } from '../hooks/useCountryBrief'
import { formatEconValue, resolveISO2, type EconIndicator, type IndicatorId } from '../services/worldbank'
import { CAPITALS } from '../services/capitals'
import { linkedCrisisEvents, pickCountryHeadlines } from '../utils/countryBrief'
import type { TrajectoryEntry } from '../utils/trajectory'
import type { CrisisEvent, NewsArticle } from '../types'
import { StateMediaBadge } from './StateMediaBadge'
import { freshness, type FreshnessKind } from '../utils/freshness'

interface Props {
  country: string
  crises: CrisisEvent[]
  /** app-wide headlines; any that name the country are merged into the country's own feed */
  articles: NewsArticle[]
  trend?: TrajectoryEntry
}

const CATEGORY_LABEL = { political: 'POLITICS', economic: 'ECONOMY', humanitarian: 'HUMANITARIAN', other: 'SECURITY' } as const

function ageLabel(iso: string): string {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? formatDistanceToNowStrict(t, { addSuffix: false }).replace(/ (\w)\w*/, '$1') : ''
}

/** Few, high-signal facts. Each is shown only if the World Bank actually returned a value for it. */
const FACT_IDS: { id: IndicatorId; label: string; kind: FreshnessKind }[] = [
  { id: 'SP.POP.TOTL', label: 'Population', kind: 'structural' },
  { id: 'NY.GDP.MKTP.CD', label: 'GDP', kind: 'macro' },
  { id: 'NY.GDP.PCAP.CD', label: 'GDP / person', kind: 'macro' },
  { id: 'NY.GDP.MKTP.KD.ZG', label: 'GDP growth', kind: 'macro' },
  { id: 'FP.CPI.TOTL.ZG', label: 'Inflation', kind: 'macro' },
  { id: 'SL.UEM.TOTL.ZS', label: 'Unemployment', kind: 'macro' },
  { id: 'SP.DYN.LE00.IN', label: 'Life expectancy', kind: 'structural' },
  { id: 'MS.MIL.XPND.GD.ZS', label: 'Military spend', kind: 'military' },
]

export default function CountryBrief({ country, crises, articles, trend }: Props) {
  const { headlines, profile, econ, loading } = useCountryBrief(country)

  const picked = useMemo(() => pickCountryHeadlines(country, headlines, articles), [country, headlines, articles])
  const tracked = useMemo(() => linkedCrisisEvents(crises, country), [crises, country])

  const byId = new Map<string, EconIndicator>((econ?.indicators ?? []).filter(i => i.value != null).map(i => [i.id, i]))
  const facts: { label: string; value: string; year?: string; stale?: string | null }[] = []
  // Capital names come from one curated list (services/capitals.ts), not World Bank's capitalCity, which still says
  // "Kiev" while the map says "Kyiv". Countries left out there on purpose (disputed or split capitals) show none.
  const iso2 = resolveISO2(country)
  const capital = iso2 ? CAPITALS[iso2] : undefined
  if (capital) facts.push({ label: 'Capital', value: capital })
  for (const f of FACT_IDS) {
    const ind = byId.get(f.id)
    if (ind && ind.value != null) facts.push({ label: f.label, value: formatEconValue(f.id, ind.value), year: ind.year, stale: ind.year ? freshness(ind.year, f.kind, iso2)?.label : null })
  }
  if (profile?.incomeLevel && !/not classified/i.test(profile.incomeLevel)) facts.push({ label: 'Income group', value: profile.incomeLevel.replace(/ income$/i, '') })
  if (profile?.region) facts.push({ label: 'Region', value: profile.region.replace(/\s*\(.*?\)\s*/g, ' ').trim() })

  return (
    <div className="cb-body">
      <div className="cb-section">
        <div className="cb-label">TOP NEWS · LAST 14 DAYS</div>
        {picked.length > 0 ? picked.map(({ article, category }) => (
          <a key={article.id} className="cb-news" href={article.url} target="_blank" rel="noopener noreferrer" title={article.title}>
            <span className="cb-news-title">{article.title}</span>
            <span className="cb-news-meta">
              {category && <b className={`cb-tag ${category}`}>{CATEGORY_LABEL[category]}</b>}
              <span>{article.source}</span>
              <StateMediaBadge source={article.source} />
              {ageLabel(article.publishedAt) && <span>· {ageLabel(article.publishedAt)}</span>}
            </span>
          </a>
        )) : (
          <div className="cb-empty">{loading ? 'Loading latest coverage…' : `No recent coverage found for ${country}.`}</div>
        )}
      </div>

      <div className="cb-section">
        <div className="cb-label">TRACKED ACTIVITY</div>
        {tracked.total > 0 ? (
          <>
            <div className="cb-line">{tracked.total} live incident{tracked.total === 1 ? '' : 's'} on the map{trend && trend.recentCount + trend.priorCount > 0 ? ` · ${trend.reason}` : ''}</div>
            {tracked.top.map(c => (
              <div key={c.id} className="cb-incident" title={c.title}>
                <i className={`cb-dot ${c.severity}`} />
                <span>{c.title}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="cb-line cb-dim">No live incidents (conflict, disaster, quake, outage) currently tracked here.</div>
        )}
      </div>

      <div className="cb-section">
        <div className="cb-label">KEY FACTS</div>
        {facts.length > 0 ? (
          <div className="cb-facts">
            {facts.map(f => (
              <div key={f.label} className="cb-fact">
                <span className="cb-fact-label">{f.label}</span>
                <span className="cb-fact-value" title={f.stale ?? undefined}>{f.value}{f.year && <small style={f.stale ? { color: 'var(--amber)', fontWeight: 700 } : undefined}>{f.year}{f.stale ? ' ⚠' : ''}</small>}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="cb-empty">{loading ? 'Loading World Bank data…' : 'No World Bank data for this territory.'}</div>
        )}
        <div className="cb-source">News: Google News · Facts: World Bank (latest year shown)</div>
      </div>
    </div>
  )
}
