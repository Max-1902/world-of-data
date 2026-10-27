/**
 * The forecasts this browser has shown, per country × series (localStorage `ws-forecast-log`), so the Predictions
 * panel can say what changed since an earlier visit and score forecasts once their year's figure is published.
 * Per-device by design: nothing leaves the browser, and a cleared or private browser simply starts a new record.
 */
import { sameInputs, type ForecastRecord } from '../utils/forecastRecord'

const KEY = 'ws-forecast-log'
const PER_SERIES = 12
const MAX_SERIES = 300

type Log = Record<string, ForecastRecord[]>

function read(): Log {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Log : {}
  } catch { return {} }
}

function write(log: Log) {
  try { localStorage.setItem(KEY, JSON.stringify(log)) } catch { /* storage full or blocked: the panel still works, just without memory */ }
}

/** Every record for one country × series, oldest first. */
export function recordsFor(key: string): ForecastRecord[] {
  const list = read()[key]
  return Array.isArray(list) ? list.filter(r => r && r.key === key && Array.isArray(r.tail) && Array.isArray(r.points)) : []
}

/**
 * Records `rec` unless the latest record already has the same inputs. Returns the latest record with *different*
 * inputs from before this call (what "changed since" compares against), and the day the current inputs were first seen.
 */
export function remember(rec: ForecastRecord): { previous: ForecastRecord | null; since: string } {
  const log = read()
  const list = recordsFor(rec.key)
  const latest = list[list.length - 1]
  if (latest && sameInputs(latest, rec)) {
    const earlier = [...list].reverse().find(r => !sameInputs(r, rec)) ?? null
    return { previous: earlier, since: latest.issued }
  }
  const next = [...list, rec].slice(-PER_SERIES)
  log[rec.key] = next
  const keys = Object.keys(log)
  if (keys.length > MAX_SERIES) {
    // drop the series looked at longest ago
    const lastIssued = (k: string) => log[k][log[k].length - 1]?.issued ?? ''
    const byAge = keys.sort((a, b) => lastIssued(a).localeCompare(lastIssued(b)))
    for (const k of byAge.slice(0, keys.length - MAX_SERIES)) delete log[k]
  }
  write(log)
  return { previous: latest ?? null, since: rec.issued }
}
