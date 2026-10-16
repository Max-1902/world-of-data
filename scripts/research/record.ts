/**
 * Daily research recorder. Writes two dated files under research/data/:
 *
 *   dashboard/<day>.json   — what the dashboard computes right now: the exact ACLED poll the app sends
 *                            (14 days, capped at 500 events), merged with the baseline, the Watchlist
 *                            trajectories, and the frozen AI context built from them (an eval fixture).
 *   acled-daily/<day>.json — per-day, per-country ACLED aggregates (count, severity score, fatalities)
 *                            for the last 30 days, uncapped. Each file is a vintage: comparing vintages
 *                            shows how much ACLED backfills after the fact.
 *
 * A failed ACLED login is recorded as such (the dashboard file then holds the baseline-only context the
 * app would have shown), so gaps in the series are visible rather than silent. Flights are not polled.
 *
 *   npx tsx scripts/research/record.ts            # normal run
 *   npx tsx scripts/research/record.ts --no-acled # don't touch ACLED (e.g. while the account is locked)
 */
import { resolve } from 'node:path'
import { acledDashboardQuery, acledToCrisisEvent, acledSeverity, ACLED_LIMIT } from '../../src/services/crises'
import { mergeWithBaseline } from '../../src/hooks/useCrises'
import { computeTrajectories, isBaseline } from '../../src/utils/trajectory'
import { scoreByCountry } from '../../src/services/history'
import { buildDashboardContext, notMeasured } from '../../src/services/openrouter'
import { aggregateDaily } from '../../src/research/backtest'
import { DATA_DIR, loadEnv, writeJson, flag, isoDay, acledToken, acledRead, acledAll } from './lib'

const DAILY_WINDOW_DAYS = 30
const FLIGHTS_REASON = 'the research recorder does not poll OpenSky'

async function main() {
  loadEnv()
  const now = Date.now()
  const day = isoDay(now)
  const acled: Record<string, unknown> = { ok: false }
  let live: ReturnType<typeof acledToCrisisEvent>[] = []
  let daily: { from: string; to: string; rows: number; agg: ReturnType<typeof aggregateDaily> } | null = null

  if (flag('no-acled')) acled.error = 'skipped (--no-acled)'
  else {
    try {
      const token = await acledToken()
      const rows = await acledRead(token, acledDashboardQuery(14, now))
      live = rows.map(acledToCrisisEvent)
      const dates = live.map(e => e.date).sort()
      Object.assign(acled, {
        ok: true,
        eventsReturned: live.length,
        limit: ACLED_LIMIT,
        // At the cap the 14-day window is incomplete; earliest/latest show which part survived.
        truncated: live.length >= ACLED_LIMIT,
        earliestDate: dates[0] ?? null,
        latestDate: dates[dates.length - 1] ?? null,
      })
      const from = isoDay(now - DAILY_WINDOW_DAYS * 86_400_000)
      const all = await acledAll(token, from, day, 'event_date|event_type|country|fatalities')
      daily = {
        from, to: day, rows: all.length,
        agg: aggregateDaily(all.map(r => ({ event_date: r.event_date, country: r.country, severity: acledSeverity(r.event_type), fatalities: Number(r.fatalities) || 0 }))),
      }
    } catch (e) {
      acled.error = (e as Error).message
    }
  }

  const crises = mergeWithBaseline(live)
  const trajectories = computeTrajectories(crises, [], 6, [], null, now)
  const opts = { now: new Date(now), flightsUnmeasuredReason: FLIGHTS_REASON, conflictCapped: live.length >= ACLED_LIMIT }
  writeJson(resolve(DATA_DIR, 'dashboard', `${day}.json`), {
    v: 1,
    recordedAt: new Date(now).toISOString(),
    acled,
    trajectories,
    liveScoreByCountry: scoreByCountry(crises.filter(c => !isBaseline(c))),
    notMeasured: notMeasured(crises, [], opts),
    context: buildDashboardContext(crises, [], trajectories, '', '', '', opts),
  })
  if (daily) writeJson(resolve(DATA_DIR, 'acled-daily', `${day}.json`), { v: 1, recordedAt: new Date(now).toISOString(), ...daily }, false)

  console.log(`recorded ${day}: ACLED ${acled.ok ? `ok, ${acled.eventsReturned} dashboard events${acled.truncated ? ' (TRUNCATED at cap)' : ''}, ${daily?.rows} events in ${DAILY_WINDOW_DAYS}-day aggregate` : `not measured — ${acled.error}`}`)
}

main().catch(e => { console.error(e); process.exit(1) })
