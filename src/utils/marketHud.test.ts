import { describe, it, expect } from 'vitest'
import { marketHudPlaceholder, summarizeMarketHud, summarizeSanctionsHud } from './marketHud'
import type { Stock } from '../types'

const stock = (symbol: string, changePercent: number): Stock => ({
  symbol, name: symbol, price: 100, change: 0, changePercent,
  high: 0, low: 0, open: 0, previousClose: 0, currency: 'USD', exchange: '', lastUpdated: '2026-01-01T00:00:00Z',
})

describe('summarizeMarketHud', () => {
  it('counts hubs up and finds the largest absolute mover', () => {
    const result = summarizeMarketHud([stock('SPY', 0.5), stock('FXI', -2.1), stock('EWZ', 1.8)])
    expect(result.up).toBe(2)
    expect(result.tracked).toBe(3)
    expect(result.topMover).toEqual({ symbol: 'FXI', changePercent: -2.1 })
  })

  it('returns no top mover when nothing has loaded yet', () => {
    const result = summarizeMarketHud([])
    expect(result.up).toBe(0)
    expect(result.tracked).toBe(0)
    expect(result.topMover).toBeUndefined()
  })

  it('does not count a flat quote as up', () => {
    const result = summarizeMarketHud([stock('SPY', 0)])
    expect(result.up).toBe(0)
  })
})

describe('summarizeSanctionsHud', () => {
  it('counts sanctioned countries and the critical-severity subset from the curated dataset', () => {
    const result = summarizeSanctionsHud()
    expect(result.sanctioned).toBeGreaterThan(0)
    expect(result.critical).toBeGreaterThan(0)
    expect(result.critical).toBeLessThanOrEqual(result.sanctioned)
  })
})

describe('empty market HUD', () => {
  it('says why there is no value instead of a bare dash', () => {
    expect(marketHudPlaceholder(undefined)).toEqual({ value: '…', title: 'Market quotes not requested yet (Finnhub)' })
    expect(marketHudPlaceholder({ status: 'down', lastError: 'HTTP 401' })).toEqual({ value: 'N/A', title: 'Finnhub not responding (HTTP 401): no market data' })
    expect(marketHudPlaceholder({ status: 'degraded', lastError: null }).value).toBe('…')
  })

  it('reports the oldest last-trade time, so a stale close is visible', () => {
    const s = (symbol: string, at: string) => ({ symbol, changePercent: 1, lastUpdated: at }) as Stock
    expect(summarizeMarketHud([s('SPY', '2026-10-16T20:00:00Z'), s('EWJ', '2026-10-16T06:00:00Z')]).asOf).toBe('2026-10-16T06:00:00.000Z')
    expect(summarizeMarketHud([]).asOf).toBeUndefined()
  })
})
