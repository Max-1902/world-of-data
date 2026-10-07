/**
 * Country-level indicators from World Bank Open Data (free, no key) — the same source family the app already uses in
 * worldbank.ts, militaryPersonnel.ts and infraIndicators.ts. One request returns the most recent value for every country.
 *
 * Each country's value is its most recent *non-empty* year, and only if 2010 or later (`mrnev=1`; plain `MRV=1` returns only the
 * single latest year, which is empty for most countries on slow-reporting indicators), so years differ between countries and
 * between indicators; the year travels with every value so the UI can say so.
 */

const WB_BASE = 'https://api.worldbank.org/v2'

export type IndicatorGroup = 'Economy' | 'Population' | 'Military' | 'Society & infrastructure'
export type ScaleKind = 'linear' | 'log' | 'symlog'

export interface IndicatorMeta {
  id: string
  label: string
  /** very short label for dense charts */
  short: string
  group: IndicatorGroup
  /** how to space values on an axis: heavy-tailed positives are logarithmic, signed heavy-tailed use symlog */
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

export const INDICATORS: IndicatorMeta[] = [
  { id: 'NY.GDP.PCAP.CD',     label: 'GDP per capita (US$)',                  short: 'GDP/cap',     group: 'Economy',    scale: 'log',    format: usd },
  { id: 'NY.GDP.MKTP.CD',     label: 'GDP (US$)',                             short: 'GDP',         group: 'Economy',    scale: 'log',    format: usd },
  { id: 'NY.GDP.MKTP.KD.ZG',  label: 'GDP growth (%)',                        short: 'Growth',      group: 'Economy',    scale: 'linear', format: pct },
  { id: 'FP.CPI.TOTL.ZG',     label: 'Inflation, consumer prices (%)',        short: 'Inflation',   group: 'Economy',    scale: 'symlog', format: pct },
  { id: 'SL.UEM.TOTL.ZS',     label: 'Unemployment (% of labour force)',      short: 'Unemploy.',   group: 'Economy',    scale: 'linear', format: pct },
  { id: 'GC.DOD.TOTL.GD.ZS',  label: 'Central government debt (% of GDP)',    short: 'Gov. debt',   group: 'Economy',    scale: 'linear', format: pct },
  { id: 'NE.TRD.GNFS.ZS',     label: 'Trade (% of GDP)',                      short: 'Trade',       group: 'Economy',    scale: 'linear', format: pct },
  { id: 'BX.KLT.DINV.CD.WD',  label: 'Foreign direct investment, inflows (US$)', short: 'FDI in',   group: 'Economy',    scale: 'symlog', format: usd },
  { id: 'BX.TRF.PWKR.CD.DT',  label: 'Remittances received (US$)',            short: 'Remittances', group: 'Economy',    scale: 'log',    format: usd },
  { id: 'TX.VAL.TECH.MF.ZS',  label: 'High-tech exports (% of manufactured exports)', short: 'High-tech', group: 'Economy', scale: 'linear', format: pct },
  { id: 'SP.POP.TOTL',        label: 'Population',                            short: 'Population',  group: 'Population', scale: 'log',    format: compact },
  { id: 'SP.POP.GROW',        label: 'Population growth (%)',                 short: 'Pop. growth', group: 'Population', scale: 'linear', format: pct },
  { id: 'MS.MIL.XPND.GD.ZS',  label: 'Military spending (% of GDP)',          short: 'Mil. % GDP',  group: 'Military',   scale: 'linear', format: pct },
  { id: 'MS.MIL.TOTL.P1',     label: 'Armed forces personnel',                short: 'Troops',      group: 'Military',   scale: 'log',    format: compact },
  { id: 'MS.MIL.TOTL.TF.ZS',  label: 'Armed forces (% of labour force)',      short: 'Troops % LF', group: 'Military',   scale: 'linear', format: pct },
  { id: 'SP.DYN.LE00.IN',     label: 'Life expectancy at birth (years)',      short: 'Life exp.',   group: 'Society & infrastructure', scale: 'linear', format: num1 },
  { id: 'SE.ADT.LITR.ZS',     label: 'Adult literacy rate (%)',               short: 'Literacy',    group: 'Society & infrastructure', scale: 'linear', format: pct },
  { id: 'SI.POV.GINI',        label: 'Gini index (inequality)',               short: 'Gini',        group: 'Society & infrastructure', scale: 'linear', format: num1 },
  { id: 'IT.NET.USER.ZS',     label: 'Internet users (% of population)',      short: 'Internet',    group: 'Society & infrastructure', scale: 'linear', format: pct },
  { id: 'EG.ELC.ACCS.ZS',     label: 'Access to electricity (% of population)', short: 'Electricity', group: 'Society & infrastructure', scale: 'linear', format: pct },
  { id: 'EG.USE.PCAP.KG.OE',  label: 'Energy use per capita (kg oil equivalent)', short: 'Energy/cap', group: 'Society & infrastructure', scale: 'log', format: compact },
]

export const INDICATOR_BY_ID = new Map(INDICATORS.map(i => [i.id, i]))
export const INDICATOR_GROUPS: IndicatorGroup[] = ['Economy', 'Population', 'Military', 'Society & infrastructure']

/** Indicators shown in the correlation matrix: broad coverage, one or two per theme. */
export const MATRIX_IDS = [
  'NY.GDP.PCAP.CD', 'SP.POP.TOTL', 'NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG', 'NE.TRD.GNFS.ZS',
  'MS.MIL.XPND.GD.ZS', 'MS.MIL.TOTL.TF.ZS', 'SP.DYN.LE00.IN', 'IT.NET.USER.ZS', 'EG.USE.PCAP.KG.OE',
] as const

export interface Preset { title: string; x: string; y: string; blurb: string }

/** Well-known country comparisons to start from. The blurbs describe what is plotted, not what it will show. */
export const PRESETS: Preset[] = [
  { title: 'Wealth & health', x: 'NY.GDP.PCAP.CD', y: 'SP.DYN.LE00.IN', blurb: 'GDP per capita against life expectancy.' },
  { title: 'Defence burden', x: 'NY.GDP.PCAP.CD', y: 'MS.MIL.XPND.GD.ZS', blurb: 'GDP per capita against military spending as a share of GDP.' },
  { title: 'Army size', x: 'SP.POP.TOTL', y: 'MS.MIL.TOTL.P1', blurb: 'Population against armed forces personnel.' },
  { title: 'Digital divide', x: 'NY.GDP.PCAP.CD', y: 'IT.NET.USER.ZS', blurb: 'GDP per capita against internet users.' },
  { title: 'Openness', x: 'SP.POP.TOTL', y: 'NE.TRD.GNFS.ZS', blurb: 'Population against trade as a share of GDP.' },
  { title: 'Energy appetite', x: 'NY.GDP.PCAP.CD', y: 'EG.USE.PCAP.KG.OE', blurb: 'GDP per capita against energy use per person.' },
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
  iso2: string
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

/**
 * Pure parser for the World Bank `[meta, rows]` envelope: drops aggregates, nulls, non-numeric values and values older
 * than `minYear` (`mrnev=1` ignores the request's date range and can return 1990s figures), keeps the first row per country.
 */
export const MIN_YEAR = 2010

export function parseWorldBank(json: unknown, minYear = MIN_YEAR): CountryValue[] {
  const data = Array.isArray(json) && json.length === 2 ? json[1] : null
  if (!Array.isArray(data)) throw new Error('Unexpected World Bank response shape')
  const seen = new Set<string>()
  const out: CountryValue[] = []
  for (const d of data as { value?: unknown; date?: unknown; countryiso3code?: unknown; country?: { id?: unknown; value?: unknown } }[]) {
    const iso2 = d?.country?.id, iso3 = d?.countryiso3code
    if (typeof d?.value !== 'number' || !Number.isFinite(d.value)) continue
    if (typeof iso2 !== 'string' || !iso2 || typeof iso3 !== 'string' || !iso3 || NON_COUNTRY_ISO3.has(iso3)) continue
    if (Number(d.date) < minYear) continue
    if (seen.has(iso2)) continue
    seen.add(iso2)
    out.push({ iso2, iso3, name: cleanCountryName(String(d.country?.value ?? iso2)), value: d.value, year: String(d.date ?? '') })
  }
  return out
}

const CACHE_TTL = 60 * 60 * 1000
const RETRY_DELAY_MS = 800
const cache = new Map<string, { at: number; rows: CountryValue[] }>()
const inflight = new Map<string, Promise<CountryValue[]>>()

/** Latest value per country for one indicator. Cached for an hour; concurrent calls share one request. */
export function fetchIndicatorAll(id: string): Promise<CountryValue[]> {
  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < CACHE_TTL) return Promise.resolve(hit.rows)
  const running = inflight.get(id)
  if (running) return running
  const url = `${WB_BASE}/country/all/indicator/${encodeURIComponent(id)}?format=json&per_page=20000&mrnev=1`
  const attempt = async (): Promise<CountryValue[]> => {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw Object.assign(new Error(`World Bank HTTP ${res.status}`), { transient: res.status === 429 || res.status >= 500 })
    return parseWorldBank(await res.json())
  }
  const p = (async () => {
    let rows: CountryValue[]
    try { rows = await attempt() } catch (e) {
      // one retry for throttling / server hiccups / network errors; a malformed body or a 4xx is not retried
      const transient = (e as { transient?: boolean }).transient ?? (e instanceof TypeError || (e as Error)?.name === 'TimeoutError')
      if (!transient) throw e
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      rows = await attempt()
    }
    cache.set(id, { at: Date.now(), rows })
    return rows
  })().finally(() => inflight.delete(id))
  inflight.set(id, p)
  return p
}
