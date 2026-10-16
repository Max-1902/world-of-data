/**
 * How old may a "latest" value be before the UI must say so? One rule for every panel that shows a World Bank
 * style latest-year figure, so a 2020 number can't sit next to a live war badge looking current.
 */

/** Maximum age in years before a value is labelled outdated, by kind of figure. */
export const MAX_AGE_YEARS = {
  /** armed forces personnel: changes fast in wartime; IISS-sourced WB series mostly stop at 2020 */
  military: 3,
  /** annual macro indicators (GDP, inflation, unemployment): normal publication lag is 1–2 years */
  macro: 3,
  /** slow-moving structural indicators (population, life expectancy, income group) */
  structural: 5,
} as const

export type FreshnessKind = keyof typeof MAX_AGE_YEARS

/**
 * Wars that make an older figure materially misleading, by ISO2 and start year. Start years are the commonly
 * documented ones: Russia's full-scale invasion of Ukraine (24 Feb 2022), the SAF–RSF war in Sudan (15 Apr 2023),
 * the Israel–Hamas war (7 Oct 2023), the Myanmar coup and civil war (1 Feb 2021).
 */
export const WAR_SINCE: Record<string, number> = { UA: 2022, RU: 2022, SD: 2023, IL: 2023, PS: 2023, MM: 2021 }

export interface Freshness {
  year: number
  ageYears: number
  /** true when the UI must flag the value */
  stale: boolean
  /** short label for the UI, or null when the value is current enough */
  label: string | null
}

export function freshness(year: string | number, kind: FreshnessKind, iso2?: string | null, now: Date = new Date()): Freshness | null {
  const y = typeof year === 'number' ? year : parseInt(year, 10)
  if (!Number.isFinite(y)) return null
  const ageYears = now.getUTCFullYear() - y
  const since = iso2 ? WAR_SINCE[iso2.toUpperCase()] : undefined
  // a figure from the war's first year was usually compiled before it started (IISS data as of the prior November)
  if (kind === 'military' && since !== undefined && y <= since) {
    return { year: y, ageYears, stale: true, label: `pre-war figure (${y}); war since ${since}` }
  }
  if (ageYears > MAX_AGE_YEARS[kind]) return { year: y, ageYears, stale: true, label: `outdated: ${y}` }
  return { year: y, ageYears, stale: false, label: null }
}
