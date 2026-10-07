import { useMemo } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { usePlaceBrief } from '../hooks/usePlaceBrief'
import { pickCountryHeadlines } from '../utils/countryBrief'
import { nearbyData, RADIUS_KM } from '../utils/nearby'
import { INFRA_LABELS } from '../services/infrastructure'
import { CIVIL_FACILITY_LABELS, type CivilFacilityType } from '../services/civilFacilities'
import { distanceKm } from '../utils/geo'
import type { Earthquake } from '../services/earthquakes'
import type { FirePoint } from '../services/wildfires'
import type { CrisisEvent, Flight, NewsArticle, SelectedPlace } from '../types'

interface Props {
  place: SelectedPlace
  crises: CrisisEvent[]
  flights: Flight[]
  earthquakes: Earthquake[]
  fires: FirePoint[]
  /** app-wide headlines; any that name the place are merged into the place's own feed */
  articles: NewsArticle[]
  onSelectCountry: (country: string) => void
}

const CATEGORY_LABEL = { political: 'POLITICS', economic: 'ECONOMY', humanitarian: 'HUMANITARIAN', other: 'SECURITY' } as const
const CIVIL_ORDER: CivilFacilityType[] = ['hospital', 'police', 'telecom']

function ageLabel(iso: string): string {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? formatDistanceToNowStrict(t, { addSuffix: false }).replace(/ (\w)\w*/, '$1') : ''
}
const km = (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)} km`

/** One name + distance row. */
function Row({ label, sub, km: d, dot }: { label: string; sub?: string; km?: number; dot?: string }) {
  return (
    <div className="cb-incident" title={label}>
      {dot && <i className={`cb-dot ${dot}`} />}
      <span>{label}{sub ? <small className="pb-sub"> · {sub}</small> : null}</span>
      {d !== undefined && <em className="pb-km">{km(d)}</em>}
    </div>
  )
}

const more = (list: unknown[], shown: number) => list.length > shown ? <div className="cb-line cb-dim">+{list.length - shown} more</div> : null

export default function PlaceBrief({ place, crises, flights, earthquakes, fires, articles, onSelectCountry }: Props) {
  const { headlines, civil, powerPlants, loading } = usePlaceBrief(place)
  const picked = useMemo(() => pickCountryHeadlines(place.name, headlines, articles, 6), [place.name, headlines, articles])
  const near = useMemo(
    () => nearbyData(place, { crises, flights, earthquakes, fires }),
    [place, crises, flights, earthquakes, fires],
  )

  const centre = { lat: place.lat, lng: place.lng }
  const civilBy = (t: CivilFacilityType) => civil.filter(f => f.type === t)
  const strongestQuake = near.quakes.length ? [...near.quakes].sort((a, b) => b.item.magnitude - a.item.magnitude)[0] : null
  const assetCount = near.military.length + near.nuclear.length + near.infra.length + near.ports.length + powerPlants.length
  const activityCount = near.incidents.length + near.quakes.length + near.fires.length
  const aircraft = near.flights.airborne + near.flights.onGround

  return (
    <div className="cb-body">
      <div className="cb-section">
        <div className="cb-label">TOP NEWS · {place.name.toUpperCase()} · LAST 14 DAYS</div>
        {picked.length > 0 ? picked.map(({ article, category }) => (
          <a key={article.id} className="cb-news" href={article.url} target="_blank" rel="noopener noreferrer" title={article.title}>
            <span className="cb-news-title">{article.title}</span>
            <span className="cb-news-meta">
              {category && <b className={`cb-tag ${category}`}>{CATEGORY_LABEL[category]}</b>}
              <span>{article.source}</span>
              {ageLabel(article.publishedAt) && <span>· {ageLabel(article.publishedAt)}</span>}
            </span>
          </a>
        )) : (
          <div className="cb-empty">{loading ? 'Loading latest coverage…' : `No recent coverage found for ${place.name}.`}</div>
        )}
      </div>

      <div className="cb-section">
        <div className="cb-label">TRACKED ACTIVITY · WITHIN {RADIUS_KM.incidents} KM</div>
        {activityCount === 0 ? (
          <div className="cb-line cb-dim">No live incidents, earthquakes or fire detections near {place.name}.</div>
        ) : (
          <>
            {near.incidents.slice(0, 4).map(({ item, km: d }) => <Row key={item.id} label={item.title} km={d} dot={item.severity} />)}
            {more(near.incidents, 4)}
            {strongestQuake && (
              <Row
                label={`M${strongestQuake.item.magnitude.toFixed(1)} earthquake · ${strongestQuake.item.place}`}
                sub={ageLabel(new Date(strongestQuake.item.time).toISOString()) + ' ago'}
                km={strongestQuake.km}
                dot={strongestQuake.item.magnitude >= 6 ? 'high' : 'medium'}
              />
            )}
            {near.quakes.length > 1 && <div className="cb-line cb-dim">{near.quakes.length} earthquakes within {RADIUS_KM.quakes} km this week</div>}
            {near.fires.length > 0 && <div className="cb-line">{near.fires.length} satellite fire detection{near.fires.length === 1 ? '' : 's'} within {RADIUS_KM.fires} km (24 h)</div>}
          </>
        )}
        {aircraft > 0 && (
          <div className="cb-line pb-gap">
            {near.flights.airborne} aircraft airborne{near.flights.onGround ? `, ${near.flights.onGround} on the ground` : ''} within {RADIUS_KM.flights} km
            {near.flights.sample.length > 0 && <span className="cb-dim"> · {near.flights.sample.map(f => f.callsign?.trim() || f.icao24).join(', ')}</span>}
          </div>
        )}
      </div>

      <div className="cb-section">
        <div className="cb-label">FACILITIES &amp; INFRASTRUCTURE</div>
        {near.military.slice(0, 4).map(({ item, km: d }) => <Row key={item.id} label={item.name} sub={`${item.operator} military`} km={d} dot="high" />)}
        {near.nuclear.slice(0, 3).map(({ item, km: d }) => <Row key={item.id} label={item.name} sub="nuclear plant" km={d} dot="critical" />)}
        {near.ports.slice(0, 3).map(({ item, km: d }) => <Row key={item.id} label={item.name} sub={`${item.type} port`} km={d} />)}
        {near.infra.slice(0, 3).map(({ item, km: d }) => (
          <Row key={item.id} label={item.name} sub={INFRA_LABELS[item.type]?.toLowerCase()} km={d} />
        ))}
        {powerPlants.slice(0, 4).map(p => <Row key={p.id} label={p.name} sub={`power · ${p.capacity}`} km={distanceKm(centre, p)} />)}
        {assetCount === 0 && <div className="cb-line cb-dim">No bases, ports, plants or major infrastructure in our datasets within {RADIUS_KM.assets} km.</div>}
        <div className="pb-chips">
          {CIVIL_ORDER.map(t => {
            const n = civilBy(t).length
            return n > 0 ? <span key={t} className="pb-chip" title={civilBy(t).slice(0, 5).map(f => f.name).join('\n')}>{n} {CIVIL_FACILITY_LABELS[t].toLowerCase()}{n === 1 ? '' : 's'}</span> : null
          })}
        </div>
        {civil.length === 0 && <div className="cb-empty">{loading ? 'Loading hospitals, police and telecom from OpenStreetMap…' : 'No mapped hospitals, police or telecom within 15 km (or the OpenStreetMap lookup was unavailable).'}</div>}
        {civil.length > 0 && <div className="cb-line cb-dim">Within 15 km, from OpenStreetMap (first 40 per type).</div>}
      </div>

      <div className="cb-section">
        <button className="pb-country" onClick={() => onSelectCountry(place.country)}>
          Open {place.country} country brief →
        </button>
        <div className="cb-source">
          {place.name}{place.region ? `, ${place.region}` : ''} · {place.lat.toFixed(2)}, {place.lng.toFixed(2)} · News: Google News · Facilities: OpenStreetMap, WRI GPPD
        </div>
      </div>
    </div>
  )
}
