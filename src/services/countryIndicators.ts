/**
 * Country-level indicators for the Country Analytics panel, from three free, keyless sources the app already uses:
 *  - World Bank Open Data (worldbank.ts, militaryPersonnel.ts, infraIndicators.ts, resources.ts)
 *  - Our World in Data Grapher CSVs (owid.ts) — conflict, terrorism, energy, R&D
 *  - Ember electricity data, served by Our World in Data (powerGeneration.ts)
 *
 * Every indicator resolves to one value per country (identified by ISO-3166 alpha-3, the code all three sources share
 * and Mapbox's country boundaries expose). A country's value is its most recent non-empty year, and only if 2010 or
 * later, so years differ between countries and between indicators; the year travels with every value.
 */
import { fetchOwidChart, type OwidChartData } from './owid'
import { fetchPowerGenerationRanking, formatTwh, type PowerGenerationEntry } from './powerGeneration'

const WB_BASE = 'https://api.worldbank.org/v2'

export type IndicatorGroup =
  | 'Economy' | 'Trade & finance' | 'Population' | 'Military & conflict' | 'Energy & resources' | 'Innovation' | 'Society & infrastructure'
export type ScaleKind = 'linear' | 'log' | 'symlog'
export type IndicatorSource = 'World Bank' | 'Our World in Data' | 'Ember'

export interface IndicatorMeta {
  id: string
  label: string
  /** very short label for dense charts */
  short: string
  group: IndicatorGroup
  source: IndicatorSource
  /** how to space values on an axis: heavy-tailed positives are logarithmic, signed or zero-heavy ones use symlog */
  scale: ScaleKind
  format: (v: number) => string
}

const compact = (v: number): string => {
  const a = Math.abs(v)
  const s = a >= 1e12 ? `${+(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${+(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${+(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K` : `${+a.toFixed(a >= 100 ? 0 : 1)}`
  return v < 0 ? `−${s}` : s
}
const usd = (v: number) => `${v < 0 ? '−' : ''}$${compact(Math.abs(v))}`
const pct = (v: number) => `${v.toFixed(1)}%`
const num1 = (v: number) => v.toFixed(1)

type Fmt = (v: number) => string
const wb = (id: string, label: string, short: string, group: IndicatorGroup, scale: ScaleKind, format: Fmt): IndicatorMeta =>
  ({ id, label, short, group, source: 'World Bank', scale, format })
const owid = (slug: string, label: string, short: string, group: IndicatorGroup, scale: ScaleKind, format: Fmt): IndicatorMeta =>
  ({ id: `owid:${slug}`, label, short, group, source: 'Our World in Data', scale, format })
const ember = (key: string, label: string, short: string, scale: ScaleKind, format: Fmt): IndicatorMeta =>
  ({ id: `ember:${key}`, label, short, group: 'Energy & resources', source: 'Ember', scale, format })

export const INDICATORS: IndicatorMeta[] = [
  // Economy
  wb('NY.GDP.PCAP.CD',     'GDP per capita (US$)',                 'GDP/cap',     'Economy', 'log',    usd),
  wb('NY.GDP.MKTP.CD',     'GDP (US$)',                            'GDP',         'Economy', 'log',    usd),
  wb('NY.GDP.MKTP.KD.ZG',  'GDP growth (%)',                       'Growth',      'Economy', 'linear', pct),
  wb('FP.CPI.TOTL.ZG',     'Inflation, consumer prices (%)',       'Inflation',   'Economy', 'symlog', pct),
  wb('SL.UEM.TOTL.ZS',     'Unemployment (% of labour force)',     'Unemploy.',   'Economy', 'linear', pct),
  wb('GC.DOD.TOTL.GD.ZS',  'Central government debt (% of GDP)',   'Gov. debt',   'Economy', 'linear', pct),
  owid('agriculture-orientation-index', 'Agriculture orientation index (government spending)', 'Agri. index', 'Economy', 'linear', num1),
  // Trade & finance
  wb('NE.TRD.GNFS.ZS',     'Trade (% of GDP)',                     'Trade',       'Trade & finance', 'linear', pct),
  wb('NE.EXP.GNFS.CD',     'Exports of goods and services (US$)',  'Exports',     'Trade & finance', 'log',    usd),
  wb('NE.IMP.GNFS.CD',     'Imports of goods and services (US$)',  'Imports',     'Trade & finance', 'log',    usd),
  wb('BN.CAB.XOKA.CD',     'Current account balance (US$)',        'Curr. acct',  'Trade & finance', 'symlog', usd),
  wb('BX.KLT.DINV.CD.WD',  'Foreign direct investment, inflows (US$)',  'FDI in',  'Trade & finance', 'symlog', usd),
  wb('BM.KLT.DINV.CD.WD',  'Foreign direct investment, outflows (US$)', 'FDI out', 'Trade & finance', 'symlog', usd),
  wb('BX.TRF.PWKR.CD.DT',  'Remittances received (US$)',           'Remittances', 'Trade & finance', 'log',    usd),
  wb('TX.VAL.TECH.MF.ZS',  'High-tech exports (% of manufactured exports)', 'High-tech', 'Trade & finance', 'linear', pct),
  wb('TM.TAX.MRCH.WM.AR.ZS', 'Applied tariff rate, all products (%)', 'Tariff',    'Trade & finance', 'linear', pct),
  // Population
  wb('SP.POP.TOTL',        'Population',                           'Population',  'Population', 'log',    compact),
  wb('SP.POP.GROW',        'Population growth (%)',                'Pop. growth', 'Population', 'linear', pct),
  // Military & conflict
  wb('MS.MIL.XPND.GD.ZS',  'Military spending (% of GDP)',         'Mil. % GDP',  'Military & conflict', 'linear', pct),
  wb('MS.MIL.TOTL.P1',     'Armed forces personnel',               'Troops',      'Military & conflict', 'log',    compact),
  wb('MS.MIL.TOTL.TF.ZS',  'Armed forces (% of labour force)',     'Troops % LF', 'Military & conflict', 'linear', pct),
  owid('deaths-in-armed-conflicts-by-type', 'Deaths in armed conflicts', 'Conflict deaths', 'Military & conflict', 'symlog', compact),
  owid('number-of-armed-conflicts',         'Number of ongoing armed conflicts', 'Conflicts', 'Military & conflict', 'symlog', compact),
  owid('terrorism-deaths',                  'Deaths from terrorism', 'Terror deaths', 'Military & conflict', 'symlog', compact),
  // Energy & resources
  wb('EG.USE.PCAP.KG.OE',  'Energy use per capita (kg oil equivalent)', 'Energy/cap', 'Energy & resources', 'log', compact),
  owid('global-primary-energy-by-source', 'Primary energy consumption (TWh)', 'Primary energy', 'Energy & resources', 'log', v => formatTwh(v)),
  owid('renewable-energy',                'Renewable energy consumption (TWh)', 'Renewables', 'Energy & resources', 'log', v => formatTwh(v)),
  ember('total',     'Electricity generated (TWh)',                 'Electricity', 'log',    v => formatTwh(v)),
  ember('lowcarbon', 'Low-carbon share of electricity (%)',         'Low-carbon',  'linear', pct),
  ember('windsolar', 'Wind and solar share of electricity (%)',     'Wind+solar',  'linear', pct),
  ember('coal',      'Coal share of electricity (%)',               'Coal share',  'linear', pct),
  wb('NY.GDP.TOTL.RT.ZS',  'Total natural resource rents (% of GDP)', 'Resource rents', 'Energy & resources', 'linear', pct),
  wb('NY.GDP.PETR.RT.ZS',  'Oil rents (% of GDP)',                 'Oil rents',   'Energy & resources', 'linear', pct),
  wb('NY.GDP.NGAS.RT.ZS',  'Natural gas rents (% of GDP)',         'Gas rents',   'Energy & resources', 'linear', pct),
  wb('NY.GDP.COAL.RT.ZS',  'Coal rents (% of GDP)',                'Coal rents',  'Energy & resources', 'linear', pct),
  wb('NY.GDP.MINR.RT.ZS',  'Mineral rents (% of GDP)',             'Mineral rents', 'Energy & resources', 'linear', pct),
  wb('NY.GDP.FRST.RT.ZS',  'Forest rents (% of GDP)',              'Forest rents', 'Energy & resources', 'linear', pct),
  // Innovation
  owid('research-spending-gdp',              'R&D spending (% of GDP)',            'R&D % GDP',    'Innovation', 'linear', pct),
  owid('researchers-in-rd-per-million-people', 'R&D researchers per million people', 'Researchers',  'Innovation', 'log',    compact),
  owid('annual-patent-applications',         'Patent applications per year',       'Patents',      'Innovation', 'log',    compact),
  // Society & infrastructure
  wb('SP.DYN.LE00.IN',     'Life expectancy at birth (years)',     'Life exp.',   'Society & infrastructure', 'linear', num1),
  wb('SE.ADT.LITR.ZS',     'Adult literacy rate (%)',              'Literacy',    'Society & infrastructure', 'linear', pct),
  wb('SI.POV.GINI',        'Gini index (inequality)',              'Gini',        'Society & infrastructure', 'linear', num1),
  wb('IT.NET.USER.ZS',     'Internet users (% of population)',     'Internet',    'Society & infrastructure', 'linear', pct),
  wb('IT.CEL.SETS.P2',     'Mobile subscriptions (per 100 people)', 'Mobile',     'Society & infrastructure', 'linear', num1),
  wb('EG.ELC.ACCS.ZS',     'Access to electricity (% of population)', 'Electricity access', 'Society & infrastructure', 'linear', pct),
  wb('SH.H2O.BASW.ZS',     'Basic drinking water services (% of population)', 'Water', 'Society & infrastructure', 'linear', pct),
  wb('SH.STA.BASS.ZS',     'Basic sanitation services (% of population)', 'Sanitation', 'Society & infrastructure', 'linear', pct),
  wb('IS.AIR.PSGR',        'Air passengers carried per year',      'Air travel',  'Society & infrastructure', 'log',    compact),
  wb('IS.RRS.TOTL.KM',     'Rail lines (route-km)',                'Rail km',     'Society & infrastructure', 'log',    compact),
]

export const INDICATOR_BY_ID = new Map(INDICATORS.map(i => [i.id, i]))
export const INDICATOR_GROUPS: IndicatorGroup[] = ['Economy', 'Trade & finance', 'Population', 'Military & conflict', 'Energy & resources', 'Innovation', 'Society & infrastructure']

/** Indicators shown in the correlation matrix: broad coverage, one or two per theme. */
export const MATRIX_IDS = [
  'NY.GDP.PCAP.CD', 'SP.POP.TOTL', 'NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG', 'NE.TRD.GNFS.ZS',
  'MS.MIL.XPND.GD.ZS', 'MS.MIL.TOTL.TF.ZS', 'NY.GDP.TOTL.RT.ZS', 'SP.DYN.LE00.IN', 'IT.NET.USER.ZS', 'EG.USE.PCAP.KG.OE', 'ember:lowcarbon',
] as const

export interface Preset { title: string; x: string; y: string; blurb: string }

/** Well-known country comparisons to start from. The blurbs describe what is plotted, not what it will show. */
export const PRESETS: Preset[] = [
  { title: 'Wealth & health', x: 'NY.GDP.PCAP.CD', y: 'SP.DYN.LE00.IN', blurb: 'GDP per capita against life expectancy.' },
  { title: 'Defence burden', x: 'NY.GDP.PCAP.CD', y: 'MS.MIL.XPND.GD.ZS', blurb: 'GDP per capita against military spending as a share of GDP.' },
  { title: 'Army size', x: 'SP.POP.TOTL', y: 'MS.MIL.TOTL.P1', blurb: 'Population against armed forces personnel.' },
  { title: 'Oil & arms', x: 'NY.GDP.PETR.RT.ZS', y: 'MS.MIL.XPND.GD.ZS', blurb: 'Oil rents as a share of GDP against military spending as a share of GDP.' },
  { title: 'Wealth & conflict', x: 'NY.GDP.PCAP.CD', y: 'owid:deaths-in-armed-conflicts-by-type', blurb: 'GDP per capita against deaths in armed conflicts.' },
  { title: 'Digital divide', x: 'NY.GDP.PCAP.CD', y: 'IT.NET.USER.ZS', blurb: 'GDP per capita against internet users.' },
  { title: 'Brains', x: 'NY.GDP.PCAP.CD', y: 'owid:research-spending-gdp', blurb: 'GDP per capita against R&D spending as a share of GDP.' },
  { title: 'Openness', x: 'SP.POP.TOTL', y: 'NE.TRD.GNFS.ZS', blurb: 'Population against trade as a share of GDP.' },
  { title: 'Energy appetite', x: 'NY.GDP.PCAP.CD', y: 'EG.USE.PCAP.KG.OE', blurb: 'GDP per capita against energy use per person.' },
  { title: 'Clean power', x: 'NY.GDP.PCAP.CD', y: 'ember:lowcarbon', blurb: 'GDP per capita against the low-carbon share of electricity.' },
]

/** World Bank's formal names read badly on charts and don't geocode; shorten the ones with a well-known common name. */
const NAME_FIXES: Record<string, string> = {
  'Korea, Rep.': 'South Korea', "Korea, Dem. People's Rep.": 'North Korea', 'Russian Federation': 'Russia',
  'Congo, Dem. Rep.': 'DR Congo', 'Congo, Rep.': 'Congo', 'Syrian Arab Republic': 'Syria', 'Lao PDR': 'Laos',
  'Kyrgyz Republic': 'Kyrgyzstan', 'Slovak Republic': 'Slovakia', 'Hong Kong SAR, China': 'Hong Kong',
  'Macao SAR, China': 'Macao', 'Micronesia, Fed. Sts.': 'Micronesia', 'Gambia, The': 'Gambia', 'Bahamas, The': 'Bahamas',
  'Egypt, Arab Rep.': 'Egypt', 'Iran, Islamic Rep.': 'Iran', 'Venezuela, RB': 'Venezuela', 'Yemen, Rep.': 'Yemen',
  'Brunei Darussalam': 'Brunei',
}
export const cleanCountryName = (name: string): string => NAME_FIXES[name] ?? name

export interface CountryValue {
  /** ISO-3166 alpha-3 — the identity key shared by every source and by Mapbox's country boundaries */
  iso3: string
  name: string
  value: number
  year: string
}

// World Bank aggregate/region codes — only real countries wanted
const NON_COUNTRY_ISO3 = new Set([
  'WLD','ARB','CSS','CEB','EAP','EAR','EAS','ECA','ECS','EMU','EUU','FCS',
  'HIC','HPC','IBD','IBT','IDA','IDB','IDX','INX','LAC','LCN','LDC','LIC',
  'LMC','LMY','LTE','MEA','MIC','MNA','NAC','OED','OSS','PRE','PSS','PST',
  'SAS','SSA','SSF','SST','TEA','TEC','TLA','TMN','TSA','TSS','UMC','AFE','AFW',
])

export const MIN_YEAR = 2010

/**
 * Pure parser for the World Bank `[meta, rows]` envelope: drops aggregates, nulls, non-numeric values and values older
 * than `minYear` (`mrnev=1` ignores the request's date range and can return 1990s figures), keeps the first row per country.
 */
export function parseWorldBank(json: unknown, minYear = MIN_YEAR): CountryValue[] {
  const data = Array.isArray(json) && json.length === 2 ? json[1] : null
  if (!Array.isArray(data)) throw new Error('Unexpected World Bank response shape')
  const seen = new Set<string>()
  const out: CountryValue[] = []
  for (const d of data as { value?: unknown; date?: unknown; countryiso3code?: unknown; country?: { id?: unknown; value?: unknown } }[]) {
    const iso3 = d?.countryiso3code
    if (typeof d?.value !== 'number' || !Number.isFinite(d.value)) continue
    if (typeof iso3 !== 'string' || !iso3 || NON_COUNTRY_ISO3.has(iso3)) continue
    if (Number(d.date) < minYear) continue
    if (seen.has(iso3)) continue
    seen.add(iso3)
    out.push({ iso3, name: cleanCountryName(String(d.country?.value ?? iso3)), value: d.value, year: String(d.date ?? '') })
  }
  return out
}

/** Our World in Data chart → country rows. OWID's regional/income aggregates carry an `OWID_` code or none; pre-2010 values are dropped. */
export function owidToRows(data: OwidChartData, minYear = MIN_YEAR): CountryValue[] {
  return data.values
    .filter(v => /^[A-Z]{3}$/.test(v.code) && v.year >= minYear && Number.isFinite(v.value))
    .map(v => ({ iso3: v.code, name: cleanCountryName(v.entity), value: v.value, year: String(v.year) }))
}

const EMBER_VALUE: Record<string, (e: PowerGenerationEntry) => number> = {
  total: e => e.totalTwh,
  lowcarbon: e => e.lowCarbonPct,
  windsolar: e => ((e.bySource.wind + e.bySource.solar) / e.totalTwh) * 100,
  coal: e => (e.bySource.coal / e.totalTwh) * 100,
}

/** Ember electricity entries → country rows for one measure (`total`, `lowcarbon`, `windsolar`, `coal`). */
export function emberToRows(entries: PowerGenerationEntry[], key: string, minYear = MIN_YEAR): CountryValue[] {
  const f = EMBER_VALUE[key]
  if (!f) throw new Error(`Unknown Ember measure: ${key}`)
  return entries
    .filter(e => /^[A-Z]{3}$/.test(e.code) && e.year >= minYear && e.totalTwh > 0)
    .map(e => ({ iso3: e.code, name: cleanCountryName(e.country), value: f(e), year: String(e.year) }))
    .filter(r => Number.isFinite(r.value))
}

const CACHE_TTL = 60 * 60 * 1000
const RETRY_DELAY_MS = 800
const cache = new Map<string, { at: number; rows: CountryValue[] }>()
const inflight = new Map<string, Promise<CountryValue[]>>()

async function fetchWorldBank(id: string): Promise<CountryValue[]> {
  const url = `${WB_BASE}/country/all/indicator/${encodeURIComponent(id)}?format=json&per_page=20000&mrnev=1`
  const attempt = async (): Promise<CountryValue[]> => {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw Object.assign(new Error(`World Bank HTTP ${res.status}`), { transient: res.status === 429 || res.status >= 500 })
    return parseWorldBank(await res.json())
  }
  try { return await attempt() } catch (e) {
    // one retry for throttling / server hiccups / timeouts / network errors; a malformed body or a 4xx is not retried
    const transient = (e as { transient?: boolean }).transient ?? (e instanceof TypeError || (e as Error)?.name === 'TimeoutError')
    if (!transient) throw e
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    return attempt()
  }
}

async function loadIndicator(id: string): Promise<CountryValue[]> {
  if (id.startsWith('owid:')) {
    const data = await fetchOwidChart(id.slice(5))
    if (!data) throw new Error('Our World in Data request failed')
    return owidToRows(data)
  }
  if (id.startsWith('ember:')) return emberToRows(await fetchPowerGenerationRanking(), id.slice(6))
  return fetchWorldBank(id)
}

/** Latest value per country for one indicator. Cached for an hour; concurrent calls share one request. */
export function fetchIndicatorAll(id: string): Promise<CountryValue[]> {
  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < CACHE_TTL) return Promise.resolve(hit.rows)
  const running = inflight.get(id)
  if (running) return running
  const p = loadIndicator(id).then(rows => { cache.set(id, { at: Date.now(), rows }); return rows }).finally(() => inflight.delete(id))
  inflight.set(id, p)
  return p
}
