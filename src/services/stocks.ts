import type { Stock, StockCandle } from '../types'

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || ''
const BASE = 'https://finnhub.io/api/v1'

// ── Static name lookup (avoids profile2 API call, halving request count) ──────
const SYMBOL_NAMES: Record<string, string> = {
  // Indices / broad ETFs
  SPY:'S&P 500 ETF', QQQ:'Nasdaq 100 ETF', DIA:'Dow Jones ETF', IWM:'Russell 2000 ETF',
  EEM:'Emerging Markets ETF', VGK:'Europe ETF', EWU:'UK ETF', EWG:'Germany ETF',
  EWJ:'Japan ETF', EWH:'Hong Kong ETF', FXI:'China Large-Cap ETF', EWZ:'Brazil ETF',
  EWA:'Australia ETF', EWC:'Canada ETF',
  // Commodities
  GLD:'Gold ETF', SLV:'Silver ETF', GSG:'Commodities ETF', PDBC:'Commodities ETF',
  CPER:'Copper ETF', WEAT:'Wheat ETF', CORN:'Corn ETF', UNG:'Natural Gas ETF',
  DBA:'Agriculture ETF', SOYB:'Soybean ETF',
  // Energy
  XLE:'Energy Select ETF', USO:'Oil ETF', CVX:'Chevron', XOM:'ExxonMobil',
  BP:'BP plc', SLB:'SLB (Schlumberger)', HAL:'Halliburton', ENB:'Enbridge',
  MPC:'Marathon Petroleum', OIH:'Oil Services ETF',
  // Tech
  XLK:'Technology ETF', AAPL:'Apple', MSFT:'Microsoft', NVDA:'NVIDIA',
  AMD:'AMD', GOOGL:'Alphabet', META:'Meta', AMZN:'Amazon', TSLA:'Tesla', INTC:'Intel',
  // Healthcare
  XLV:'Healthcare ETF', JNJ:'Johnson & Johnson', PFE:'Pfizer', UNH:'UnitedHealth',
  ABT:'Abbott Labs', MRK:'Merck', BMY:'Bristol-Myers Squibb', AMGN:'Amgen',
  GILD:'Gilead Sciences', LLY:'Eli Lilly',
  // Defense
  ITA:'Defense ETF', LMT:'Lockheed Martin', RTX:'RTX Corp', NOC:'Northrop Grumman',
  GD:'General Dynamics', BA:'Boeing', HII:'Huntington Ingalls', LDOS:'Leidos',
  KTOS:'Kratos Defense', AXON:'Axon Enterprise',
  // Bonds
  TLT:'20Y Treasury ETF', IEF:'7-10Y Treasury ETF', SHY:'1-3Y Treasury ETF',
  HYG:'High Yield Bond ETF', LQD:'Corp Bond ETF', BND:'Total Bond ETF',
  EMB:'EM Bond ETF', TIPS:'TIPS ETF',
}

// ── Global deduplicating batch pool ───────────────────────────────────────────
// All StockList panels share this queue → no duplicate requests, no rate-limit bursts.
type Resolver = (result: Stock | null) => void
const symbolQueue = new Map<string, Resolver[]>()
let batchTimer: ReturnType<typeof setTimeout> | null = null

async function runBatch() {
  batchTimer = null
  const symbols = [...symbolQueue.keys()]
  if (symbols.length === 0) return

  // Process in batches of 5 with 1.2 s gap → ~50 req/min (well under 60 limit)
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5)
    const results = await Promise.allSettled(batch.map(fetchQuoteRaw))
    batch.forEach((sym, idx) => {
      const val = results[idx].status === 'fulfilled' ? results[idx].value : null
      const resolvers = symbolQueue.get(sym) ?? []
      symbolQueue.delete(sym)
      resolvers.forEach(fn => fn(val))
    })
    if (i + 5 < symbols.length) await new Promise(r => setTimeout(r, 1200))
  }
}

// Raw single-symbol fetch (quote only — no profile2)
async function fetchQuoteRaw(symbol: string): Promise<Stock | null> {
  if (!FINNHUB_KEY) return null
  try {
    const res = await fetch(`${BASE}/quote?symbol=${symbol}&token=${FINNHUB_KEY}`)
    if (!res.ok) throw new Error(`Finnhub ${res.status}`)
    const q = await res.json()
    if (q.c == null || q.c === 0) return null
    return {
      symbol,
      name:          SYMBOL_NAMES[symbol] ?? symbol,
      price:         q.c,
      change:        q.d  ?? 0,
      changePercent: q.dp ?? 0,
      high:          q.h  ?? 0,
      low:           q.l  ?? 0,
      open:          q.o  ?? 0,
      previousClose: q.pc ?? 0,
      currency:      'USD',
      exchange:      '',
      lastUpdated:   new Date().toISOString(),
    } satisfies Stock
  } catch (err) {
    console.warn(`[Finnhub] ${symbol}:`, err)
    return null
  }
}

// Public fetchQuote — goes through the shared global pool
export async function fetchQuote(symbol: string): Promise<Stock | null> {
  if (!FINNHUB_KEY) return null
  return new Promise(resolve => {
    if (!symbolQueue.has(symbol)) symbolQueue.set(symbol, [])
    symbolQueue.get(symbol)!.push(resolve)
    // Collect all symbols arriving within 150 ms then process together
    if (!batchTimer) batchTimer = setTimeout(runBatch, 150)
  })
}

export async function fetchMultipleQuotes(symbols: string[]): Promise<Stock[]> {
  const results = await Promise.all(symbols.map(fetchQuote))
  return results.filter((r): r is Stock => r !== null)
}

// ── Candles ───────────────────────────────────────────────────────────────────
export async function fetchCandles(
  symbol: string,
  resolution = 'D',
  days = 30
): Promise<StockCandle[]> {
  if (!FINNHUB_KEY) return []
  try {
    const to   = Math.floor(Date.now() / 1000)
    const from = to - days * 86400
    const res  = await fetch(
      `${BASE}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    )
    if (!res.ok) throw new Error(`Finnhub candles ${res.status}`)
    const data = await res.json()
    if (data.s !== 'ok') return []
    return data.t.map((t: number, i: number) => ({
      time:   t * 1000,
      open:   data.o[i],
      high:   data.h[i],
      low:    data.l[i],
      close:  data.c[i],
      volume: data.v[i],
    }))
  } catch (err) {
    console.warn(`[Finnhub candles] ${symbol}:`, err)
    return []
  }
}

export async function searchSymbol(query: string): Promise<{ symbol: string; name: string }[]> {
  if (!FINNHUB_KEY) return []
  try {
    const res  = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.result || [])
      .slice(0, 10)
      .map((r: { symbol: string; description: string }) => ({ symbol: r.symbol, name: r.description }))
  } catch {
    return []
  }
}

// Major global exchanges with their flagship indices
export const MARKET_HUBS: { symbol: string; name: string; lat: number; lng: number; exchange: string }[] = [
  { symbol: 'SPY', name: 'S&P 500 (NYSE)',       lat:  40.7074, lng:  -74.0113, exchange: 'NYSE'    },
  { symbol: 'QQQ', name: 'NASDAQ 100',            lat:  40.7587, lng:  -73.9787, exchange: 'NASDAQ'  },
  { symbol: 'EWU', name: 'FTSE 100 (LSE)',        lat:  51.5155, lng:   -0.0922, exchange: 'LSE'     },
  { symbol: 'EWG', name: 'DAX (Frankfurt)',        lat:  50.1109, lng:    8.6821, exchange: 'XETRA'   },
  { symbol: 'EWJ', name: 'Nikkei 225 (Tokyo)',    lat:  35.6762, lng:  139.6503, exchange: 'TSE'     },
  { symbol: 'EWH', name: 'Hang Seng (HK)',        lat:  22.2793, lng:  114.1628, exchange: 'HKEX'    },
  { symbol: 'FXI', name: 'CSI 300 (Shanghai)',    lat:  31.2304, lng:  121.4737, exchange: 'SSE'     },
  { symbol: 'EWZ', name: 'Bovespa (São Paulo)',   lat: -23.5505, lng:  -46.6333, exchange: 'B3'      },
  { symbol: 'EWA', name: 'ASX 200 (Sydney)',      lat: -33.8688, lng:  151.2093, exchange: 'ASX'     },
  { symbol: 'EWC', name: 'TSX (Toronto)',         lat:  43.6532, lng:  -79.3832, exchange: 'TSX'     },
]
