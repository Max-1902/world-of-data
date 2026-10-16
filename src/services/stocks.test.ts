import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch, jsonResponse, quietConsole } from '../test/helpers'

// stocks.ts keeps a module-level request queue — reload it for each test.
async function load() {
  vi.resetModules()
  return import('./stocks')
}

const T = 1_760_000_000 // a trade time, unix seconds
const quote = (c: number, extra: Record<string, number> = {}) => ({ c, d: 1, dp: 0.5, h: c + 1, l: c - 1, o: c, pc: c - 1, t: T, ...extra })

describe('fetchQuote / fetchMultipleQuotes', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())

  it('maps a Finnhub quote to a Stock with a friendly name', async () => {
    mockFetch(() => jsonResponse(quote(500)))
    const { fetchQuote } = await load()
    const p = fetchQuote('SPY')
    await vi.advanceTimersByTimeAsync(150)
    expect(await p).toMatchObject({
      symbol: 'SPY', name: 'S&P 500 ETF', price: 500, change: 1, changePercent: 0.5,
      high: 501, low: 499, open: 500, previousClose: 499, currency: 'USD',
    })
  })

  it('falls back to the ticker as the name for unknown symbols', async () => {
    mockFetch(() => jsonResponse(quote(10)))
    const { fetchQuote } = await load()
    const p = fetchQuote('ZZZZ')
    await vi.advanceTimersByTimeAsync(150)
    expect((await p)!.name).toBe('ZZZZ')
  })

  it('returns null for zero/missing prices (unknown symbol or market data unavailable)', async () => {
    mockFetch(() => jsonResponse({ c: 0, d: null, dp: null }))
    const { fetchQuote } = await load()
    const p = fetchQuote('NOPE')
    await vi.advanceTimersByTimeAsync(150)
    expect(await p).toBeNull()
  })

  it.each(['d', 'dp', 'h', 'l', 'o', 'pc', 't'])('drops a quote missing %s instead of inventing 0 (regression: "0.0%" for unknown change)', async (field) => {
    const q: Record<string, unknown> = quote(42)
    q[field] = null
    mockFetch(() => jsonResponse(q))
    const { fetchQuote } = await load()
    const p = fetchQuote('AAPL')
    await vi.advanceTimersByTimeAsync(150)
    expect(await p).toBeNull()
  })

  it('stamps the quote with Finnhub\'s trade time, not the fetch time', async () => {
    mockFetch(() => jsonResponse(quote(42)))
    const { fetchQuote } = await load()
    const p = fetchQuote('AAPL')
    await vi.advanceTimersByTimeAsync(150)
    expect((await p)!.lastUpdated).toBe(new Date(T * 1000).toISOString())
  })

  it('returns null on HTTP errors without rejecting', async () => {
    mockFetch(() => jsonResponse({}, { status: 429 }))
    const { fetchQuote } = await load()
    const p = fetchQuote('SPY')
    await vi.advanceTimersByTimeAsync(150)
    expect(await p).toBeNull()
  })

  it('de-duplicates concurrent requests for the same symbol into one network call', async () => {
    const fetchMock = mockFetch(() => jsonResponse(quote(100)))
    const { fetchQuote } = await load()
    const [a, b] = [fetchQuote('QQQ'), fetchQuote('QQQ')]
    await vi.advanceTimersByTimeAsync(150)
    const [ra, rb] = await Promise.all([a, b])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(ra).toEqual(rb)
    expect(ra!.price).toBe(100)
  })

  it('throttles large batches: five symbols per burst, 1.2s apart', async () => {
    const fetchMock = mockFetch(() => jsonResponse(quote(1)))
    const { fetchMultipleQuotes } = await load()
    const symbols = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2']
    const p = fetchMultipleQuotes(symbols)
    await vi.advanceTimersByTimeAsync(150)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    await vi.advanceTimersByTimeAsync(1_199)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(7)
    expect(await p).toHaveLength(7)
  })

  it('fetchMultipleQuotes omits symbols that failed', async () => {
    mockFetch(url => url.includes('symbol=BAD') ? jsonResponse({ c: 0 }) : jsonResponse(quote(5)))
    const { fetchMultipleQuotes } = await load()
    const p = fetchMultipleQuotes(['GOOD', 'BAD'])
    await vi.advanceTimersByTimeAsync(150)
    expect((await p).map(s => s.symbol)).toEqual(['GOOD'])
  })
})

describe('searchSymbol', () => {
  beforeEach(() => quietConsole())

  it('maps results, caps at 10, and URL-encodes the query', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ result: Array.from({ length: 15 }, (_, i) => ({ symbol: `S${i}`, description: `Name ${i}` })) }))
    const { searchSymbol } = await load()
    const results = await searchSymbol('a&b c')
    expect(results).toHaveLength(10)
    expect(results[0]).toEqual({ symbol: 'S0', name: 'Name 0' })
    expect(String(fetchMock.mock.calls[0][0])).toContain('q=a%26b%20c')
  })

  it('returns [] on failure or when result is absent', async () => {
    const { searchSymbol } = await load()
    mockFetch(() => jsonResponse({}))
    expect(await searchSymbol('x')).toEqual([])
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await searchSymbol('x')).toEqual([])
    mockFetch(() => { throw new Error('offline') })
    expect(await searchSymbol('x')).toEqual([])
  })
})

describe('MARKET_HUBS', () => {
  it('has valid, unique coordinates and symbols', async () => {
    const { MARKET_HUBS } = await load()
    expect(new Set(MARKET_HUBS.map(h => h.symbol)).size).toBe(MARKET_HUBS.length)
    for (const h of MARKET_HUBS) {
      expect(Math.abs(h.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(h.lng)).toBeLessThanOrEqual(180)
    }
  })
})
