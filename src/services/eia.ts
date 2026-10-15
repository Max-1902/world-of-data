/**
 * US EIA weekly inventories — commercial crude, the Strategic Petroleum Reserve, motor gasoline,
 * distillate fuel oil (Weekly Petroleum Status Report) and working gas in underground storage
 * (Weekly Natural Gas Storage Report).
 *
 * Source: EIA Open Data API v2, free (key by email, no billing), via this app's /api/eia proxy,
 * which injects the key and only forwards the series below. Series ids were checked against
 * EIA's own tables (eia.gov/dnav) on 2026-10-14; the proxy keeps the same list (api/eia.ts).
 *
 * Unlike most services here this one does not collapse failures into `[]`: "not configured",
 * "error" and "ok" are distinct, so the panel never shows an empty or zero stock as if it were data.
 */

export interface EiaSeriesDef {
  id: string
  key: 'crude' | 'spr' | 'gasoline' | 'distillate' | 'gas'
  label: string
  /** fallback unit; the unit EIA returns with the data wins when present */
  unit: string
  report: string
}

export const EIA_SERIES: EiaSeriesDef[] = [
  { id: 'PET.WCESTUS1.W', key: 'crude', label: 'Commercial crude oil (excl. SPR)', unit: 'thousand barrels', report: 'Weekly Petroleum Status Report' },
  { id: 'PET.WGTSTUS1.W', key: 'gasoline', label: 'Total motor gasoline', unit: 'thousand barrels', report: 'Weekly Petroleum Status Report' },
  { id: 'PET.WDISTUS1.W', key: 'distillate', label: 'Distillate fuel oil', unit: 'thousand barrels', report: 'Weekly Petroleum Status Report' },
  { id: 'NG.NW2_EPG0_SWO_R48_BCF.W', key: 'gas', label: 'Natural gas in storage (Lower 48, working gas)', unit: 'billion cubic feet', report: 'Weekly Natural Gas Storage Report' },
  { id: 'PET.WCSSTUS1.W', key: 'spr', label: 'Strategic Petroleum Reserve (crude)', unit: 'thousand barrels', report: 'Weekly Petroleum Status Report' },
]

export interface WeeklyPoint { period: string; t: number; value: number }

export type EiaResult =
  | { status: 'ok'; points: WeeklyPoint[]; unit: string | null }
  | { status: 'not_configured' }
  | { status: 'error'; message: string }

const TTL_MS = 60 * 60 * 1000
const cache = new Map<string, { at: number; result: EiaResult }>()

/** EIA rows: `period` (YYYY-MM-DD for weekly data) and `value` (number, or a numeric string). Anything else is dropped. */
export function parseEia(json: unknown): { points: WeeklyPoint[]; unit: string | null } | null {
  const rows = (json as { response?: { data?: unknown } } | null)?.response?.data
  if (!Array.isArray(rows)) return null
  let unit: string | null = null
  const points: WeeklyPoint[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const { period, value, units } = r as Record<string, unknown>
    if (typeof period !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(period)) continue
    const v = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
    if (!Number.isFinite(v)) continue
    const t = Date.parse(`${period}T00:00:00Z`)
    if (!Number.isFinite(t)) continue
    if (unit === null && typeof units === 'string' && units) unit = units
    points.push({ period, t, value: v })
  }
  points.sort((a, b) => a.t - b.t)
  // one value per week: EIA should never repeat a period, but keep the last if it does
  const dedup = points.filter((p, i) => i === points.length - 1 || points[i + 1].period !== p.period)
  return { points: dedup, unit }
}

export async function fetchEiaSeries(id: string): Promise<EiaResult> {
  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result
  let result: EiaResult
  try {
    const res = await fetch(`/api/eia?series=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(20000) })
    const body = await res.json().catch(() => null) as { error?: { code?: string; message?: string } | string } | null
    if (res.status === 503 && typeof body?.error === 'object' && body.error?.code === 'not_configured') {
      result = { status: 'not_configured' }
    } else if (!res.ok) {
      const msg = typeof body?.error === 'string' ? body.error : body?.error?.message
      result = { status: 'error', message: `EIA returned HTTP ${res.status}${msg ? `: ${msg}` : ''}` }
    } else {
      const parsed = parseEia(body)
      result = !parsed ? { status: 'error', message: 'Unexpected response from EIA (no data rows).' }
        : parsed.points.length === 0 ? { status: 'error', message: 'EIA returned no usable weekly values for this series.' }
        : { status: 'ok', ...parsed }
    }
  } catch (e) {
    result = { status: 'error', message: `Could not reach EIA (${e instanceof Error ? e.message : 'network error'}).` }
  }
  // cache successes and "not configured"; let errors retry on the next load
  if (result.status !== 'error') cache.set(id, { at: Date.now(), result })
  return result
}
