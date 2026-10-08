/**
 * Higher-frequency macro data for European countries, from three free, keyless, CORS-open official sources:
 *  - ECB Data Portal (https://data-api.ecb.europa.eu) — ECB key rates, 10-year government bond yields (convergence
 *    series), bank lending rates (MIR), euro reference exchange rates
 *  - Eurostat dissemination API (JSON-stat 2.0) — HICP, unemployment, quarterly GDP, government debt and deficit,
 *    economic sentiment, house prices, nominal GDP
 *  - BIS (https://stats.bis.org) — central bank policy rates for countries outside the euro area
 *
 * Every series keeps its source and exact dataset/key so the panel can cite it. A series a country doesn't publish
 * comes back empty and is shown as "not published", never filled.
 */
import type { PeriodPt, Pt } from '../utils/econAnalysis'

const ECB = 'https://data-api.ecb.europa.eu/service/data'
const ESTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'
const BIS = 'https://stats.bis.org/api/v1/data'

/** EU member states plus the EFTA states Eurostat covers. ISO 3166-1 alpha-2. */
export const EUROPE = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'NO', 'IS', 'CH'] as const

/** Year each member adopted the euro (ECB, "Our currency"). */
export const EURO_ADOPTION: Record<string, number> = {
  BE: 1999, DE: 1999, IE: 1999, ES: 1999, FR: 1999, IT: 1999, LU: 1999, NL: 1999, AT: 1999, PT: 1999, FI: 1999,
  GR: 2001, SI: 2007, CY: 2008, MT: 2008, SK: 2009, EE: 2011, LV: 2014, LT: 2015, HR: 2023, BG: 2026,
}

/** National currencies of the non-euro countries covered. */
export const CURRENCY: Record<string, string> = { CZ: 'CZK', DK: 'DKK', HU: 'HUF', PL: 'PLN', RO: 'RON', SE: 'SEK', NO: 'NOK', IS: 'ISK', CH: 'CHF' }

export const isEurope = (iso2: string) => (EUROPE as readonly string[]).includes(iso2)
export const isEuroMember = (iso2: string) => iso2 in EURO_ADOPTION
/** Eurostat uses EL for Greece. */
export const estatGeo = (iso2: string) => (iso2 === 'GR' ? 'EL' : iso2)
/** Euro area in its current composition (21 members since Bulgaria joined on 1 January 2026). */
export const EA = 'EA21'

// ── Period handling ──────────────────────────────────────────────────────────

/** "2026", "2026-Q2", "2026-08", "2026-08-14" → a UTC timestamp in the middle of that period. */
export function periodTime(period: string): number {
  const y = Number(period.slice(0, 4))
  let m: RegExpMatchArray | null
  if ((m = period.match(/^\d{4}-Q([1-4])$/))) return Date.UTC(y, (Number(m[1]) - 1) * 3 + 1, 15)
  if ((m = period.match(/^\d{4}-(\d{2})$/))) return Date.UTC(y, Number(m[1]) - 1, 15)
  if ((m = period.match(/^\d{4}-(\d{2})-(\d{2})$/))) return Date.UTC(y, Number(m[1]) - 1, Number(m[2]))
  return Date.UTC(y, 6, 1)
}

const pt = (period: string, value: number): PeriodPt => ({ period, t: periodTime(period), value })

// ── Parsers ──────────────────────────────────────────────────────────────────

interface JsonStat {
  id?: string[]
  size?: number[]
  value?: Record<string, number | null> | (number | null)[]
  dimension?: Record<string, { category?: { index?: Record<string, number> } }>
  error?: unknown
}

/**
 * Splits a Eurostat JSON-stat response into one series per value of `by` (e.g. per geo), keyed by that dimension's
 * code. Every other dimension except time must have been fixed by the query; if not, the first category is taken.
 */
export function parseJsonStat(json: unknown, by = 'geo'): Record<string, PeriodPt[]> {
  const j = json as JsonStat
  if (!j || !Array.isArray(j.id) || !Array.isArray(j.size) || !j.dimension || !j.value) return {}
  const ids = j.id, size = j.size
  const strides = ids.map((_, k) => size.slice(k + 1).reduce((a, b) => a * b, 1))
  const inv = (dim: string) => Object.fromEntries(Object.entries(j.dimension![dim]?.category?.index ?? {}).map(([code, i]) => [i, code]))
  const tk = ids.indexOf('time'), bk = ids.indexOf(by)
  if (tk < 0) return {}
  const times = inv('time'), byCodes = bk >= 0 ? inv(by) : { 0: by }
  const out: Record<string, PeriodPt[]> = {}
  const entries = Array.isArray(j.value) ? j.value.map((v, i) => [String(i), v] as const) : Object.entries(j.value)
  for (const [key, v] of entries) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const idx = Number(key)
    const pos = ids.map((_, k) => Math.floor(idx / strides[k]) % size[k])
    if (ids.some((d, k) => k !== tk && k !== bk && pos[k] !== 0)) continue
    const code = byCodes[bk >= 0 ? pos[bk] : 0]
    const period = times[pos[tk]]
    if (code === undefined || period === undefined) continue
    ;(out[code] ??= []).push(pt(period, v))
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.t - b.t)
  return out
}

interface SdmxJson {
  dataSets?: { series?: Record<string, { observations?: Record<string, (number | null)[]> }> }[]
  structure?: { dimensions?: { observation?: { values?: { id?: string }[] }[] } }
}

/** First series of an ECB SDMX-JSON ("jsondata") response. */
export function parseSdmxJson(json: unknown): PeriodPt[] {
  const j = json as SdmxJson
  const series = j?.dataSets?.[0]?.series
  const times = j?.structure?.dimensions?.observation?.[0]?.values
  if (!series || !times) return []
  const first = Object.values(series)[0]
  const out: PeriodPt[] = []
  for (const [i, obs] of Object.entries(first?.observations ?? {})) {
    const period = times[Number(i)]?.id
    const v = obs?.[0]
    if (period && typeof v === 'number' && Number.isFinite(v)) out.push(pt(period, v))
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Splits one CSV line, honouring double-quoted fields. */
export function csvLine(line: string): string[] {
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out
}

/** BIS SDMX CSV → points (TIME_PERIOD, OBS_VALUE columns). */
export function parseBisCsv(text: string): PeriodPt[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const head = csvLine(lines[0])
  const ti = head.indexOf('TIME_PERIOD'), vi = head.indexOf('OBS_VALUE')
  if (ti < 0 || vi < 0) return []
  const out: PeriodPt[] = []
  for (const l of lines.slice(1)) {
    const f = csvLine(l)
    const v = Number(f[vi])
    if (f[ti] && f[vi] !== '' && Number.isFinite(v)) out.push(pt(f[ti], v))
  }
  return out.sort((a, b) => a.t - b.t)
}

/**
 * ECB key rates are published only on the dates they change. Turns those change points into a month-end step series
 * running to `until` (the rate in force at the end of each month).
 */
export function stepMonthly(changes: PeriodPt[], until = Date.now()): PeriodPt[] {
  if (!changes.length) return []
  const out: PeriodPt[] = []
  const d0 = new Date(changes[0].t)
  let y = d0.getUTCFullYear(), m = d0.getUTCMonth()
  const end = new Date(until)
  let k = 0, cur = changes[0].value
  while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth())) {
    const monthEnd = Date.UTC(y, m + 1, 1) - 1
    while (k < changes.length && changes[k].t <= monthEnd) cur = changes[k++].value
    out.push(pt(`${y}-${String(m + 1).padStart(2, '0')}`, cur))
    if (++m === 12) { m = 0; y++ }
  }
  return out
}

// ── Fetching ─────────────────────────────────────────────────────────────────

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (res.status === 404) return null    // ECB answers 404 when a key has no data
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function eurostat(dataset: string, params: Record<string, string>, geos: string[], since: string): Promise<Record<string, PeriodPt[]>> {
  const q = new URLSearchParams(params)
  for (const g of geos) q.append('geo', g)
  q.set('sinceTimePeriod', since)
  const json = await getJson(`${ESTAT}/${dataset}?${q.toString()}`)
  if (json && typeof json === 'object' && 'error' in json) {
    // Eurostat returns an error body (not an HTTP error) when a filter matches nothing
    return {}
  }
  return parseJsonStat(json, 'geo')
}

/** Eurostat, keyed by na_item instead of geo (for one-country, several-item queries). */
async function eurostatItems(dataset: string, params: Record<string, string>, items: string[], geo: string, since: string): Promise<Record<string, PeriodPt[]>> {
  const q = new URLSearchParams(params)
  for (const it of items) q.append('na_item', it)
  q.set('geo', geo)
  q.set('sinceTimePeriod', since)
  const json = await getJson(`${ESTAT}/${dataset}?${q.toString()}`)
  if (json && typeof json === 'object' && 'error' in json) return {}
  return parseJsonStat(json, 'na_item')
}

export async function ecb(key: string, start = '2000-01'): Promise<PeriodPt[]> {
  const json = await getJson(`${ECB}/${key}?format=jsondata&startPeriod=${start}`)
  return json ? parseSdmxJson(json) : []
}

export async function bisPolicyRate(iso2: string, start = '2000-01'): Promise<PeriodPt[]> {
  const res = await fetch(`${BIS}/WS_CBPOL/M.${iso2}?startPeriod=${start}&format=csv`, { signal: AbortSignal.timeout(30000) })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return parseBisCsv(await res.text())
}

// ── The European bundle ──────────────────────────────────────────────────────

export type EuroSeriesId =
  | 'hicp' | 'unemployment' | 'gdp' | 'esi' | 'debtQ' | 'hpi'
  | 'yield10' | 'yieldDE' | 'policy' | 'ecbDfr' | 'ecbMro' | 'ecbMlf' | 'mortgage' | 'corporate' | 'mortgageEA' | 'corporateEA' | 'fx'

export interface EuroSeries {
  label: string
  unit: string
  source: 'ECB' | 'Eurostat' | 'BIS'
  /** dataset and key, to cite */
  ref: string
  points: PeriodPt[]
  /** euro-area comparator, when the same series exists for it */
  ea?: PeriodPt[]
  /** set when the request failed (as opposed to the series simply not existing for this country) */
  error?: string
}

export interface EuropeAnnual {
  /** general government balance (B9), interest payable (D41PAY), gross debt (GD), % of GDP */
  balance: Pt[]
  interest: Pt[]
  debt: Pt[]
  /** nominal GDP, million EUR */
  nominalGdp: Pt[]
}

export interface EuropeData {
  iso2: string
  euroMember: boolean
  euroSince: number | null
  currency: string
  series: Partial<Record<EuroSeriesId, EuroSeries>>
  annual: EuropeAnnual
  errors: number
  fetchedAt: number
}

const toPts = (pp: PeriodPt[] | undefined): Pt[] => (pp ?? []).map(p => ({ x: Number(p.period.slice(0, 4)), y: p.value }))

const cache = new Map<string, EuropeData>()
const inflight = new Map<string, Promise<EuropeData>>()
const TTL = 60 * 60 * 1000

/** All European series for one country. Individual failures are recorded per series; never rejects. */
export function fetchEuropeData(iso2: string): Promise<EuropeData> {
  const hit = cache.get(iso2)
  if (hit && Date.now() - hit.fetchedAt < TTL) return Promise.resolve(hit)
  const running = inflight.get(iso2)
  if (running) return running
  const p = loadEurope(iso2).finally(() => inflight.delete(iso2))
  inflight.set(iso2, p)
  return p
}

async function loadEurope(iso2: string): Promise<EuropeData> {
  const geo = estatGeo(iso2)
  const member = isEuroMember(iso2)
  const cur = member ? 'EUR' : CURRENCY[iso2] ?? ''
  const series: Partial<Record<EuroSeriesId, EuroSeries>> = {}
  let errors = 0

  const pairs: [string, Record<string, string>, string, Omit<EuroSeries, 'points' | 'ea'>, EuroSeriesId][] = [
    ['prc_hicp_minr', { coicop18: 'TOTAL', unit: 'RCH_A' }, '2000-01', { label: 'HICP inflation', unit: '% y/y', source: 'Eurostat', ref: 'prc_hicp_minr · TOTAL · RCH_A' }, 'hicp'],
    ['une_rt_m', { sex: 'T', age: 'TOTAL', unit: 'PC_ACT', s_adj: 'SA' }, '2000-01', { label: 'Unemployment rate', unit: '% of labour force, SA', source: 'Eurostat', ref: 'une_rt_m · T · TOTAL · PC_ACT · SA' }, 'unemployment'],
    ['namq_10_gdp', { unit: 'CLV_PCH_SM', s_adj: 'SCA', na_item: 'B1GQ' }, '2000-Q1', { label: 'Real GDP growth', unit: '% vs same quarter a year earlier', source: 'Eurostat', ref: 'namq_10_gdp · B1GQ · CLV_PCH_SM · SCA' }, 'gdp'],
    ['ei_bssi_m_r2', { indic: 'BS-ESI-I', s_adj: 'SA' }, '2000-01', { label: 'Economic sentiment', unit: 'index, long-term average = 100', source: 'Eurostat', ref: 'ei_bssi_m_r2 · BS-ESI-I · SA' }, 'esi'],
    ['gov_10q_ggdebt', { unit: 'PC_GDP', sector: 'S13', na_item: 'GD' }, '2000-Q1', { label: 'Government debt', unit: '% of GDP, general government', source: 'Eurostat', ref: 'gov_10q_ggdebt · S13 · GD · PC_GDP' }, 'debtQ'],
    ['prc_hpi_q', { purchase: 'TOTAL', unit: 'RCH_A' }, '2005-Q1', { label: 'House prices', unit: '% y/y', source: 'Eurostat', ref: 'prc_hpi_q · TOTAL · RCH_A' }, 'hpi'],
  ]

  type Job = () => Promise<void>
  const jobs: Job[] = pairs.map(([ds, params, since, meta, id]) => async () => {
    try {
      const r = await eurostat(ds, params, [geo, EA], since)
      series[id] = { ...meta, points: r[geo] ?? [], ea: r[EA] }
    } catch (e) { errors++; series[id] = { ...meta, points: [], error: e instanceof Error ? e.message : String(e) } }
  })

  const ecbJob = (id: EuroSeriesId, key: string, meta: Omit<EuroSeries, 'points' | 'ref'>, map: (p: PeriodPt[]) => PeriodPt[] = p => p, start?: string): Job => async () => {
    try { series[id] = { ...meta, ref: key, points: map(await ecb(key, start)) } }
    catch (e) { errors++; series[id] = { ...meta, ref: key, points: [], error: e instanceof Error ? e.message : String(e) } }
  }

  // 10-year benchmark yield, Maastricht convergence series; the currency dimension is left open (national currency
  // before euro adoption).
  jobs.push(ecbJob('yield10', `IRS/M.${iso2}.L.L40.CI.0000..N.Z`, { label: '10-year government bond yield', unit: '% p.a.', source: 'ECB' }))
  if (iso2 !== 'DE') jobs.push(ecbJob('yieldDE', 'IRS/M.DE.L.L40.CI.0000.EUR.N.Z', { label: 'German 10-year yield (benchmark)', unit: '% p.a.', source: 'ECB' }))

  if (member) {
    jobs.push(ecbJob('ecbDfr', 'FM/B.U2.EUR.4F.KR.DFR.LEV', { label: 'ECB deposit facility rate', unit: '% p.a., month-end', source: 'ECB' }, p => stepMonthly(p), '1999-01'))
    jobs.push(ecbJob('ecbMro', 'FM/B.U2.EUR.4F.KR.MRR_FR.LEV', { label: 'ECB main refinancing rate', unit: '% p.a., month-end', source: 'ECB' }, p => stepMonthly(p), '1999-01'))
    jobs.push(ecbJob('ecbMlf', 'FM/B.U2.EUR.4F.KR.MLFR.LEV', { label: 'ECB marginal lending rate', unit: '% p.a., month-end', source: 'ECB' }, p => stepMonthly(p), '1999-01'))
    jobs.push(ecbJob('mortgage', `MIR/M.${iso2}.B.A2C.AM.R.A.2250.EUR.N`, { label: 'Cost of borrowing, house purchase', unit: '% p.a., new business', source: 'ECB' }, undefined, '2003-01'))
    jobs.push(ecbJob('corporate', `MIR/M.${iso2}.B.A2I.AM.R.A.2240.EUR.N`, { label: 'Cost of borrowing, corporations', unit: '% p.a., new business', source: 'ECB' }, undefined, '2003-01'))
    jobs.push(ecbJob('mortgageEA', 'MIR/M.U2.B.A2C.AM.R.A.2250.EUR.N', { label: 'Euro area, house purchase', unit: '% p.a.', source: 'ECB' }, undefined, '2003-01'))
    jobs.push(ecbJob('corporateEA', 'MIR/M.U2.B.A2I.AM.R.A.2240.EUR.N', { label: 'Euro area, corporations', unit: '% p.a.', source: 'ECB' }, undefined, '2003-01'))
    jobs.push(ecbJob('fx', 'EXR/M.USD.EUR.SP00.A', { label: 'US dollars per euro', unit: 'monthly average', source: 'ECB' }))
  } else {
    jobs.push(async () => {
      const meta = { label: 'Central bank policy rate', unit: '% p.a., month-end', source: 'BIS' as const, ref: `WS_CBPOL · M.${iso2}` }
      try { series.policy = { ...meta, points: await bisPolicyRate(iso2) } }
      catch (e) { errors++; series.policy = { ...meta, points: [], error: e instanceof Error ? e.message : String(e) } }
    })
    if (cur) jobs.push(ecbJob('fx', `EXR/M.${cur}.EUR.SP00.A`, { label: `${cur} per euro`, unit: 'monthly average, ECB reference rate', source: 'ECB' }))
  }

  const annual: EuropeAnnual = { balance: [], interest: [], debt: [], nominalGdp: [] }
  jobs.push(async () => {
    try {
      const r = await eurostatItems('gov_10dd_edpt1', { unit: 'PC_GDP', sector: 'S13' }, ['B9', 'D41PAY', 'GD'], geo, '1995')
      annual.balance = toPts(r.B9); annual.interest = toPts(r.D41PAY); annual.debt = toPts(r.GD)
    } catch { errors++ }
  })
  jobs.push(async () => {
    try {
      const r = await eurostat('nama_10_gdp', { unit: 'CP_MEUR', na_item: 'B1GQ' }, [geo], '1995')
      annual.nominalGdp = toPts(r[geo])
    } catch { errors++ }
  })

  const queue = [...jobs]
  await Promise.all(Array.from({ length: 4 }, async () => { for (let j = queue.shift(); j; j = queue.shift()) await j() }))

  // Policy rate used by the analysis: the ECB deposit facility rate for members, the BIS series otherwise.
  if (member && series.ecbDfr) series.policy = { ...series.ecbDfr, label: 'Policy rate (ECB deposit facility)' }

  const data: EuropeData = { iso2, euroMember: member, euroSince: EURO_ADOPTION[iso2] ?? null, currency: cur, series, annual, errors, fetchedAt: Date.now() }
  if (!errors) cache.set(iso2, data)
  return data
}
