import type { WorldBankObservation } from './worldbank'
/**
 * Natural resources & critical minerals — per-country production, reserves,
 * and strategic dependencies.
 *
 * Static data below is curated from public USGS Mineral Commodity Summaries
 * (2025/2026), BGS World Mineral Statistics, and World Bank resource-rent
 * indicators — covering the countries that actually matter for a given
 * mineral (a handful of producers hold the vast majority of world output for
 * most critical minerals), rather than bundling all 90+ minerals for all
 * ~190 countries. This keeps bundle size small while still surfacing the
 * commodities that drive geopolitics (rare earths, lithium, cobalt, oil,
 * gas, uranium, copper, etc).
 *
 * For any country without a static entry (or to refresh numbers), a live
 * World Bank "mineral rents % of GDP" + "natural resource rents % of GDP"
 * lookup is used as a fallback/supplement — so every one of the ~190
 * countries in ALL_COUNTRIES returns *something* on demand.
 */

export interface ResourceEntry {
  mineral: string
  /** World rank in production (1 = largest producer), if known */
  rank?: number
  /** Share of world production, % */
  shareOfWorld?: number
  /** Free-text note — reserves size, strategic role, trend */
  note?: string
}

export interface CountryResourceProfile {
  iso2: string
  name: string
  resources: ResourceEntry[]
  /** One-line strategic summary — why this country's resources matter geopolitically */
  strategic?: string
}

// ── Static profiles — major producers / reserve holders only ────────────────
// Source: USGS Mineral Commodity Summaries 2025/2026, BGS World Mineral
// Production, IEA, OPEC. Figures are approximate annual-share snapshots,
// meant for situational context rather than financial/trading use.
export const RESOURCE_PROFILES: CountryResourceProfile[] = [
  {
    iso2: 'CN', name: 'China',
    resources: [
      { mineral: 'Rare earth elements', rank: 1, shareOfWorld: 69, note: 'Dominates global refining (~90%), not just mining' },
      { mineral: 'Graphite', rank: 1, shareOfWorld: 65 },
      { mineral: 'Gallium', rank: 1, shareOfWorld: 98, note: 'Export controls imposed 2023' },
      { mineral: 'Germanium', rank: 1, shareOfWorld: 60, note: 'Export controls imposed 2023' },
      { mineral: 'Magnesium', rank: 1, shareOfWorld: 85 },
      { mineral: 'Tungsten', rank: 1, shareOfWorld: 82 },
      { mineral: 'Antimony', rank: 1, shareOfWorld: 48 },
      { mineral: 'Coal', rank: 1, shareOfWorld: 51 },
      { mineral: 'Gold', rank: 1, shareOfWorld: 10 },
      { mineral: 'Lithium (refining)', note: 'Controls ~65% of global lithium chemical refining despite modest mining share' },
    ],
    strategic: 'Controls chokepoints in rare-earth and critical-mineral refining, used as leverage in trade disputes (export licensing on Ga/Ge/graphite/rare earths).',
  },
  {
    iso2: 'AU', name: 'Australia',
    resources: [
      { mineral: 'Lithium', rank: 1, shareOfWorld: 47 },
      { mineral: 'Iron ore', rank: 1, shareOfWorld: 37 },
      { mineral: 'Bauxite/Aluminum ore', rank: 1, shareOfWorld: 29 },
      { mineral: 'Rare earths (mining)', rank: 2, shareOfWorld: 6 },
      { mineral: 'Gold', rank: 2, shareOfWorld: 9 },
      { mineral: 'Uranium', rank: 3, note: 'Largest known reserves in the world' },
      { mineral: 'Natural gas (LNG)', note: 'Top-3 global LNG exporter' },
    ],
    strategic: 'Key Western-aligned alternative to Chinese lithium/rare-earth supply chains (AUKUS critical minerals cooperation).',
  },
  {
    iso2: 'RU', name: 'Russia',
    resources: [
      { mineral: 'Natural gas', rank: 1, note: 'Largest proven reserves globally' },
      { mineral: 'Palladium', rank: 1, shareOfWorld: 38 },
      { mineral: 'Nickel', rank: 3, shareOfWorld: 8 },
      { mineral: 'Crude oil', rank: 3, shareOfWorld: 11 },
      { mineral: 'Diamonds', rank: 1, shareOfWorld: 30 },
      { mineral: 'Platinum group metals', rank: 2 },
      { mineral: 'Coal', rank: 6 },
    ],
    strategic: 'Energy exports to Europe/Asia remain a primary sanctions/leverage vector since 2022; palladium critical to catalytic converters and electronics.',
  },
  {
    iso2: 'SA', name: 'Saudi Arabia',
    resources: [
      { mineral: 'Crude oil', rank: 1, shareOfWorld: 12, note: 'OPEC+ swing producer, largest spare capacity' },
      { mineral: 'Natural gas', rank: 7 },
    ],
    strategic: 'De facto OPEC+ leader; production-quota decisions move global oil prices.',
  },
  {
    iso2: 'US', name: 'United States',
    resources: [
      { mineral: 'Crude oil', rank: 1, shareOfWorld: 20, note: 'Largest producer since ~2018 (shale)' },
      { mineral: 'Natural gas', rank: 1, shareOfWorld: 25 },
      { mineral: 'Coal', rank: 2 },
      { mineral: 'Copper', rank: 4 },
      { mineral: 'Rare earths (mining)', rank: 2, note: 'Mountain Pass mine; refining still largely outsourced to China' },
      { mineral: 'Lithium', note: 'Emerging producer (Nevada, Salton Sea) — currently minor share' },
    ],
    strategic: 'Shale revolution ended reliance on Gulf oil imports; actively building domestic critical-mineral refining to de-risk China dependency.',
  },
  {
    iso2: 'CD', name: 'DR Congo',
    resources: [
      { mineral: 'Cobalt', rank: 1, shareOfWorld: 74, note: 'Chinese-owned mines dominate extraction' },
      { mineral: 'Tantalum', rank: 1, shareOfWorld: 40 },
      { mineral: 'Copper', rank: 2, shareOfWorld: 12 },
      { mineral: 'Diamonds', rank: 3 },
      { mineral: 'Tin', rank: 4 },
    ],
    strategic: 'Cobalt is essential for EV/lithium-ion batteries; artisanal mining and conflict-mineral concerns (tantalum/tin/tungsten/gold — "3TG") are major supply-chain risk factors.',
  },
  {
    iso2: 'CL', name: 'Chile',
    resources: [
      { mineral: 'Copper', rank: 1, shareOfWorld: 24 },
      { mineral: 'Lithium', rank: 2, shareOfWorld: 25, note: 'Salar de Atacama — among lowest-cost brine lithium in the world' },
      { mineral: 'Iodine', rank: 1 },
    ],
    strategic: 'Copper price is a bellwether for Chile\'s economy; lithium nationalization policy (2023) shapes EV battery supply chains.',
  },
  {
    iso2: 'PE', name: 'Peru',
    resources: [
      { mineral: 'Copper', rank: 2, shareOfWorld: 11 },
      { mineral: 'Silver', rank: 2, shareOfWorld: 15 },
      { mineral: 'Zinc', rank: 2 },
      { mineral: 'Gold', rank: 8 },
      { mineral: 'Tin', rank: 3 },
    ],
    strategic: 'Frequent mine-blockade protests and political instability create recurring copper supply risk.',
  },
  {
    iso2: 'ZA', name: 'South Africa',
    resources: [
      { mineral: 'Platinum', rank: 1, shareOfWorld: 71 },
      { mineral: 'Palladium', rank: 2, shareOfWorld: 33 },
      { mineral: 'Chromium', rank: 1, shareOfWorld: 44 },
      { mineral: 'Manganese', rank: 1, shareOfWorld: 37 },
      { mineral: 'Gold', rank: 7 },
      { mineral: 'Vanadium', rank: 3 },
    ],
    strategic: 'Near-monopoly on platinum group metals used in catalytic converters and hydrogen fuel cells; chronic power-grid (Eskom) instability threatens output.',
  },
  {
    iso2: 'ID', name: 'Indonesia',
    resources: [
      { mineral: 'Nickel', rank: 1, shareOfWorld: 50, note: 'Export ban on raw ore (2020) forced domestic smelting buildout' },
      { mineral: 'Tin', rank: 2, shareOfWorld: 19 },
      { mineral: 'Coal', rank: 3, note: 'Top thermal coal exporter' },
      { mineral: 'Palm-derived / bauxite', shareOfWorld: 6 },
    ],
    strategic: 'Nickel dominance underpins stainless steel and EV battery (NMC/LFP transition) supply chains; heavy Chinese smelter investment.',
  },
  {
    iso2: 'GN', name: 'Guinea',
    resources: [
      { mineral: 'Bauxite/Aluminum ore', rank: 1, shareOfWorld: 30, note: 'Simandou — one of world\'s largest untapped iron-ore deposits' },
    ],
    strategic: 'Political instability (2021 coup) plus emerging Simandou iron-ore project makes Guinea a watch point for aluminum and steel supply chains.',
  },
  {
    iso2: 'CA', name: 'Canada',
    resources: [
      { mineral: 'Potash', rank: 1, shareOfWorld: 31 },
      { mineral: 'Uranium', rank: 2, shareOfWorld: 15 },
      { mineral: 'Nickel', rank: 6 },
      { mineral: 'Crude oil (oil sands)', rank: 4 },
      { mineral: 'Rare earths / critical minerals', note: 'Emerging producer, strong US/allied partnership focus' },
    ],
    strategic: 'Key North American ally for de-risking critical-mineral supply chains away from China.',
  },
  {
    iso2: 'BR', name: 'Brazil',
    resources: [
      { mineral: 'Iron ore', rank: 2, shareOfWorld: 17 },
      { mineral: 'Niobium', rank: 1, shareOfWorld: 88 },
      { mineral: 'Rare earths', note: 'Second-largest reserves globally, mostly undeveloped' },
      { mineral: 'Crude oil', rank: 8 },
    ],
    strategic: 'Near-monopoly on niobium (steel alloying, superconductors); large untapped rare-earth reserves attracting Western investment.',
  },
  {
    iso2: 'KZ', name: 'Kazakhstan',
    resources: [
      { mineral: 'Uranium', rank: 1, shareOfWorld: 43, note: 'World\'s top uranium producer, mostly via Kazatomprom' },
      { mineral: 'Chromium', rank: 2 },
      { mineral: 'Crude oil', rank: 12 },
    ],
    strategic: 'Uranium output feeds global nuclear fuel supply; landlocked, transit routes through Russia are a strategic vulnerability.',
  },
  {
    iso2: 'IQ', name: 'Iraq',
    resources: [{ mineral: 'Crude oil', rank: 5, shareOfWorld: 5 }],
    strategic: 'OPEC member; oil revenue funds ~90% of government budget, making output a proxy for internal political stability.',
  },
  {
    iso2: 'AE', name: 'UAE',
    resources: [{ mineral: 'Crude oil', rank: 8 }, { mineral: 'Natural gas', rank: 17 }],
    strategic: 'OPEC+ member pushing for higher production quotas; diversifying economy away from oil dependency faster than Gulf peers.',
  },
  {
    iso2: 'IR', name: 'Iran',
    resources: [
      { mineral: 'Natural gas', rank: 2, note: 'Second-largest proven reserves' },
      { mineral: 'Crude oil', rank: 9, note: 'Output constrained by sanctions' },
      { mineral: 'Copper', note: 'Sarcheshmeh — one of largest deposits in Middle East' },
    ],
    strategic: 'Sanctions suppress oil/gas export volume well below reserve-implied potential; any sanctions relief would be a major supply-side swing factor.',
  },
  {
    iso2: 'VE', name: 'Venezuela',
    resources: [{ mineral: 'Crude oil', note: 'Largest proven reserves in the world (heavy crude)' }, { mineral: 'Gold', note: 'Significant undeveloped reserves' }],
    strategic: 'Sanctions and state-oil-company (PDVSA) mismanagement mean actual output is far below reserve potential — any policy shift is a major latent supply swing.',
  },
  {
    iso2: 'NG', name: 'Nigeria',
    resources: [{ mineral: 'Crude oil', rank: 14 }, { mineral: 'Natural gas', note: 'Largest proven reserves in Africa' }],
    strategic: 'Pipeline sabotage/theft and OPEC quota compliance issues make Nigerian output volatile relative to nameplate capacity.',
  },
  {
    iso2: 'AR', name: 'Argentina',
    resources: [{ mineral: 'Lithium', rank: 4, note: 'Part of the "Lithium Triangle" with Chile & Bolivia' }, { mineral: 'Shale gas/oil', note: 'Vaca Muerta — one of largest shale formations globally' }],
    strategic: 'Rapidly expanding lithium brine projects; Vaca Muerta shale could make Argentina a major energy exporter this decade.',
  },
  {
    iso2: 'BO', name: 'Bolivia',
    resources: [{ mineral: 'Lithium', note: 'Largest known reserves in the world (Salar de Uyuni), but extraction technically difficult — minimal current output' }, { mineral: 'Tin', rank: 5 }],
    strategic: 'Massive latent lithium reserves are geopolitically significant but largely undeveloped due to technical/investment/nationalization hurdles.',
  },
  {
    iso2: 'MN', name: 'Mongolia',
    resources: [{ mineral: 'Coal', note: 'Major exporter to China' }, { mineral: 'Copper', note: 'Oyu Tolgoi — one of world\'s largest copper-gold deposits' }],
    strategic: 'Landlocked and economically dependent on Chinese demand for coal and copper exports.',
  },
  {
    iso2: 'MA', name: 'Morocco',
    resources: [{ mineral: 'Phosphate rock', rank: 1, shareOfWorld: 70, note: 'Reserves far exceed all other countries combined' }],
    strategic: 'De facto global monopoly on phosphate reserves (fertilizer production) — critical to global food security.',
  },
  {
    iso2: 'TR', name: 'Turkey',
    resources: [{ mineral: 'Boron', rank: 1, shareOfWorld: 72 }],
    strategic: 'Dominant boron reserves feed glass, ceramics, and increasingly battery/defense applications.',
  },
  {
    iso2: 'GA', name: 'Gabon',
    resources: [{ mineral: 'Manganese', rank: 2, shareOfWorld: 20 }],
    strategic: 'Second-largest manganese producer; critical for steelmaking and battery cathodes.',
  },
  {
    iso2: 'NO', name: 'Norway',
    resources: [{ mineral: 'Natural gas', note: 'Largest supplier to Europe after Russian pipeline flows collapsed post-2022' }, { mineral: 'Crude oil', rank: 15 }],
    strategic: 'Became Europe\'s top gas supplier after 2022, a direct beneficiary of the shift away from Russian energy.',
  },
  {
    iso2: 'QA', name: 'Qatar',
    resources: [{ mineral: 'Natural gas (LNG)', rank: 2, note: 'Among top 2 LNG exporters globally alongside the US' }],
    strategic: 'LNG export capacity expansion (North Field) positions Qatar as a long-term swing supplier to both Europe and Asia.',
  },
  {
    iso2: 'IN', name: 'India',
    resources: [{ mineral: 'Coal', rank: 2 }, { mineral: 'Iron ore', rank: 4 }, { mineral: 'Rare earths', note: 'Third-largest reserves, minimal current refining capacity' }],
    strategic: 'Building domestic critical-mineral and rare-earth refining capacity to reduce Chinese import dependency.',
  },
  {
    iso2: 'MX', name: 'Mexico',
    resources: [{ mineral: 'Silver', rank: 1, shareOfWorld: 23 }, { mineral: 'Fluorite', rank: 1 }],
    strategic: 'World\'s top silver producer; silver demand increasingly tied to solar panel manufacturing.',
  },
]

const RESOURCE_MAP = new Map(RESOURCE_PROFILES.map(r => [r.iso2, r]))

export function getResourceProfile(iso2: string): CountryResourceProfile | null {
  return RESOURCE_MAP.get(iso2.toUpperCase()) ?? null
}

// ── Live fallback: World Bank resource-rent indicators (works for ~all countries) ──
const WB_BASE = 'https://api.worldbank.org/v2'

const RENT_INDICATORS = {
  'NY.GDP.MINR.RT.ZS': 'Mineral rents (% of GDP)',
  'NY.GDP.PETR.RT.ZS': 'Oil rents (% of GDP)',
  'NY.GDP.NGAS.RT.ZS': 'Natural gas rents (% of GDP)',
  'NY.GDP.COAL.RT.ZS': 'Coal rents (% of GDP)',
  'NY.GDP.FRST.RT.ZS': 'Forest rents (% of GDP)',
  'NY.GDP.TOTL.RT.ZS': 'Total natural resource rents (% of GDP)',
} as const

export interface ResourceRent {
  label: string
  value: number
  year: string
}

const rentCache = new Map<string, ResourceRent[]>()
const RENT_CACHE_TTL = 60 * 60 * 1000

export async function fetchResourceRents(iso2: string): Promise<ResourceRent[]> {
  const key = iso2.toUpperCase()
  const cached = rentCache.get(key)
  if (cached) return cached

  const ids = Object.keys(RENT_INDICATORS) as (keyof typeof RENT_INDICATORS)[]
  const fetches = ids.map(async (id): Promise<ResourceRent | null> => {
    try {
      const url = `${WB_BASE}/country/${key}/indicator/${id}?format=json&date=2015:2024&per_page=10&MRV=1`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return null
      const json = await res.json()
      const data = Array.isArray(json) && json.length === 2 ? json[1] : null
      if (!data || !Array.isArray(data)) return null
      const entry = (data as WorldBankObservation[]).find(d => d.value != null)
      if (!entry) return null
      return { label: RENT_INDICATORS[id] as string, value: entry.value as number, year: entry.date as string }
    } catch {
      return null
    }
  })

  const results = (await Promise.all(fetches)).filter((r): r is ResourceRent => r != null)
  rentCache.set(key, results)
  setTimeout(() => rentCache.delete(key), RENT_CACHE_TTL)
  return results
}

// ── Compact capability summary for AI context (kept short — not the full dataset) ──
export function resourceCapabilitySummary(): string {
  const top = RESOURCE_PROFILES.slice(0, 8).map(p => p.name).join(', ')
  return `Critical minerals & resource data available for ${RESOURCE_PROFILES.length} major producer countries (${top}, +more) — production rank, world share, strategic notes. Live World Bank resource-rent data (mineral/oil/gas/coal % of GDP) available on-demand for any country.`
}
