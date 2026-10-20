import { fetchMultipleQuotes, MARKET_HUBS } from '../services/stocks'
import type { Stock } from '../types'
import { usePolling } from './usePolling'

const REFRESH_MS = 60_000
const HUB_SYMBOLS = MARKET_HUBS.map(h => h.symbol)

const fetchHubs = () => fetchMultipleQuotes(HUB_SYMBOLS)

export function useStocks(enabled: boolean) {
  const { data: stocks, loading, error, lastUpdated, refresh } = usePolling<Stock[]>(fetchHubs, { initial: [], intervalMs: REFRESH_MS, enabled })
  return { stocks, loading, error, lastUpdated, refresh }
}
