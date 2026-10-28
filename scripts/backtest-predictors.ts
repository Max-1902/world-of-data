/**
 * Runs the backtest written down in docs/predictor-backtest-protocol.md. Offline: reads World Bank API JSON files and
 * the FRED Brent CSV from a data directory, writes a markdown report.
 *
 * Usage: npx tsx scripts/backtest-predictors.ts <data-dir> <out.md>
 *   <data-dir> holds <indicator>.json (World Bank API v2, country/all, per_page=20000, date=1960:2025) and brent.csv.
 */
import fs from 'node:fs'
import { arForecast, dieboldMariano, type Pt } from '../src/utils/econAnalysis'

const [DATA, OUT] = process.argv.slice(2)
if (!DATA || !OUT) throw new Error('usage: backtest-predictors.ts <data-dir> <out.md>')

type Series = Map<number, number>
const econ = JSON.parse(fs.readFileSync('src/data/wb-economies.json', 'utf8')) as { economies: string[][] }
const ISO = new Set(econ.economies.map(e => e[0]))

function loadWb(id: string): { byIso: Map<string, Series>; pages: number } {
  const raw = JSON.parse(fs.readFileSync(`${DATA}/${id}.json`, 'utf8'))
  const byIso = new Map<string, Series>()
  for (const r of raw[1] ?? []) {
    if (r.value == null || !(ISO.has(r.countryiso3code) || r.countryiso3code === 'WLD')) continue
    if (!byIso.has(r.countryiso3code)) byIso.set(r.countryiso3code, new Map())
    byIso.get(r.countryiso3code)!.set(+r.date, r.value)
  }
  return { byIso, pages: raw[0].pages }
}

const growthWb = loadWb('NY.GDP.MKTP.KD.ZG')
if (growthWb.pages !== 1) throw new Error('growth file is paginated')
const growth = growthWb.byIso
const world = growth.get('WLD')!
growth.delete('WLD')

const change = (s: Series): Series => { const o: Series = new Map(); for (const [t, v] of s) if (s.has(t - 1)) o.set(t, v - s.get(t - 1)!); return o }
const level = (s: Series): Series => s

interface Candidate { id: string; label: string; minJoint: number; exploratory: boolean; x: Map<string, Series> }
const own = (wb: string, tf: (s: Series) => Series): Map<string, Series> => {
  const { byIso, pages } = loadWb(wb)
  if (pages !== 1) throw new Error(`${wb} is paginated`)
  const m = new Map<string, Series>()
  for (const [k, s] of byIso) if (k !== 'WLD') m.set(k, tf(s))
  return m
}
const globalX = (s: Series): Map<string, Series> => new Map([...growth.keys()].map(k => [k, s]))
const brent: Series = new Map()
for (const line of fs.readFileSync(`${DATA}/brent.csv`, 'utf8').trim().split('\n').slice(1)) {
  const [d, v] = line.split(','); const y = +d.slice(0, 4); if (Number.isFinite(+v) && v !== '') brent.set(y, +v)
}
const brentLogChange: Series = new Map()
for (const [t, v] of brent) if (brent.has(t - 1)) brentLogChange.set(t, Math.log(v / brent.get(t - 1)!))

const CANDIDATES: Candidate[] = [
  { id: 'inflation', label: 'Inflation, change (pp)', minJoint: 20, exploratory: false, x: own('FP.CPI.TOTL.ZG', change) },
  { id: 'credit', label: 'Private credit / GDP, change (pp)', minJoint: 20, exploratory: false, x: own('FS.AST.PRVT.GD.ZS', change) },
  { id: 'current_account', label: 'Current account / GDP, level', minJoint: 20, exploratory: false, x: own('BN.CAB.XOKA.GD.ZS', level) },
  { id: 'unemployment', label: 'Unemployment rate, change (pp)', minJoint: 20, exploratory: false, x: own('SL.UEM.TOTL.ZS', change) },
  { id: 'real_rate', label: 'Real interest rate, level', minJoint: 20, exploratory: false, x: own('FR.INR.RINR', level) },
  { id: 'world_growth', label: 'World GDP growth, level', minJoint: 20, exploratory: false, x: globalX(world) },
  { id: 'brent', label: 'Brent oil price, log change (exploratory)', minJoint: 15, exploratory: true, x: globalX(brentLogChange) },
]

// Harness controls (CONTROLS=1): a predictor that leaks next year's growth must pass, pure noise must not.
if (process.env.CONTROLS) {
  let seed = 12345
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const leak = new Map<string, Series>(), noise = new Map<string, Series>()
  for (const [k, g] of growth) {
    const l: Series = new Map(), n: Series = new Map()
    for (const [t, v] of g) { l.set(t - 1, v); n.set(t, Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())) }
    leak.set(k, l); noise.set(k, n)
  }
  CANDIDATES.length = 0
  CANDIDATES.push({ id: 'control_leak', label: 'CONTROL: next-year growth (leak)', minJoint: 20, exploratory: false, x: leak },
    { id: 'control_noise', label: 'CONTROL: random noise', minJoint: 20, exploratory: false, x: noise })
}

// ── small OLS ────────────────────────────────────────────────────────────────
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-10) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((r, i) => r[n] / r[i])
}
function ols(X: number[][], y: number[]): number[] | null {
  const d = X[0].length
  const XtX = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)))
  const Xty = Array.from({ length: d }, (_, i) => X.reduce((s, r, t) => s + r[i] * y[t], 0))
  const b = solve(XtX, Xty)
  return b && b.every(Number.isFinite) ? b : null
}
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0)
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length
const sdev = (v: number[]) => { const m = mean(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) }

// ── backtest ─────────────────────────────────────────────────────────────────
const FIRST_T = 1990, LAST_T = 2024, MIN_HIST = 30

interface Rec { cand: string; variant: 'A' | 'B'; iso: string; T: number; ec: number; e1: number; e2: number }
const recs: Rec[] = []
const lastSlopeSign = new Map<string, number[]>()   // candidate → betas at final origin (variant A)

// shipped AR(2) one-step forecast per (iso, T), cached
const base1 = new Map<string, number | null>()
function shipped(iso: string, T: number): number | null {
  const k = `${iso}|${T}`
  if (base1.has(k)) return base1.get(k)!
  const g = growth.get(iso)!
  const pts: Pt[] = []
  for (let t = T; g.has(t); t--) pts.unshift({ x: t, y: g.get(t)! })
  let v: number | null = null
  if (pts.length >= MIN_HIST) v = arForecast(pts, 2, 1)?.points[0].value ?? null
  base1.set(k, v)
  return v
}

interface Fit { rows: number[]; xs: number[]; beta2: number[]; resid: number[]; last: [number, number]; xT: number; f2: number; fA: number | null }
function fitEconomy(g: Series, x: Series, T: number, minJoint: number, wantA: boolean): Fit | null {
  if (!g.has(T) || !g.has(T - 1) || !x.has(T)) return null
  const Xar: number[][] = [], Xadl: number[][] = [], Y: number[] = [], xs: number[] = []
  for (let t = 1; t + 1 <= T; t++) {
    if (g.has(t + 1) && g.has(t) && g.has(t - 1) && x.has(t)) {
      Xar.push([1, g.get(t)!, g.get(t - 1)!]); Xadl.push([1, g.get(t)!, g.get(t - 1)!, x.get(t)!]); Y.push(g.get(t + 1)!); xs.push(x.get(t)!)
    }
  }
  if (Y.length < minJoint) return null
  const b2 = ols(Xar, Y)
  if (!b2) return null
  const here = [1, g.get(T)!, g.get(T - 1)!]
  const resid = Y.map((y, i) => y - dot(Xar[i], b2))
  let fA: number | null = null
  if (wantA) { const bA = ols(Xadl, Y); if (bA) fA = dot([...here, x.get(T)!], bA) }
  return { rows: Y, xs, beta2: b2, resid, last: [g.get(T)!, g.get(T - 1)!], xT: x.get(T)!, f2: dot(here, b2), fA }
}

for (const cand of CANDIDATES) {
  for (let T = FIRST_T; T <= LAST_T; T++) {
    const fits = new Map<string, Fit>()
    for (const [iso, g] of growth) {
      const x = cand.x.get(iso); if (!x || !g.has(T + 1)) continue
      if (shipped(iso, T) == null) continue
      const f = fitEconomy(g, x, T, cand.minJoint, true)
      if (f) fits.set(iso, f)
    }
    // pooled slope on within-economy standardised x, from data up to T only
    let sxe = 0, sxx = 0
    const std = new Map<string, { m: number; s: number }>()
    for (const [iso, f] of fits) {
      const m = mean(f.xs), s = sdev(f.xs)
      if (!(s > 1e-9)) continue
      std.set(iso, { m, s })
      f.xs.forEach((v, i) => { const z = (v - m) / s; sxe += z * f.resid[i]; sxx += z * z })
    }
    const betaB = sxx > 0 ? sxe / sxx : null
    for (const [iso, f] of fits) {
      const actual = growth.get(iso)!.get(T + 1)!
      const e1 = Math.abs(shipped(iso, T)! - actual), e2 = Math.abs(f.f2 - actual)
      if (f.fA != null) recs.push({ cand: cand.id, variant: 'A', iso, T, ec: Math.abs(f.fA - actual), e1, e2 })
      const st = std.get(iso)
      if (betaB != null && st) recs.push({ cand: cand.id, variant: 'B', iso, T, ec: Math.abs(f.f2 + betaB * (f.xT - st.m) / st.s - actual), e1, e2 })
      if (T === LAST_T && f.fA != null) {
        const Xadl: number[][] = [], Y: number[] = []
        const g = growth.get(iso)!, x = cand.x.get(iso)!
        for (let t = 1; t + 1 <= T; t++) if (g.has(t + 1) && g.has(t) && g.has(t - 1) && x.has(t)) { Xadl.push([1, g.get(t)!, g.get(t - 1)!, x.get(t)!]); Y.push(g.get(t + 1)!) }
        const b = ols(Xadl, Y); if (b) { if (!lastSlopeSign.has(cand.id)) lastSlopeSign.set(cand.id, []); lastSlopeSign.get(cand.id)!.push(b[3]) }
      }
    }
  }
}

// ── scoring ──────────────────────────────────────────────────────────────────
interface Score { n: number; ratio: [number | null, number | null]; share: [number | null, number | null]; econs: [number, number]; dm: { stat: number; p: number; n: number } | null; pass: boolean }
const geo = (v: number[]) => Math.exp(mean(v.map(Math.log)))

function score(cand: Candidate, variant: 'A' | 'B', base: 'e1' | 'e2', skip2020: boolean): Score {
  const rs = recs.filter(r => r.cand === cand.id && r.variant === variant && !(skip2020 && r.T === 2019))
  const per = (lo: number, hi: number) => {
    const by = new Map<string, { c: number; b: number; n: number }>()
    for (const r of rs) if (r.T >= lo && r.T <= hi) { const o = by.get(r.iso) ?? { c: 0, b: 0, n: 0 }; o.c += r.ec; o.b += r[base]; o.n++; by.set(r.iso, o) }
    const ok = [...by.values()].filter(o => o.n >= 5 && o.b > 0 && o.c > 0)
    return ok.length < 10 ? { ratio: null, share: null, n: ok.length } : { ratio: geo(ok.map(o => o.c / o.b)), share: ok.filter(o => o.c < o.b).length / ok.length, n: ok.length }
  }
  const p1 = per(1990, 2009), p2 = per(2010, 2024)
  const years = new Map<number, { c: number[]; b: number[] }>()
  for (const r of rs) { const o = years.get(r.T) ?? { c: [], b: [] }; o.c.push(r.ec); o.b.push(r[base]); years.set(r.T, o) }
  const ys = [...years.entries()].filter(([, o]) => o.c.length >= 20).sort((a, b) => a[0] - b[0])
  const dm = dieboldMariano(ys.map(([, o]) => mean(o.c)), ys.map(([, o]) => mean(o.b)), 1)
  const pass = !cand.exploratory && p1.ratio != null && p2.ratio != null && p1.ratio < 1 && p2.ratio < 1 &&
    p1.share! > 0.5 && p2.share! > 0.5 && dm != null && dm.stat < 0 && dm.p < 0.05 / 12
  return { n: rs.length, ratio: [p1.ratio, p2.ratio], share: [p1.share, p2.share], econs: [p1.n, p2.n], dm, pass }
}

const f2 = (v: number | null) => (v == null ? '–' : v.toFixed(3))
const pc = (v: number | null) => (v == null ? '–' : `${Math.round(v * 100)}%`)
const pv = (v: number | null | undefined) => (v == null ? '–' : v < 0.001 ? '<0.001' : v.toFixed(3))
const lines: string[] = []
lines.push('# Predictor backtest — results', '', `Run ${new Date().toISOString().slice(0, 10)} by \`scripts/backtest-predictors.ts\` on the protocol in \`docs/predictor-backtest-protocol.md\` (written and committed first). Horizon: one year ahead, forecast origins ${FIRST_T}–${LAST_T}, current-vintage World Bank data (not real-time).`, '')
lines.push('Ratio = geometric-mean MAE of (AR(2) + indicator) ÷ baseline across economies; below 1 means the indicator helped. Share = economies where it helped. Periods: origins 1990–2009 | 2010–2024. DM p = Diebold–Mariano across origin years on the cross-economy mean error (pass needs p < 0.0042). A = per-economy slope, B = pooled slope.', '')
const sections: [string, 'e1' | 'e2'][] = [['vs the shipped AR(2) (all history)', 'e1'], ['vs AR(2) fit on the same years as the indicator model', 'e2']]
const verdict = new Map<string, boolean>()
for (const [title, base] of sections) {
  lines.push(`## ${title}`, '', '| Indicator | Var | Economies (early / late) | Ratio early | Ratio late | Share early | Share late | DM p | Ratio late, excl. 2020 | Pass |', '|---|---|---|---|---|---|---|---|---|---|')
  for (const cand of CANDIDATES) for (const v of ['A', 'B'] as const) {
    const s = score(cand, v, base, false), x = score(cand, v, base, true)
    if (base === 'e1' || base === 'e2') verdict.set(`${cand.id}|${v}|${base}`, s.pass)
    lines.push(`| ${cand.label} | ${v} | ${s.econs[0]} / ${s.econs[1]} | ${f2(s.ratio[0])} | ${f2(s.ratio[1])} | ${pc(s.share[0])} | ${pc(s.share[1])} | ${pv(s.dm?.p)} | ${f2(x.ratio[1])} | ${cand.exploratory ? 'exploratory' : s.pass ? 'yes' : 'no'} |`)
  }
  lines.push('')
}
lines.push('## Verdict', '')
for (const cand of CANDIDATES.filter(c => !c.exploratory)) {
  const ok = (['A', 'B'] as const).filter(v => verdict.get(`${cand.id}|${v}|e1`) && verdict.get(`${cand.id}|${v}|e2`))
  lines.push(`- **${cand.label}**: ${ok.length ? `passed against both baselines (variant ${ok.join(', ')})` : 'tested, did not improve the forecast under the protocol'}`)
}
lines.push('', '## Slope sign stability (variant A, final origin)', '', '| Indicator | Economies | Share with positive slope |', '|---|---|---|')
for (const cand of CANDIDATES) { const b = lastSlopeSign.get(cand.id) ?? []; lines.push(`| ${cand.label} | ${b.length} | ${b.length ? pc(b.filter(v => v > 0).length / b.length) : '–'} |`) }
fs.writeFileSync(OUT, lines.join('\n') + '\n')
console.log(lines.join('\n'))
