import { useState } from 'react'
import {
  Plane, AlertTriangle, Newspaper, TrendingUp,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import type {
  Flight, CrisisEvent, NewsArticle, Stock, PanelState,
} from '../../types'
import FlightPanel from './panels/FlightPanel'
import CrisesPanel from './panels/CrisesPanel'
import NewsPanel from './panels/NewsPanel'
import StocksPanel from './panels/StocksPanel'

type PanelId = 'flights' | 'crises' | 'news' | 'stocks'

const TABS: { id: PanelId; label: string; Icon: React.ElementType; color: string }[] = [
  { id: 'flights', label: 'Flights', Icon: Plane, color: '#0088ff' },
  { id: 'crises', label: 'Crises', Icon: AlertTriangle, color: '#ff3344' },
  { id: 'news', label: 'News', Icon: Newspaper, color: '#aa44ff' },
  { id: 'stocks', label: 'Markets', Icon: TrendingUp, color: '#00ff88' },
]

interface Props {
  panelState: PanelState

  // Flights
  flights: Flight[]
  flightsLoading: boolean
  flightsUpdated: Date | null
  onFlightRefresh: () => void
  onFlightSelect: (f: Flight) => void

  // Crises
  crises: CrisisEvent[]
  crisesLoading: boolean
  onCrisisRefresh: () => void
  onCrisisSelect: (c: CrisisEvent) => void

  // News
  newsArticles: NewsArticle[]
  newsLoading: boolean
  newsQuery: string
  onNewsSearch: (q: string) => void
  onNewsLoad: () => void
  onNewsSelect: (a: NewsArticle) => void

  // Stocks
  stocks: Stock[]
  stocksWatchlist: string[]
  stocksLoading: boolean
  stocksUpdated: Date | null
  stocksSearchResults: { symbol: string; name: string }[]
  onStockAdd: (s: string) => void
  onStockRemove: (s: string) => void
  onStockSearch: (q: string) => void
  onStockRefresh: () => void

  onToggleLayer: (layer: keyof PanelState) => void
}

export default function Sidebar({
  panelState,
  flights, flightsLoading, flightsUpdated, onFlightRefresh, onFlightSelect,
  crises, crisesLoading, onCrisisRefresh, onCrisisSelect,
  newsArticles, newsLoading, newsQuery, onNewsSearch, onNewsLoad, onNewsSelect,
  stocks, stocksWatchlist, stocksLoading, stocksUpdated,
  stocksSearchResults, onStockAdd, onStockRemove, onStockSearch, onStockRefresh,
  onToggleLayer,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelId>('flights')

  const activeTab = TABS.find((t) => t.id === activePanel)!

  return (
    <div
      className={`relative flex h-full transition-all duration-250 ${collapsed ? 'w-10' : 'w-80'}`}
      style={{ flexShrink: 0 }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-6 h-12 bg-surface-700 border border-surface-500 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-surface-600 transition-all shadow-lg"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      {collapsed ? (
        // Icon rail when collapsed
        <div className="w-10 bg-surface-900 border-l border-surface-600 flex flex-col items-center py-3 gap-3">
          {TABS.map(({ id, Icon, color, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => { setActivePanel(id); setCollapsed(false) }}
              className="w-8 h-8 rounded flex items-center justify-center hover:bg-surface-700 transition-colors relative"
              style={{ color: panelState[id] ? color : '#444' }}
            >
              <Icon size={16} />
              {/* badge */}
              {id === 'flights' && flights.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent-blue text-white text-center leading-3" style={{ fontSize: '8px' }}>
                  {flights.length > 99 ? '+' : flights.length}
                </span>
              )}
              {id === 'crises' && crises.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent-red text-white text-center leading-3" style={{ fontSize: '8px' }}>
                  {crises.length}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        // Full sidebar
        <div className="flex-1 flex flex-col bg-surface-900 border-l border-surface-600 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-surface-600 bg-surface-800 flex-shrink-0">
            {TABS.map(({ id, label, Icon, color }) => {
              const isActive = activePanel === id
              const isOn = panelState[id]
              return (
                <button
                  key={id}
                  onClick={() => setActivePanel(id)}
                  className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors relative ${
                    isActive ? 'bg-surface-700' : 'hover:bg-surface-750'
                  }`}
                  style={{ color: isActive ? color : isOn ? '#888' : '#444' }}
                >
                  <Icon size={14} />
                  <span style={{ fontSize: '9px' }}>{label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: color }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Panel header with toggle */}
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b border-surface-700 flex-shrink-0"
            style={{ background: activeTab.color + '11' }}
          >
            <div className="flex items-center gap-1.5">
              <activeTab.Icon size={12} style={{ color: activeTab.color }} />
              <span className="text-xs font-semibold text-gray-300">{activeTab.label}</span>
            </div>
            {/* Map layer toggle */}
            <button
              onClick={() => onToggleLayer(activePanel)}
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-all ${
                panelState[activePanel]
                  ? 'border-current text-current'
                  : 'border-surface-600 text-gray-600'
              }`}
              style={panelState[activePanel] ? { color: activeTab.color, borderColor: activeTab.color } : {}}
              title="Toggle map layer"
            >
              {panelState[activePanel] ? 'ON MAP' : 'HIDDEN'}
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'flights' && (
              <FlightPanel
                flights={flights}
                loading={flightsLoading}
                lastUpdated={flightsUpdated}
                onRefresh={onFlightRefresh}
                onSelect={onFlightSelect}
              />
            )}
            {activePanel === 'crises' && (
              <CrisesPanel
                crises={crises}
                loading={crisesLoading}
                onRefresh={onCrisisRefresh}
                onSelect={onCrisisSelect}
              />
            )}
            {activePanel === 'news' && (
              <NewsPanel
                articles={newsArticles}
                loading={newsLoading}
                query={newsQuery}
                onSearch={onNewsSearch}
                onLoad={onNewsLoad}
                onSelect={onNewsSelect}
              />
            )}
            {activePanel === 'stocks' && (
              <StocksPanel
                stocks={stocks}
                watchlist={stocksWatchlist}
                loading={stocksLoading}
                lastUpdated={stocksUpdated}
                searchResults={stocksSearchResults}
                onAdd={onStockAdd}
                onRemove={onStockRemove}
                onSearch={onStockSearch}
                onRefresh={onStockRefresh}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
