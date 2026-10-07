/**
 * Aggregates point data into H3 hexagons so tens of thousands of detections can be drawn (and read) as one surface
 * instead of an unreadable pile of markers. Pure given its inputs; h3-js is imported lazily so it stays out of the
 * first-load bundle (same approach as services/gpsjam.ts).
 */
import { unwrapRing } from '../services/gpsjam'

export interface HexPoint {
  lat: number
  lng: number
  /** amount this point adds to its cell's value (1 for a count, MW for fire power, …) */
  weight: number
  /** per-point figure whose maximum is kept per cell (magnitude, FRP, …) */
  peak?: number
}

export interface HexCell {
  id: string
  lat: number
  lng: number
  /** closed ring of [lng, lat], already unwrapped across the antimeridian */
  ring: [number, number][]
  value: number
  count: number
  peak: number
}

export async function binPoints(points: HexPoint[], res: number): Promise<HexCell[]> {
  const { latLngToCell, cellToLatLng, cellToBoundary } = await import('h3-js')
  const acc = new Map<string, { value: number; count: number; peak: number }>()
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !Number.isFinite(p.weight) || p.weight < 0) continue
    let id: string
    try { id = latLngToCell(p.lat, p.lng, res) } catch { continue }
    let a = acc.get(id)
    if (!a) acc.set(id, a = { value: 0, count: 0, peak: -Infinity })
    a.value += p.weight
    a.count++
    if (p.peak !== undefined && p.peak > a.peak) a.peak = p.peak
  }
  const out: HexCell[] = []
  for (const [id, a] of acc) {
    const [lat, lng] = cellToLatLng(id)
    const ring = unwrapRing(cellToBoundary(id, true) as [number, number][])
    out.push({ id, lat, lng, ring: [...ring, ring[0]], value: a.value, count: a.count, peak: Number.isFinite(a.peak) ? a.peak : 0 })
  }
  return out
}

/** Metres of extrusion for a normalised value of 1.0. */
export const HEIGHT_SCALE = 180_000

/**
 * Normalises cells for drawing. A square-root scale is used because counts and fire power are heavy-tailed:
 * on a linear scale one huge cell would flatten every other hot spot to nothing.
 */
export function drawProps(cells: HexCell[]): (HexCell & { intensity: number })[] {
  const max = cells.reduce((m, c) => Math.max(m, c.value), 0)
  return cells.map(c => ({ ...c, intensity: max > 0 ? Math.sqrt(c.value / max) : 0 }))
}
