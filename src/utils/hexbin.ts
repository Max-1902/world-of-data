/**
 * Aggregates point events into H3 hexagons so tens of thousands of ACLED rows can be drawn (and read) as
 * one surface instead of an unreadable pile of markers. Pure given its inputs; h3-js is imported lazily so
 * it stays out of the first-load bundle (same approach as services/gpsjam.ts).
 */
import type { CrisisEvent } from '../types'
import { DAY_MS, datedEvents, eventDay, eventScore } from './analytics'
import { unwrapRing } from '../services/gpsjam'

export interface HexCell {
  id: string
  lat: number
  lng: number
  /** closed ring of [lng, lat], already unwrapped across the antimeridian */
  ring: [number, number][]
  /** weighted severity in the latest `windowDays` */
  recent: number
  /** weighted severity in the `windowDays` before that */
  prior: number
  /** recent − prior */
  change: number
  events: number
  fatalities: number
  /** country with the most events in the cell */
  country: string
}

export interface HexOptions {
  /** H3 resolution; 3 ≈ 60 km edge — coarse enough to read globally, fine enough to separate hot spots */
  res?: number
  /** latest day in the data (UTC midnight) */
  endDay: number
  windowDays?: number
}

export async function binToHex(events: CrisisEvent[], opts: HexOptions): Promise<HexCell[]> {
  const { latLngToCell, cellToLatLng, cellToBoundary } = await import('h3-js')
  const res = opts.res ?? 3
  const w = opts.windowDays ?? 7
  const recentFrom = opts.endDay - (w - 1) * DAY_MS
  const priorFrom = recentFrom - w * DAY_MS

  interface Acc { recent: number; prior: number; events: number; fatalities: number; countries: Map<string, number> }
  const cells = new Map<string, Acc>()

  for (const e of datedEvents(events)) {
    if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) continue
    const d = eventDay(e)!
    if (d < priorFrom || d > opts.endDay) continue
    let id: string
    try { id = latLngToCell(e.latitude, e.longitude, res) } catch { continue }
    let a = cells.get(id)
    if (!a) cells.set(id, a = { recent: 0, prior: 0, events: 0, fatalities: 0, countries: new Map() })
    if (d >= recentFrom) a.recent += eventScore(e); else a.prior += eventScore(e)
    a.events++
    a.fatalities += e.fatalities ?? 0
    a.countries.set(e.country, (a.countries.get(e.country) ?? 0) + 1)
  }

  const out: HexCell[] = []
  for (const [id, a] of cells) {
    const [lat, lng] = cellToLatLng(id)
    const ring = unwrapRing(cellToBoundary(id, true) as [number, number][])
    let country = '', best = 0
    for (const [c, n] of a.countries) if (n > best) { best = n; country = c }
    out.push({
      id, lat, lng, ring: [...ring, ring[0]],
      recent: a.recent, prior: a.prior, change: a.recent - a.prior,
      events: a.events, fatalities: a.fatalities, country,
    })
  }
  return out
}

/**
 * Normalises cells for drawing. Heights and colours use a square-root / signed-root scale because event counts
 * are heavy-tailed: on a linear scale a single metropolis would flatten every other hot spot to nothing.
 * `intensity` is each cell's square-root share (0–1) of the busiest cell; `divergence` is −1..1 around zero change.
 */
export function drawProps(cells: HexCell[]): (HexCell & { intensity: number; divergence: number; heightScale: number })[] {
  const maxRecent = cells.reduce((m, c) => Math.max(m, c.recent), 0) || 1
  const maxChange = cells.reduce((m, c) => Math.max(m, Math.abs(c.change)), 0) || 1
  // metres of extrusion for a value of 1.0; scaled with the data so the busiest cell is always the same visual height
  const heightScale = 180_000
  return cells.map(c => ({
    ...c,
    intensity: Math.sqrt(c.recent / maxRecent),
    divergence: Math.sign(c.change) * Math.sqrt(Math.abs(c.change) / maxChange),
    heightScale,
  }))
}
