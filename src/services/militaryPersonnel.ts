import type { WorldBankObservation } from './worldbank'
import { isWbEconomy } from './economies'
/**
 * Armed forces personnel by country — World Bank Open Data (free, no key
 * required). Indicator MS.MIL.TOTL.P1, sourced by World Bank from IISS
 * "The Military Balance" — same indicator family as MS.MIL.XPND.GD.ZS
 * (military spending % GDP) already used in worldbank.ts.
 *
 * https://data.worldbank.org/indicator/MS.MIL.TOTL.P1
 */

const WB_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'MS.MIL.TOTL.P1'

export interface MilitaryPersonnelEntry {
  iso2: string
  iso3: string
  country: string
  personnel: number
  year: string
  rank: number
}

let cache: MilitaryPersonnelEntry[] | null = null
let cachePromise: Promise<MilitaryPersonnelEntry[]> | null = null
let cachedAt = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/** Fetch armed-forces personnel for every country in one World Bank call, ranked descending (strongest military first). */
export async function fetchMilitaryPersonnelRanking(): Promise<MilitaryPersonnelEntry[]> {
  if (cache && Date.now() - cachedAt < CACHE_TTL) return cache
  if (cachePromise) return cachePromise

  cachePromise = (async () => {
    const url = `${WB_BASE}/country/all/indicator/${INDICATOR}?format=json&date=2015:2024&per_page=20000&MRV=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`World Bank API error ${res.status}`)
    const json = await res.json()
    const data = Array.isArray(json) && json.length === 2 ? json[1] : null
    if (!data || !Array.isArray(data)) throw new Error('Unexpected World Bank response shape')

    const entries: MilitaryPersonnelEntry[] = (data as WorldBankObservation[])
      .filter(d => d.value != null && isWbEconomy(d.countryiso3code))
      .map(d => ({
        iso2: d.country?.id as string,
        iso3: d.countryiso3code as string,
        country: d.country?.value as string,
        personnel: d.value as number,
        year: d.date as string,
        rank: 0,
      }))
      .sort((a, b) => b.personnel - a.personnel)
      .map((e, i) => ({ ...e, rank: i + 1 }))

    cache = entries
    cachedAt = Date.now()
    return entries
  })()

  try {
    return await cachePromise
  } finally {
    cachePromise = null
  }
}

export function formatPersonnel(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toFixed(0)
}
