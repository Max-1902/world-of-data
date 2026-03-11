import { RefreshCw, AlertTriangle } from 'lucide-react'
import type { CrisisEvent } from '../../../types'

const TYPE_ICONS: Record<string, string> = {
  war: '⚔️',
  conflict: '💥',
  terrorism: '🔴',
  protest: '✊',
  political: '🏛️',
  disaster: '🌊',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff1a2e',
  high: '#ff6600',
  medium: '#ffcc00',
  low: '#aaaaaa',
}

const TYPE_LABELS: Record<string, string> = {
  war: 'WAR',
  conflict: 'CONFLICT',
  terrorism: 'TERROR',
  protest: 'PROTEST',
  political: 'POLITICAL',
  disaster: 'DISASTER',
}

interface Props {
  crises: CrisisEvent[]
  loading: boolean
  onRefresh: () => void
  onSelect: (c: CrisisEvent) => void
}

export default function CrisesPanel({ crises, loading, onRefresh, onSelect }: Props) {
  const bySeverity = [...crises].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2)
  })

  const counts = crises.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-red pulse-alert" />
          <span className="text-xs text-gray-400">
            {loading ? 'Loading…' : `${crises.length} active events`}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-gray-500 hover:text-accent-red transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-1 p-2 border-b border-surface-700">
        {Object.entries(counts).map(([type, count]) => (
          <div
            key={type}
            className="flex flex-col items-center p-1 rounded bg-surface-800"
          >
            <span className="text-base leading-none">{TYPE_ICONS[type] ?? '📍'}</span>
            <span className="text-xs text-gray-200 font-semibold mt-0.5">{count}</span>
            <span className="text-xs text-gray-600" style={{ fontSize: '9px' }}>
              {TYPE_LABELS[type] ?? type.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {bySeverity.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-xs gap-2">
            <AlertTriangle size={24} />
            <span>No crisis data. GDELT/ACLED loading…</span>
          </div>
        )}
        {bySeverity.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="w-full flex gap-2 px-3 py-2 hover:bg-surface-700 transition-colors text-left border-b border-surface-800 group"
          >
            <span className="mt-0.5 text-sm flex-shrink-0">{TYPE_ICONS[c.type] ?? '📍'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span
                  className="text-xs font-bold"
                  style={{ color: SEVERITY_COLORS[c.severity] ?? '#aaa', fontSize: '9px' }}
                >
                  {c.severity.toUpperCase()}
                </span>
                <span className="text-xs text-gray-300 truncate group-hover:text-white">
                  {c.title}
                </span>
              </div>
              <div className="text-xs text-gray-600 truncate">
                {c.country} · {new Date(c.date).toLocaleDateString()}
                {c.fatalities ? ` · ${c.fatalities} fatalities` : ''}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-surface-600 text-xs text-gray-600">
        Sources: GDELT · ACLED · live / 5 min
      </div>
    </div>
  )
}
