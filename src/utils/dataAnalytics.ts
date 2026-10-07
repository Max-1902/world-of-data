/**
 * Pure analysis of the live data the app already loads: USGS earthquakes (services/earthquakes.ts) and NASA FIRMS
 * fire detections (services/wildfires.ts). No network, no clock — every function takes the data and an explicit
 * time, so results are deterministic and testable.
 */
import type { Earthquake } from '../services/earthquakes'
import type { FirePoint } from '../services/wildfires'

export const HOUR_MS = 3_600_000
export const DAY_MS = 24 * HOUR_MS

// ── Generic helpers ───────────────────────────────────────────────────────────

/** Counts of `times` in n consecutive buckets of `stepMs` starting at `start` (bucket i is [start+i·step, start+(i+1)·step)). */
export function bucketCounts(times: number[], start: number, stepMs: number, n: number): number[] {
  const out = new Array<number>(n).fill(0)
  for (const t of times) {
    const i = Math.floor((t - start) / stepMs)
    if (i >= 0 && i < n) out[i]++
  }
  return out
}

/** Trailing mean over `window` values; null until a full window exists, so no partial average is shown as real. */
export function trailingMean(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    out.push(i >= window - 1 ? sum / window : null)
  }
  return out
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Row × column grid of counts, used by the heatmap. */
export interface Matrix {
  rows: string[]
  /** start time (epoch ms) of each column's window */
  cols: number[]
  cells: number[][]
  totals: number[]
  max: number
}

// ── Earthquakes ───────────────────────────────────────────────────────────────

export interface GutenbergRichter {
  /** quakes at or above the completeness magnitude */
  n: number
  mc: number
  /** maximum-likelihood b-value (Aki–Utsu, bin-corrected); null when it can't be estimated */
  b: number | null
  /** standard error (Shi & Bolt 1982) */
  bErr: number | null
  /** cumulative count of quakes with magnitude ≥ m */
  points: { m: number; cumulative: number }[]
}

/**
 * Gutenberg–Richter frequency–magnitude statistics: log10 N(≥M) falls roughly linearly with slope −b, and b is
 * typically close to 1 for global catalogues. `step` is the catalogue's magnitude resolution (USGS reports 0.1).
 */
export function gutenbergRichter(mags: number[], mc = 4.5, step = 0.1): GutenbergRichter {
  const m = mags.filter(x => Number.isFinite(x) && x >= mc - 1e-9)
  const n = m.length
  if (n === 0) return { n: 0, mc, b: null, bErr: null, points: [] }
  const mean = m.reduce((a, c) => a + c, 0) / n
  const denom = mean - (mc - step / 2)
  const b = n >= 2 && denom > 0 ? Math.LOG10E / denom : null
  let bErr: number | null = null
  if (b !== null && n > 2) {
    const ss = m.reduce((a, c) => a + (c - mean) ** 2, 0)
    bErr = 2.3 * b * b * Math.sqrt(ss / (n * (n - 1)))
  }
  const max = Math.max(...m)
  const points: GutenbergRichter['points'] = []
  for (let i = 0; mc + i * step <= max + 1e-9; i++) {
    const level = Math.round((mc + i * step) * 100) / 100
    const cumulative = m.filter(x => x >= level - 1e-9).length
    if (cumulative > 0) points.push({ m: level, cumulative })
  }
  return { n, mc, b, bErr, points }
}

/** USGS `place` reads "12 km SSW of Town, Region"; the part after the last comma is the region (verbatim, not normalised). */
export function quakeRegion(place: string): string {
  const i = place.lastIndexOf(',')
  const region = (i >= 0 ? place.slice(i + 1) : place).trim()
  return region || 'Unknown'
}

/** Top regions by quake count, in `windows` consecutive windows of `windowMs` ending at `end`. */
export function quakeRegionMatrix(quakes: Pick<Earthquake, 'place' | 'time'>[], end: number, windows = 7, windowMs = DAY_MS, topN = 10): Matrix {
  const start = end - windows * windowMs
  const byRegion = new Map<string, number[]>()
  for (const q of quakes) {
    const i = Math.floor((q.time - start) / windowMs)
    if (i < 0 || i >= windows) continue
    const region = quakeRegion(q.place)
    let row = byRegion.get(region)
    if (!row) byRegion.set(region, row = new Array(windows).fill(0))
    row[i]++
  }
  const ranked = [...byRegion.entries()]
    .map(([region, row]) => ({ region, row, total: row.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || a.region.localeCompare(b.region))
    .slice(0, topN)
  return {
    rows: ranked.map(r => r.region),
    cols: Array.from({ length: windows }, (_, i) => start + i * windowMs),
    cells: ranked.map(r => r.row),
    totals: ranked.map(r => r.total),
    max: ranked.reduce((m, r) => Math.max(m, ...r.row), 0),
  }
}

/** Conventional shallow / intermediate / deep depth classes (km). Negative depths (above datum) count as shallow. */
export const DEPTH_BINS = [
  { label: '0–35', lo: -Infinity, hi: 35 },
  { label: '35–70', lo: 35, hi: 70 },
  { label: '70–150', lo: 70, hi: 150 },
  { label: '150–300', lo: 150, hi: 300 },
  { label: '300+', lo: 300, hi: Infinity },
] as const

export function depthBins(quakes: Pick<Earthquake, 'depth'>[]): { label: string; count: number }[] {
  const counts = DEPTH_BINS.map(() => 0)
  for (const q of quakes) {
    if (!Number.isFinite(q.depth)) continue
    const i = DEPTH_BINS.findIndex(b => q.depth >= b.lo && q.depth < b.hi)
    if (i >= 0) counts[i]++
  }
  return DEPTH_BINS.map((b, i) => ({ label: b.label, count: counts[i] }))
}

// ── Wildfires ─────────────────────────────────────────────────────────────────

/** Detections per UTC hour of acquisition (FIRMS `acq_time` is HHMM, sometimes unpadded). */
export function fireHourCounts(fires: Pick<FirePoint, 'time'>[]): number[] {
  const counts = new Array<number>(24).fill(0)
  for (const f of fires) {
    if (!/^\d{1,4}$/.test(f.time)) continue
    const h = parseInt(f.time.padStart(4, '0').slice(0, 2), 10)
    if (h < 24) counts[h]++
  }
  return counts
}

/** Fire radiative power (MW) classes; log-spaced because FRP is heavy-tailed. Detections with no FRP are excluded. */
export const FRP_BINS = [
  { label: '< 1', lo: 0, hi: 1 },
  { label: '1–3', lo: 1, hi: 3 },
  { label: '3–10', lo: 3, hi: 10 },
  { label: '10–30', lo: 10, hi: 30 },
  { label: '30–100', lo: 30, hi: 100 },
  { label: '100–300', lo: 100, hi: 300 },
  { label: '300+', lo: 300, hi: Infinity },
] as const

export function frpHistogram(fires: Pick<FirePoint, 'frp'>[]): { label: string; count: number }[] {
  const counts = FRP_BINS.map(() => 0)
  for (const f of fires) {
    if (!(f.frp > 0)) continue
    const i = FRP_BINS.findIndex(b => f.frp >= b.lo && f.frp < b.hi)
    if (i >= 0) counts[i]++
  }
  return FRP_BINS.map((b, i) => ({ label: b.label, count: counts[i] }))
}

export interface FireSummary {
  detections: number
  /** sum of FRP over detections that report one (MW) */
  totalFrpMw: number
  withFrp: number
  nightShare: number
  highConfidenceShare: number
}

export function fireSummary(fires: Pick<FirePoint, 'frp' | 'daynight' | 'confidence'>[]): FireSummary {
  const n = fires.length
  let total = 0, withFrp = 0, night = 0, high = 0
  for (const f of fires) {
    if (f.frp > 0) { total += f.frp; withFrp++ }
    if (f.daynight === 'N') night++
    if (f.confidence === 'high') high++
  }
  return { detections: n, totalFrpMw: total, withFrp, nightShare: n ? night / n : 0, highConfidenceShare: n ? high / n : 0 }
}
