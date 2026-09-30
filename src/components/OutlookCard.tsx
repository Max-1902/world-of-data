import { ArrowDownRight, ArrowUpRight, Minus, Radar } from 'lucide-react'
import { computeTrajectories } from '../utils/trajectory'
import type { CrisisEvent, Flight, NewsArticle } from '../types'

interface Props {
  crises: CrisisEvent[]
  flights: Flight[]
  articles: NewsArticle[]
  onSelectCountry: (country: string) => void
}

export default function OutlookCard({ crises, flights, articles, onSelectCountry }: Props) {
  const entries = computeTrajectories(crises, flights, 6, articles)
  const rising = entries.filter(entry => entry.trend === 'rising')
  const featured = (rising.length ? rising : entries).slice(0, 2)

  return (
    <section className="outlook-card" aria-label="Regional activity outlook">
      <div className="outlook-head">
        <div className="outlook-title">
          <span className="outlook-icon"><Radar size={13} /></span>
          <div>
            <div className="outlook-eyebrow">REGIONAL OUTLOOK</div>
            <div className="outlook-subtitle">Activity trend · 72 hours</div>
          </div>
        </div>
        <span className="outlook-live"><i /> RULE BASED</span>
      </div>

      {featured.length > 0 ? (
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
    </section>
  )
}
