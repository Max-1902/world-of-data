/**
 * IMF World Economic Outlook figures (through /api/imf-weo, which only exists because the IMF API sends no CORS
 * headers). Free and keyless. Used as the external benchmark next to the Predictions panel's own forecasts: the
 * cross-country backtest found the IMF's October WEO beats this app's GDP model in most economies, so it is shown,
 * not hidden.
 *
 * The API does not say, per country, which years are IMF estimates and which are projections. A year from the
 * edition's own year on (2026 in the October 2026 edition) is a projection; earlier years may be either.
 */
/** What /api/imf-weo returns (shape defined in api/imf-weo.ts). */
export interface WeoPayload {
  indicator: 'NGDP_RPCH' | 'PCPIPCH' | 'LUR'
  label: string
  unit: string
  /** the edition, as the IMF states it ("World Economic Outlook (October 2026)") */
  vintage: string
  lastModified: string | null
  /** ISO3 → year → value */
  values: Record<string, Record<string, number>>
}

/** World Bank series → the WEO indicator that measures the same thing. */
export const WEO_FOR_WB: Record<string, WeoPayload['indicator']> = {
  'NY.GDP.MKTP.KD.ZG': 'NGDP_RPCH',
  'FP.CPI.TOTL.ZG': 'PCPIPCH',
  'SL.UEM.TOTL.ZS': 'LUR',
}

const CACHE_MS = 6 * 60 * 60_000
const cache = new Map<string, { at: number; data: WeoPayload }>()
const inflight = new Map<string, Promise<WeoPayload | null>>()

/** One WEO indicator for every country, or null when the request fails (cached six hours, concurrent calls share one). */
export function fetchWeo(indicator: WeoPayload['indicator']): Promise<WeoPayload | null> {
  const hit = cache.get(indicator)
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data)
  const running = inflight.get(indicator)
  if (running) return running
  const p = (async () => {
    try {
      const res = await fetch(`/api/imf-weo?indicator=${indicator}`, { signal: AbortSignal.timeout(25_000) })
      if (!res.ok) return null
      const data = await res.json() as WeoPayload
      if (!data || typeof data.values !== 'object' || typeof data.vintage !== 'string') return null
      cache.set(indicator, { at: Date.now(), data })
      return data
    } catch { return null }
  })().finally(() => inflight.delete(indicator))
  inflight.set(indicator, p)
  return p
}

/** The edition's year ("World Economic Outlook (October 2026)" → 2026), or null if it doesn't state one. */
export function vintageYear(vintage: string): number | null {
  const m = vintage.match(/(19|20)\d{2}/g)
  return m ? Number(m[m.length - 1]) : null
}

/** One country's WEO values for the given years; a year from the edition's year on is marked as a projection. */
export function weoPoints(data: WeoPayload, iso3: string, years: number[]): { year: number; value: number; projection: boolean }[] {
  const row = data.values[iso3]
  if (!row) return []
  const vy = vintageYear(data.vintage)
  return years.flatMap(y => {
    const v = row[String(y)]
    return typeof v === 'number' ? [{ year: y, value: v, projection: vy !== null && y >= vy }] : []
  })
}
