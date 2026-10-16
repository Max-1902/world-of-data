/**
 * Country Lookup — every World Bank series this app shows for one country, with full history (World Bank Open Data,
 * free, no key: https://api.worldbank.org/v2/).
 *
 * The first four categories are the World Bank DataBank country profile, indicator for indicator. The rest add the
 * series needed for economic analysis. Labels shown as the official indicator name come from the API response itself,
 * not from this file; `short` is only a compact label for dense rows. History is requested from 1960, where the WDI
 * series begin; most countries start later for most series.
 *
 * Three World Bank sources are used: World Development Indicators (2), Worldwide Governance Indicators (3) and the
 * Human Capital Index (63). The API only batches indicators from one source per request.
 */
import type { Pt } from '../utils/econAnalysis'
import { CAPITALS } from './capitals'

const WB_BASE = 'https://api.worldbank.org/v2'
export const FIRST_YEAR = 1960

export type UnitKind = 'usd' | 'pct' | 'growth' | 'count' | 'num' | 'index'

export interface WbSeriesMeta {
  id: string
  short: string
  kind: UnitKind
  source: 2 | 3 | 63
}

export interface Category {
  id: string
  title: string
  /** whether this category is part of the World Bank's own country profile */
  profile: boolean
  blurb: string
  series: WbSeriesMeta[]
}

const s = (id: string, short: string, kind: UnitKind, source: 2 | 3 | 63 = 2): WbSeriesMeta => ({ id, short, kind, source })

export const CATEGORIES: Category[] = [
  {
    id: 'social', title: 'Social', profile: true, blurb: 'Health, poverty, population and human capital',
    series: [
      s('SP.DYN.LE00.IN', 'Life expectancy (years)', 'num'),
      s('SI.POV.DDAY', 'Poverty at $3.00/day (%)', 'pct'),
      s('SP.POP.TOTL', 'Population', 'count'),
      s('SP.POP.GROW', 'Population growth (%)', 'growth'),
      s('SM.POP.NETM', 'Net migration', 'count'),
      s('HD.HCI.OVRL', 'Human Capital Index (0–1)', 'index', 63),
    ],
  },
  {
    id: 'economic', title: 'Economic', profile: true, blurb: 'Output, growth, jobs and prices',
    series: [
      s('NY.GDP.MKTP.CD', 'GDP (current US$)', 'usd'),
      s('NY.GDP.PCAP.CD', 'GDP per capita (US$)', 'usd'),
      s('NY.GDP.MKTP.KD.ZG', 'GDP growth (%)', 'growth'),
      s('SL.UEM.TOTL.ZS', 'Unemployment (%)', 'pct'),
      s('FP.CPI.TOTL.ZG', 'Inflation, CPI (%)', 'growth'),
      s('BX.TRF.PWKR.DT.GD.ZS', 'Remittances received (% GDP)', 'pct'),
    ],
  },
  {
    id: 'environment', title: 'Environment', profile: true, blurb: 'Energy access, land, emissions and water',
    series: [
      s('EG.ELC.ACCS.ZS', 'Access to electricity (%)', 'pct'),
      s('AG.LND.FRST.ZS', 'Forest area (% land)', 'pct'),
      s('EN.GHG.CO2.PC.CE.AR5', 'CO₂ per capita (t)', 'num'),
      s('ER.H2O.FWTL.ZS', 'Freshwater withdrawals (% resources)', 'pct'),
      s('EG.ELC.RNWX.ZS', 'Renewable power ex. hydro (%)', 'pct'),
      s('SH.STA.SMSS.ZS', 'Safely managed sanitation (%)', 'pct'),
    ],
  },
  {
    id: 'institutions', title: 'Institutions', profile: true, blurb: 'Connectivity, safety, representation, debt, statistics',
    series: [
      s('IT.NET.USER.ZS', 'Internet users (%)', 'pct'),
      s('VC.IHR.PSRC.P5', 'Homicides per 100k', 'num'),
      s('SG.GEN.PARL.ZS', 'Women in parliament (%)', 'pct'),
      s('GC.DOD.TOTL.GD.ZS', 'Central gov. debt (% GDP)', 'pct'),
      s('IQ.SPI.OVRL', 'Statistical performance (0–100)', 'index'),
      s('BX.KLT.DINV.WD.GD.ZS', 'FDI net inflows (% GDP)', 'pct'),
    ],
  },
  {
    id: 'output', title: 'Output & income', profile: false, blurb: 'Real (constant-price) output, income and the price deflator',
    series: [
      s('NY.GDP.MKTP.KD', 'Real GDP (constant US$)', 'usd'),
      s('NY.GDP.PCAP.KD', 'Real GDP per capita', 'usd'),
      s('NY.GDP.PCAP.KD.ZG', 'Real GDP per capita growth (%)', 'growth'),
      s('NY.GDP.PCAP.PP.CD', 'GDP per capita, PPP', 'usd'),
      s('NY.GNP.PCAP.CD', 'GNI per capita, Atlas', 'usd'),
      s('NY.GNP.PCAP.PP.CD', 'GNI per capita, PPP', 'usd'),
      s('NY.GDP.DEFL.KD.ZG', 'GDP deflator (%)', 'growth'),
    ],
  },
  {
    id: 'structure', title: 'Demand & structure', profile: false, blurb: 'What GDP is spent on and which sectors produce it',
    series: [
      s('NE.CON.PRVT.ZS', 'Household consumption (% GDP)', 'pct'),
      s('NE.CON.GOVT.ZS', 'Government consumption (% GDP)', 'pct'),
      s('NE.GDI.TOTL.ZS', 'Gross capital formation (% GDP)', 'pct'),
      s('NY.GNS.ICTR.ZS', 'Gross savings (% GDP)', 'pct'),
      s('NE.EXP.GNFS.ZS', 'Exports (% GDP)', 'pct'),
      s('NE.IMP.GNFS.ZS', 'Imports (% GDP)', 'pct'),
      s('NV.AGR.TOTL.ZS', 'Agriculture (% GDP)', 'pct'),
      s('NV.IND.TOTL.ZS', 'Industry (% GDP)', 'pct'),
      s('NV.IND.MANF.ZS', 'Manufacturing (% GDP)', 'pct'),
      s('NV.SRV.TOTL.ZS', 'Services (% GDP)', 'pct'),
    ],
  },
  {
    id: 'fiscal', title: 'Public finance', profile: false, blurb: 'Central government balance, revenue and spending',
    series: [
      s('GC.NLD.TOTL.GD.ZS', 'Net lending/borrowing (% GDP)', 'pct'),
      s('GC.REV.XGRT.GD.ZS', 'Revenue ex. grants (% GDP)', 'pct'),
      s('GC.XPN.TOTL.GD.ZS', 'Expense (% GDP)', 'pct'),
      s('GC.TAX.TOTL.GD.ZS', 'Tax revenue (% GDP)', 'pct'),
      s('MS.MIL.XPND.GD.ZS', 'Military spending (% GDP)', 'pct'),
    ],
  },
  {
    id: 'finance', title: 'Money & finance', profile: false, blurb: 'Money, credit, interest rates, banks and markets',
    series: [
      s('FM.LBL.BMNY.ZG', 'Broad money growth (%)', 'growth'),
      s('FS.AST.PRVT.GD.ZS', 'Private credit (% GDP)', 'pct'),
      s('FR.INR.LEND', 'Lending rate (%)', 'pct'),
      s('FR.INR.DPST', 'Deposit rate (%)', 'pct'),
      s('FR.INR.RINR', 'Real interest rate (%)', 'pct'),
      s('FB.AST.NPER.ZS', 'Non-performing loans (%)', 'pct'),
      s('CM.MKT.LCAP.GD.ZS', 'Stock market cap. (% GDP)', 'pct'),
      s('PA.NUS.FCRF', 'Exchange rate (LCU per US$)', 'num'),
    ],
  },
  {
    id: 'external', title: 'External sector', profile: false, blurb: 'Balance of payments, reserves, external debt and trade mix',
    series: [
      s('BN.CAB.XOKA.GD.ZS', 'Current account (% GDP)', 'pct'),
      s('NE.TRD.GNFS.ZS', 'Trade (% GDP)', 'pct'),
      s('FI.RES.TOTL.MO', 'Reserves (months of imports)', 'num'),
      s('FI.RES.TOTL.CD', 'Total reserves (US$)', 'usd'),
      s('DT.DOD.DECT.GN.ZS', 'External debt (% GNI)', 'pct'),
      s('TX.VAL.TECH.MF.ZS', 'High-tech exports (% manuf.)', 'pct'),
      s('TX.VAL.FUEL.ZS.UN', 'Fuel exports (% merch.)', 'pct'),
      s('TM.TAX.MRCH.WM.AR.ZS', 'Applied tariff, weighted (%)', 'pct'),
      s('NY.GDP.TOTL.RT.ZS', 'Natural resource rents (% GDP)', 'pct'),
    ],
  },
  {
    id: 'labour', title: 'Labour market', profile: false, blurb: 'Participation, employment and youth unemployment (ILO modelled estimates)',
    series: [
      s('SL.TLF.CACT.ZS', 'Labour force participation (%)', 'pct'),
      s('SL.TLF.CACT.FE.ZS', 'Female participation (%)', 'pct'),
      s('SL.EMP.TOTL.SP.ZS', 'Employment-to-population (%)', 'pct'),
      s('SL.UEM.1524.ZS', 'Youth unemployment (%)', 'pct'),
    ],
  },
  {
    id: 'inequality', title: 'Poverty & inequality', profile: false, blurb: 'Distribution of income (survey years only)',
    series: [
      s('SI.POV.GINI', 'Gini index', 'num'),
      s('SI.DST.10TH.10', 'Income share, top 10% (%)', 'pct'),
      s('SI.POV.LMIC', 'Poverty at $4.20/day (%)', 'pct'),
    ],
  },
  {
    id: 'demography', title: 'Demography & health', profile: false, blurb: 'Ageing, fertility, urbanisation, mortality, health spending',
    series: [
      s('SP.POP.65UP.TO.ZS', 'Aged 65+ (%)', 'pct'),
      s('SP.POP.DPND', 'Age dependency ratio (%)', 'pct'),
      s('SP.DYN.TFRT.IN', 'Fertility (births per woman)', 'num'),
      s('SP.URB.TOTL.IN.ZS', 'Urban population (%)', 'pct'),
      s('SH.DYN.MORT', 'Under-5 mortality (per 1,000)', 'num'),
      s('SP.DYN.IMRT.IN', 'Infant mortality (per 1,000)', 'num'),
      s('SH.XPD.CHEX.GD.ZS', 'Health spending (% GDP)', 'pct'),
      s('SH.H2O.SMDW.ZS', 'Safely managed water (%)', 'pct'),
    ],
  },
  {
    id: 'education', title: 'Education & innovation', profile: false, blurb: 'Schooling, research and technology adoption',
    series: [
      s('SE.XPD.TOTL.GD.ZS', 'Education spending (% GDP)', 'pct'),
      s('SE.PRM.ENRR', 'Primary enrolment (% gross)', 'pct'),
      s('SE.TER.ENRR', 'Tertiary enrolment (% gross)', 'pct'),
      s('SE.ADT.LITR.ZS', 'Adult literacy (%)', 'pct'),
      s('GB.XPD.RSDV.GD.ZS', 'R&D spending (% GDP)', 'pct'),
      s('IP.PAT.RESD', 'Patent applications, residents', 'count'),
      s('IT.CEL.SETS.P2', 'Mobile subscriptions per 100', 'num'),
    ],
  },
  {
    id: 'energy', title: 'Energy & air', profile: false, blurb: 'Energy use, renewables and air pollution',
    series: [
      s('EG.USE.PCAP.KG.OE', 'Energy use (kg oil eq./capita)', 'num'),
      s('EG.FEC.RNEW.ZS', 'Renewables (% final energy)', 'pct'),
      s('EN.ATM.PM25.MC.M3', 'PM2.5 exposure (µg/m³)', 'num'),
    ],
  },
  {
    id: 'governance', title: 'Governance', profile: false, blurb: 'Worldwide Governance Indicators: estimates on a standard-normal scale, roughly −2.5 to +2.5',
    series: [
      s('GOV_WGI_VA.EST', 'Voice & accountability', 'index', 3),
      s('GOV_WGI_PV.EST', 'Political stability', 'index', 3),
      s('GOV_WGI_GE.EST', 'Government effectiveness', 'index', 3),
      s('GOV_WGI_RQ.EST', 'Regulatory quality', 'index', 3),
      s('GOV_WGI_RL.EST', 'Rule of law', 'index', 3),
      s('GOV_WGI_CC.EST', 'Control of corruption', 'index', 3),
    ],
  },
]

export const ALL_SERIES: WbSeriesMeta[] = CATEGORIES.flatMap(c => c.series)
export const SERIES_BY_ID = new Map(ALL_SERIES.map(m => [m.id, m]))

// ── Formatting ───────────────────────────────────────────────────────────────

const compact = (a: number): string =>
  a >= 1e12 ? `${+(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${+(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${+(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${+(a / 1e3).toFixed(1)}K` : a.toLocaleString('en-US', { maximumFractionDigits: 0 })

export function formatValue(kind: UnitKind, v: number): string {
  const neg = v < 0 ? '−' : ''
  const a = Math.abs(v)
  switch (kind) {
    case 'usd': return `${neg}$${compact(a)}`
    case 'count': return `${neg}${compact(a)}`
    case 'pct': return `${neg}${a.toFixed(a >= 100 ? 0 : 1)}%`
    case 'growth': return `${v > 0 ? '+' : neg}${a.toFixed(1)}%`
    case 'index': return `${neg}${a.toFixed(a >= 10 ? 1 : 2)}`
    default: return `${neg}${a >= 1000 ? compact(a) : a.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2)}`
  }
}

/** Units of a trend slope: percentages move in percentage points. */
export function formatSlope(kind: UnitKind, perYear: number): string {
  const sign = perYear > 0 ? '+' : perYear < 0 ? '−' : ''
  const a = Math.abs(perYear)
  if (kind === 'pct' || kind === 'growth') return `${sign}${a.toFixed(a >= 1 ? 1 : 2)} pp/yr`
  return `${sign}${formatValue(kind === 'usd' ? 'usd' : kind === 'count' ? 'count' : 'num', a).replace('−', '')}/yr`
}

/** Level series in money or headcounts are compared in log changes (% growth); rates and shares in raw differences. */
export const changeMode = (kind: UnitKind): 'diff' | 'log' => (kind === 'usd' || kind === 'count' ? 'log' : 'diff')

// ── Country list ─────────────────────────────────────────────────────────────

export interface WbCountry { iso2: string; iso3: string; name: string; region: string; incomeLevel: string; capital: string }

let countriesCache: Promise<WbCountry[]> | null = null

/** Every economy the World Bank reports on (aggregates such as "Euro area" are excluded). Throws on failure. */
export function fetchCountryList(): Promise<WbCountry[]> {
  if (!countriesCache) {
    countriesCache = (async () => {
      const res = await fetch(`${WB_BASE}/country?format=json&per_page=400`, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`World Bank HTTP ${res.status}`)
      const json: unknown = await res.json()
      const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] as Record<string, unknown>[] : []
      const out: WbCountry[] = []
      for (const r of rows) {
        const region = (r.region as { value?: string } | undefined)?.value ?? ''
        if (typeof r.iso2Code !== 'string' || typeof r.name !== 'string' || !region || region === 'Aggregates') continue
        out.push({
          iso2: r.iso2Code, iso3: typeof r.id === 'string' ? r.id : '', name: r.name, region: region.trim(),
          incomeLevel: (r.incomeLevel as { value?: string } | undefined)?.value ?? '',
          // canonical names (services/capitals.ts), not World Bank's capitalCity ("Kiev"); disputed capitals stay blank
          capital: CAPITALS[r.iso2Code] ?? '',
        })
      }
      if (!out.length) throw new Error('World Bank returned no countries')
      return out.sort((a, b) => a.name.localeCompare(b.name))
    })()
    countriesCache.catch(() => { countriesCache = null })
  }
  return countriesCache
}

// ── Country dataset ──────────────────────────────────────────────────────────

export interface SeriesData {
  /** official World Bank indicator name, from the response */
  name: string
  points: Pt[]
}

export interface CountryDataset {
  iso2: string
  name: string
  series: Record<string, SeriesData>
  /** requests that failed: their indicators are missing for a network reason, not because the World Bank lacks data */
  failedBatches: number
  totalBatches: number
  /** World Bank "lastupdated" stamps seen in the responses */
  lastUpdated: string[]
  fetchedAt: number
}

const BATCH = 30
const TTL = 60 * 60 * 1000
const datasetCache = new Map<string, CountryDataset>()
const inflight = new Map<string, Promise<CountryDataset>>()

export function batches(): { source: number; ids: string[] }[] {
  const out: { source: number; ids: string[] }[] = []
  for (const src of [2, 3, 63] as const) {
    const ids = ALL_SERIES.filter(m => m.source === src).map(m => m.id)
    for (let i = 0; i < ids.length; i += BATCH) out.push({ source: src, ids: ids.slice(i, i + BATCH) })
  }
  return out
}

interface WbRow { indicator?: { id?: string; value?: string }; country?: { value?: string }; date?: string; value?: number | null }

async function fetchBatch(iso2: string, source: number, ids: string[]): Promise<{ rows: WbRow[]; lastUpdated: string | null }> {
  const to = new Date().getUTCFullYear()
  const url = `${WB_BASE}/country/${iso2}/indicator/${ids.join(';')}?source=${source}&format=json&date=${FIRST_YEAR}:${to}&per_page=20000`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`World Bank HTTP ${res.status}`)
  const json: unknown = await res.json()
  if (!Array.isArray(json)) throw new Error('World Bank: unexpected response')
  const meta = json[0] as { message?: { value?: string }[]; lastupdated?: string } | undefined
  if (meta?.message) throw new Error(`World Bank: ${meta.message[0]?.value ?? 'error'}`)
  return { rows: Array.isArray(json[1]) ? json[1] as WbRow[] : [], lastUpdated: meta?.lastupdated ?? null }
}

/**
 * All catalogue series for one country, from FIRST_YEAR on. Resolves even when some batches fail (see
 * `failedBatches`); rejects only when every batch fails.
 */
export function fetchCountryDataset(iso2: string): Promise<CountryDataset> {
  const hit = datasetCache.get(iso2)
  if (hit && Date.now() - hit.fetchedAt < TTL) return Promise.resolve(hit)
  const running = inflight.get(iso2)
  if (running) return running
  const p = (async () => {
    const plan = batches()
    const series: Record<string, SeriesData> = {}
    const lastUpdated = new Set<string>()
    let failed = 0, name = iso2
    // two at a time: the World Bank rate-limits bursts
    const queue = [...plan]
    await Promise.all([0, 1].map(async () => {
      for (let b = queue.shift(); b; b = queue.shift()) {
        try {
          const { rows, lastUpdated: lu } = await fetchBatch(iso2, b.source, b.ids)
          if (lu) lastUpdated.add(lu)
          for (const r of rows) {
            const id = r.indicator?.id
            const year = Number(r.date)
            if (!id || !SERIES_BY_ID.has(id)) continue
            if (r.country?.value) name = r.country.value
            const entry = series[id] ??= { name: r.indicator?.value ?? id, points: [] }
            if (typeof r.value === 'number' && Number.isFinite(r.value) && Number.isInteger(year)) entry.points.push({ x: year, y: r.value })
          }
        } catch { failed++ }
      }
    }))
    if (failed === plan.length) throw new Error('World Bank unreachable')
    // one value per year, even if a response repeats a row
    for (const v of Object.values(series)) v.points = [...new Map(v.points.map(p => [p.x, p])).values()].sort((a, b) => a.x - b.x)
    const data: CountryDataset = { iso2, name, series, failedBatches: failed, totalBatches: plan.length, lastUpdated: [...lastUpdated].sort(), fetchedAt: Date.now() }
    if (!failed) datasetCache.set(iso2, data)
    return data
  })().finally(() => inflight.delete(iso2))
  inflight.set(iso2, p)
  return p
}

/** Points for one series, or [] when the country does not report it. */
export const pointsOf = (d: CountryDataset | null, id: string): Pt[] => d?.series[id]?.points ?? []
