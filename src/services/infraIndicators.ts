/**
 * Infrastructure access indicators by country — World Bank Open Data (free,
 * no key required), World Development Indicators. Same source family already
 * used in worldbank.ts and militaryPersonnel.ts.
 *
 * Ranking/map layer is keyed on electricity access (EG.ELC.ACCS.ZS) since
 * it's the indicator with the broadest country coverage; the rest are shown
 * as a per-country breakdown in the country drawer / dock panel.
 *
 * https://data.worldbank.org/topic/infrastructure
 */

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
  year: string
  rank: number
  indicators: InfraIndicatorValue[]
}

let cache: CountryInfraEntry[] | null = null
let cachePromise: Promise<CountryInfraEntry[]> | null = null
let cachedAt = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// World Bank aggregate/region codes to exclude — only real countries wanted
const NON_COUNTRY_ISO3 = new Set([
  'WLD','ARB','CSS','CEB','EAP','EAR','EAS','ECA','ECS','EMU','EUU','FCS',
  'HIC','HPC','IBD','IBT','IDA','IDB','IDX','INX','LAC','LCN','LDC','LIC',
  'LMC','LMY','LTE','MEA','MIC','MNA','NAC','OED','OSS','PRE','PSS','PST',
  'SAS','SSA','SSF','SST','TEA','TEC','TLA','TMN','TSA','TSS','UMC','AFE','AFW',
])

async function fetchIndicatorAllCountries(id: InfraIndicatorId): Promise<Map<string, { value: number; year: string; iso3: string; country: string }>> {
  const out = new Map<string, { value: number; year: string; iso3: string; country: string }>()
  const url = `${WB_BASE}/country/all/indicator/${id}?format=json&date=2010:2024&per_page=20000&MRV=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`World Bank API error ${res.status}`)
  const json = await res.json()
  const data = Array.isArray(json) && json.length === 2 ? json[1] : null
  if (!data || !Array.isArray(data)) throw new Error('Unexpected World Bank response shape')
  for (const d of data) {
    if (d.value == null || !d.countryiso3code || NON_COUNTRY_ISO3.has(d.countryiso3code)) continue
    const iso2 = d.country?.id as string
    if (!iso2 || out.has(iso2)) continue
    out.set(iso2, { value: d.value as number, year: d.date as string, iso3: d.countryiso3code, country: d.country?.value as string })
  }
  return out
}

/** Fetch infrastructure indicators for every country, ranked by electricity access (broadest coverage). */
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
          year: rankEntry.year,
          rank: 0,
          indicators,
        }
      })
      .sort((a, b) => b.electricityAccessPct - a.electricityAccessPct)
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
