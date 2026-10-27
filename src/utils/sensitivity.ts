/**
 * How much a country's GDP growth has moved with its export growth: ordinary least squares of real GDP growth on real
 * export growth (both World Bank, annual %), per country. Specified before any result was looked at (2026-10-27):
 * years from SENS_FROM on, at least SENS_MIN_N joint years, classical 95% interval on the slope. Nothing is tuned.
 *
 * It is a statistical association, not a causal multiplier: a global recession lowers exports and GDP together, so the
 * slope also carries common shocks and is likely larger than the effect of exports alone. It is used as the
 * "statistical" step of a demand-shock scenario and labelled that way.
 */
import { joinYears, regress, type Pt } from './econAnalysis'

export const SENS_FROM = 1991
export const SENS_MIN_N = 15

export interface Sensitivity {
  /** pp of GDP growth per 1 pp of export growth */
  slope: number
  ci: [number, number]
  r2: number
  n: number
  from: number
  to: number
}

export function exportSensitivity(gdpGrowth: readonly Pt[], exportGrowth: readonly Pt[]): Sensitivity | null {
  const rows = joinYears(exportGrowth.filter(p => p.x >= SENS_FROM), gdpGrowth.filter(p => p.x >= SENS_FROM))
  if (rows.length < SENS_MIN_N) return null
  const r = regress(rows.map(q => q.a), rows.map(q => q.b))
  if (!r) return null
  return { slope: r.slope, ci: r.ci, r2: r.r2, n: r.n, from: rows[0].x, to: rows[rows.length - 1].x }
}
