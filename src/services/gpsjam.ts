/**
 * GPS interference — live, from GPSJAM.org's daily aggregate of ADS-B navigation-accuracy reports
 * (aircraft broadcast how accurate their position fix is; many low-accuracy reports in one area
 * indicate likely jamming or spoofing). Data credit: GPSJAM.org, built on airplanes.live and
 * ADS-B Exchange. Free, keyless; fetched through this app's own /api/gpsjam function because the
 * upstream file sends no CORS headers. The file is per UTC day, so "live" means yesterday's picture.
 *
 * Aircraft reports can't say *why* accuracy dropped, so this layer never labels a cell as jamming
 * versus spoofing — it reports the share of aircraft that saw degraded accuracy and how many flew.
 */

export type JamSeverity = 'high' | 'medium'

export interface GPSJamCell {
  id:         string              // H3 cell index (resolution 4, ≈ 22 km edge)
  lat:        number              // cell centre
  lng:        number
  ring:       [number, number][]  // closed [lng, lat] outline
  percentBad: number              // share of aircraft with degraded accuracy, 0–100
  good:       number              // aircraft with good accuracy
  bad:        number              // aircraft with degraded accuracy
  severity:   JamSeverity         // high > 10% (GPSJAM red), medium 2–10% (yellow)
}

export interface GPSJamData {
  date:  string  // UTC day the data covers, YYYY-MM-DD
  cells: GPSJamCell[]
}

export const SEVERITY_COLORS: Record<JamSeverity, string> = {
  high:   '#ff2244',
  medium: '#ff8800',
}

export const SEVERITY_LABELS: Record<JamSeverity, string> = {
  high:   'SEVERE (>10% of aircraft)',
  medium: 'ELEVATED (2–10% of aircraft)',
}

export const GPSJAM_ATTRIBUTION = 'GPSJAM.org · airplanes.live · ADS-B Exchange'

export function percentBad(good: number, bad: number): number {
  const total = good + bad
  return total > 0 ? (100 * (bad - 1)) / total : 0 // GPSJAM's formula; the −1 damps single-aircraft noise
}

export function severityOf(pct: number): JamSeverity {
  return pct > 10 ? 'high' : 'medium'
}

/** H3 outlines that straddle the antimeridian jump ±180°; shift the western part so the ring stays contiguous. */
export function unwrapRing(ring: [number, number][]): [number, number][] {
  const lngs = ring.map(p => p[0])
  if (Math.max(...lngs) - Math.min(...lngs) <= 180) return ring
  return ring.map(([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat])
}

interface RawPayload { date?: unknown; cells?: unknown }

export async function fetchGPSJam(): Promise<GPSJamData> {
  const res = await fetch('/api/gpsjam', { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`GPSJAM HTTP ${res.status}`)
  const raw = await res.json() as RawPayload
  if (typeof raw.date !== 'string' || !Array.isArray(raw.cells)) throw new Error('GPSJAM: unexpected payload')

  const { cellToLatLng, cellToBoundary, isValidCell } = await import('h3-js')
  const cells: GPSJamCell[] = []
  for (const c of raw.cells as ({ h?: unknown; good?: unknown; bad?: unknown } | null)[]) {
    if (!c || typeof c.h !== 'string' || typeof c.good !== 'number' || typeof c.bad !== 'number' || !isValidCell(c.h)) continue
    const pct = percentBad(c.good, c.bad)
    if (pct < 2) continue
    const [lat, lng] = cellToLatLng(c.h)
    const ring = unwrapRing(cellToBoundary(c.h, true) as [number, number][])
    cells.push({
      id: c.h, lat, lng, ring: [...ring, ring[0]],
      percentBad: pct, good: c.good, bad: c.bad, severity: severityOf(pct),
    })
  }
  return { date: raw.date, cells }
}
