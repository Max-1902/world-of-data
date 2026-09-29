/**
 * World Bank Open Data API — free, no key required.
 * https://api.worldbank.org/v2/
 *
 * Bulk integration: instead of firing one request per indicator every time a
 * country is opened, each indicator is fetched ONCE for all countries
 * (`/country/all/indicator/{id}?mrnev=1`, most recent non-empty value per
 * country). The resulting dataset is kept in memory and persisted to
 * localStorage for 24h, so reloads and country switches are instant and the
 * World Bank is only hit again once the cache expires.
 *
 * Public API:
 *   loadWorldBankDataset()          — full dataset for every country (cached)
 *   fetchCountryEcon(name | iso2)   — one country's indicators (from dataset)
 *   getIndicatorAllCountries(id)    — one indicator across all countries
 *   fetchWorldBankIndicator(code)   — ANY World Bank indicator code, on demand
 */

const WB_BASE = 'https://api.worldbank.org/v2'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h — WB data is updated a few times a year
const LS_DATASET_KEY = 'wb:dataset:v2'
const LS_INDICATOR_PREFIX = 'wb:indicator:v1:'
const MAX_CONCURRENT = 6

type Group = 'ECONOMY' | 'DEMOGRAPHICS' | 'TRADE' | 'SECURITY & ENERGY'

// Indicators included in the bulk dataset (most recent year available)
const INDICATORS = {
  // Economy
  'NY.GDP.MKTP.CD':       { label: 'GDP (current US$)',                 group: 'ECONOMY' },
  'NY.GDP.PCAP.CD':       { label: 'GDP per capita (US$)',              group: 'ECONOMY' },
  'NY.GDP.PCAP.PP.CD':    { label: 'GDP per capita, PPP (US$)',         group: 'ECONOMY' },
  'NY.GNP.PCAP.CD':       { label: 'GNI per capita (US$)',              group: 'ECONOMY' },
  'NY.GDP.MKTP.KD.ZG':    { label: 'GDP growth (%)',                    group: 'ECONOMY' },
  'FP.CPI.TOTL.ZG':       { label: 'Inflation, CPI (%)',                group: 'ECONOMY' },
  'NY.GDP.DEFL.KD.ZG':    { label: 'GDP deflator inflation (%)',        group: 'ECONOMY' },
  'SL.UEM.TOTL.ZS':       { label: 'Unemployment (%)',                  group: 'ECONOMY' },
  'SL.TLF.CACT.ZS':       { label: 'Labor force participation (%)',     group: 'ECONOMY' },
  'GC.DOD.TOTL.GD.ZS':    { label: 'Gov. debt (% GDP)',                 group: 'ECONOMY' },
  'GC.REV.XGRT.GD.ZS':    { label: 'Gov. revenue (% GDP)',              group: 'ECONOMY' },
  'GC.TAX.TOTL.GD.ZS':    { label: 'Tax revenue (% GDP)',               group: 'ECONOMY' },
  'NV.AGR.TOTL.ZS':       { label: 'Agriculture (% GDP)',               group: 'ECONOMY' },
  'NV.IND.MANF.ZS':       { label: 'Manufacturing (% GDP)',             group: 'ECONOMY' },
  'NV.SRV.TOTL.ZS':       { label: 'Services (% GDP)',                  group: 'ECONOMY' },
  'NE.GDI.TOTL.ZS':       { label: 'Gross capital formation (% GDP)',   group: 'ECONOMY' },
  'NY.GNS.ICTR.ZS':       { label: 'Gross savings (% GDP)',             group: 'ECONOMY' },
  'FS.AST.PRVT.GD.ZS':    { label: 'Private credit (% GDP)',            group: 'ECONOMY' },
  'FR.INR.RINR':          { label: 'Real interest rate (%)',            group: 'ECONOMY' },
  'PA.NUS.FCRF':          { label: 'Exchange rate (LCU per US$)',       group: 'ECONOMY' },
  'FI.RES.TOTL.CD':       { label: 'Total reserves (US$)',              group: 'ECONOMY' },
  'DT.DOD.DECT.CD':       { label: 'External debt stock (US$)',         group: 'ECONOMY' },
  'SI.POV.GINI':          { label: 'GINI index',                        group: 'ECONOMY' },
  // Demographics
  'SP.POP.TOTL':          { label: 'Population',                        group: 'DEMOGRAPHICS' },
  'SP.POP.GROW':          { label: 'Population growth (%)',             group: 'DEMOGRAPHICS' },
  'SP.DYN.LE00.IN':       { label: 'Life expectancy (years)',           group: 'DEMOGRAPHICS' },
  'SE.ADT.LITR.ZS':       { label: 'Literacy rate (%)',                 group: 'DEMOGRAPHICS' },
  'SI.POV.DDAY':          { label: 'Extreme poverty, $2.15/day (%)',    group: 'DEMOGRAPHICS' },
  // Trade
  'NE.EXP.GNFS.CD':       { label: 'Exports (US$)',                     group: 'TRADE' },
  'NE.IMP.GNFS.CD':       { label: 'Imports (US$)',                     group: 'TRADE' },
  'BN.CAB.XOKA.CD':       { label: 'Current account (US$)',             group: 'TRADE' },
  'NE.TRD.GNFS.ZS':       { label: 'Trade (% GDP)',                     group: 'TRADE' },
  'TG.VAL.TOTL.GD.ZS':    { label: 'Merchandise trade (% GDP)',         group: 'TRADE' },
  'BX.KLT.DINV.CD.WD':    { label: 'FDI inflows (US$)',                 group: 'TRADE' },
  'BM.KLT.DINV.CD.WD':    { label: 'FDI outflows (US$)',                group: 'TRADE' },
  'BX.TRF.PWKR.CD.DT':    { label: 'Remittances received (US$)',        group: 'TRADE' },
  'IC.BUS.EASE.XQ':       { label: 'Ease of business score',            group: 'TRADE' },
  'TX.VAL.TECH.MF.ZS':    { label: 'High-tech exports (%)',             group: 'TRADE' },
  'TM.TAX.MRCH.WM.AR.ZS': { label: 'Tariff rate, applied (%)',          group: 'TRADE' },
  // Security & energy
  'MS.MIL.XPND.GD.ZS':    { label: 'Military spending (% GDP)',         group: 'SECURITY & ENERGY' },
  'EG.USE.PCAP.KG.OE':    { label: 'Energy use (kg oil eq/cap)',        group: 'SECURITY & ENERGY' },
  'EG.ELC.ACCS.ZS':       { label: 'Access to electricity (%)',         group: 'SECURITY & ENERGY' },
} as const satisfies Record<string, { label: string; group: Group }>

export type IndicatorId = keyof typeof INDICATORS
export const INDICATOR_IDS = Object.keys(INDICATORS) as IndicatorId[]
export function indicatorLabel(id: IndicatorId): string { return INDICATORS[id].label }

export interface EconIndicator {
  id: IndicatorId
  label: string
  value: number | null
  year: string
}

export interface CountryEconData {
  iso2: string
  iso3: string
  countryName: string
  indicators: EconIndicator[]
  fetchedAt: number
}

export interface WBCountryMeta {
  iso2: string
  iso3: string
  name: string
  region: string
  incomeLevel: string
}

/** Most recent value per country (keyed by ISO2) for one indicator. */
export type IndicatorSeries = Record<string, { value: number; year: string }>

export interface WorldBankDataset {
  fetchedAt: number
  countries: Record<string, WBCountryMeta>              // ISO2 → metadata (no aggregates)
  values: Partial<Record<IndicatorId, IndicatorSeries>> // indicator → ISO2 → value
}

// ── Low-level fetch helpers ──────────────────────────────────────────────────
async function wbFetch(path: string, timeoutMs = 20000): Promise<unknown[] | null> {
  try {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${WB_BASE}${path}${sep}format=json`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const json = await res.json()
    // Response is [metadata, dataArray]; errors come back as [{ message: [...] }]
    return Array.isArray(json) && json.length === 2 && Array.isArray(json[1]) ? json[1] : null
  } catch {
    return null
  }
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

function lsGet<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null } catch { return null }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota / private mode */ }
}
const fresh = (fetchedAt: number | undefined) => !!fetchedAt && Date.now() - fetchedAt < CACHE_TTL

async function fetchCountryMeta(): Promise<Record<string, WBCountryMeta> | null> {
  const rows = await wbFetch('/country?per_page=400')
  if (!rows) return null
  const out: Record<string, WBCountryMeta> = {}
  for (const r of rows as any[]) {
    if (!r?.iso2Code || r.region?.value === 'Aggregates') continue
    out[r.iso2Code] = {
      iso2: r.iso2Code, iso3: r.id, name: r.name,
      region: r.region?.value ?? '', incomeLevel: r.incomeLevel?.value ?? '',
    }
  }
  return out
}

/** One indicator for every country — a single request (~270 rows). */
async function fetchSeries(code: string): Promise<IndicatorSeries | null> {
  const rows = await wbFetch(`/country/all/indicator/${encodeURIComponent(code)}?mrnev=1&per_page=1000`)
  if (!rows) return null
  const out: IndicatorSeries = {}
  for (const r of rows as any[]) {
    const iso2 = r?.country?.id
    if (iso2 && r.value != null) out[iso2] = { value: Number(r.value), year: String(r.date) }
  }
  return out
}

// ── Bulk dataset ─────────────────────────────────────────────────────────────
let dataset: WorldBankDataset | null = lsGet<WorldBankDataset>(LS_DATASET_KEY)
let inflight: Promise<WorldBankDataset | null> | null = null

/**
 * Load every bulk indicator for every country. Served from memory/localStorage
 * when younger than 24h; concurrent callers share one in-flight request.
 */
export function loadWorldBankDataset(force = false): Promise<WorldBankDataset | null> {
  if (!force && dataset && fresh(dataset.fetchedAt)) return Promise.resolve(dataset)
  if (inflight) return inflight
  inflight = (async () => {
    const [countries, series] = await Promise.all([
      fetchCountryMeta(),
      mapLimited(INDICATOR_IDS, MAX_CONCURRENT, id => fetchSeries(id)),
    ])
    const values: WorldBankDataset['values'] = {}
    INDICATOR_IDS.forEach((id, i) => { if (series[i]) values[id] = series[i]! })
    if (!countries || Object.keys(values).length === 0) {
      // Network failure — keep serving stale data rather than nothing
      return dataset
    }
    // Drop aggregate rows (regions, income groups) from each series
    for (const s of Object.values(values)) {
      for (const iso2 of Object.keys(s!)) if (!countries[iso2]) delete s![iso2]
    }
    dataset = { fetchedAt: Date.now(), countries, values }
    lsSet(LS_DATASET_KEY, dataset)
    return dataset
  })().finally(() => { inflight = null })
  return inflight
}

/** One bulk indicator across all countries (sorted high → low). */
export async function getIndicatorAllCountries(id: IndicatorId): Promise<{ iso2: string; name: string; value: number; year: string }[]> {
  const ds = await loadWorldBankDataset()
  const s = ds?.values[id]
  if (!ds || !s) return []
  return Object.entries(s)
    .map(([iso2, v]) => ({ iso2, name: ds.countries[iso2]?.name ?? iso2, ...v }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Any World Bank indicator code (e.g. 'NY.GDP.MKTP.PP.CD', 'EN.ATM.CO2E.PC'),
 * fetched for all countries on first use and cached for 24h.
 */
const indicatorCache = new Map<string, { fetchedAt: number; series: IndicatorSeries }>()
export async function fetchWorldBankIndicator(code: string): Promise<IndicatorSeries | null> {
  if (code in INDICATORS) {
    const ds = await loadWorldBankDataset()
    const s = ds?.values[code as IndicatorId]
    if (s) return s
  }
  const mem = indicatorCache.get(code) ?? lsGet<{ fetchedAt: number; series: IndicatorSeries }>(LS_INDICATOR_PREFIX + code)
  if (mem && fresh(mem.fetchedAt)) { indicatorCache.set(code, mem); return mem.series }
  const series = await fetchSeries(code)
  if (!series) return mem?.series ?? null
  const entry = { fetchedAt: Date.now(), series }
  indicatorCache.set(code, entry)
  lsSet(LS_INDICATOR_PREFIX + code, entry)
  return series
}

// ── Country name → ISO2 mapping (common names + variants) ────────────────────
const NAME_TO_ISO2: Record<string, string> = {
  'afghanistan':'AF','albania':'AL','algeria':'DZ','angola':'AO','argentina':'AR',
  'armenia':'AM','australia':'AU','austria':'AT','azerbaijan':'AZ','bahrain':'BH',
  'bangladesh':'BD','belarus':'BY','belgium':'BE','benin':'BJ','bolivia':'BO',
  'bosnia':'BA','bosnia and herzegovina':'BA','botswana':'BW','brazil':'BR','brunei':'BN',
  'bulgaria':'BG','burkina faso':'BF','burundi':'BI','cambodia':'KH','cameroon':'CM',
  'canada':'CA','chad':'TD','chile':'CL','china':'CN','colombia':'CO',
  'congo':'CD','dr congo':'CD','democratic republic of the congo':'CD','costa rica':'CR',
  'croatia':'HR','cuba':'CU','cyprus':'CY','czech republic':'CZ','czechia':'CZ',
  'denmark':'DK','djibouti':'DJ','dominican republic':'DO','ecuador':'EC','egypt':'EG',
  'el salvador':'SV','eritrea':'ER','estonia':'EE','ethiopia':'ET','fiji':'FJ',
  'finland':'FI','france':'FR','gabon':'GA','georgia':'GE','germany':'DE',
  'ghana':'GH','greece':'GR','guatemala':'GT','guinea':'GN','haiti':'HT',
  'honduras':'HN','hungary':'HU','iceland':'IS','india':'IN','indonesia':'ID',
  'iran':'IR','iraq':'IQ','ireland':'IE','israel':'IL','italy':'IT',
  'ivory coast':'CI','jamaica':'JM','japan':'JP','jordan':'JO','kazakhstan':'KZ',
  'kenya':'KE','kosovo':'XK','kuwait':'KW','kyrgyzstan':'KG','laos':'LA',
  'latvia':'LV','lebanon':'LB','libya':'LY','lithuania':'LT','luxembourg':'LU',
  'madagascar':'MG','malaysia':'MY','mali':'ML','malta':'MT','mauritania':'MR',
  'mexico':'MX','moldova':'MD','mongolia':'MN','montenegro':'ME','morocco':'MA',
  'mozambique':'MZ','myanmar':'MM','namibia':'NA','nepal':'NP','netherlands':'NL',
  'new zealand':'NZ','nicaragua':'NI','niger':'NE','nigeria':'NG','north korea':'KP',
  'north macedonia':'MK','norway':'NO','oman':'OM','pakistan':'PK','palestine':'PS',
  'panama':'PA','papua new guinea':'PG','paraguay':'PY','peru':'PE','philippines':'PH',
  'poland':'PL','portugal':'PT','qatar':'QA','romania':'RO','russia':'RU',
  'rwanda':'RW','saudi arabia':'SA','senegal':'SN','serbia':'RS','sierra leone':'SL',
  'singapore':'SG','slovakia':'SK','slovenia':'SI','somalia':'SO','south africa':'ZA',
  's.africa':'ZA','south korea':'KR','s.korea':'KR','south sudan':'SS','spain':'ES',
  'sri lanka':'LK','sudan':'SD','sweden':'SE','switzerland':'CH','syria':'SY',
  'taiwan':'TW','tajikistan':'TJ','tanzania':'TZ','thailand':'TH','togo':'TG',
  'tunisia':'TN','turkey':'TR','turkmenistan':'TM','uganda':'UG','ukraine':'UA',
  'united arab emirates':'AE','uae':'AE','united kingdom':'GB','uk':'GB',
  'united states':'US','us':'US','usa':'US','uruguay':'UY','uzbekistan':'UZ',
  'venezuela':'VE','vietnam':'VN','yemen':'YE','zambia':'ZM','zimbabwe':'ZW',
  'falklands':'FK','gibraltar':'GI','bermuda':'BM','ascension is.':'SH',
  's.china sea':'CN','n.korea':'KP',
}

function resolveISO2(countryName: string, countries?: Record<string, WBCountryMeta>): string | null {
  const lc = countryName.toLowerCase().trim()
  // Direct match
  if (NAME_TO_ISO2[lc]) return NAME_TO_ISO2[lc]
  // 2-letter code already
  if (/^[A-Z]{2}$/.test(countryName)) return countryName
  // Exact World Bank name (covers every economy, e.g. "Cabo Verde", "Turkiye")
  if (countries) {
    for (const c of Object.values(countries)) {
      if (c.name.toLowerCase() === lc || c.iso3.toLowerCase() === lc) return c.iso2
    }
  }
  // Partial match
  for (const [name, code] of Object.entries(NAME_TO_ISO2)) {
    if (lc.includes(name) || name.includes(lc)) return code
  }
  return null
}

// ── Per-country view ─────────────────────────────────────────────────────────
export async function fetchCountryEcon(countryName: string): Promise<CountryEconData | null> {
  const ds = await loadWorldBankDataset()
  const iso2 = resolveISO2(countryName, ds?.countries)
  if (!iso2 || !ds) return null

  const indicators: EconIndicator[] = []
  for (const id of INDICATOR_IDS) {
    const v = ds.values[id]?.[iso2]
    if (v) indicators.push({ id, label: INDICATORS[id].label, value: v.value, year: v.year })
  }
  if (indicators.length === 0) return null

  const meta = ds.countries[iso2]
  return {
    iso2,
    iso3: meta?.iso3 ?? iso2,
    countryName: meta?.name ?? countryName,
    indicators,
    fetchedAt: ds.fetchedAt,
  }
}

// ── Format helpers ───────────────────────────────────────────────────────────
export function formatEconValue(id: IndicatorId, val: number): string {
  // Currency values
  if (id.includes('.CD') || id.includes('XOKA')) {
    const abs = Math.abs(val)
    if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
    if (abs >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
    if (abs >= 1e3) return `$${(val / 1e3).toFixed(0)}K`
    return `$${val.toFixed(0)}`
  }
  // Population
  if (id === 'SP.POP.TOTL') {
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
    if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`
    return val.toFixed(0)
  }
  // Percentages
  if (INDICATORS[id].label.includes('%')) {
    return `${val.toFixed(1)}%`
  }
  // Energy, life expectancy, GINI, exchange rate, etc.
  if (val >= 1000) return val.toFixed(0)
  return val.toFixed(val < 10 ? 2 : 1)
}

// Group indicators into logical sections for display
export function groupIndicators(indicators: EconIndicator[]): Record<string, EconIndicator[]> {
  const groups: Record<string, EconIndicator[]> = {
    'ECONOMY': [],
    'DEMOGRAPHICS': [],
    'TRADE': [],
    'SECURITY & ENERGY': [],
  }

  for (const ind of indicators) groups[INDICATORS[ind.id].group].push(ind)

  // Remove empty groups
  for (const key of Object.keys(groups)) {
    if (groups[key].length === 0) delete groups[key]
  }

  return groups
}
