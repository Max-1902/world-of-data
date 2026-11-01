// Vercel serverless function — daily price history from Yahoo Finance's public chart endpoint.
// query1.finance.yahoo.com/v8/finance/chart needs no key and no account, so nothing can bill, but it sends no CORS
// headers, so the browser can't read it directly. It is an unofficial, undocumented endpoint: Yahoo can change or
// block it without notice, and its terms cover personal use. The app credits Yahoo Finance wherever it shows the data.
//
// Not an open proxy: only the symbols in ALLOWED are served, always as dividend-adjusted daily closes from
// HISTORY_FROM onward, returned as { symbol, name, currency, points: [[unixSeconds, adjClose], …] }. Each symbol is
// kept in memory for CACHE_MS, so a busy deploy asks upstream at most a few times a day.
import type { VercelRequest, VercelResponse } from '@vercel/node'

/** The world benchmark plus the single-country funds in src/services/countryFunds.ts (a test keeps them in step). */
export const ALLOWED = new Set([
  'ACWI',
  'ARGT', 'ECH', 'EIDO', 'EIS', 'ENZL', 'EPHE', 'EPOL', 'EPU', 'EWA', 'EWC', 'EWG', 'EWH', 'EWI', 'EWJ', 'EWL', 'EWM',
  'EWP', 'EWQ', 'EWS', 'EWT', 'EWU', 'EWW', 'EWY', 'EWZ', 'EZA', 'GREK', 'INDA', 'MCHI', 'THD', 'TUR', 'VNM',
])

/** 2008-01-01 UTC: just before ACWI, the benchmark, starts trading (2008-03-28). */
export const HISTORY_FROM = 1199145600
const TIMEOUT_MS = 15_000
const CACHE_MS = 6 * 60 * 60_000
const MAX_BYTES = 3_000_000

export interface ChartPayload { symbol: string; name: string; currency: string; points: [number, number][] }

interface RawChart {
  chart?: {
    result?: {
      meta?: {
        symbol?: string; longName?: string; shortName?: string; currency?: string
        currentTradingPeriod?: { regular?: { start?: number; end?: number } }
      }
      timestamp?: unknown[]
      indicators?: { adjclose?: { adjclose?: unknown[] }[] }
    }[] | null
  }
}

/**
 * Yahoo's chart JSON → the compact payload; days without a valid close are dropped, not filled. Historical bars are
 * stamped at the session open; the current session's bar is stamped with its latest trade instead, and until the
 * session closes its "close" is a live price. So that bar is dropped while the session is open and re-stamped to the
 * session open once it has closed, keeping one timestamp convention for every bar.
 */
export function parseChart(json: unknown, symbol: string, nowS = Date.now() / 1000): ChartPayload | null {
  const r = (json as RawChart | null)?.chart?.result?.[0]
  const ts = r?.timestamp
  const closes = r?.indicators?.adjclose?.[0]?.adjclose
  if (!r || !Array.isArray(ts) || !Array.isArray(closes)) return null
  const session = r.meta?.currentTradingPeriod?.regular
  const start = session?.start, end = session?.end
  const points: [number, number][] = []
  for (let i = 0; i < ts.length; i++) {
    const raw = ts[i], c = closes[i]
    if (typeof raw !== 'number' || !Number.isFinite(raw) || typeof c !== 'number' || !Number.isFinite(c) || c <= 0) continue
    let t = raw
    if (typeof start === 'number' && typeof end === 'number' && t >= start) {
      if (nowS < end) continue
      t = start
    }
    points.push([t, c])
  }
  if (points.length === 0) return null
  return { symbol, name: r.meta?.longName || r.meta?.shortName || symbol, currency: r.meta?.currency ?? '', points }
}

const cache = new Map<string, { at: number; payload: ChartPayload }>()

export function resetCache() { cache.clear() }

async function load(symbol: string): Promise<ChartPayload | null> {
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.payload
  const to = Math.floor(Date.now() / 1000)
  const upstream = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${HISTORY_FROM}&period2=${to}&interval=1d&events=div,split`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (WorldOfData)', Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) },
  )
  if (!upstream.ok) throw new Error(`Yahoo Finance HTTP ${upstream.status}`)
  const text = await upstream.text()
  if (text.length > MAX_BYTES) throw new Error('Yahoo Finance response unexpectedly large')
  const payload = parseChart(JSON.parse(text), symbol)
  if (payload) cache.set(symbol, { at: Date.now(), payload })
  return payload
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const raw = req.query.symbol
  const symbol = (Array.isArray(raw) ? raw[0] : raw ?? '').toUpperCase()
  if (!ALLOWED.has(symbol)) return res.status(400).json({ error: 'symbol not served' })
  try {
    const payload = await load(symbol)
    if (!payload) return res.status(502).json({ error: 'no price history returned' })
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
    return res.status(200).json(payload)
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'Yahoo Finance request failed' })
  }
}
