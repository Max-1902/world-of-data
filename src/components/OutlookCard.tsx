import { ArrowDownRight, ArrowUpRight, Minus, Radar } from 'lucide-react'
import { computeTrajectories, isFlaggedUp } from '../utils/trajectory'
import { formatDistanceToNow } from 'date-fns'
import { useHistory, PREVIOUS_VISIT } from '../hooks/useHistory'
import { changesSince, scoreByCountry } from '../services/history'
import CountryBrief from './CountryBrief'
import PlaceBrief from './PlaceBrief'
import CloseButton from './CloseButton'
import type { Earthquake } from '../services/earthquakes'
import type { FirePoint } from '../services/wildfires'
import type { ConflictFeed, CrisisEvent, Flight, NewsArticle, SelectedPlace } from '../types'

/** Don't report "since last visit" for a reload a few minutes after the previous one. */
const MIN_AWAY_MS = 30 * 60 * 1000

interface Props {
  crises: CrisisEvent[]
  /** unthinned live events with the cap flag, for trend scoring; falls back to `crises` */
  conflictFeed?: ConflictFeed
  flights: Flight[]
  articles: NewsArticle[]
  earthquakes?: Earthquake[]
  fires?: FirePoint[]
  selectedCountry?: string | null
  /** a picked city; takes over the card from the regional outlook */
  selectedPlace?: SelectedPlace | null
  onSelectCountry: (country: string) => void
  onClose: () => void
}

export default function OutlookCard({ crises, conflictFeed, flights, articles, earthquakes = [], fires = [], selectedCountry, selectedPlace, onSelectCountry, onClose }: Props) {
  const subject = selectedPlace ? null : selectedCountry
  const entries = computeTrajectories(conflictFeed?.events.length ? conflictFeed.events : crises, { limit: 6, articles, focusCountry: subject, capped: conflictFeed?.capped })
  const rising = entries.filter(isFlaggedUp)
  const snaps = useHistory()
  const since = PREVIOUS_VISIT !== null && Date.now() - PREVIOUS_VISIT >= MIN_AWAY_MS
    ? changesSince(snaps, PREVIOUS_VISIT, scoreByCountry(crises))
    : null
  const featured = subject ? entries : (rising.length ? rising : entries).slice(0, 2)

  return (
    <section className={`outlook-card${selectedCountry || selectedPlace ? ' outlook-card-country' : ''}`} aria-label={selectedPlace ? `${selectedPlace.name} brief` : selectedCountry ? `${selectedCountry} brief` : 'Regional activity outlook'}>
      <div className="outlook-head">
        <div className="outlook-title">
          <span className="outlook-icon"><Radar size={13} /></span>
          <div>
            <div className="outlook-eyebrow">{selectedPlace ? selectedPlace.name : selectedCountry ? selectedCountry : 'Regional outlook'}</div>
            <div className="outlook-subtitle">{selectedPlace ? `${[selectedPlace.region, selectedPlace.country].filter(Boolean).join(', ')} · local brief` : selectedCountry ? 'Country brief · news and facts' : 'Activity trend · 72 hours'}</div>
          </div>
        </div>
        <span className="outlook-live"><i /> {selectedCountry || selectedPlace ? 'Live' : 'Rule-based'}</span>
        <CloseButton onClick={onClose} label={selectedPlace ? `Close ${selectedPlace.name} brief` : selectedCountry ? `Close ${selectedCountry} brief` : 'Close regional outlook'} />
      </div>

      {selectedPlace ? (
        <PlaceBrief place={selectedPlace} crises={crises} flights={flights} earthquakes={earthquakes} fires={fires} articles={articles} onSelectCountry={onSelectCountry} />
      ) : selectedCountry ? (
        <CountryBrief country={selectedCountry} crises={crises} articles={articles} earthquakes={earthquakes} trend={entries[0]} />
      ) : featured.length > 0 ? (
        <div className="outlook-list">
          {featured.map(entry => {
            const rising = entry.trend === 'rising'
            const falling = entry.trend === 'falling'
            const Icon = rising ? ArrowUpRight : falling ? ArrowDownRight : Minus
            return (
              <button
                className="outlook-entry outlook-entry-btn"
                key={entry.country}
                onClick={() => onSelectCountry(entry.country)}
                title={`Open full data for ${entry.country}`}
              >
                <div className={`outlook-trend ${entry.trend}`}><Icon size={14} /></div>
                <div className="outlook-detail">
                  <div className="outlook-country">
                    {entry.country}
                    {entry.unusual && <span className="outlook-news-badge" title={`Unusually ${entry.unusual} for this country, measured against its own last ${entry.baseline?.days} days`}>UNUSUAL</span>}
                    {entry.newsHit && <span className="outlook-news-badge" title={entry.newsHit}>NEWS</span>}
                  </div>
                  <div className="outlook-reason">{entry.reason}</div>
                </div>
                <div
                  className={`outlook-delta ${entry.trend}`}
                  title="Change in weighted incident activity versus the prior period"
                >
                  {entry.delta > 0 ? '+' : ''}{entry.delta}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="outlook-empty">No recent regional activity trend is available.</div>
      )}

      {!selectedCountry && !selectedPlace && since && since.movers.length > 0 && (
        <div className="outlook-since">
          <div className="outlook-since-head">SINCE YOUR LAST VISIT · {formatDistanceToNow(since.baselineT, { addSuffix: true }).toUpperCase()}</div>
          {since.movers.map(m => (
            <button key={m.country} className="outlook-since-row" onClick={() => onSelectCountry(m.country)}>
              <span className="outlook-since-country">{m.country}</span>
              <span className="outlook-since-score">{m.before} → {m.now}</span>
              <span className={`outlook-delta ${m.delta > 0 ? 'rising' : 'falling'}`}>{m.delta > 0 ? '+' : ''}{m.delta}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
