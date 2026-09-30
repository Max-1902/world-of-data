import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Radar } from 'lucide-react'
import { computeTrajectories } from '../utils/trajectory'
import type { CrisisEvent, Flight } from '../types'

interface Props {
  crises: CrisisEvent[]
  flights: Flight[]
  onOpen: () => void
}

export default function OutlookCard({ crises, flights, onOpen }: Props) {
  const entries = computeTrajectories(crises, flights, 6)
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
              <div className="outlook-entry" key={entry.country}>
                <div className={`outlook-trend ${entry.trend}`}><Icon size={14} /></div>
                <div className="outlook-detail">
                  <div className="outlook-country">{entry.country}</div>
                  <div className="outlook-reason">{entry.reason}</div>
                </div>
                <div
                  className={`outlook-delta ${entry.trend}`}
                  title="Change in weighted incident activity versus the prior period"
                >
                  {entry.delta > 0 ? '+' : ''}{entry.delta}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="outlook-empty">No recent regional activity trend is available.</div>
      )}

      <button className="outlook-action" onClick={onOpen}>
        Open full analysis <ArrowRight size={12} />
      </button>
    </section>
  )
}
