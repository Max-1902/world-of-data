/**
 * What else the dashboard holds on one country, per country-page tab. These sit under each tab's existing overview and
 * only filter datasets that already exist elsewhere (nothing is estimated here): a section appears with its data, or
 * says plainly that the source has nothing for this country.
 */
import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import type { CrisisEvent, NewsArticle } from '../../types'
import { useCountryBrief } from '../../hooks/useCountryBrief'
import { useDisasterAlerts } from '../../hooks/useDisasterAlerts'
import { useOutages } from '../../hooks/useOutages'
import { fetchDataCenters, type DataCenterPoint } from '../../services/datacenters'
import { DISASTER_LABELS } from '../../services/gdacs'
import { fetchAllCrisisWatch, type CrisisWatchEntry } from '../../services/news'
import { METRIC_LABELS, OIL_GAS_DATA, OIL_GAS_SOURCE, formatValue, type OilGasMetric } from '../../services/oilgas'
import { PORTS, PORT_TYPE_LABELS } from '../../services/ports'
import { fetchResourceRents, getResourceProfile, type ResourceRent } from '../../services/resources'
import { linkedCrisisEvents, mentionsCountry, pickCountryHeadlines } from '../../utils/countryBrief'
import { matchCountry } from '../countryDrawer/parts'
import { MetricRow, SectionLabel, SourceLine, StatusLabel } from '../DataLabels'
import { StateMediaBadge } from '../StateMediaBadge'

const OIL_GAS_METRICS: OilGasMetric[] = ['oilReserves', 'gasReserves', 'oilProduction', 'gasProduction']

function ago(iso: string | number): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  return Number.isFinite(t) ? `${formatDistanceToNowStrict(t)} ago` : ''
}

function ExternalRow({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <a className="cb-news" href={href} target="_blank" rel="noopener noreferrer" title={title}>
      <span className="cb-news-title">{title}</span>
      <span className="cb-news-meta"><span>{meta}</span></span>
    </a>
  )
}

/** Mineral and energy resources, and the ports, held for this country. */
export function TradeMore({ country, iso2 }: { country: string; iso2: string | null }) {
  const profile = iso2 ? getResourceProfile(iso2) : null
  const oilGas = iso2 ? OIL_GAS_DATA.find(o => o.iso2 === iso2) ?? null : null
  const ports = useMemo(() => PORTS.filter(p => matchCountry(p.country, country.toLowerCase())), [country])
  const [rents, setRents] = useState<ResourceRent[] | 'loading'>('loading')
  useEffect(() => {
    if (!iso2) { setRents([]); return }
    let live = true
    setRents('loading')
    fetchResourceRents(iso2).then(r => { if (live) setRents(r) }, () => { if (live) setRents([]) })
    return () => { live = false }
  }, [iso2])

  return (
    <>
      <SectionLabel>Minerals · production rank and share of world</SectionLabel>
      {profile ? (
        <>
          {profile.strategic && <p className="viz-foot">{profile.strategic}</p>}
          {profile.resources.map(r => (
            <MetricRow key={r.mineral} label={r.mineral}
              value={[r.rank ? `#${r.rank} producer` : null, r.shareOfWorld != null ? `${r.shareOfWorld}% of world` : null].filter(Boolean).join(' · ') || '—'}
              title={r.note} />
          ))}
          <SourceLine source="USGS Mineral Commodity Summaries and BGS" asOf="2025/2026 editions, approximate shares for major producers only" />
        </>
      ) : <StatusLabel status="empty">No mineral profile for {country}: the dataset covers major producers and reserve holders only.</StatusLabel>}

      <SectionLabel>Oil and gas</SectionLabel>
      {oilGas ? (
        <>
          {OIL_GAS_METRICS.map(m => oilGas[m] > 0 && <MetricRow key={m} label={METRIC_LABELS[m]} value={formatValue(oilGas[m], m)} year={oilGas.years[m]} />)}
          <SourceLine source={OIL_GAS_SOURCE.name} asOf={`retrieved ${OIL_GAS_SOURCE.retrieved}`} />
        </>
      ) : <StatusLabel status="empty">No oil or gas figures for {country} in the Factbook extract.</StatusLabel>}

      <SectionLabel>Natural-resource rents · share of GDP</SectionLabel>
      {rents === 'loading' ? <StatusLabel status="loading">World Bank resource rents…</StatusLabel>
        : rents.length ? <>{rents.map(r => <MetricRow key={r.label} label={r.label.replace(/ \(% of GDP\)$/, '')} value={r.value.toFixed(1)} unit="% of GDP" year={r.year} />)}<SourceLine source="World Bank Open Data" /></>
        : <StatusLabel status="empty">The World Bank reports no resource rents for {country}.</StatusLabel>}

      <SectionLabel>Ports</SectionLabel>
      {ports.length ? (
        <>
          {ports.map(p => (
            <MetricRow key={p.id} label={`${p.name} · ${PORT_TYPE_LABELS[p.type]}`}
              value={p.activity ? `${p.activity.tradeMt.toFixed(0)} Mt` : '—'} year={p.activity?.year}
              title={p.activity ? `${p.activity.portCalls} port calls, of which ${p.activity.tankerCalls} tankers and ${p.activity.containerCalls} container ships; top industry: ${p.topIndustry}` : undefined} />
          ))}
          <SourceLine source="IMF PortWatch (estimated imports + exports, million tonnes)" />
        </>
      ) : <StatusLabel status="empty">No major port for {country} in the ports dataset.</StatusLabel>}
    </>
  )
}

/** Every tracked conflict event for the country (the overview lists the first six), and the ICG's CrisisWatch entry. */
export function RiskMore({ country, crises }: { country: string; crises: CrisisEvent[] }) {
  // same rule as the brief: with only the hand-entered baseline loaded, "none" can't be claimed
  const conflict = useMemo(() => crises.some(c => c.source !== 'Baseline' && !c.id.startsWith('baseline-')) ? linkedCrisisEvents(crises, country, Infinity) : null, [country, crises])
  const [cw, setCw] = useState<CrisisWatchEntry[] | 'loading'>('loading')
  useEffect(() => {
    let live = true
    fetchAllCrisisWatch().then(e => { if (live) setCw(e) }, () => { if (live) setCw([]) })
    return () => { live = false }
  }, [])
  const entries = cw === 'loading' ? [] : cw.filter(e => mentionsCountry(e.title, country))

  return (
    <>
      <SectionLabel>All tracked conflict events</SectionLabel>
      {conflict === null ? <StatusLabel status="empty">Not measured: the ACLED feed returned nothing.</StatusLabel>
        : conflict.total === 0 ? <StatusLabel status="empty">No conflict events recorded for {country}.</StatusLabel>
        : <>
            {conflict.top.map(c => (
              <MetricRow key={c.id} label={c.title} value={c.fatalities != null ? `${c.fatalities}` : '—'} unit={c.fatalities != null ? 'fatalities' : undefined} year={c.date?.slice(0, 10)} tone={c.severity === 'critical' ? 'down' : 'neutral'} />
            ))}
            <SourceLine source="ACLED" />
          </>}

      <SectionLabel>International Crisis Group · CrisisWatch</SectionLabel>
      {cw === 'loading' ? <StatusLabel status="loading">ICG CrisisWatch…</StatusLabel>
        : entries.length ? <>{entries.map(e => <ExternalRow key={e.id} href={e.url} title={e.title} meta={`${e.trend === 'unknown' ? 'trend not stated' : e.trend} · ${e.source}${ago(e.publishedAt) ? ` · ${ago(e.publishedAt)}` : ''}`} />)}<SourceLine source="International Crisis Group" asOf="trend read from the entry's own wording" /></>
        : <StatusLabel status="empty">No CrisisWatch entry names {country} right now.</StatusLabel>}
    </>
  )
}

/** Data centers OpenStreetMap volunteers have tagged with this country. */
export function InfraMore({ country, iso2 }: { country: string; iso2: string | null }) {
  const [dcs, setDcs] = useState<DataCenterPoint[] | 'loading' | 'error'>('loading')
  useEffect(() => {
    let live = true
    fetchDataCenters().then(d => { if (live) setDcs(d) }, () => { if (live) setDcs('error') })
    return () => { live = false }
  }, [])
  const mine = Array.isArray(dcs) ? dcs.filter(d => d.country && (d.country.toUpperCase() === iso2 || matchCountry(d.country, country.toLowerCase()))) : []
  const untagged = Array.isArray(dcs) ? dcs.filter(d => !d.country).length : 0

  return (
    <>
      <SectionLabel>Data centers</SectionLabel>
      {dcs === 'loading' ? <StatusLabel status="loading">OpenStreetMap data centers (the worldwide query can take up to a minute)…</StatusLabel>
        : dcs === 'error' ? <StatusLabel status="error">OpenStreetMap could not be reached, so there is no data-center list right now.</StatusLabel>
        : <>
            {mine.length ? mine.map(d => <MetricRow key={d.id} label={d.name} value={d.operator ?? '—'} />) : <StatusLabel status="empty">No data center tagged with {country} in OpenStreetMap.</StatusLabel>}
            <SourceLine source="© OpenStreetMap contributors (ODbL)">{untagged.toLocaleString()} of {dcs.length.toLocaleString()} worldwide have no country tag and cannot be assigned, so this list is a lower bound</SourceLine>
          </>}
    </>
  )
}

/** Disaster alerts and internet outages in the country, which the brief and the overview leave out. */
export function ActivityMore({ country, iso2 }: { country: string; iso2: string | null }) {
  const { alerts, loading } = useDisasterAlerts()
  const { outages, radarOutages, loading: outagesLoading } = useOutages(true)
  const lc = country.toLowerCase()
  const mine = useMemo(() => alerts.filter(a => matchCountry(a.country, lc)), [alerts, lc])
  const ioda = useMemo(() => iso2 ? outages.filter(o => o.countryCode === iso2) : [], [outages, iso2])
  const radar = useMemo(() => iso2 ? radarOutages.filter(o => o.countries.some(c => c.code === iso2)) : [], [radarOutages, iso2])

  return (
    <>
      <SectionLabel>Disaster alerts · last 14 days</SectionLabel>
      {loading && !alerts.length ? <StatusLabel status="loading">GDACS alerts…</StatusLabel>
        : mine.length ? <>{mine.map(a => <ExternalRow key={a.id} href={a.reportUrl} title={`${DISASTER_LABELS[a.type]} · ${a.name}`} meta={`${a.alert} alert · ${a.severityText}`} />)}<SourceLine source="GDACS (Orange and Red alerts only)" /></>
        : <StatusLabel status="empty">No Orange or Red GDACS alert in {country} in the last 14 days.</StatusLabel>}

      <SectionLabel>Internet outages</SectionLabel>
      {outagesLoading && !outages.length && !radarOutages.length ? <StatusLabel status="loading">IODA and Cloudflare Radar…</StatusLabel>
        : ioda.length + radar.length === 0 ? <StatusLabel status="empty">No outage reported for {country} (IODA, last 24 hours; Cloudflare Radar, last 7 days).</StatusLabel>
        : <>
            {ioda.map(o => <MetricRow key={o.id} label={`${o.entityName}${o.org ? ` · ${o.org}` : ''}`} value={`${o.status}, ${Math.round(o.dropPct)}% below baseline`} />)}
            {radar.map(o => <ExternalRow key={o.id} href={o.linkedUrl} title={o.description || `${o.type || 'Outage'} · ${o.scope || country}`} meta={`Cloudflare Radar · ${o.cause.toLowerCase().replace(/_/g, ' ')} · ${ago(o.start)}`} />)}
            <SourceLine source="IODA (Georgia Tech) and Cloudflare Radar" />
          </>}
    </>
  )
}

/** Every matching headline, not only the top five, plus the state-media flag where it applies. */
export function NewsMore({ country, articles }: { country: string; articles: NewsArticle[] }) {
  const { headlines, loading } = useCountryBrief(country)
  const all = useMemo(() => pickCountryHeadlines(country, headlines, articles, 60), [country, headlines, articles])
  const rest = all.slice(5)

  return (
    <>
      <SectionLabel>More coverage · {rest.length} further headline{rest.length === 1 ? '' : 's'}</SectionLabel>
      {rest.length ? (
        <>
          {rest.map(({ article }) => (
            <a key={article.id} className="cb-news" href={article.url} target="_blank" rel="noopener noreferrer" title={article.title}>
              <span className="cb-news-title">{article.title}</span>
              <span className="cb-news-meta"><span>{article.source}</span><StateMediaBadge source={article.source} />{ago(article.publishedAt) && <span>· {ago(article.publishedAt)}</span>}</span>
            </a>
          ))}
          <SourceLine source="Google News search for this country and the dashboard's own feeds" />
        </>
      ) : loading ? <StatusLabel status="loading">Further coverage…</StatusLabel>
        : <StatusLabel status="empty">No further headlines beyond the top five for {country}.</StatusLabel>}
    </>
  )
}
