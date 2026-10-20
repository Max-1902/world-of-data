/**
 * Single-country economic time-series analysis for the Country Lookup workspace. Pure functions: no network, no clock.
 *
 * Every result carries its sample size and enough of its method to be reported honestly. The choices, and why:
 *  - Trends: Mann–Kendall with Sen's slope and an effective-sample-size correction for autocorrelation (Yue & Wang
 *    2004). Annual macro series are autocorrelated, and the plain test then reports trends far too often; trend-free
 *    pre-whitening, tried first, made that worse in simulation (see trendTest).
 *  - Relationships between series are estimated on changes, not levels (Okun: Δunemployment on growth; Phillips:
 *    Δinflation on unemployment). Two trending levels correlate whether or not they are related.
 *  - Business cycle: Hodrick–Prescott filter on log real GDP with λ = 6.25, the value Ravn & Uhlig (2002) derive for
 *    annual data (λ = 100 is the older convention). The filter is unreliable at the end of the sample.
 *  - Debt: the European Commission's debt-dynamics identity with the effective (implicit) interest rate.
 *  - Anomalies: robust z-scores of the latest change against the country's own history, with the number of flags that
 *    chance alone would produce reported alongside.
 */

export interface Pt { x: number; y: number }

// ── Basic statistics ─────────────────────────────────────────────────────────

export const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length
export function sd(v: number[]): number {
  if (v.length < 2) return NaN
  const m = mean(v)
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1))
}
export function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 on erf; |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let ser = 1.000000000190015
  for (const k of c) ser += k / ++y
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

/** Continued fraction for the regularised incomplete beta (Numerical Recipes `betacf`). */
function betacf(a: number, b: number, x: number): number {
  const EPS = 3e-14, FPMIN = 1e-300
  let c = 1, d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((a - 1 + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + 1 + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b
}

/** Two-sided p-value of a t statistic with `df` degrees of freedom. */
export function tPValue(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0
  return incompleteBeta(df / 2, 0.5, df / (df + t * t))
}

/** 97.5% quantile of Student's t (for 95% intervals), by bisection on `tPValue`. */
export function tCrit95(df: number): number {
  let lo = 0, hi = 100
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (tPValue(mid, df) > 0.05) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

// ── Regression ───────────────────────────────────────────────────────────────

export interface Regression {
  n: number
  slope: number
  intercept: number
  /** standard error of the slope */
  se: number
  /** two-sided p-value for slope = 0 */
  p: number
  /** 95% confidence interval for the slope */
  ci: [number, number]
  r2: number
}

/** Ordinary least squares of y on x with classical standard errors. Null below 5 points or with no spread in x. */
export function regress(x: number[], y: number[]): Regression | null {
  const n = x.length
  if (n < 5 || y.length !== n) return null
  const mx = mean(x), my = mean(y)
  let sxx = 0, sxy = 0, syy = 0
  for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); syy += (y[i] - my) ** 2 }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const sse = Math.max(0, syy - slope * sxy)
  const se = Math.sqrt(sse / (n - 2) / sxx)
  // a perfect fit is significant unless y never moves; constant y used to come out as p = 0
  const t = se === 0 ? (slope === 0 ? 0 : Infinity) : slope / se
  const tc = tCrit95(n - 2)
  return { n, slope, intercept, se, p: tPValue(t, n - 2), ci: [slope - tc * se, slope + tc * se], r2: syy === 0 ? 0 : 1 - sse / syy }
}

// ── Series helpers ───────────────────────────────────────────────────────────

/** Points sorted by x, finite values only. */
export const clean = (pts: Pt[]): Pt[] => pts.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x)

/** The most recent run of consecutive years (no gaps). */
export function lastRun(pts: Pt[]): Pt[] {
  const s = clean(pts)
  let start = s.length - 1
  while (start > 0 && s[start].x - s[start - 1].x === 1) start--
  return s.slice(Math.max(0, start))
}

/** Pairs of values for the years both series report. */
export function joinYears(a: Pt[], b: Pt[]): { x: number; a: number; b: number }[] {
  const m = new Map(clean(b).map(p => [p.x, p.y]))
  return clean(a).filter(p => m.has(p.x)).map(p => ({ x: p.x, a: p.y, b: m.get(p.x)! }))
}

/** Year-on-year differences, only between consecutive years. */
export function diffs(pts: Pt[], mode: 'diff' | 'log' = 'diff'): Pt[] {
  const s = clean(pts)
  const out: Pt[] = []
  for (let i = 1; i < s.length; i++) {
    if (s[i].x - s[i - 1].x !== 1) continue
    if (mode === 'log') {
      if (s[i].y > 0 && s[i - 1].y > 0) out.push({ x: s[i].x, y: 100 * Math.log(s[i].y / s[i - 1].y) })
    } else out.push({ x: s[i].x, y: s[i].y - s[i - 1].y })
  }
  return out
}

// ── Trend test ───────────────────────────────────────────────────────────────

/** Sen's slope: the median of all pairwise slopes. Robust to outliers and to a non-normal distribution. */
export function senSlope(pts: Pt[]): number {
  const slopes: number[] = []
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (pts[j].x !== pts[i].x) slopes.push((pts[j].y - pts[i].y) / (pts[j].x - pts[i].x))
  }
  return slopes.length ? median(slopes) : 0
}

/** Mann–Kendall S statistic and two-sided p-value (normal approximation, tie-corrected variance, continuity correction). */
export function mannKendall(values: number[]): { s: number; z: number; p: number } {
  const n = values.length
  let s = 0
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += Math.sign(values[j] - values[i])
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let ties = 0
  for (const t of counts.values()) if (t > 1) ties += t * (t - 1) * (2 * t + 5)
  const varS = (n * (n - 1) * (2 * n + 5) - ties) / 18
  const z = varS <= 0 ? 0 : s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0
  return { s, z, p: 2 * (1 - normalCdf(Math.abs(z))) }
}

function lag1(v: number[]): number {
  if (v.length < 4) return 0
  const m = mean(v)
  let num = 0, den = 0
  for (let i = 0; i < v.length; i++) { den += (v[i] - m) ** 2; if (i > 0) num += (v[i] - m) * (v[i - 1] - m) }
  return den === 0 ? 0 : num / den
}

export interface TrendResult {
  n: number
  from: number
  to: number
  /** Sen's slope, units per year */
  slope: number
  p: number
  direction: 'up' | 'down' | 'flat'
  /** bias-corrected lag-1 autocorrelation of the detrended series, used to shrink the effective sample size */
  r1: number
}

export const TREND_WINDOW = 15
export const TREND_MIN_N = 8
export const ALPHA = 0.05

/**
 * Monotonic-trend test on the most recent `window` observations: Sen's slope, and Mann–Kendall with the variance
 * inflated for lag-1 autocorrelation (Yue & Wang 2004 effective sample size). r1 is estimated on the Sen-detrended
 * series and bias-corrected, (n·r1 + 1)/(n − 4), because short samples underestimate it badly.
 *
 * Chosen by simulation: on trendless AR(1) series with ρ = 0.6 and n = 15 the plain test
 * calls ~24% "significant", trend-free pre-whitening ~29%, this correction ~9%. The price is lower power. "flat"
 * means no trend at the 5% level, not that the series is constant.
 */
export function trendTest(pts: Pt[], window = TREND_WINDOW): TrendResult | null {
  const s = clean(pts).slice(-window)
  const n = s.length
  if (n < TREND_MIN_N) return null
  const b = senSlope(s)
  let r1 = (n * lag1(s.map(p => p.y - b * p.x)) + 1) / (n - 4)
  r1 = Math.min(0.95, r1)
  const mk = mannKendall(s.map(p => p.y))
  let p = mk.p
  if (r1 > 0 && mk.z !== 0) {
    const f = 1 + 2 * (r1 ** (n + 1) - n * r1 * r1 + (n - 1) * r1) / (n * (r1 - 1) ** 2)
    p = 2 * (1 - normalCdf(Math.abs(mk.z) / Math.sqrt(f)))
  }
  const direction = p < ALPHA && b !== 0 ? (b > 0 ? 'up' : 'down') : 'flat'
  return { n, from: s[0].x, to: s[n - 1].x, slope: b, p, direction, r1 }
}

/**
 * Benjamini–Hochberg: which of many p-values survive at false-discovery rate `q`. Testing ~90 series at 5% would
 * otherwise yield several "significant" trends by chance alone.
 */
export function benjaminiHochberg(pvals: number[], q = 0.05): boolean[] {
  const m = pvals.length
  const order = pvals.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0])
  let k = -1
  order.forEach(([p], r) => { if (p <= ((r + 1) / m) * q) k = r })
  const out = new Array<boolean>(m).fill(false)
  for (let r = 0; r <= k; r++) out[order[r][1]] = true
  return out
}

// ── Business cycle ───────────────────────────────────────────────────────────

/** Solves a small dense linear system by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]
    x[r] = s / M[r][r]
  }
  return x
}

/** Hodrick–Prescott trend: minimises Σ(y−τ)² + λ Σ(Δ²τ)². */
export function hpFilter(y: number[], lambda: number): number[] {
  const n = y.length
  if (n < 4) return [...y]
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
  for (let t = 0; t < n - 2; t++) {
    const idx = [t, t + 1, t + 2], w = [1, -2, 1]
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) A[idx[a]][idx[c]] += lambda * w[a] * w[c]
  }
  return solve(A, y)
}

export const HP_LAMBDA_ANNUAL = 6.25

export interface OutputGap { points: (Pt & { trend: number })[]; lambda: number }

/** Output gap (% of trend output) from real GDP levels over the latest unbroken run of years (min 12). */
export function outputGap(realGdp: Pt[], lambda = HP_LAMBDA_ANNUAL): OutputGap | null {
  const run = lastRun(realGdp).filter(p => p.y > 0)
  if (run.length < 12) return null
  const logs = run.map(p => Math.log(p.y))
  const trend = hpFilter(logs, lambda)
  return { lambda, points: run.map((p, i) => ({ x: p.x, y: 100 * (Math.exp(logs[i] - trend[i]) - 1), trend: Math.exp(trend[i]) })) }
}

export interface Recession {
  start: number
  end: number
  /** cumulative real GDP change over the episode, % */
  depth: number
  /** first year real GDP regained its pre-recession level; null when not yet */
  recovered: number | null
}

/** Episodes of consecutive years of negative real GDP growth, with depth and recovery year. */
export function recessions(growth: Pt[], realGdp: Pt[]): Recession[] {
  const g = clean(growth)
  const lvl = new Map(clean(realGdp).map(p => [p.x, p.y]))
  const out: Recession[] = []
  for (let i = 0; i < g.length; i++) {
    if (g[i].y >= 0) continue
    let j = i
    while (j + 1 < g.length && g[j + 1].y < 0 && g[j + 1].x === g[j].x + 1) j++
    const depth = 100 * (g.slice(i, j + 1).reduce((f, p) => f * (1 + p.y / 100), 1) - 1)
    const peak = lvl.get(g[i].x - 1)
    let recovered: number | null = null
    if (peak !== undefined) {
      for (const [yr, v] of [...lvl.entries()].sort((a, b) => a[0] - b[0])) if (yr > g[j].x && v >= peak) { recovered = yr; break }
    }
    out.push({ start: g[i].x, end: g[j].x, depth, recovered })
    i = j
  }
  return out
}

export interface PeriodStat { label: string; from: number; to: number; n: number; mean: number; sd: number }

/** Mean and standard deviation by calendar decade (decades with fewer than 3 values are dropped). */
export function byDecade(pts: Pt[]): PeriodStat[] {
  const groups = new Map<number, number[]>()
  for (const p of clean(pts)) {
    const d = Math.floor(p.x / 10) * 10
    groups.set(d, [...(groups.get(d) ?? []), p.y])
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).filter(([, v]) => v.length >= 3)
    .map(([d, v]) => ({ label: `${d}s`, from: d, to: d + 9, n: v.length, mean: mean(v), sd: sd(v) }))
}

/** Compound annual growth rate (%) of a level series over the last `years`, or null when either end year is missing. */
export function cagr(level: Pt[], years: number): { from: number; to: number; rate: number } | null {
  const s = clean(level)
  if (!s.length) return null
  const end = s[s.length - 1]
  const start = s.find(p => p.x === end.x - years)
  if (!start || start.y <= 0 || end.y <= 0) return null
  return { from: start.x, to: end.x, rate: 100 * ((end.y / start.y) ** (1 / years) - 1) }
}

/** Splits real GDP growth into per-capita growth and population growth, by decade: (1+g) = (1+g_pc)(1+n). */
export function growthDecomposition(gdpGrowth: Pt[], popGrowth: Pt[]): (PeriodStat & { pop: number; perCapita: number })[] {
  const joined = joinYears(gdpGrowth, popGrowth)
  const total = byDecade(joined.map(j => ({ x: j.x, y: j.a })))
  return total.map(d => {
    const rows = joined.filter(j => j.x >= d.from && j.x <= d.to)
    const pop = mean(rows.map(r => r.b))
    const perCapita = mean(rows.map(r => 100 * ((1 + r.a / 100) / (1 + r.b / 100) - 1)))
    return { ...d, pop, perCapita }
  })
}

// ── Relationships estimated on changes ──────────────────────────────────────

export interface Okun {
  points: { x: number; growth: number; dU: number }[]
  fit: Regression
  /** growth that keeps unemployment stable (−intercept/slope); only when the slope is significantly negative */
  stableGrowth: number | null
}

/** Okun's law, difference form: Δunemployment (pp) on real GDP growth (%), consecutive years only. */
export function okun(gdpGrowth: Pt[], unemployment: Pt[]): Okun | null {
  const dU = new Map(diffs(unemployment).map(p => [p.x, p.y]))
  const points = clean(gdpGrowth).filter(p => dU.has(p.x)).map(p => ({ x: p.x, growth: p.y, dU: dU.get(p.x)! }))
  const fit = regress(points.map(p => p.growth), points.map(p => p.dU))
  if (!fit) return null
  const stableGrowth = fit.slope < 0 && fit.p < ALPHA ? -fit.intercept / fit.slope : null
  return { points, fit, stableGrowth }
}

export interface Phillips {
  points: { x: number; u: number; dPi: number }[]
  fit: Regression
  /** unemployment at which inflation is stable (−intercept/slope); only when the slope is significantly negative */
  nairu: number | null
}

/** Accelerationist Phillips curve: Δinflation (pp) on the unemployment rate (%). */
export function phillips(inflation: Pt[], unemployment: Pt[]): Phillips | null {
  const u = new Map(clean(unemployment).map(p => [p.x, p.y]))
  const points = diffs(inflation).filter(p => u.has(p.x)).map(p => ({ x: p.x, u: u.get(p.x)!, dPi: p.y }))
  const fit = regress(points.map(p => p.u), points.map(p => p.dPi))
  if (!fit) return null
  return { points, fit, nairu: fit.slope < 0 && fit.p < ALPHA ? -fit.intercept / fit.slope : null }
}

/** AR(1) persistence: inflation on last year's inflation. A coefficient near 1 means shocks fade slowly. */
export function persistence(series: Pt[]): Regression | null {
  const s = clean(series)
  const x: number[] = [], y: number[] = []
  for (let i = 1; i < s.length; i++) if (s[i].x - s[i - 1].x === 1) { x.push(s[i - 1].y); y.push(s[i].y) }
  return regress(x, y)
}

// ── Structural break ─────────────────────────────────────────────────────────

/** Andrews (1993; corrected 2003) asymptotic 5% critical value of sup-F, one restriction, 15% trimming. */
export const SUPF_CRIT_5 = 8.68
export const BREAK_TRIM = 0.15
export const BREAK_MIN_N = 20

export interface MeanBreak {
  n: number
  /** first year of the new regime */
  year: number
  supF: number
  significant: boolean
  before: { from: number; to: number; mean: number; n: number }
  after: { from: number; to: number; mean: number; n: number }
}

/**
 * Quandt–Andrews test for one unknown break in the mean: an F test of "same mean before and after" at every candidate
 * year (trimming 15% at each end), keeping the largest. Compared with Andrews' critical value, which accounts for the
 * search over break dates. Assumes roughly independent errors; persistent series (inflation) will over-reject.
 */
export function meanBreak(pts: Pt[]): MeanBreak | null {
  const s = clean(pts)
  const n = s.length
  if (n < BREAK_MIN_N) return null
  const y = s.map(p => p.y)
  const m = mean(y)
  const sst = y.reduce((a, v) => a + (v - m) ** 2, 0)
  if (sst === 0) return null
  const lo = Math.max(2, Math.floor(n * BREAK_TRIM)), hi = Math.min(n - 2, n - Math.floor(n * BREAK_TRIM))
  let best: { k: number; f: number } | null = null
  for (let k = lo; k <= hi; k++) {
    const a = y.slice(0, k), b = y.slice(k)
    const ma = mean(a), mb = mean(b)
    const ssr = a.reduce((t, v) => t + (v - ma) ** 2, 0) + b.reduce((t, v) => t + (v - mb) ** 2, 0)
    const f = ssr === 0 ? Infinity : (sst - ssr) / (ssr / (n - 2))
    if (!best || f > best.f) best = { k, f }
  }
  if (!best) return null
  const a = s.slice(0, best.k), b = s.slice(best.k)
  return {
    n, year: b[0].x, supF: best.f, significant: best.f > SUPF_CRIT_5,
    before: { from: a[0].x, to: a[a.length - 1].x, mean: mean(a.map(p => p.y)), n: a.length },
    after: { from: b[0].x, to: b[b.length - 1].x, mean: mean(b.map(p => p.y)), n: b.length },
  }
}

// ── Balances ─────────────────────────────────────────────────────────────────

export interface SectoralRow { x: number; currentAccount: number; government: number; privateSector: number }

/**
 * Sectoral balances identity: private (S−I) + government (T−G) = current account (all % of GDP), so the private
 * balance is derived as CA − government. Inherits any mismatch between the two sources' coverage.
 */
export function sectoralBalances(currentAccount: Pt[], government: Pt[]): SectoralRow[] {
  return joinYears(currentAccount, government).map(j => ({ x: j.x, currentAccount: j.a, government: j.b, privateSector: j.a - j.b }))
}

export interface DebtRow {
  x: number
  debt: number
  /** effective nominal interest rate on last year's debt stock, % */
  interestRate: number
  /** nominal GDP growth, % */
  growth: number
  primaryBalance: number
  /** contribution of i − g to the change in the debt ratio, pp of GDP */
  snowball: number
  /** change in the debt ratio, pp */
  change: number
  /** stock-flow adjustment: the part of the change neither the primary balance nor the snowball explains */
  sfa: number
  /** primary balance that would have held the ratio constant, % of GDP */
  stabilising: number
}

/**
 * Debt dynamics (European Commission convention), all % of GDP:
 *   Δd_t = −pb_t + d_{t−1}·(i_t − g_t)/(1 + g_t) + sfa_t
 * with i_t the effective interest rate (interest paid / last year's debt, in money terms), g_t nominal GDP growth,
 * pb_t = balance + interest paid. The SFA is the residual.
 */
export function debtDynamics(input: { debt: Pt[]; balance: Pt[]; interest: Pt[]; nominalGdp: Pt[] }): DebtRow[] {
  const d = new Map(clean(input.debt).map(p => [p.x, p.y]))
  const b = new Map(clean(input.balance).map(p => [p.x, p.y]))
  const ip = new Map(clean(input.interest).map(p => [p.x, p.y]))
  const y = new Map(clean(input.nominalGdp).map(p => [p.x, p.y]))
  const rows: DebtRow[] = []
  for (const [t, dt] of [...d.entries()].sort((a, c) => a[0] - c[0])) {
    const d0 = d.get(t - 1), bt = b.get(t), it = ip.get(t), yt = y.get(t), y0 = y.get(t - 1)
    if (d0 === undefined || bt === undefined || it === undefined || yt === undefined || y0 === undefined || d0 <= 0 || y0 <= 0) continue
    const g = yt / y0 - 1
    const i = (it / d0) * (1 + g)
    const pb = bt + it
    const snowball = 100 * (d0 / 100) * (i - g) / (1 + g)
    const change = dt - d0
    rows.push({ x: t, debt: dt, interestRate: 100 * i, growth: 100 * g, primaryBalance: pb, snowball, change, sfa: change + pb - snowball, stabilising: snowball })
  }
  return rows
}

// ── Anomaly scan ─────────────────────────────────────────────────────────────

export interface Anomaly { id: string; year: number; change: number; z: number; typical: number; n: number }

export const ANOMALY_Z = 3
export const ANOMALY_MIN_HISTORY = 10

/**
 * For each series: the latest year-on-year change compared with all earlier changes, as a robust z-score
 * (median and MAD×1.4826), flagged at |z| ≥ ANOMALY_Z. Returns the flags plus how many series were tested and how many
 * flags chance alone would give if changes were normal — a lower bound, since macro changes have fat tails.
 */
export function anomalyScan(series: { id: string; points: Pt[]; mode: 'diff' | 'log' }[]): { flags: Anomaly[]; tested: number; expectedByChance: number } {
  const flags: Anomaly[] = []
  let tested = 0
  for (const s of series) {
    const ch = diffs(s.points, s.mode)
    if (ch.length < ANOMALY_MIN_HISTORY + 1) continue
    const last = ch[ch.length - 1]
    const hist = ch.slice(0, -1).map(p => p.y)
    const med = median(hist)
    const mad = 1.4826 * median(hist.map(v => Math.abs(v - med)))
    if (!(mad > 0)) continue
    tested++
    const z = (last.y - med) / mad
    if (Math.abs(z) >= ANOMALY_Z) flags.push({ id: s.id, year: last.x, change: last.y, z, typical: mad, n: hist.length })
  }
  const pTail = 2 * (1 - normalCdf(ANOMALY_Z))
  return { flags: flags.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)), tested, expectedByChance: tested * pTail }
}

// ── Forecast ─────────────────────────────────────────────────────────────────
//
// A univariate projection of a single annual series (e.g. GDP growth) from its own history, in the same
// spirit as trendTest/hpFilter above: a named, textbook method with n and a documented assumption, not a
// black box. With ~60 annual points per country this is deliberately a low-order AR model, not anything
// more flexible — there isn't enough data to justify more parameters, and macro forecasting research itself
// finds that simple univariate models are hard to beat at a 1–2 year horizon for GDP growth specifically.
// Two baselines are reported alongside every forecast for exactly that reason: if the AR model can't beat
// "repeat last year's value" or "the historical mean" out of sample (backtestForecast below), that is the
// honest result to show, not a reason to hide the baseline.

export interface Forecast {
  method: string
  n: number
  /** one point per step ahead, years 1..horizon beyond the last observed year */
  points: { year: number; value: number; lo: number; hi: number }[]
  /** AR only: the level the iterated forecast converges to, c / (1 − Σφ); null when the fit isn't stationary */
  longRun?: number | null
}

/** Repeats the last value: the standard "no change" baseline for a growth-rate-like series. */
export function naiveForecast(pts: Pt[], horizon: number): Forecast | null {
  const s = lastRun(pts)
  if (s.length < 2) return null
  const last = s[s.length - 1]
  const resid = diffs(s).map(d => d.y)
  const se = sd(resid)
  return {
    method: 'naive (random walk)', n: s.length,
    points: Array.from({ length: horizon }, (_, i) => {
      const h = i + 1
      const spread = Number.isFinite(se) ? tCrit95(s.length - 2) * se * Math.sqrt(h) : NaN
      return { year: last.x + h, value: last.y, lo: last.y - spread, hi: last.y + spread }
    }),
  }
}

/** The series' own historical mean, flat into the future: the baseline for a level that reverts rather than drifts. */
export function meanForecast(pts: Pt[], horizon: number): Forecast | null {
  const s = lastRun(pts)
  if (s.length < 5) return null
  const m = mean(s.map(p => p.y))
  const se = sd(s.map(p => p.y))
  const lastYear = s[s.length - 1].x
  const spread = Number.isFinite(se) ? tCrit95(s.length - 1) * se : NaN
  return {
    method: 'historical mean', n: s.length,
    points: Array.from({ length: horizon }, (_, i) => ({ year: lastYear + i + 1, value: m, lo: m - spread, hi: m + spread })),
  }
}

/** OLS fit of an AR(p) model by the normal equations (p small, solved directly — no iteration). */
function fitAr(y: number[], p: number): { coef: number[]; intercept: number; resid: number[] } | null {
  const n = y.length - p
  if (n < p + 3) return null
  const X: number[][] = [], Y: number[] = []
  for (let t = p; t < y.length; t++) { X.push([1, ...Array.from({ length: p }, (_, k) => y[t - 1 - k])]); Y.push(y[t]) }
  const d = p + 1
  const XtX = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0)))
  const XtY = Array.from({ length: d }, (_, i) => X.reduce((s, row, t) => s + row[i] * Y[t], 0))
  const beta = solve(XtX, XtY)
  if (beta.some(b => !Number.isFinite(b))) return null
  const resid = X.map((row, t) => Y[t] - row.reduce((s, x, i) => s + x * beta[i], 0))
  return { intercept: beta[0], coef: beta.slice(1), resid }
}

/**
 * Forecasts `horizon` years ahead with an AR(p) model fit by OLS on the most recent unbroken run of years.
 * Each step is iterated using the model's own prior forecasts (no look-ahead). The interval is the standard
 * h-step AR forecast interval (Hamilton, Time Series Analysis, 1994, ch. 4; Hyndman & Athanasopoulos, FPP3 §9.8):
 *   ŷ ± t(0.975, n−p−1) · σ̂ · √(ψ₀² + … + ψ²₍h−1₎),  σ̂² = Σe² / (n−p−1),  ψ₀ = 1, ψⱼ = Σᵢ φᵢ ψⱼ₋ᵢ
 * It ignores parameter-estimation uncertainty and assumes the past error spread holds, so real coverage can
 * fall short of 95% (measured in research/FINDINGS.md). Null below 2p + 3 points.
 */
export function arForecast(pts: Pt[], p = 2, horizon = 3): Forecast | null {
  const s = lastRun(pts)
  const y = s.map(v => v.y)
  const fit = fitAr(y, p)
  if (!fit) return null
  const { intercept, coef, resid } = fit
  const df = resid.length - p - 1
  const se = df > 0 ? Math.sqrt(resid.reduce((sum, e) => sum + e * e, 0) / df) : NaN
  const psi = [1]
  for (let j = 1; j < horizon; j++) psi.push(coef.reduce((sum, c, i) => sum + (j - 1 - i >= 0 ? c * psi[j - 1 - i] : 0), 0))
  const lastYear = s[s.length - 1].x
  const history = [...y]
  const out: Forecast['points'] = []
  let psiSq = 0
  for (let h = 1; h <= horizon; h++) {
    const lags = Array.from({ length: p }, (_, k) => history[history.length - 1 - k])
    const value = intercept + coef.reduce((sum, c, i) => sum + c * lags[i], 0)
    history.push(value)
    psiSq += psi[h - 1] ** 2
    const spread = Number.isFinite(se) ? tCrit95(df) * se * Math.sqrt(psiSq) : NaN
    out.push({ year: lastYear + h, value, lo: value - spread, hi: value + spread })
  }
  return { method: `AR(${p})`, n: s.length, points: out, longRun: arStationary(coef) ? intercept / (1 - coef.reduce((a, b) => a + b, 0)) : null }
}

/** Stationarity of an AR(1)/AR(2) fit (the stationarity triangle for p = 2); higher orders aren't checked and return false. */
function arStationary(phi: number[]): boolean {
  if (phi.length === 1) return Math.abs(phi[0]) < 1
  if (phi.length === 2) return phi[0] + phi[1] < 1 && phi[1] - phi[0] < 1 && Math.abs(phi[1]) < 1
  return false
}

export interface ForecastBacktest {
  model: string
  /** rolling-origin folds: fit on data up to each cutoff year, score the 1-year-ahead forecast only */
  folds: number
  mae: number | null
  /** the same folds' naive-baseline MAE, for the same question put to both */
  baselineMae: number | null
  /** Diebold–Mariano test of equal accuracy vs the naive baseline (absolute-error loss); null below 5 folds */
  dm: DieboldMariano | null
}

export interface DieboldMariano {
  /** HLN-corrected statistic: negative = the model's errors are smaller */
  stat: number
  /** two-sided p-value from Student's t with n − 1 degrees of freedom */
  p: number
  n: number
}

/**
 * Diebold–Mariano (1995) test that two forecasts are equally accurate, with the Harvey, Leybourne & Newbold (1997)
 * small-sample correction and t(n−1) reference distribution. Loss differential d_t = |e1_t| − |e2_t|. For h-step
 * forecasts the long-run variance uses autocovariances up to lag h − 1 (none at h = 1).
 */
export function dieboldMariano(errors1: number[], errors2: number[], h = 1): DieboldMariano | null {
  const n = Math.min(errors1.length, errors2.length)
  if (n < 5) return null
  const d = Array.from({ length: n }, (_, i) => Math.abs(errors1[i]) - Math.abs(errors2[i]))
  const m = mean(d)
  const gamma = (k: number) => { let s = 0; for (let t = k; t < n; t++) s += (d[t] - m) * (d[t - k] - m); return s / n }
  let lrv = gamma(0)
  for (let k = 1; k < h; k++) lrv += 2 * gamma(k)
  if (!(lrv > 0)) return null
  const dm = m / Math.sqrt(lrv / n)
  const stat = dm * Math.sqrt((n + 1 - 2 * h + (h * (h - 1)) / n) / n)
  return { stat, p: tPValue(stat, n - 1), n }
}

/**
 * Pseudo-out-of-sample backtest: for every possible cutoff year with enough history before it and at least
 * one real value after it, refits the model using only data up to that year and scores its 1-year-ahead
 * forecast against what the series actually did next. This is the only honest way to claim a forecast
 * method "works" on a series this short — an in-sample fit error is not a forecast error. Mirrors
 * research/src/backtest.ts's replay-and-score shape for the trend flag.
 */
export function backtestForecast(pts: Pt[], makeForecast: (train: Pt[]) => Forecast | null, minHistory: number): ForecastBacktest | null {
  const s = lastRun(pts)
  const errors: number[] = []
  const baselineErrors: number[] = []
  for (let cut = minHistory; cut < s.length; cut++) {
    const train = s.slice(0, cut)
    const actual = s[cut]
    const f = makeForecast(train)
    const base = naiveForecast(train, 1)
    // paired: a fold counts only when both forecasts exist, so the two MAEs are over the same years
    if (!f?.points[0] || !base?.points[0]) continue
    errors.push(f.points[0].value - actual.y)
    baselineErrors.push(base.points[0].value - actual.y)
  }
  if (!errors.length) return null
  const abs = (v: number[]) => v.map(Math.abs)
  return {
    model: 'model', folds: errors.length,
    mae: mean(abs(errors)),
    baselineMae: mean(abs(baselineErrors)),
    dm: dieboldMariano(errors, baselineErrors, 1),
  }
}

// ── Monthly helpers (Europe) ─────────────────────────────────────────────────

export interface PeriodPt { period: string; t: number; value: number }

/** Joins two period-keyed series and returns a − b for the periods both report (e.g. real rate = policy − inflation). */
export function spreadSeries(a: PeriodPt[], b: PeriodPt[]): PeriodPt[] {
  const m = new Map(b.map(p => [p.period, p.value]))
  return a.filter(p => m.has(p.period)).map(p => ({ ...p, value: p.value - m.get(p.period)! }))
}

/** Annual averages of a monthly/quarterly series (only years with all `perYear` observations). */
export function annualAverage(pts: PeriodPt[], perYear: number): Pt[] {
  const g = new Map<number, number[]>()
  for (const p of pts) {
    const yr = Number(p.period.slice(0, 4))
    g.set(yr, [...(g.get(yr) ?? []), p.value])
  }
  return [...g.entries()].filter(([, v]) => v.length === perYear).map(([x, v]) => ({ x, y: mean(v) })).sort((a, b) => a.x - b.x)
}
