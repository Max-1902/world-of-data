import type { Stock } from '../types'
import { SANCTIONED_COUNTRIES } from '../services/sanctions'

export interface MarketHudSummary {
  /** Hubs with a positive change, out of every hub that actually returned a quote this session. */
  up: number
  /** Hubs that returned a quote this session (may be fewer than the 10 tracked hubs while data is loading). */
  tracked: number
  /** Largest absolute % move among tracked hubs; undefined once none have reported yet. */
  topMover?: { symbol: string; changePercent: number }
  /** Oldest last-trade time among the quotes (ISO), so a weekend's Friday close isn't read as today's move. */
  asOf?: string
}

/**
 * What to show instead of a number when there are no quotes: why, in a few letters, plus a tooltip.
 * "—" alone read as "broken" or "nothing happening" (audit 2026-10-15).
 */
export function marketHudPlaceholder(health: { status: string; lastError: string | null } | undefined): { value: string; title: string } {
  if (!health) return { value: '…', title: 'Market quotes not requested yet (Finnhub)' }
  if (health.status === 'down') return { value: 'N/A', title: `Finnhub not responding${health.lastError ? ` (${health.lastError})` : ''}: no market data` }
  return { value: '…', title: 'Waiting for Finnhub quotes' }
}

/** Market-hub HUD stats — pure function over whatever `useStocks` has fetched so far. */
export function summarizeMarketHud(stocks: Stock[]): MarketHudSummary {
  const up = stocks.filter(s => s.changePercent > 0).length
  const topMover = stocks.reduce<Stock | undefined>((best, s) =>
    !best || Math.abs(s.changePercent) > Math.abs(best.changePercent) ? s : best, undefined)
  const times = stocks.map(s => Date.parse(s.lastUpdated)).filter(Number.isFinite)
  return {
    up,
    tracked: stocks.length,
    topMover: topMover ? { symbol: topMover.symbol, changePercent: topMover.changePercent } : undefined,
    asOf: times.length ? new Date(Math.min(...times)).toISOString() : undefined,
  }
}

/** Counts from the static, sourced sanctions dataset (OFAC/EU/UN/UK/…) — stable facts, not live figures. */
export function summarizeSanctionsHud() {
  return {
    sanctioned: SANCTIONED_COUNTRIES.length,
    critical: SANCTIONED_COUNTRIES.filter(c => c.severity === 'critical').length,
  }
}
