/**
 * Cross-border displacement corridors and per-country displacement totals, live from the
 * UNHCR Refugee Data Finder API (api.unhcr.org/population/v1 — free, keyless, CORS-open).
 *
 * One request per year returns every origin → country-of-asylum pair UNHCR publishes. The latest
 * year with data is compared with the year before it, so each corridor and country carries a real
 * year-on-year change ("wave") rather than a guessed trend. Everything here is UNHCR's own numbers;
 * the only thing added is a map point per country (Natural Earth label points, see
 * scripts/build-country-anchors.mjs). The lines drawn from these are origin → host links, not
 * travel routes: UNHCR does not publish the path people took.
 *
 * Coverage notes worth showing next to the data:
 *  - Palestine refugees under UNRWA's mandate are not in UNHCR's figures.
 *  - IDP figures are those UNHCR reports (conflict-related, largely from IDMC); IOM DTM rounds
 *    (src/services/dtm.ts) are more recent and survey-based for the countries DTM covers.
 *  - A year-on-year change in a stock can be new arrivals, returns, onward movement or a change in
 *    how a host registers people; it is not a count of new crossings.
 */
import anchorsFile from '../data/country-anchors.json'

const UNHCR_API = 'https://api.unhcr.org/population/v1/population/'

/** Corridors smaller than this are folded into country totals only (keeps the map readable). */
export const MIN_CORRIDOR = 50_000
/** A change of at least this fraction either way counts as rising / falling. */
export const TREND_THRESHOLD = 0.15

export type Trend = 'new' | 'rising' | 'steady' | 'falling'

export interface Corridor {
  from: string          // ISO3 of origin
  to: string            // ISO3 of country of asylum
  fromName: string
  toName: string
  fromIso2: string
  toIso2: string
  fromPoint: [number, number]  // [lng, lat]
  toPoint: [number, number]
  /** refugees + asylum-seekers + other people in need of international protection */
  count: number
  prev: number
  refugees: number
  asylumSeekers: number
  oip: number
  trend: Trend
}

export interface CountryDisplacement {
  iso3: string
  iso2: string
  name: string
  point: [number, number]
  /** people from this country displaced abroad (refugees + asylum-seekers + OIP) */
  abroad: number
  abroadPrev: number
  /** people displaced inside this country (UNHCR-reported IDPs) */
  idps: number
  idpsPrev: number
  /** people from other countries hosted here */
  hosted: number
  hostedPrev: number
  /** abroad + idps, the country's total forcibly displaced population */
  displaced: number
  trend: Trend
  hostedTrend: Trend
}

export interface DisplacementSnapshot {
  year: number
  prevYear: number
  corridors: Corridor[]          // count ≥ MIN_CORRIDOR, largest first
  countries: CountryDisplacement[] // largest displaced first
  /** people counted in pairs we can't place (origin "Unknown", "Stateless", …) */
  unplaced: number
  fetchedAt: number
}

type Anchor = [number, number, string, string]
const ANCHORS = (anchorsFile as unknown as { anchors: Record<string, Anchor> }).anchors

interface UnhcrRow {
  coo_iso?: string; coa_iso?: string; coo_name?: string; coa_name?: string
  refugees?: number | string; asylum_seekers?: number | string; oip?: number | string; idps?: number | string
}

/** UNHCR returns numbers, numeric strings, "0" and "-" (not applicable) in the same column. */
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function trendOf(cur: number, prev: number): Trend {
  if (prev <= 0) return cur > 0 ? 'new' : 'steady'
  const change = (cur - prev) / prev
  if (change >= TREND_THRESHOLD) return 'rising'
  if (change <= -TREND_THRESHOLD) return 'falling'
  return 'steady'
}

interface Tally { refugees: number; asylumSeekers: number; oip: number; count: number }

function tallyPairs(rows: UnhcrRow[]) {
  const pairs = new Map<string, Tally>()
  const idps = new Map<string, number>()
  for (const r of rows) {
    const from = r.coo_iso, to = r.coa_iso
    if (!from || !to) continue
    if (from === to) {
      const n = num(r.idps)
      if (n) idps.set(from, (idps.get(from) ?? 0) + n)
      continue
    }
    const t = { refugees: num(r.refugees), asylumSeekers: num(r.asylum_seekers), oip: num(r.oip), count: 0 }
    t.count = t.refugees + t.asylumSeekers + t.oip
    if (!t.count) continue
    const key = `${from}>${to}`
    const prev = pairs.get(key)
    if (prev) { prev.refugees += t.refugees; prev.asylumSeekers += t.asylumSeekers; prev.oip += t.oip; prev.count += t.count }
    else pairs.set(key, t)
  }
  return { pairs, idps }
}

/** Pure: turns two years of UNHCR rows into corridors and country totals. Exported for tests. */
export function buildSnapshot(cur: UnhcrRow[], prev: UnhcrRow[], year: number, now = Date.now()): DisplacementSnapshot {
  const a = tallyPairs(cur), b = tallyPairs(prev)
  const corridors: Corridor[] = []
  const countries = new Map<string, CountryDisplacement>()
  let unplaced = 0

  const country = (iso3: string): CountryDisplacement | null => {
    const anchor = ANCHORS[iso3]
    if (!anchor) return null
    let c = countries.get(iso3)
    if (!c) {
      c = { iso3, iso2: anchor[3], name: anchor[2], point: [anchor[0], anchor[1]], abroad: 0, abroadPrev: 0, idps: 0, idpsPrev: 0, hosted: 0, hostedPrev: 0, displaced: 0, trend: 'steady', hostedTrend: 'steady' }
      countries.set(iso3, c)
    }
    return c
  }

  for (const [key, t] of a.pairs) {
    const [from, to] = key.split('>')
    const o = country(from), d = country(to)
    // Hosted totals count everyone a country hosts, placeable origin or not.
    if (d) d.hosted += t.count
    if (!o || !d) { unplaced += t.count; continue }
    o.abroad += t.count
    const p = b.pairs.get(key)?.count ?? 0
    if (t.count >= MIN_CORRIDOR) {
      corridors.push({
        from, to, fromName: o.name, toName: d.name, fromIso2: o.iso2, toIso2: d.iso2,
        fromPoint: o.point, toPoint: d.point,
        count: t.count, prev: p, refugees: t.refugees, asylumSeekers: t.asylumSeekers, oip: t.oip,
        trend: trendOf(t.count, p),
      })
    }
  }
  for (const [key, t] of b.pairs) {
    const [from, to] = key.split('>')
    const d = ANCHORS[to] ? country(to) : null
    if (d) d.hostedPrev += t.count
    if (ANCHORS[from] && ANCHORS[to]) country(from)!.abroadPrev += t.count
  }
  for (const [iso3, n] of a.idps) { const c = country(iso3); if (c) c.idps = n }
  for (const [iso3, n] of b.idps) { const c = country(iso3); if (c) c.idpsPrev = n }

  for (const c of countries.values()) {
    c.displaced = c.abroad + c.idps
    c.trend = trendOf(c.displaced, c.abroadPrev + c.idpsPrev)
    c.hostedTrend = trendOf(c.hosted, c.hostedPrev)
  }

  return {
    year, prevYear: year - 1,
    corridors: corridors.sort((x, y) => y.count - x.count),
    countries: [...countries.values()].filter(c => c.displaced > 0 || c.hosted > 0).sort((x, y) => y.displaced - x.displaced),
    unplaced,
    fetchedAt: now,
  }
}

async function fetchYear(year: number): Promise<UnhcrRow[] | null> {
  const url = `${UNHCR_API}?year=${year}&coo_all=true&coa_all=true&limit=20000`
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) return null
  const json = await res.json() as { items?: unknown }
  return Array.isArray(json.items) ? json.items as UnhcrRow[] : null
}

const TTL_MS = 6 * 60 * 60 * 1000
let cached: { at: number; snap: DisplacementSnapshot } | null = null
let inflight: Promise<DisplacementSnapshot | null> | null = null

/**
 * Latest UNHCR year with data (tries last calendar year, then the one before), compared with the
 * year before it. Returns null when UNHCR can't be reached — never a stand-in dataset.
 */
export function fetchDisplacement(now = Date.now()): Promise<DisplacementSnapshot | null> {
  if (cached && now - cached.at < TTL_MS) return Promise.resolve(cached.snap)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const last = new Date(now).getUTCFullYear() - 1
      for (const year of [last, last - 1]) {
        const cur = await fetchYear(year)
        if (!cur) return null
        if (!cur.length) continue
        const prev = (await fetchYear(year - 1)) ?? []
        const snap = buildSnapshot(cur, prev, year, now)
        if (!snap.corridors.length) return null
        cached = { at: now, snap }
        return snap
      }
      return null
    } catch {
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export const TREND_COLORS: Record<Trend, string> = {
  new:     '#ef4444',
  rising:  '#f97316',
  steady:  '#eab308',
  falling: '#60a5fa',
}

export const TREND_LABELS: Record<Trend, string> = {
  new:     'New since last year',
  rising:  `Up ${Math.round(TREND_THRESHOLD * 100)}%+ on last year`,
  steady:  'Roughly unchanged',
  falling: `Down ${Math.round(TREND_THRESHOLD * 100)}%+ on last year`,
}

/** "+38%" / "−53%" / "new" for a corridor or country change. */
export function changeLabel(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? 'new' : '—'
  const pct = Math.round(((cur - prev) / prev) * 100)
  return pct === 0 ? '±0%' : pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`
}
