import type { Stock } from '../types'
import { SANCTIONED_COUNTRIES } from '../services/sanctions'

export interface MarketHudSummary {
  /** Hubs with a positive change, out of every hub that actually returned a quote this session. */
  up: number
  /** Hubs that returned a quote this session (may be fewer than the 10 tracked hubs while data is loading). */
  tracked: number
  /** Largest absolute % move among tracked hubs; undefined once none have reported yet. */
  topMover?: { symbol: string; changePercent: number }
}

/** Market-hub HUD stats — pure function over whatever `useStocks` has fetched so far. */
export function summarizeMarketHud(stocks: Stock[]): MarketHudSummary {
  const up = stocks.filter(s => s.changePercent > 0).length
  const topMover = stocks.reduce<Stock | undefined>((best, s) =>
    !best || Math.abs(s.changePercent) > Math.abs(best.changePercent) ? s : best, undefined)
  return {
    up,
    tracked: stocks.length,
    topMover: topMover ? { symbol: topMover.symbol, changePercent: topMover.changePercent } : undefined,
  }
}

/** Counts from the static, sourced sanctions dataset (OFAC/EU/UN/UK/…) — stable facts, not live figures. */
export function summarizeSanctionsHud() {
  return {
    sanctioned: SANCTIONED_COUNTRIES.length,
    critical: SANCTIONED_COUNTRIES.filter(c => c.severity === 'critical').length,
  }
}
