/**
 * Pure statistics for comparing countries on two indicators: axis scales, rank and linear correlation, a least-squares
 * trend, which countries sit furthest above/below it, and the colouring used on the map. No network, no clock.
 */
import type { CountryValue, IndicatorMeta, ScaleKind } from '../services/countryIndicators'
import { divergingColor, sequentialColor } from './vizPalette'

// ── Scales ────────────────────────────────────────────────────────────────────

export interface Scale {
  kind: ScaleKind
  /** data → axis space */
  fwd: (v: number) => number
  /** axis space → data */
  inv: (t: number) => number
  /** whether a value can be placed on this scale at all (log needs > 0) */
  valid: (v: number) => boolean
}

export function makeScale(kind: ScaleKind): Scale {
  if (kind === 'log') return { kind, fwd: v => Math.log10(v), inv: t => 10 ** t, valid: v => Number.isFinite(v) && v > 0 }
  if (kind === 'symlog') return { kind, fwd: v => Math.sign(v) * Math.log10(1 + Math.abs(v)), inv: t => Math.sign(t) * (10 ** Math.abs(t) - 1), valid: Number.isFinite }
  return { kind, fwd: v => v, inv: t => t, valid: Number.isFinite }
}

/** Round, human-friendly tick values (in data units) inside [lo, hi]. */
export function niceTicks(kind: ScaleKind, lo: number, hi: number): number[] {
  if (!(hi > lo)) return [lo]
  if (kind === 'linear') {
    const raw = (hi - lo) / 5
    const pow = 10 ** Math.floor(Math.log10(raw))
    const f = raw / pow
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
    const out: number[] = []
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step)
    return out
  }
  const out: number[] = []
  if (kind === 'log') {
    for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** k
        if (v >= lo && v <= hi && (m === 1 || hi / lo < 100)) out.push(v)
      }
    }
    return out
  }
  // symlog: 0 and ±10^k
  if (lo <= 0 && hi >= 0) out.push(0)
  for (let k = 0; k <= Math.ceil(Math.log10(Math.max(Math.abs(lo), Math.abs(hi)) + 1)); k++) {
    for (const s of [-1, 1]) {
      const v = s * 10 ** k
      if (v >= lo && v <= hi) out.push(v)
    }
  }
  return out.sort((a, b) => a - b)
}

// ── Correlation & regression ──────────────────────────────────────────────────

export function pearson(a: number[], b: number[]): number | null {
  const n = a.length
  if (n < 3 || b.length !== n) return null
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb
    sab += da * db; saa += da * da; sbb += db * db
  }
  return saa === 0 || sbb === 0 ? null : sab / Math.sqrt(saa * sbb)
}

/** 1-based ranks; tied values share the average of the ranks they span. */
export function ranks(values: number[]): number[] {
  const idx = values.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0])
  const out = new Array<number>(values.length)
  for (let i = 0; i < idx.length;) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[idx[k][1]] = avg
    i = j + 1
  }
  return out
}

/** Spearman rank correlation: Pearson on ranks, so it only asks that the relationship be monotonic. */
export function spearman(a: number[], b: number[]): number | null {
  return pearson(ranks(a), ranks(b))
}

/** 95% interval for a correlation via the Fisher z-transform. */
export function fisherCI(r: number, n: number, z = 1.96): [number, number] | null {
  if (n <= 3 || Math.abs(r) >= 1) return null
  const f = Math.atanh(r)
  const se = 1 / Math.sqrt(n - 3)
  return [Math.tanh(f - z * se), Math.tanh(f + z * se)]
}

export interface Fit { slope: number; intercept: number; r2: number }

export function ols(x: number[], y: number[]): Fit | null {
  const n = x.length
  if (n < 3) return null
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2 }
  if (sxx === 0) return null
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) }
}

// ── Pair analysis ─────────────────────────────────────────────────────────────

export interface Joined { iso3: string; name: string; x: number; y: number; xYear: string; yYear: string }
export interface Residual extends Joined {
  /** axis-space coordinates */
  tx: number
  ty: number
  /** trend value in axis space, and its value in data units */
  fittedT: number
  expected: number
  /** standardised residual: distance from the trend in standard deviations */
  z: number
}

/** Countries present in both indicators with values the scales can place. */
export function joinRows(xRows: CountryValue[], yRows: CountryValue[], xs: Scale, ys: Scale): Joined[] {
  const yBy = new Map(yRows.map(r => [r.iso3, r]))
  const out: Joined[] = []
  for (const x of xRows) {
    const y = yBy.get(x.iso3)
    if (!y || !xs.valid(x.value) || !ys.valid(y.value)) continue
    out.push({ iso3: x.iso3, name: x.name, x: x.value, y: y.value, xYear: x.year, yYear: y.year })
  }
  return out
}

export const MIN_PAIR_N = 8

export interface PairAnalysis {
  n: number
  pearson: number | null
  spearman: number | null
  /** 95% interval for Spearman ρ */
  ci: [number, number] | null
  fit: Fit
  residSd: number
  points: Residual[]
  /** furthest above / below the trend, most extreme first */
  over: Residual[]
  under: Residual[]
}

/** Correlation and trend between two indicators, fitted in axis space (so a log axis gives a log-linear trend). Null below MIN_PAIR_N countries. */
export function analyzePair(xRows: CountryValue[], yRows: CountryValue[], xs: Scale, ys: Scale, topK = 5): PairAnalysis | null {
  const joined = joinRows(xRows, yRows, xs, ys)
  if (joined.length < MIN_PAIR_N) return null
  const tx = joined.map(j => xs.fwd(j.x))
  const ty = joined.map(j => ys.fwd(j.y))
  const fit = ols(tx, ty)
  if (!fit) return null
  const resid = ty.map((t, i) => t - (fit.intercept + fit.slope * tx[i]))
  const residSd = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / Math.max(1, joined.length - 2)) || 1
  const points: Residual[] = joined.map((j, i) => {
    const fittedT = fit.intercept + fit.slope * tx[i]
    return { ...j, tx: tx[i], ty: ty[i], fittedT, expected: ys.inv(fittedT), z: resid[i] / residSd }
  })
  const rho = spearman(joined.map(j => j.x), joined.map(j => j.y))
  return {
    n: joined.length,
    pearson: pearson(tx, ty),
    spearman: rho,
    ci: rho === null ? null : fisherCI(rho, joined.length),
    fit, residSd, points,
    over: points.filter(p => p.z > 0).sort((a, b) => b.z - a.z).slice(0, topK),
    under: points.filter(p => p.z < 0).sort((a, b) => a.z - b.z).slice(0, topK),
  }
}

const strength = (r: number) => { const a = Math.abs(r); return a < 0.2 ? 'negligible' : a < 0.4 ? 'weak' : a < 0.6 ? 'moderate' : a < 0.8 ? 'strong' : 'very strong' }

/** Plain-language reading of a pair analysis, generated from the numbers so it can't claim more than they show. */
export function describePair(a: PairAnalysis, x: IndicatorMeta, y: IndicatorMeta): string {
  if (a.spearman === null) return 'The two indicators have no variation to compare.'
  const dir = a.spearman >= 0 ? 'positive' : 'negative'
  const ci = a.ci ? ` (95% interval ${a.ci[0].toFixed(2)} to ${a.ci[1].toFixed(2)})` : ''
  const head = `Across ${a.n} countries, ${x.short} and ${y.short} have a ${strength(a.spearman)} ${dir} relationship: Spearman ρ = ${a.spearman.toFixed(2)}${ci}.`
  return Math.abs(a.spearman) < 0.2 ? `${head} Knowing one tells you almost nothing about the other.` : head
}

/** One-line reading of the fitted trend line in the units a reader recognises. */
export function describeFit(fit: Fit, xs: Scale, ys: Scale, x: IndicatorMeta, y: IndicatorMeta): string {
  const r2 = `${Math.round(fit.r2 * 100)}% of the variation in ${y.short} lies along the trend line`
  if (xs.kind === 'symlog' || ys.kind === 'symlog') return `${r2} (fitted on a symmetric-log scale).`
  const s = fit.slope
  if (xs.kind === 'log' && ys.kind === 'log') return `A 10× larger ${x.short} goes with a ${(10 ** s).toFixed(2)}× larger ${y.short}; ${r2}.`
  if (xs.kind === 'log') return `Each 10× in ${x.short} goes with ${s >= 0 ? '+' : '−'}${Math.abs(s).toPrecision(2)} in ${y.short}; ${r2}.`
  if (ys.kind === 'log') return `Each +1 in ${x.short} goes with a ${(10 ** s).toFixed(2)}× change in ${y.short}; ${r2}.`
  return `Each +1 in ${x.short} goes with ${s >= 0 ? '+' : '−'}${Math.abs(s).toPrecision(2)} in ${y.short}; ${r2}.`
}

// ── Distributions, quantiles ──────────────────────────────────────────────────

/** Linear-interpolated percentile of an ascending-sorted array, p in 0..1. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const i = (sorted.length - 1) * Math.min(1, Math.max(0, p))
  const lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

export interface HistBin { lo: number; hi: number; count: number }

/** Equal-width bins in axis space (so a log indicator gets log-spaced bins); edges are returned in data units. */
export function histogram(values: number[], scale: Scale, bins = 12): HistBin[] {
  const t = values.filter(scale.valid).map(scale.fwd)
  if (t.length === 0) return []
  const lo = Math.min(...t), hi = Math.max(...t)
  const w = (hi - lo) / bins || 1
  const counts = new Array<number>(bins).fill(0)
  for (const v of t) counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++
  return counts.map((count, i) => ({ lo: scale.inv(lo + i * w), hi: scale.inv(lo + (i + 1) * w), count }))
}

// ── Correlation matrix ────────────────────────────────────────────────────────

export interface CorrMatrix { ids: string[]; rho: (number | null)[][]; n: number[][] }

/** Pairwise-complete Spearman ρ for every pair of indicators; a pair with fewer than `minN` shared countries is null. */
export function correlationMatrix(items: { id: string; rows: CountryValue[] }[], minN = 12): CorrMatrix {
  const maps = items.map(i => new Map(i.rows.map(r => [r.iso3, r.value])))
  const k = items.length
  const rho: (number | null)[][] = Array.from({ length: k }, () => new Array(k).fill(null))
  const n: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      const a: number[] = [], b: number[] = []
      for (const [iso, v] of maps[i]) { const w = maps[j].get(iso); if (w !== undefined) { a.push(v); b.push(w) } }
      n[i][j] = n[j][i] = a.length
      const r = i === j ? (a.length >= minN ? 1 : null) : a.length >= minN ? spearman(a, b) : null
      rho[i][j] = rho[j][i] = r
    }
  }
  return { ids: items.map(i => i.id), rho, n }
}

// ── Map colouring ─────────────────────────────────────────────────────────────

export type MapMode = 'value' | 'trend'

export interface CountryColors {
  mode: MapMode
  /** ISO-3166-1 alpha-2 → CSS colour */
  colors: Record<string, string>
  /** legend end values in data units (value mode only) */
  lo: number | null
  hi: number | null
}

/**
 * Colours for the globe. "value" shades every country with data by the selected indicator, clipped to the 2nd–98th
 * percentile (on the indicator's own scale) so a few giants don't wash out everyone else. "trend" shades only the
 * countries in the pair analysis by how far they sit above (red) or below (blue) the fitted trend.
 */
export function countryColors(mode: MapMode, yRows: CountryValue[], ys: Scale, analysis: PairAnalysis | null): CountryColors {
  const colors: Record<string, string> = {}
  if (mode === 'trend') {
    for (const p of analysis?.points ?? []) colors[p.iso3] = divergingColor(Math.max(-1, Math.min(1, p.z / 2.5)))
    return { mode, colors, lo: null, hi: null }
  }
  const usable = yRows.filter(r => ys.valid(r.value))
  if (usable.length === 0) return { mode, colors, lo: null, hi: null }
  const t = usable.map(r => ys.fwd(r.value)).sort((a, b) => a - b)
  const lo = percentile(t, 0.02), hi = percentile(t, 0.98)
  const span = hi - lo || 1
  for (const r of usable) colors[r.iso3] = sequentialColor(0.2 + 0.8 * Math.min(1, Math.max(0, (ys.fwd(r.value) - lo) / span)))
  return { mode, colors, lo: ys.inv(lo), hi: ys.inv(hi) }
}

/**
 * Compact, plain-text summary of a pair analysis for the AI analyst's context. Everything in it is computed locally, so the
 * model can cite it instead of recalling figures from memory.
 */
export function summarizeForAI(a: PairAnalysis, x: IndicatorMeta, y: IndicatorMeta, xs: Scale, ys: Scale, topK = 5): string {
  const fmtP = (p: Residual) => `${p.name} (${y.format(p.y)} actual vs ${y.format(p.expected)} expected, ${p.z >= 0 ? '+' : '−'}${Math.abs(p.z).toFixed(1)} sd)`
  return [
    `Comparison: ${y.label} (Y) against ${x.label} (X), ${a.n} countries, each country's latest value since 2010 (${x.source}${x.source !== y.source ? ` and ${y.source}` : ''}).`,
    `${describePair(a, x, y)} ${describeFit(a.fit, xs, ys, x, y)}`,
    `Furthest ABOVE the trend: ${a.over.slice(0, topK).map(fmtP).join('; ') || 'none'}.`,
    `Furthest BELOW the trend: ${a.under.slice(0, topK).map(fmtP).join('; ') || 'none'}.`,
  ].join('\n  ')
}
