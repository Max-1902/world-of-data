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
import { aggregateDaily, backtest, replay, addDays, type DailyAgg, type Rates } from '../../src/research/backtest'
import { trainLogistic, predict, timeSplit, elevatedLabel, featureVector, type LogisticModel } from '../../src/research/mlTrend'
import { FLAT_DEADZONE } from '../../src/utils/trajectory'
import { ROOT, DATA_DIR, loadEnv, writeJson, arg, isoDay, acledToken, acledAll, flag } from './lib'

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

/**
 * Trains the logistic-regression alternative (src/research/mlTrend.ts) on the earlier `trainFraction` of
 * as-of days and reports its lift on the later days only — never trained and tested on the same days, so
 * this can't just be the model memorising the period. Compared against the rule's lift on that *same*
 * held-out slice, not the whole range, so the two numbers answer the same question.
 */
function evalMl(agg: DailyAgg, from: string, to: string, trainFraction: number): { model: LogisticModel; ruleLift: number | null; mlLift: number | null; testDays: number; testN: number } {
  const obs = replay(agg, from, to)
  const { train, test } = timeSplit(obs, trainFraction)
  const model = trainLogistic(train.map(featureVector), train.map(o => elevatedLabel(o, FLAT_DEADZONE)))

  const actuallyElevated = (o: typeof obs[number]) => elevatedLabel(o, FLAT_DEADZONE) === 1
  const baseRate = test.filter(actuallyElevated).length / (test.length || 1)

  const risingTest = test.filter(o => o.trend === 'rising')
  const ruleLift = risingTest.length && baseRate ? (risingTest.filter(actuallyElevated).length / risingTest.length) / baseRate : null

  // ML "flagged" means predicted probability > 0.5 — the same even-odds threshold a reader would assume.
  const flagged = test.filter(o => predict(model, o) > 0.5)
  const mlLift = flagged.length && baseRate ? (flagged.filter(actuallyElevated).length / flagged.length) / baseRate : null

  return { model, ruleLift, mlLift, testDays: new Set(test.map(o => o.asOf)).size, testN: test.length }
}

async function main() {
  const { from, to, agg, source } = await load()
  const report = backtest(agg, from, to)
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  console.log(`Backtest ${from} → ${to} (${report.asOfDays} as-of days, ${report.countries} countries)\n`)
  console.log('| group | n | next 72h elevated | next 72h > last 72h | mean change |')
  console.log('|---|---|---|---|---|')
  console.log(line('all', report.all))
  for (const t of ['rising', 'flat', 'falling'] as const) console.log(line(t, report.byTrend[t]))
  console.log(line('rising, shown on Watchlist', report.shownRising))
  console.log(line('naive "up at all"', report.naiveUp))
  console.log(`\nlift (elevated | rising ÷ elevated | all): ${num(report.liftElevated)}`)

  let ml: ReturnType<typeof evalMl> | undefined
  if (flag('ml')) {
    const trainFraction = Number(arg('train-fraction') ?? '0.7')
    ml = evalMl(agg, from, to, trainFraction)
    console.log(`\nML comparison (logistic regression, trained on the first ${Math.round(trainFraction * 100)}% of as-of days, n=${ml.model.trainedOn.examples}; scored on the remaining ${ml.testDays} days, n=${ml.testN}):`)
    console.log(`  rule lift on held-out days:  ${num(ml.ruleLift)}`)
    console.log(`  model lift on held-out days: ${num(ml.mlLift)}`)
    console.log(`  (lift = P(elevated | flagged) ÷ P(elevated | all); 1 means the flag carries no information)`)
    if (ml.ruleLift != null && ml.mlLift != null && ml.mlLift <= ml.ruleLift)
      console.log(`  → the rule matched or beat the model on this slice. Not a reason to ship the model.`)
  }

  writeJson(resolve(ROOT, 'research/backtest', `${to}_${days}d.json`), {
    source, ...report,
    ml: ml && { trainedOn: ml.model.trainedOn, ruleLift: ml.ruleLift, mlLift: ml.mlLift, testDays: ml.testDays, testN: ml.testN },
  })
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
