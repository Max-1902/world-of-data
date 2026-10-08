/**
 * Backtest the Watchlist trend flag (src/research/backtest.ts) on ACLED daily aggregates.
 *
 *   npx tsx scripts/research/backtest.ts --input research/data/acled-daily/2026-11-07.json
 *   npx tsx scripts/research/backtest.ts --fetch-days 180   # one ACLED login, pulls and stores aggregates first
 *
 * Writes research/backtest/<to>_<days>d.json and prints a summary table.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { acledSeverity } from '../../src/services/crises'
import { aggregateDaily, backtest, addDays, type DailyAgg, type Rates } from '../../src/research/backtest'
import { ROOT, DATA_DIR, loadEnv, writeJson, arg, isoDay, acledToken, acledAll } from './lib'

async function load(): Promise<{ from: string; to: string; agg: DailyAgg; source: string }> {
  const input = arg('input')
  if (input) {
    const f = JSON.parse(readFileSync(resolve(process.cwd(), input), 'utf8')) as { from: string; to: string; agg: DailyAgg }
    return { ...f, source: input }
  }
  const days = Number(arg('fetch-days'))
  if (!days) throw new Error('pass --input <acled-daily file> or --fetch-days <n>')
  loadEnv()
  // ACLED keeps adding events for recent days; stop a week back so the outcome windows are mostly settled.
  const to = isoDay(Date.now() - 7 * 86_400_000)
  const from = addDays(to, -days + 1)
  const token = await acledToken()
  const rows = await acledAll(token, from, to, 'event_date|event_type|country|fatalities')
  const agg = aggregateDaily(rows.map(r => ({ event_date: r.event_date, country: r.country, severity: acledSeverity(r.event_type), fatalities: Number(r.fatalities) || 0 })))
  const path = resolve(DATA_DIR, 'acled-history', `${from}_${to}.json`)
  writeJson(path, { v: 1, recordedAt: new Date().toISOString(), from, to, rows: rows.length, agg }, false)
  return { from, to, agg, source: path.replace(ROOT + '/', '') }
}

const pct = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(1)}%`
const num = (v: number | null) => v == null ? '—' : v.toFixed(2)
const line = (label: string, r: Rates) => `| ${label} | ${r.n} | ${pct(r.elevated)} | ${pct(r.escalated)} | ${num(r.meanChange)} |`

async function main() {
  const { from, to, agg, source } = await load()
  const report = backtest(agg, from, to)
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  writeJson(resolve(ROOT, 'research/backtest', `${to}_${days}d.json`), { source, ...report })
  console.log(`Backtest ${from} → ${to} (${report.asOfDays} as-of days, ${report.countries} countries)\n`)
  console.log('| group | n | next 72h elevated | next 72h > last 72h | mean change |')
  console.log('|---|---|---|---|---|')
  console.log(line('all', report.all))
  for (const t of ['rising', 'flat', 'falling'] as const) console.log(line(t, report.byTrend[t]))
  console.log(line('rising, shown on Watchlist', report.shownRising))
  console.log(line('naive "up at all"', report.naiveUp))
  console.log(`\nlift (elevated | rising ÷ elevated | all): ${num(report.liftElevated)}`)
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
