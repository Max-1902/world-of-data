/**
 * The two Eurostat series the GDP nowcast (utils/nowcast.ts) reads, for one European economy: quarterly real GDP
 * growth (namq_10_gdp) and monthly industrial production (sts_inpr_m). Free, keyless, CORS-enabled (the same API
 * services/europeMacro.ts uses). Cached per economy for an hour; concurrent calls share one request.
 */
import { parseEurostat, type Month, type Quarter } from '../utils/nowcast'

const ESTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'
const CACHE_MS = 60 * 60_000
const TIMEOUT_MS = 30_000

/** EU member states by Eurostat geo code (Greece is EL in Eurostat, not GR). */
export const NOWCAST_ECONOMIES: { geo: string; name: string }[] = [
  { geo: 'AT', name: 'Austria' }, { geo: 'BE', name: 'Belgium' }, { geo: 'BG', name: 'Bulgaria' }, { geo: 'HR', name: 'Croatia' },
  { geo: 'CY', name: 'Cyprus' }, { geo: 'CZ', name: 'Czechia' }, { geo: 'DK', name: 'Denmark' }, { geo: 'EE', name: 'Estonia' },
  { geo: 'FI', name: 'Finland' }, { geo: 'FR', name: 'France' }, { geo: 'DE', name: 'Germany' }, { geo: 'EL', name: 'Greece' },
  { geo: 'HU', name: 'Hungary' }, { geo: 'IE', name: 'Ireland' }, { geo: 'IT', name: 'Italy' }, { geo: 'LV', name: 'Latvia' },
  { geo: 'LT', name: 'Lithuania' }, { geo: 'LU', name: 'Luxembourg' }, { geo: 'MT', name: 'Malta' }, { geo: 'NL', name: 'Netherlands' },
  { geo: 'PL', name: 'Poland' }, { geo: 'PT', name: 'Portugal' }, { geo: 'RO', name: 'Romania' }, { geo: 'SK', name: 'Slovakia' },
  { geo: 'SI', name: 'Slovenia' }, { geo: 'ES', name: 'Spain' }, { geo: 'SE', name: 'Sweden' },
]

export interface NowcastData {
  gdp: Map<Quarter, number>
  ip: Map<Month, number>
  /** when Eurostat last updated each dataset, as it states it */
  updated: { gdp: string | null; ip: string | null }
}

async function get(url: string): Promise<{ series: Map<string, number>; updated: string | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Eurostat HTTP ${res.status}`)
  const json = await res.json() as { updated?: unknown }
  return { series: parseEurostat(json), updated: typeof json?.updated === 'string' ? json.updated : null }
}

const cache = new Map<string, { at: number; data: NowcastData }>()
const inflight = new Map<string, Promise<NowcastData>>()

/** Both series for one economy. Rejects on a failed request or an unexpected payload. */
export function fetchNowcastData(geo: string): Promise<NowcastData> {
  const hit = cache.get(geo)
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data)
  const running = inflight.get(geo)
  if (running) return running
  const g = encodeURIComponent(geo)
  const p = Promise.all([
    get(`${ESTAT}/namq_10_gdp?format=JSON&lang=EN&geo=${g}&unit=CLV_PCH_PRE&s_adj=SCA&na_item=B1GQ&sinceTimePeriod=1995-Q1`),
    get(`${ESTAT}/sts_inpr_m?format=JSON&lang=EN&geo=${g}&unit=I21&s_adj=SCA&nace_r2=B-D&indic_bt=PRD&sinceTimePeriod=1995-01`),
  ]).then(([gdp, ip]) => {
    const data: NowcastData = { gdp: gdp.series as Map<Quarter, number>, ip: ip.series as Map<Month, number>, updated: { gdp: gdp.updated, ip: ip.updated } }
    cache.set(geo, { at: Date.now(), data })
    return data
  }).finally(() => inflight.delete(geo))
  inflight.set(geo, p)
  return p
}
