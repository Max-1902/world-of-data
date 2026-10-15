/**
 * Week-on-week, year-on-year and seasonal (same week, previous five years) comparisons for a weekly
 * inventory series. Computed here from the EIA history itself, so the "5-year" figures can differ
 * slightly from the averages EIA prints in its reports, which align weeks by EIA's own calendar.
 */
import type { WeeklyPoint } from '../services/eia'

const DAY = 86_400_000
/** Weekly data shares a weekday, so a same-calendar-date match is always within half a week. */
const MATCH_TOL = 3.5 * DAY

/** The observation closest to `t`, if one lies within half a week of it. */
export function nearest(points: WeeklyPoint[], t: number): WeeklyPoint | null {
  let best: WeeklyPoint | null = null
  for (const p of points) if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p
  return best && Math.abs(best.t - t) <= MATCH_TOL ? best : null
}

const yearsBefore = (t: number, k: number) => { const d = new Date(t); d.setUTCFullYear(d.getUTCFullYear() - k); return d.getTime() }

export interface Seasonal { avg: number; min: number; max: number }

/** Average and range of the same week in each of the previous five years; null unless all five exist. */
export function seasonal5y(points: WeeklyPoint[], t: number): Seasonal | null {
  const vals: number[] = []
  for (let k = 1; k <= 5; k++) {
    const p = nearest(points, yearsBefore(t, k))
    if (!p) return null
    vals.push(p.value)
  }
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, min: Math.min(...vals), max: Math.max(...vals) }
}

export interface InventorySummary {
  latest: WeeklyPoint
  /** change vs the previous week; null if the previous observation is not exactly one week earlier */
  weekChange: number | null
  /** change vs the same week a year earlier */
  yearChange: number | null
  seasonal: Seasonal | null
  /** latest vs the 5-year average for this week, in % */
  vsSeasonalPct: number | null
}

export function summarize(points: WeeklyPoint[]): InventorySummary | null {
  if (!points.length) return null
  const latest = points[points.length - 1]
  const prev = points[points.length - 2]
  const weekChange = prev && Math.abs(latest.t - prev.t - 7 * DAY) <= DAY ? latest.value - prev.value : null
  const ya = nearest(points, yearsBefore(latest.t, 1))
  const seasonal = seasonal5y(points, latest.t)
  return {
    latest, weekChange,
    yearChange: ya ? latest.value - ya.value : null,
    seasonal,
    vsSeasonalPct: seasonal && seasonal.avg !== 0 ? (latest.value / seasonal.avg - 1) * 100 : null,
  }
}
