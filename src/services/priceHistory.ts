// Daily adjusted closes from Yahoo Finance, through api/yahoo-chart.ts (keyless; Yahoo sends no CORS headers).
// Only the symbols that proxy allows can be fetched. Cached per symbol for an hour: the history is long and gains one
// bar a day, and the desktop app can stay open for days.

export interface PriceSeries {
  symbol: string
  name: string
  /** [unix seconds of the trading day, dividend-adjusted close], oldest first */
  points: [number, number][]
}

const CACHE_MS = 60 * 60_000
const cache = new Map<string, { at: number; p: Promise<PriceSeries | null> }>()

function parse(json: unknown, symbol: string): PriceSeries | null {
  const j = json as { symbol?: unknown; name?: unknown; points?: unknown } | null
  if (!j || !Array.isArray(j.points)) return null
  const points = j.points.filter((p): p is [number, number] =>
    Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > 0)
  if (points.length === 0) return null
  points.sort((a, b) => a[0] - b[0])
  return { symbol, name: typeof j.name === 'string' ? j.name : symbol, points }
}

/** A fund's daily history, or null when it can't be loaded (a failed load is retried on the next call). */
export function fetchPriceHistory(symbol: string): Promise<PriceSeries | null> {
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.p
  const p = fetch(`/api/yahoo-chart?symbol=${encodeURIComponent(symbol)}`, { signal: AbortSignal.timeout(30_000) })
    .then(async r => (r.ok ? parse(await r.json(), symbol) : null))
    .catch(err => { console.warn(`[Yahoo] ${symbol}:`, err); return null })
    .then(s => { if (!s) cache.delete(symbol); return s })
  cache.set(symbol, { at: Date.now(), p })
  return p
}
