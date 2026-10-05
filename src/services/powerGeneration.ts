/**
 * Electricity generation by country and source — Ember yearly electricity data,
 * served as a flat CSV by Our World in Data's Grapher API (free, no key, the
 * same host and CSV shape owid.ts already uses).
 *
 * One row per country-year with a TWh column per source. We keep the most
 * recent year reported for each country and rank by total generation.
 *
 * https://ourworldindata.org/grapher/electricity-production-by-source
 */

const URL = 'https://ourworldindata.org/grapher/electricity-production-by-source.csv?v=1&csvType=full&useColumnShortNames=true'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export type PowerSource = 'coal' | 'gas' | 'oil' | 'nuclear' | 'hydro' | 'wind' | 'solar' | 'bioenergy' | 'other'

export const POWER_SOURCES: { id: PowerSource; label: string; fossil: boolean }[] = [
  { id: 'coal',      label: 'Coal',       fossil: true },
  { id: 'gas',       label: 'Gas',        fossil: true },
  { id: 'oil',       label: 'Oil',        fossil: true },
  { id: 'nuclear',   label: 'Nuclear',    fossil: false },
  { id: 'hydro',     label: 'Hydro',      fossil: false },
  { id: 'wind',      label: 'Wind',       fossil: false },
  { id: 'solar',     label: 'Solar',      fossil: false },
  { id: 'bioenergy', label: 'Bioenergy',  fossil: false },
  { id: 'other',     label: 'Other renewables', fossil: false },
]

// CSV column short-name prefix -> source id
const COLUMN_SOURCE: Record<string, PowerSource> = {
  coal_generation__twh: 'coal',
  gas_generation__twh: 'gas',
  oil_generation__twh: 'oil',
  nuclear_generation__twh: 'nuclear',
  hydro_generation__twh: 'hydro',
  wind_generation__twh: 'wind',
  solar_generation__twh: 'solar',
  bioenergy_generation__twh: 'bioenergy',
  other_renewables_excluding_bioenergy_generation__twh: 'other',
}

export interface PowerGenerationEntry {
  country: string
  code: string
  year: number
  /** Total generation, TWh */
  totalTwh: number
  /** TWh per source (missing sources are 0) */
  bySource: Record<PowerSource, number>
  /** Share of generation from non-fossil sources, 0–100 */
  lowCarbonPct: number
  rank: number
}

let cache: PowerGenerationEntry[] | null = null
let cachedAt = 0
let inflight: Promise<PowerGenerationEntry[]> | null = null

const emptySources = (): Record<PowerSource, number> =>
  ({ coal: 0, gas: 0, oil: 0, nuclear: 0, hydro: 0, wind: 0, solar: 0, bioenergy: 0, other: 0 })

export function parsePowerCsv(text: string): PowerGenerationEntry[] {
  const lines = text.split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  const cols: { index: number; source: PowerSource }[] = []
  header.forEach((name, index) => {
    const source = COLUMN_SOURCE[name.trim()]
    if (source) cols.push({ index, source })
  })
  if (cols.length === 0) return []

  const latest = new Map<string, Omit<PowerGenerationEntry, 'rank'>>()
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',')
    const [entity, code] = row
    const year = Number(row[2])
    // Ember's regional/income aggregates have no ISO code; "World" has OWID_WRL.
    if (!entity || !code || code.startsWith('OWID_') || !Number.isFinite(year)) continue

    const bySource = emptySources()
    let saw = false
    for (const { index, source } of cols) {
      const n = Number(row[index])
      if (row[index] === undefined || row[index] === '' || !Number.isFinite(n)) continue
      bySource[source] += n
      saw = true
    }
    if (!saw) continue
    const totalTwh = Object.values(bySource).reduce((a, b) => a + b, 0)
    if (totalTwh <= 0) continue

    const prev = latest.get(code)
    if (prev && prev.year >= year) continue
    const fossil = bySource.coal + bySource.gas + bySource.oil
    latest.set(code, { country: entity, code, year, totalTwh, bySource, lowCarbonPct: (1 - fossil / totalTwh) * 100 })
  }
  return Array.from(latest.values())
    .sort((a, b) => b.totalTwh - a.totalTwh)
    .map((e, i) => ({ ...e, rank: i + 1 }))
}

/** Countries ranked by total electricity generated (TWh), most recent year per country. Rejects on network/HTTP errors. */
export async function fetchPowerGenerationRanking(): Promise<PowerGenerationEntry[]> {
  if (cache && Date.now() - cachedAt < CACHE_TTL) return cache
  if (inflight) return inflight
  inflight = (async () => {
    const res = await fetch(URL, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`OWID API error ${res.status}`)
    cache = parsePowerCsv(await res.text())
    cachedAt = Date.now()
    return cache
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export function formatTwh(twh: number): string {
  if (twh >= 100) return `${Math.round(twh).toLocaleString()} TWh`
  if (twh >= 1) return `${twh.toFixed(1)} TWh`
  return `${(twh * 1000).toFixed(0)} GWh`
}
