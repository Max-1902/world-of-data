import { vintageYear, type WeoPayload } from '../services/imfWeo'

/**
 * Where the world economy is heading, in the IMF's own figures: its world aggregate for real GDP growth and consumer
 * prices, and the main country groups. Nothing here is this app's forecast and nothing is summed locally: every number
 * is one the IMF publishes, and the only things computed are the direction words and the 2000–2019 average of the
 * IMF's own world series.
 */

export const WORLD = 'WEOWORLD'
/** The groups shown under the world figure, in display order, with the IMF's names. */
export const WORLD_GROUPS = [
  ['ADVEC', 'Advanced economies'],
  ['OEMDC', 'Emerging market and developing economies'],
  ['EURO', 'Euro area'],
  ['DA', 'Emerging and developing Asia'],
] as const

/** A change smaller than this (percentage points) is called "about the same": the IMF publishes one decimal. */
export const STEADY_PP = 0.2
const BASE_FROM = 2000, BASE_TO = 2019
/** The average is stated only when the IMF's series covers at least this many of the twenty base years. */
const BASE_MIN_YEARS = 15

export type Direction = 'up' | 'down' | 'steady'

export interface GroupRow { code: string; label: string; now: number | null; next: number | null }

export interface WorldOutlook {
  vintage: string
  lastModified: string | null
  /** the edition's year (a projection), the year before (may be an IMF estimate), the year after, and the last year published */
  years: { prev: number; now: number; next: number; end: number }
  growth: { prev: number | null; now: number; next: number | null; end: number | null }
  /** the IMF's world growth, 2000–2019 average, or null when the series doesn't cover it */
  baseline: number | null
  inflation: { now: number | null; next: number | null } | null
  groups: GroupRow[]
  /** world growth by year, every year the IMF publishes (history and projections) */
  series: { year: number; value: number }[]
  /** advanced and emerging economies by year, for the chart */
  groupSeries: Record<'ADVEC' | 'OEMDC', { year: number; value: number }[]>
}

export const direction = (from: number, to: number): Direction =>
  to - from >= STEADY_PP ? 'up' : from - to >= STEADY_PP ? 'down' : 'steady'

const at = (row: Record<string, number> | undefined, y: number) => {
  const v = row?.[String(y)]
  return typeof v === 'number' ? v : null
}
const asSeries = (row: Record<string, number> | undefined) =>
  Object.entries(row ?? {}).map(([y, value]) => ({ year: Number(y), value })).sort((a, b) => a.year - b.year)

/** The world outlook from the IMF's growth (and, if loaded, inflation) payloads; null when the edition or the world figure is missing. */
export function buildWorldOutlook(gdp: WeoPayload, cpi: WeoPayload | null): WorldOutlook | null {
  const vy = vintageYear(gdp.vintage)
  const world = gdp.groups?.[WORLD]
  const now = at(world, vy ?? NaN)
  if (vy === null || now === null) return null
  const series = asSeries(world)
  const lastYear = series[series.length - 1].year
  const end = Math.min(lastYear, vy + 5)
  const base = series.filter(p => p.year >= BASE_FROM && p.year <= BASE_TO)
  const cpiWorld = cpi?.groups?.[WORLD]
  return {
    vintage: gdp.vintage,
    lastModified: gdp.lastModified,
    years: { prev: vy - 1, now: vy, next: vy + 1, end },
    growth: { prev: at(world, vy - 1), now, next: at(world, vy + 1), end: end > vy + 1 ? at(world, end) : null },
    baseline: base.length >= BASE_MIN_YEARS ? base.reduce((s, p) => s + p.value, 0) / base.length : null,
    inflation: cpiWorld ? { now: at(cpiWorld, vy), next: at(cpiWorld, vy + 1) } : null,
    groups: WORLD_GROUPS.map(([code, label]) => ({ code, label, now: at(gdp.groups?.[code], vy), next: at(gdp.groups?.[code], vy + 1) })),
    series,
    groupSeries: { ADVEC: asSeries(gdp.groups?.ADVEC), OEMDC: asSeries(gdp.groups?.OEMDC) },
  }
}

const f1 = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`

/** The answer in words, every number taken from the IMF's figures above. */
export function worldSentences(w: WorldOutlook): string[] {
  const { growth: g, years: y } = w
  const out: string[] = []
  let lead = `The IMF projects world real GDP growth of ${f1(g.now)}% in ${y.now}`
  if (g.prev !== null) {
    const d = direction(g.prev, g.now)
    lead += d === 'steady' ? `, about the same as its estimated ${f1(g.prev)}% for ${y.prev}` : `, ${d === 'up' ? 'up' : 'down'} from an estimated ${f1(g.prev)}% in ${y.prev}`
  }
  if (g.next !== null) {
    const d = direction(g.now, g.next)
    lead += `, then ${f1(g.next)}% in ${y.next} (${d === 'up' ? 'a pick-up' : d === 'down' ? 'a slowdown' : 'about the same'})`
  }
  out.push(`${lead}.`)
  if (w.baseline !== null) {
    const ref = g.next ?? g.now, refYear = g.next !== null ? y.next : y.now
    const d = direction(w.baseline, ref)
    out.push(`${refYear} is ${d === 'steady' ? 'close to' : d === 'up' ? 'above' : 'below'} the world’s 2000–2019 average of ${f1(w.baseline)}%${g.end !== null ? `, and the IMF’s figure for ${y.end} is ${f1(g.end)}%` : ''}.`)
  }
  if (w.inflation?.now != null) {
    const { now, next } = w.inflation
    const d = next != null ? direction(now, next) : null
    out.push(`World consumer-price inflation: ${f1(now)}% in ${y.now}${next != null ? `, ${f1(next)}% in ${y.next} (${d === 'down' ? 'easing' : d === 'up' ? 'rising' : 'about the same'})` : ''}.`)
  }
  const adv = w.groups.find(r => r.code === 'ADVEC'), em = w.groups.find(r => r.code === 'OEMDC')
  if (adv?.next != null && em?.next != null) {
    out.push(`Growth in ${y.next}: ${f1(em.next)}% in emerging and developing economies, ${f1(adv.next)}% in advanced economies.`)
  }
  return out
}
