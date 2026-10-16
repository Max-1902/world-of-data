/**
 * Infrastructure access indicators by country — World Bank Open Data (free,
 * no key required), World Development Indicators. Same source family already
 * used in worldbank.ts and militaryPersonnel.ts.
 *
 * Countries are ranked by an access index: the mean of the four "% of
 * population" indicators (electricity, internet, drinking water, sanitation).
 * Electricity alone can't rank — ~100 countries sit at exactly 100 %, so the
 * order among them would just be the API's alphabetical order. Electricity
 * (EG.ELC.ACCS.ZS) still defines which countries are listed, being the
 * broadest-coverage indicator. All indicators are shown per country in the
 * country drawer / dock panel.
 *
 * https://data.worldbank.org/topic/infrastructure
 */

import { isWbEconomy } from './economies'

const WB_BASE = 'https://api.worldbank.org/v2'

const INDICATORS = {
  'EG.ELC.ACCS.ZS':    'Access to electricity (% of population)',
  'IT.NET.USER.ZS':    'Internet users (% of population)',
  'IT.CEL.SETS.P2':    'Mobile subscriptions (per 100 people)',
  'IS.AIR.PSGR':       'Air transport, passengers carried',
  'IS.RRS.TOTL.KM':    'Rail lines (total route-km)',
  'SH.H2O.BASW.ZS':    'Basic drinking water services (% of population)',
  'SH.STA.BASS.ZS':    'Basic sanitation services (% of population)',
} as const

export type InfraIndicatorId = keyof typeof INDICATORS
const RANK_INDICATOR: InfraIndicatorId = 'EG.ELC.ACCS.ZS'
/** The % of population indicators averaged into the access index. */
const INDEX_INDICATORS: InfraIndicatorId[] = ['EG.ELC.ACCS.ZS', 'IT.NET.USER.ZS', 'SH.H2O.BASW.ZS', 'SH.STA.BASS.ZS']
/** A country needs at least this many of them to get an index (and a real rank). */
const MIN_INDEX_INPUTS = 3

/** Mean of the available % indicators (each clamped to 0–100), or null when too few are reported. */
export function computeAccessIndex(indicators: { id: InfraIndicatorId; value: number }[]): number | null {
  const vals = indicators.filter(i => INDEX_INDICATORS.includes(i.id)).map(i => Math.min(100, Math.max(0, i.value)))
  if (vals.length < MIN_INDEX_INPUTS) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export interface InfraIndicatorValue {
  id: InfraIndicatorId
  label: string
  value: number
  year: string
}

export interface CountryInfraEntry {
  iso2: string
  iso3: string
  country: string
  electricityAccessPct: number
  /** Mean of electricity, internet, water and sanitation access (0–100); null if fewer than 3 are reported. */
  accessIndex: number | null
  year: string
  rank: number
  indicators: InfraIndicatorValue[]
}

let cache: CountryInfraEntry[] | null = null
let cachePromise: Promise<CountryInfraEntry[]> | null = null
let cachedAt = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function fetchIndicatorAllCountries(id: InfraIndicatorId): Promise<Map<string, { value: number; year: string; iso3: string; country: string }>> {
  const out = new Map<string, { value: number; year: string; iso3: string; country: string }>()
  const url = `${WB_BASE}/country/all/indicator/${id}?format=json&date=2010:2024&per_page=20000&MRV=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`World Bank API error ${res.status}`)
  const json = await res.json()
  const data = Array.isArray(json) && json.length === 2 ? json[1] : null
  if (!data || !Array.isArray(data)) throw new Error('Unexpected World Bank response shape')
  for (const d of data) {
    if (d.value == null || !isWbEconomy(d.countryiso3code)) continue
    const iso2 = d.country?.id as string
    if (!iso2 || out.has(iso2)) continue
    out.set(iso2, { value: d.value as number, year: d.date as string, iso3: d.countryiso3code, country: d.country?.value as string })
  }
  return out
}

/** Fetch infrastructure indicators for every country, ranked by access index. */
export async function fetchInfraIndicatorRanking(): Promise<CountryInfraEntry[]> {
  if (cache && Date.now() - cachedAt < CACHE_TTL) return cache
  if (cachePromise) return cachePromise

  cachePromise = (async () => {
    const ids = Object.keys(INDICATORS) as InfraIndicatorId[]
    const maps = await Promise.all(ids.map(id => fetchIndicatorAllCountries(id).catch(() => new Map())))
    const byId = new Map(ids.map((id, i) => [id, maps[i]]))
    const rankMap = byId.get(RANK_INDICATOR)!

    const entries: CountryInfraEntry[] = Array.from(rankMap.entries())
      .map(([iso2, rankEntry]) => {
        const indicators: InfraIndicatorValue[] = []
        for (const id of ids) {
          const m = byId.get(id)!
          const e = m.get(iso2)
          if (e) indicators.push({ id, label: INDICATORS[id], value: e.value, year: e.year })
        }
        return {
          iso2,
          iso3: rankEntry.iso3,
          country: rankEntry.country,
          electricityAccessPct: rankEntry.value,
          accessIndex: computeAccessIndex(indicators),
          year: rankEntry.year,
          rank: 0,
          indicators,
        }
      })
      // Countries without enough data go last; ties fall back to electricity, then name.
      .sort((a, b) => (b.accessIndex ?? -1) - (a.accessIndex ?? -1)
        || b.electricityAccessPct - a.electricityAccessPct
        || a.country.localeCompare(b.country))
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

export function formatInfraValue(id: InfraIndicatorId, val: number): string {
  if (id === 'IS.AIR.PSGR') {
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
    if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`
    return val.toFixed(0)
  }
  if (id === 'IS.RRS.TOTL.KM') {
    return `${Math.round(val).toLocaleString()} km`
  }
  if (id === 'IT.CEL.SETS.P2') {
    return `${val.toFixed(1)} /100`
  }
  if (id.endsWith('.ZS')) {
    return `${val.toFixed(1)}%`
  }
  return val.toFixed(1)
}
