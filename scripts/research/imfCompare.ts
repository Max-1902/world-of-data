/**
 * The Predictions panel's AR(2) vs the IMF's own World Economic Outlook forecasts, scored against the same outcomes.
 *
 *   npx tsx scripts/research/imfCompare.ts --imf research/data/imf-weo/mfpd-oct2025.json \
 *     --gdp research/data/worldbank-gdp/2026-10-14.json --cpi research/data/worldbank-cpi/2026-10-14.json
 *
 * Forecast made in October of year W (the IMF's autumn WEO) for year W+1 — the "next year" number people quote.
 * Information sets, so the comparison is not rigged in either direction:
 *  - IMF (October W): full data to W−1 plus about three quarters of year W, plus judgement and other variables.
 *  - AR, fair:   fit on annual data up to W−1 only, forecast two steps ahead to W+1 (less information than the IMF had).
 *  - AR, oracle: fit on data up to W, including the full year W, which the IMF did NOT yet have in October — an upper
 *    bound on what the AR could do; it flatters the AR, never the IMF.
 *  - naive: year W's value repeated (also uses the full year W, so it is the oracle-style baseline).
 * Outcomes: the World Bank series the panel uses (primary) and the IMF's own realised values (robustness: country
 * definitions such as fiscal years differ slightly between the two). Only folds where every method has a value count.
 *
 * Writes research/backtest/imf_compare_<day>.json.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { arForecast, lastRun, mean, type Pt } from '../../src/utils/econAnalysis'
import { ROOT, writeJson, arg, isoDay } from './lib'

const P = 2, MIN_TRAIN = 30, SPLIT = 2005
type ImfRow = [number, number, number, number | null, number | null, number | null, number | null]
const read = <T>(p: string) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8')) as T
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

function compare(variable: 'gdp' | 'cpi', imf: Record<string, ImfRow[]>, wb: Record<string, Pt[]>) {
  const fCol = variable === 'gdp' ? 3 : 4, rCol = variable === 'gdp' ? 5 : 6
  const methods = ['IMF October WEO', 'AR(2) fair (data to W−1)', 'AR(2) oracle (data to W)', 'naive (year W repeated)'] as const
  type Err = Record<(typeof methods)[number], number[]>
  const blank = (): Err => Object.fromEntries(methods.map(m => [m, []])) as unknown as Err
  const acc = { wb: { early: blank(), late: blank() }, imf: { early: blank(), late: blank() } }
  const perCountry: Record<string, { imf: number[]; arFair: number[]; arOracle: number[]; naive: number[] }> = {}
  for (const [c, rows] of Object.entries(imf)) {
    const s = lastRun(wb[c] ?? [])
    const at = new Map(s.map((p, i) => [p.x, i]))
    for (const r of rows) {
      const [W, exercise, target] = r
      if (exercise !== 2 || target !== W + 1) continue
      const fImf = r[fCol], rImf = r[rCol]
      const iW = at.get(W), iT = at.get(target)
      if (fImf == null || iW == null || iT == null || iW < MIN_TRAIN) continue
      const fair = arForecast(s.slice(0, iW), P, 2)?.points[1].value
      const oracle = arForecast(s.slice(0, iW + 1), P, 1)?.points[0].value
      if (fair == null || oracle == null) continue
      const f = { 'IMF October WEO': fImf, 'AR(2) fair (data to W−1)': fair, 'AR(2) oracle (data to W)': oracle, 'naive (year W repeated)': s[iW].y }
      const period = W < SPLIT ? 'early' : 'late'
      for (const m of methods) acc.wb[period][m].push(Math.abs(f[m] - s[iT].y))
      if (rImf != null) for (const m of methods) acc.imf[period][m].push(Math.abs(f[m] - rImf))
      const pc = (perCountry[c] ??= { imf: [], arFair: [], arOracle: [], naive: [] })
      pc.imf.push(Math.abs(fImf - s[iT].y)); pc.arFair.push(Math.abs(fair - s[iT].y)); pc.arOracle.push(Math.abs(oracle - s[iT].y)); pc.naive.push(Math.abs(s[iW].y - s[iT].y))
    }
  }
  const stat = (v: number[]) => v.length ? { mae: +mean(v).toFixed(3), median: +median(v).toFixed(3), n: v.length } : null
  const table = (a: { early: Err; late: Err }) => methods.map(m => ({ method: m, early: stat(a.early[m]), late: stat(a.late[m]), all: stat([...a.early[m], ...a.late[m]]) }))
  const pcs = Object.values(perCountry)
  return {
    variable, outcomes_worldbank: table(acc.wb), outcomes_imf_realised: table(acc.imf),
    countries: pcs.length,
    imfBeatsArFair: pcs.filter(p => mean(p.imf) < mean(p.arFair)).length,
    imfBeatsArOracle: pcs.filter(p => mean(p.imf) < mean(p.arOracle)).length,
    imfBeatsNaive: pcs.filter(p => mean(p.imf) < mean(p.naive)).length,
  }
}

function main() {
  const imfPath = arg('imf'), gdpPath = arg('gdp'), cpiPath = arg('cpi')
  if (!imfPath || !gdpPath || !cpiPath) throw new Error('pass --imf, --gdp and --cpi')
  const imf = read<{ rows: Record<string, ImfRow[]>; source: string; sha256: string }>(imfPath)
  const results = [
    compare('gdp', imf.rows, read<{ countries: Record<string, Pt[]> }>(gdpPath).countries),
    compare('cpi', imf.rows, read<{ countries: Record<string, Pt[]> }>(cpiPath).countries),
  ]
  const out = resolve(ROOT, 'research/backtest', `imf_compare_${isoDay(Date.now())}.json`)
  writeJson(out, { imf: imfPath, imfSource: imf.source, imfSha256: imf.sha256, gdp: gdpPath, cpi: cpiPath, design: { P, MIN_TRAIN, SPLIT, horizon: 'October W → W+1' }, results })
  const f = (s: { mae: number; median: number; n: number } | null) => s ? `${s.mae} (med ${s.median}, n ${s.n})` : '—'
  for (const r of results) {
    console.log(`\n=== ${r.variable}: October W forecast of W+1`)
    for (const [label, t] of [['outcomes: World Bank', r.outcomes_worldbank], ['outcomes: IMF realised', r.outcomes_imf_realised]] as const) {
      console.log(`-- ${label}  | before ${SPLIT} | ${SPLIT}+ | all`)
      for (const row of t) console.log(`${row.method} | ${f(row.early)} | ${f(row.late)} | ${f(row.all)}`)
    }
    console.log(`IMF beats AR fair in ${r.imfBeatsArFair}/${r.countries} countries, AR oracle in ${r.imfBeatsArOracle}/${r.countries}, naive in ${r.imfBeatsNaive}/${r.countries}`)
  }
  console.log(`→ ${out}`)
}

main()
