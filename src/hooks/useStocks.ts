import { useState, useEffect, useCallback } from 'react'
import { fetchMultipleQuotes, searchSymbol, MARKET_HUBS } from '../services/stocks'
import type { Stock } from '../types'

const DEFAULT_SYMBOLS = MARKET_HUBS.map((h) => h.symbol)

export function useStocks(enabled: boolean) {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_SYMBOLS)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string }[]>([])

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMultipleQuotes(watchlist)
      setStocks(data)
      setLastUpdated(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [enabled, watchlist])

  useEffect(() => {
    if (!enabled) return
    load()
    const timer = window.setInterval(load, 60_000) // every 60 s
    return () => clearInterval(timer)
  }, [enabled, load])

  const addSymbol = useCallback((symbol: string) => {
    const s = symbol.toUpperCase().trim()
    if (!s || watchlist.includes(s)) return
    setWatchlist((prev) => [...prev, s])
  }, [watchlist])

  const removeSymbol = useCallback((symbol: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol))
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol))
  }, [])

  const search = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return }
    const results = await searchSymbol(query)
    setSearchResults(results)
  }, [])

  return {
    stocks,
    watchlist,
    loading,
    error,
    lastUpdated,
    searchResults,
    addSymbol,
    removeSymbol,
    search,
    refresh: load,
  }
}
