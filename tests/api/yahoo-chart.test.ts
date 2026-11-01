import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler, { ALLOWED, HISTORY_FROM, parseChart, resetCache } from '../../api/yahoo-chart'
import { COUNTRY_FUNDS, BENCHMARK } from '../../src/services/countryFunds'
import { mockReq, mockRes, mockUpstream } from './helpers'

const chart = (ts: unknown[], closes: unknown[]) => ({
  chart: { result: [{ meta: { symbol: 'EWJ', longName: 'iShares MSCI Japan ETF', currency: 'USD' }, timestamp: ts, indicators: { adjclose: [{ adjclose: closes }] } }] },
})

describe('parseChart', () => {
  it('pairs timestamps with adjusted closes and drops days without a valid close', () => {
    expect(parseChart(chart([1, 2, 3, 4, 'x'], [10, null, 0, 12, 5]), 'EWJ')).toEqual({
      symbol: 'EWJ', name: 'iShares MSCI Japan ETF', currency: 'USD', points: [[1, 10], [4, 12]],
    })
  })
  it('returns null for an error payload or an empty series', () => {
    expect(parseChart({ chart: { result: null, error: { code: 'Not Found' } } }, 'X')).toBeNull()
    expect(parseChart(chart([], []), 'EWJ')).toBeNull()
    expect(parseChart('junk', 'EWJ')).toBeNull()
  })
})

describe('allow-list', () => {
  it('serves exactly the benchmark and every country fund the app uses', () => {
    expect([...ALLOWED].sort()).toEqual([BENCHMARK.symbol, ...new Set(COUNTRY_FUNDS.map(f => f.symbol))].sort())
  })
})

describe('GET /api/yahoo-chart', () => {
  beforeEach(() => resetCache())
  afterEach(() => vi.unstubAllGlobals())

  it('fetches the fixed daily-history URL for an allowed symbol', async () => {
    const fn = mockUpstream(chart([100, 200], [1, 2]))
    const r = mockRes()
    await handler(mockReq({ query: { symbol: 'ewj' } }), r.res)
    expect(r.statusCode()).toBe(200)
    expect(r.body()).toMatchObject({ symbol: 'EWJ', points: [[100, 1], [200, 2]] })
    const url = (fn.mock.calls[0] as unknown as [string])[0]
    expect(url).toMatch(new RegExp(`^https://query1\\.finance\\.yahoo\\.com/v8/finance/chart/EWJ\\?period1=${HISTORY_FROM}&period2=\\d+&interval=1d&events=div,split$`))
  })

  it('refuses symbols outside the allow-list without calling upstream — not an open proxy', async () => {
    const fn = mockUpstream({})
    for (const symbol of ['AAPL', '../../v7/finance/quote', 'EWJ?x=1', '']) {
      const r = mockRes()
      await handler(mockReq({ query: { symbol } }), r.res)
      expect(r.statusCode()).toBe(400)
    }
    expect(fn).not.toHaveBeenCalled()
  })

  it('serves repeat requests from memory', async () => {
    const fn = mockUpstream(chart([1], [1]))
    await handler(mockReq({ query: { symbol: 'ACWI' } }), mockRes().res)
    await handler(mockReq({ query: { symbol: 'ACWI' } }), mockRes().res)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('answers 502 on an upstream error or a network failure', async () => {
    mockUpstream('nope', { status: 429 })
    const r = mockRes()
    await handler(mockReq({ query: { symbol: 'EWJ' } }), r.res)
    expect(r.statusCode()).toBe(502)

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    const r2 = mockRes()
    await handler(mockReq({ query: { symbol: 'EWZ' } }), r2.res)
    expect(r2.statusCode()).toBe(502)
  })

  it('rejects non-GET methods', async () => {
    const r = mockRes()
    await handler(mockReq({ method: 'POST', query: { symbol: 'EWJ' } }), r.res)
    expect(r.statusCode()).toBe(405)
  })
})
