import { Star } from 'lucide-react'
import { watchStore } from '../services/watchlist'
import { useWatchlist } from '../hooks/useWatchlist'

/** Star toggle: add/remove a country from the watchlist. */
export default function WatchButton({ country, size = 14 }: { country: string; size?: number }) {
  const { countries } = useWatchlist()
  const on = countries.some(c => c.toLowerCase() === country.trim().toLowerCase())
  return (
    <button
      onClick={e => { e.stopPropagation(); watchStore.toggle(country) }}
      aria-pressed={on}
      aria-label={on ? `Stop watching ${country}` : `Watch ${country}`}
      title={on ? `Watching ${country} — click to stop` : `Watch ${country} for new high-severity events and rising trends`}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', display: 'flex', color: on ? 'var(--accent)' : 'var(--text3)' }}
    >
      <Star size={size} fill={on ? 'currentColor' : 'none'} />
    </button>
  )
}
