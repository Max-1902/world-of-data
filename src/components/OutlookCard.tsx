import { ArrowDownRight, ArrowUpRight, Minus, Radar } from 'lucide-react'
import { computeTrajectories } from '../utils/trajectory'
import { formatDistanceToNow } from 'date-fns'
import { useHistory, PREVIOUS_VISIT } from '../hooks/useHistory'
import { changesSince, scoreByCountry } from '../services/history'
import CountryBrief from './CountryBrief'
import CloseButton from './CloseButton'
import type { CrisisEvent, Flight, NewsArticle } from '../types'

/** Don't report "since last visit" for a reload a few minutes after the previous one. */
const MIN_AWAY_MS = 30 * 60 * 1000

interface Props {
  crises: CrisisEvent[]
  flights: Flight[]
  articles: NewsArticle[]
  selectedCountry?: string | null
  onSelectCountry: (country: string) => void
  onClose: () => void
}

export default function OutlookCard({ crises, flights, articles, selectedCountry, onSelectCountry, onClose }: Props) {
  const entries = computeTrajectories(crises, flights, 6, articles, selectedCountry)
  const rising = entries.filter(entry => entry.trend === 'rising')
  const snaps = useHistory()
  const since = PREVIOUS_VISIT !== null && Date.now() - PREVIOUS_VISIT >= MIN_AWAY_MS
    ? changesSince(snaps, PREVIOUS_VISIT, scoreByCountry(crises))
    : null
  const featured = selectedCountry ? entries : (rising.length ? rising : entries).slice(0, 2)

  return (
    <section className={`outlook-card${selectedCountry ? ' outlook-card-country' : ''}`} aria-label={selectedCountry ? `${selectedCountry} brief` : 'Regional activity outlook'}>
      <div className="outlook-head">
        <div className="outlook-title">
          <span className="outlook-icon"><Radar size={13} /></span>
          <div>
            <div className="outlook-eyebrow">{selectedCountry ? selectedCountry.toUpperCase() : 'REGIONAL OUTLOOK'}</div>
            <div className="outlook-subtitle">{selectedCountry ? 'Country brief · news and facts' : 'Activity trend · 72 hours'}</div>
          </div>
        </div>
        <span className="outlook-live"><i /> {selectedCountry ? 'LIVE' : 'RULE BASED'}</span>
        <CloseButton onClick={onClose} label={selectedCountry ? `Close ${selectedCountry} brief` : 'Close regional outlook'} />
      </div>

      {selectedCountry ? (
        <CountryBrief country={selectedCountry} crises={crises} articles={articles} trend={entries[0]} />
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

      {!selectedCountry && since && since.movers.length > 0 && (
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
