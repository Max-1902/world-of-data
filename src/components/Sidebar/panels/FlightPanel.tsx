import { Plane, RefreshCw, Clock } from 'lucide-react'
import type { Flight } from '../../../types'

interface Props {
  flights: Flight[]
  loading: boolean
  lastUpdated: Date | null
  onRefresh: () => void
  onSelect: (f: Flight) => void
}

export default function FlightPanel({ flights, loading, lastUpdated, onRefresh, onSelect }: Props) {
  const airborne = flights.filter((f) => !f.on_ground)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-blue pulse-live" />
          <span className="text-xs text-gray-400">
            {loading ? 'Fetching…' : `${airborne.length.toLocaleString()} aircraft airborne`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <Clock size={10} />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-gray-500 hover:text-accent-blue transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {airborne.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-xs gap-2">
            <Plane size={24} />
            <span>No data — check OpenSky status</span>
          </div>
        )}
        {airborne.slice(0, 200).map((f) => (
          <button
            key={f.icao24}
            onClick={() => onSelect(f)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-700 transition-colors text-left border-b border-surface-800 group"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="#0088ff"
              style={{ transform: `rotate(${f.heading ?? 0}deg)`, flexShrink: 0 }}
            >
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-200 truncate group-hover:text-accent-blue">
                {f.callsign || f.icao24}
              </div>
              <div className="text-xs text-gray-600 truncate">{f.origin_country}</div>
            </div>
            <div className="text-right text-xs text-gray-600 flex-shrink-0">
              {f.altitude ? `${Math.round(f.altitude / 100) * 100}m` : '—'}
            </div>
          </button>
        ))}
        {airborne.length > 200 && (
          <div className="text-center text-xs text-gray-600 py-2">
            +{airborne.length - 200} more shown on map
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-surface-600 text-xs text-gray-600">
        Source: OpenSky Network · free · live
      </div>
    </div>
  )
}
