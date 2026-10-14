/**
 * Out-of-sample evaluation of the Predictions panel's forecasts (arForecast in src/utils/econAnalysis.ts), one target
 * series at a time: real GDP growth, CPI inflation, unemployment — the panel's three targets.
 *
 *   npx tsx scripts/research/forecastEval.ts --indicator gdp --fetch          # World Bank (free, keyless), stores a vintage
 *   npx tsx scripts/research/forecastEval.ts --input research/data/worldbank-gdp/<day>.json
 *
 * Rolling origin: for every country and every forecast origin year ≥ 1990 with ≥ MIN_TRAIN years before it, fit on data
 * up to the year before only, then score the 1- and 3-year-ahead forecast against what happened. Every method sees the
 * same folds. Origins are split at SPLIT so a choice made on the early period can be checked on the later one. The design
 * per indicator is fixed below, before results are looked at; unemployment (World Bank/ILO series from 1991 only) uses the
 * panel's own 15-year minimum and a later split.
 *
 * Writes research/backtest/forecast_<indicator>_<day>.json and prints a summary table.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { arForecast, naiveForecast, meanForecast, lastRun, mean, type Forecast, type Pt } from '../../src/utils/econAnalysis'
import { ROOT, DATA_DIR, writeJson, arg, flag, isoDay } from './lib'

const INDICATORS = {
  gdp: { id: 'NY.GDP.MKTP.KD.ZG', dir: 'worldbank-gdp', minTrain: 30, split: 2005 },
  cpi: { id: 'FP.CPI.TOTL.ZG', dir: 'worldbank-cpi', minTrain: 30, split: 2005 },
  unemployment: { id: 'SL.UEM.TOTL.ZS', dir: 'worldbank-unemployment', minTrain: 15, split: 2015 },
} as const
type IndicatorKey = keyof typeof INDICATORS
// Europe + Asia (World Bank ISO2). Fixed list so reruns compare like with like.
const COUNTRIES = 'DE FR IT ES GB PL NL BE AT CH SE NO DK FI IE PT GR CZ SK HU RO BG HR SI LT LV EE LU IS TR CN IN JP KR ID VN TH MY PH BD PK SG LK NP MN KH LA IR IL SA KZ UZ'.split(' ')
const WINDOWS: (number | null)[] = [null, 40, 30, 25, 20]
const FIRST_ORIGIN = 1990, H = 3, P = 2

interface Vintage { fetched: string; indicator: string; source: string; countries: Record<string, Pt[]> }

async function load(): Promise<Vintage & { path: string; key: IndicatorKey }> {
  const keyOf = (id: string) => {
    const k = (Object.keys(INDICATORS) as IndicatorKey[]).find(k => INDICATORS[k].id === id)
    if (!k) throw new Error(`unknown indicator ${id}`)
    return k
  }
  const input = arg('input')
  if (input) {
    const path = resolve(process.cwd(), input), v = JSON.parse(readFileSync(path, 'utf8')) as Vintage
    return { ...v, path, key: keyOf(v.indicator) }
  }
  const key = (arg('indicator') ?? 'gdp') as IndicatorKey
  if (!INDICATORS[key]) throw new Error(`--indicator must be one of ${Object.keys(INDICATORS).join(', ')}`)
  if (!flag('fetch')) throw new Error('pass --input <worldbank-* file> or --indicator <key> --fetch')
  const INDICATOR = INDICATORS[key].id
  const countries: Record<string, Pt[]> = {}
  for (const c of COUNTRIES) {
    const res = await fetch(`https://api.worldbank.org/v2/country/${c}/indicator/${INDICATOR}?format=json&per_page=100`)
    if (!res.ok) throw new Error(`World Bank ${c}: HTTP ${res.status}`)
    const j = await res.json() as [unknown, { date: string; value: number | null }[] | null]
    countries[c] = (j[1] ?? []).filter(d => d.value != null).map(d => ({ x: Number(d.date), y: d.value! })).sort((a, b) => a.x - b.x)
  }
  const v: Vintage = { fetched: new Date().toISOString(), indicator: INDICATOR, source: 'World Bank WDI API', countries }
  const path = resolve(DATA_DIR, INDICATORS[key].dir, `${isoDay(Date.now())}.json`)
  writeJson(path, v, false)
  return { ...v, path, key }
}

type Band = { v: number; lo: number; hi: number }
const bands = (f: Forecast): Band[] => f.points.map(p => ({ v: p.value, lo: p.lo, hi: p.hi }))

/**
 * The pre-fix interval (commit e9453fb): t · sd(resid, n−1) · √h. OLS residuals with an intercept have mean 0, so
 * sd(resid, n−1) = σ̂ · √((n−p−1)/(n−1)) with σ̂ the shipped residual standard error — derived exactly from the
 * shipped 1-step half-width, no second OLS implementation.
 */
function preFix(f: Forecast, trainLen: number): Band[] {
  const n = trainLen - P, half1 = (f.points[0].hi - f.points[0].lo) / 2
  const sdN1 = half1 * Math.sqrt((n - P - 1) / (n - 1))
  return f.points.map((p, i) => { const half = sdN1 * Math.sqrt(i + 1); return { v: p.value, lo: p.value - half, hi: p.value + half } })
}

interface Acc { e1: number[]; e3: number[]; cov1: number[]; cov3: number[] }
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const newAcc = (): Acc => ({ e1: [], e3: [], cov1: [], cov3: [] })

async function main() {
  const data = await load()
  const { minTrain: MIN_TRAIN, split: SPLIT } = INDICATORS[data.key]
  const series = Object.fromEntries(Object.entries(data.countries).map(([c, pts]) => [c, lastRun(pts)]))
  const acc: Record<string, { early: Acc; late: Acc }> = {}
  const perCountry: Record<string, Record<string, number[]>> = {}
  const nonStationary = { count: 0, total: 0 }

  for (const [c, s] of Object.entries(series)) {
    for (let cut = MIN_TRAIN; cut < s.length; cut++) {
      if (s[cut].x < FIRST_ORIGIN) continue
      const period = s[cut].x < SPLIT ? 'early' : 'late'
      const a1 = s[cut].y, a3 = s[cut + H - 1]?.y
      const add = (m: string, b: Band[]) => {
        const A = (acc[m] ??= { early: newAcc(), late: newAcc() })[period]
        A.e1.push(Math.abs(b[0].v - a1)); A.cov1.push(+(a1 >= b[0].lo && a1 <= b[0].hi))
        if (a3 !== undefined) { A.e3.push(Math.abs(b[H - 1].v - a3)); A.cov3.push(+(a3 >= b[H - 1].lo && a3 <= b[H - 1].hi)) }
        ;((perCountry[c] ??= {})[m] ??= []).push(Math.abs(b[0].v - a1))
      }
      const train = s.slice(0, cut)
      add('naive', bands(naiveForecast(train, H)!))
      for (const W of WINDOWS) {
        const tr = W ? train.slice(-W) : train, label = W ? `last ${W}` : 'full'
        const ar = arForecast(tr, P, H)!
        add(`AR(2) ${label}`, bands(ar))
        if (W === null) {
          add('AR(2) full, pre-fix interval', preFix(ar, tr.length))
          // post-hoc variant (found on this data, not shipped): naive when the AR fit is non-stationary
          add('AR(2) full, naive if non-stationary', ar.longRun == null ? bands(naiveForecast(tr, H)!) : bands(ar))
          nonStationary.total++; if (ar.longRun == null) nonStationary.count++
        }
        add(`mean ${label}`, bands(meanForecast(tr, H)!))
      }
    }
  }

  const r3 = (v: number[]) => v.length ? +mean(v).toFixed(3) : null
  const pct = (v: number[]) => v.length ? +(100 * mean(v)).toFixed(1) : null
  const med = (v: number[]) => v.length ? +median(v).toFixed(3) : null
  const summary = Object.entries(acc).map(([method, { early, late }]) => ({
    method,
    mae1: { early: r3(early.e1), late: r3(late.e1) }, mae3: { early: r3(early.e3), late: r3(late.e3) },
    medae1: { early: med(early.e1), late: med(late.e1) }, medae3: { early: med(early.e3), late: med(late.e3) },
    coverage95_1: { early: pct(early.cov1), late: pct(late.cov1) }, coverage95_3: { early: pct(early.cov3), late: pct(late.cov3) },
    folds1: { early: early.e1.length, late: late.e1.length },
  }))
  const wins = WINDOWS.map(W => {
    const m = `AR(2) ${W ? `last ${W}` : 'full'}`
    const pcs = Object.values(perCountry).filter(pc => pc[m])
    return { method: m, countries: pcs.length,
      beatsNaive: pcs.filter(pc => mean(pc[m]) < mean(pc.naive)).length,
      beatsFullAr: pcs.filter(pc => mean(pc[m]) < mean(pc['AR(2) full'])).length }
  })
  const current = Object.fromEntries(Object.entries(series).map(([c, s]) => {
    const f = arForecast(s, P, H)
    return [c, f && { last: s[s.length - 1], n: f.n, longRun: f.longRun, points: f.points }]
  }))

  const out = resolve(ROOT, 'research/backtest', `forecast_${data.key}_${isoDay(Date.now())}.json`)
  writeJson(out, { input: data.path.replace(ROOT + '/', ''), fetched: data.fetched, indicator: data.indicator,
    design: { FIRST_ORIGIN, MIN_TRAIN, SPLIT, H, P, WINDOWS }, nonStationaryFits: nonStationary, summary, wins, current })

  const f = (v: number | null, s = '') => v == null ? '—' : `${v}${s}`
  console.log(`World Bank ${data.indicator}, fetched ${data.fetched}, ${Object.keys(series).length} countries`)
  console.log(`design: origins ≥ ${FIRST_ORIGIN}, ≥ ${MIN_TRAIN} years of history, split at ${SPLIT}`)
  console.log('method | MAE h1 early/late | MAE h3 early/late | median AE h1 early/late | 95% cover h1 early/late | 95% cover h3 early/late | folds')
  for (const s of summary) console.log(`${s.method} | ${f(s.mae1.early)}/${f(s.mae1.late)} | ${f(s.mae3.early)}/${f(s.mae3.late)} | ${f(s.medae1.early)}/${f(s.medae1.late)} | ${f(s.coverage95_1.early, '%')}/${f(s.coverage95_1.late, '%')} | ${f(s.coverage95_3.early, '%')}/${f(s.coverage95_3.late, '%')} | ${s.folds1.early}/${s.folds1.late}`)
  console.log(`non-stationary AR(2) fits (full history): ${nonStationary.count}/${nonStationary.total} folds`)
  for (const w of wins) console.log(`${w.method}: beats naive in ${w.beatsNaive}/${w.countries}, beats full-history AR in ${w.beatsFullAr}/${w.countries}`)
  console.log(`→ ${out}`)
}

main().catch(e => { console.error(e); process.exit(1) })
