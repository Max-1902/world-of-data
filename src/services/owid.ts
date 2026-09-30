/**
 * Our World in Data — Grapher CSV API. Free, no key required, no rate limit
 * documented. Same "per-country ranking from a global CSV" pattern as
 * worldbank.ts / infraIndicators.ts, just with OWID's flat CSV shape instead
 * of the World Bank JSON envelope.
 *
 * Each chart is fetched as `grapher/{slug}.csv` and parsed into a per-country
 * ranking (most recent year per entity). Covers the four topic areas asked
 * for: agriculture, violence & war, energy & environment, and innovation &
 * technological change.
 *
 * https://ourworldindata.org/grapher/{slug}
 */

const OWID_BASE = 'https://ourworldindata.org/grapher'

export type OwidTopic = 'agriculture' | 'violence' | 'energy' | 'innovation'

export interface OwidChartDef {
  slug: string
  label: string
  topic: OwidTopic
  unit: string
}

export const OWID_CHARTS: OwidChartDef[] = [
  // ── Agriculture ──────────────────────────────────────────────────────────
  { slug: 'agriculture-orientation-index', label: 'Agriculture orientation index (govt. spending)', topic: 'agriculture', unit: 'index' },

  // ── Violence & war ───────────────────────────────────────────────────────
  { slug: 'deaths-in-armed-conflicts-by-type', label: 'Deaths in armed conflicts', topic: 'violence', unit: 'deaths' },
  { slug: 'number-of-armed-conflicts', label: 'Number of armed conflicts', topic: 'violence', unit: 'conflicts' },
  { slug: 'deaths-in-state-based-conflicts-by-region', label: 'Deaths in state-based conflicts by region', topic: 'violence', unit: 'deaths' },
  { slug: 'terrorism-deaths', label: 'Terrorism deaths', topic: 'violence', unit: 'deaths' },

  // ── Energy & environment ─────────────────────────────────────────────────
  { slug: 'global-primary-energy-by-source', label: 'Primary energy use by source', topic: 'energy', unit: 'TWh' },
  { slug: 'electricity-production-by-source', label: 'Electricity production by source', topic: 'energy', unit: 'TWh' },
  { slug: 'share-of-the-population-with-access-to-electricity', label: 'Population with electricity access', topic: 'energy', unit: '%' },
  { slug: 'renewable-energy', label: 'Renewable energy consumption', topic: 'energy', unit: 'TWh' },

  // ── Innovation & technological change ───────────────────────────────────
  { slug: 'research-spending-gdp', label: 'R&D spending (% of GDP)', topic: 'innovation', unit: '%' },
  { slug: 'researchers-in-rd-per-million-people', label: 'R&D researchers per million people', topic: 'innovation', unit: 'per million' },
  { slug: 'annual-patent-applications', label: 'Annual patent applications', topic: 'innovation', unit: 'applications' },
]

export interface OwidCountryValue {
  entity: string
  code: string
  year: number
  value: number
}

export interface OwidChartData {
  slug: string
  label: string
  topic: OwidTopic
  unit: string
  values: OwidCountryValue[] // most recent year per country, sorted desc by value
  fetchedAt: number
}

const cache = new Map<string, OwidChartData>()
const inflight = new Map<string, Promise<OwidChartData | null>>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// Non-country aggregate entities OWID includes alongside real countries
const NON_COUNTRY_ENTITIES = new Set([
  'World', 'Asia', 'Europe', 'Africa', 'Oceania', 'North America', 'South America',
  'Asia (UN)', 'Europe (UN)', 'Oceania (UN)', 'Africa (UN)', 'North America (UN)',
  'Latin America and the Caribbean (UN)', 'European Union (27)', 'High-income countries',
  'Low-income countries', 'Lower-middle-income countries', 'Upper-middle-income countries',
  'OECD countries', 'World Bank high income', 'World Bank low income',
])

function parseCsv(text: string): OwidCountryValue[] {
  const lines = text.split('\n').filter(Boolean)
  if (lines.length < 2) return []

  // Columns are: entity, code, year, then one or more numeric value columns
  // (e.g. energy-by-source charts have one column per fuel type — sum them),
  // occasionally followed by a trailing non-numeric metadata column (region).
  // Sum whichever columns from index 3+ parse as numbers on each row.
  const latestByEntity = new Map<string, OwidCountryValue>()
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',')
    const entity = row[0]
    const code = row[1]
    const year = Number(row[2])
    if (!entity || !code || !Number.isFinite(year)) continue
    if (NON_COUNTRY_ENTITIES.has(entity)) continue

    let sum = 0
    let sawValue = false
    for (let c = 3; c < row.length; c++) {
      const raw = row[c]
      if (raw === undefined || raw === '') continue
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      sum += n
      sawValue = true
    }
    if (!sawValue) continue

    const existing = latestByEntity.get(entity)
    if (!existing || year > existing.year) {
      latestByEntity.set(entity, { entity, code, year, value: sum })
    }
  }
  return Array.from(latestByEntity.values()).sort((a, b) => b.value - a.value)
}

/** Fetch and rank one OWID chart's most-recent-year values per country. */
export async function fetchOwidChart(slug: string): Promise<OwidChartData | null> {
  const cached = cache.get(slug)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached

  const existing = inflight.get(slug)
  if (existing) return existing

  const def = OWID_CHARTS.find(c => c.slug === slug)
  if (!def) return null

  const promise = (async () => {
    try {
      const url = `${OWID_BASE}/${slug}.csv?v=1&csvType=full&useColumnShortNames=true`
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`OWID API error ${res.status}`)
      const text = await res.text()
      const values = parseCsv(text)
      const result: OwidChartData = { slug: def.slug, label: def.label, topic: def.topic, unit: def.unit, values, fetchedAt: Date.now() }
      cache.set(slug, result)
      return result
    } catch {
      return null
    } finally {
      inflight.delete(slug)
    }
  })()

  inflight.set(slug, promise)
  return promise
}

export function formatOwidValue(unit: string, value: number): string {
  if (unit === '%') return `${value.toFixed(1)}%`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(value < 10 ? 2 : 0)
}

export const TOPIC_LABELS: Record<OwidTopic, string> = {
  agriculture: 'Agriculture',
  violence: 'Violence & War',
  energy: 'Energy & Environment',
  innovation: 'Innovation & Technology',
}
