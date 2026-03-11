import { useState, useRef } from 'react'
import { TrendingUp, TrendingDown, Plus, X, Search, RefreshCw, Clock } from 'lucide-react'
import type { Stock } from '../../../types'
import { MARKET_HUBS } from '../../../services/stocks'

interface Props {
  stocks: Stock[]
  watchlist: string[]
  loading: boolean
  lastUpdated: Date | null
  searchResults: { symbol: string; name: string }[]
  onAdd: (symbol: string) => void
  onRemove: (symbol: string) => void
  onSearch: (q: string) => void
  onRefresh: () => void
}

export default function StocksPanel({
  stocks,
  watchlist,
  loading,
  lastUpdated,
  searchResults,
  onAdd,
  onRemove,
  onSearch,
  onRefresh,
}: Props) {
  const [addInput, setAddInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const timerRef = useRef<number | null>(null)

  function handleAddInput(value: string) {
    setAddInput(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      onSearch(value)
      setShowSearch(value.length > 0)
    }, 400)
  }

  function handleAddSymbol(symbol: string) {
    onAdd(symbol)
    setAddInput('')
    setShowSearch(false)
  }

  const hubs = MARKET_HUBS.map((h) => ({
    ...h,
    stock: stocks.find((s) => s.symbol === h.symbol),
  }))

  const customStocks = stocks.filter(
    (s) => !MARKET_HUBS.some((h) => h.symbol === s.symbol)
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-green pulse-live" />
          <span className="text-xs text-gray-400">
            {loading ? 'Updating…' : `${stocks.length} instruments`}
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
            className="text-gray-500 hover:text-accent-green disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Add symbol */}
      <div className="px-3 py-2 border-b border-surface-600 relative">
        <div className="flex items-center gap-2 bg-surface-800 border border-surface-600 rounded px-2 py-1 focus-within:border-accent-green transition-colors">
          <Search size={12} className="text-gray-500" />
          <input
            value={addInput}
            onChange={(e) => handleAddInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addInput.trim()) {
                handleAddSymbol(addInput.trim().toUpperCase())
              }
            }}
            placeholder="Add symbol (e.g. AAPL, BTC-USD)"
            className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 outline-none"
          />
          {addInput && (
            <button onClick={() => { setAddInput(''); setShowSearch(false) }}>
              <X size={10} className="text-gray-500" />
            </button>
          )}
        </div>
        {showSearch && searchResults.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-surface-800 border border-surface-600 rounded shadow-xl z-50 max-h-40 overflow-y-auto">
            {searchResults.map((r) => (
              <button
                key={r.symbol}
                onClick={() => handleAddSymbol(r.symbol)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-700 text-left"
              >
                <span className="text-xs text-accent-green font-semibold">{r.symbol}</span>
                <span className="text-xs text-gray-500 truncate ml-2">{r.name}</span>
                <Plus size={10} className="text-gray-500 ml-2 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Global market hubs */}
        <div className="px-3 py-1.5 text-xs text-gray-600 bg-surface-800 sticky top-0 z-10">
          GLOBAL MARKETS
        </div>
        {hubs.map((hub) => (
          <StockRow
            key={hub.symbol}
            label={hub.exchange}
            sublabel={hub.name}
            stock={hub.stock}
            onRemove={() => onRemove(hub.symbol)}
            isHub
          />
        ))}

        {/* Custom watchlist */}
        {customStocks.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-xs text-gray-600 bg-surface-800 sticky top-0 z-10">
              WATCHLIST
            </div>
            {customStocks.map((s) => (
              <StockRow
                key={s.symbol}
                label={s.symbol}
                sublabel={s.name}
                stock={s}
                onRemove={() => onRemove(s.symbol)}
              />
            ))}
          </>
        )}

        {stocks.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-xs gap-2">
            <TrendingUp size={24} />
            <span>Add a Finnhub API key to enable live quotes</span>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-surface-600 text-xs text-gray-600">
        Source: Finnhub · free tier · 60 req/min · 1 min delay
      </div>
    </div>
  )
}

function StockRow({
  label,
  sublabel,
  stock,
  onRemove,
  isHub = false,
}: {
  label: string
  sublabel: string
  stock?: Stock
  onRemove: () => void
  isHub?: boolean
}) {
  const positive = (stock?.changePercent ?? 0) >= 0

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-800 hover:bg-surface-700 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-gray-200">{label}</span>
          {stock && (
            <span className={`text-xs font-bold ${positive ? 'text-accent-green' : 'text-accent-red'}`}>
              {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-600 truncate">{sublabel}</div>
      </div>

      {stock ? (
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-semibold text-gray-100">
            {stock.currency === 'USD' ? '$' : ''}{stock.price.toFixed(2)}
          </div>
          <div
            className={`text-xs font-semibold ${positive ? 'text-accent-green' : 'text-accent-red'}`}
            style={{ fontSize: '10px' }}
          >
            {positive ? '+' : ''}{stock.changePercent.toFixed(2)}%
          </div>
        </div>
      ) : (
        <span className="text-xs text-gray-600">—</span>
      )}

      {!isHub && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-accent-red transition-all ml-1"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}
