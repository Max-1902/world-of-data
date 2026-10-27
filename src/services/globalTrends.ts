export interface GlobalTrendPoint {
  year: number
  value: number
}

const WORLD_BANK = 'https://api.worldbank.org/v2/country/WLD/indicator'
const cache = new Map<string, { at: number; points: GlobalTrendPoint[] }>()
const inflight = new Map<string, Promise<GlobalTrendPoint[]>>()
const TTL = 60 * 60 * 1000

/** Annual World Bank series for the World aggregate, used by the home page trend cards. */
export function fetchGlobalTrend(indicator: string): Promise<GlobalTrendPoint[]> {
  const cached = cache.get(indicator)
  if (cached && Date.now() - cached.at < TTL) return Promise.resolve(cached.points)
  const active = inflight.get(indicator)
  if (active) return active

  const promise = (async () => {
    const firstYear = Math.max(1960, new Date().getUTCFullYear() - 30)
    const lastYear = new Date().getUTCFullYear()
    const url = `${WORLD_BANK}/${encodeURIComponent(indicator)}?format=json&date=${firstYear}:${lastYear}&per_page=100`
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`World Bank HTTP ${response.status}`)
    const payload: unknown = await response.json()
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) return []
    const points = (payload[1] as Array<{ date?: string; value?: number | null }>)
      .map(row => ({ year: Number(row.date), value: row.value }))
      .filter((row): row is GlobalTrendPoint => Number.isInteger(row.year) && typeof row.value === 'number' && Number.isFinite(row.value))
      .sort((a, b) => a.year - b.year)
    cache.set(indicator, { at: Date.now(), points })
    return points
  })().finally(() => inflight.delete(indicator))

  inflight.set(indicator, promise)
  return promise
}
