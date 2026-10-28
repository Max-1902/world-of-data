/**
 * What a forecast said when it was first shown, so later visits can say what changed and, once the year has happened,
 * how it scored. Pure; storage lives in services/forecastLog.ts.
 *
 * A record is kept per country × series each time its inputs change (new or revised World Bank data, a different
 * headline model, a new IMF edition). Nothing is backfilled: the track record starts on the first visit and only ever
 * scores forecasts that were recorded before their year's figure was published.
 */
import type { EvidenceKind } from './evidence'

export interface ForecastRecord {
  /** `${iso2}|${seriesId}` */
  key: string
  /** day the forecast was first shown with these inputs, YYYY-MM-DD */
  issued: string
  model: 'ar' | 'naive'
  /** the last observed years the forecast was made from (to spot new and revised data) */
  tail: { year: number; value: number }[]
  points: { year: number; value: number; lo: number; hi: number }[]
  /** the IMF's figures for the same years, from the edition current at the time */
  imf?: { vintage: string; points: { year: number; value: number }[] }
}

export const TAIL_YEARS = 5
const EPS = 0.05

/**
 * The record for what a card shows now. Built in one place so every view that records a forecast writes the same
 * shape: two views that disagreed about the tail or the IMF figures would report phantom "changes" to each other.
 */
export function makeRecord(a: {
  key: string
  issued: string
  model: ForecastRecord['model']
  series: readonly { x: number; y: number }[]
  points: ForecastRecord['points']
  imf?: { vintage: string; points: readonly { year: number; value: number }[] } | null
}): ForecastRecord {
  return {
    key: a.key, issued: a.issued, model: a.model,
    tail: a.series.slice(-TAIL_YEARS).map(p => ({ year: p.x, value: p.y })),
    points: a.points.map(p => ({ year: p.year, value: p.value, lo: p.lo, hi: p.hi })),
    imf: a.imf && a.imf.points.length ? { vintage: a.imf.vintage, points: a.imf.points.map(p => ({ year: p.year, value: p.value })) } : undefined,
  }
}

const near = (a: number, b: number) => Math.abs(a - b) < EPS
const r1 = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10).toFixed(1)}`

/** Same inputs → no new record. Values compared at display precision (0.05), so float noise is not "a revision". */
export function sameInputs(a: ForecastRecord, b: ForecastRecord): boolean {
  if (a.model !== b.model || a.tail.length !== b.tail.length) return false
  // a missing IMF figure (request failed or still loading) is not a new edition; only two different stated editions are
  if (a.imf && b.imf && a.imf.vintage !== b.imf.vintage) return false
  return a.tail.every((p, i) => p.year === b.tail[i].year && near(p.value, b.tail[i].value))
}

export interface Change { kind: EvidenceKind; text: string }

/**
 * Plain statements of what differs between an earlier record and now: new years of data, revised past values, the
 * headline model, how the forecast for each shared year moved, and any new IMF edition. Data and IMF figures are
 * observed; our own forecast moving is statistical (a model output, not a measurement).
 */
export function explainChange(prev: ForecastRecord, now: ForecastRecord, unit: string): Change[] {
  const out: Change[] = []
  const prevYears = new Map(prev.tail.map(p => [p.year, p.value]))
  const lastPrev = prev.tail.length ? prev.tail[prev.tail.length - 1].year : -Infinity
  const added = now.tail.filter(p => p.year > lastPrev)
  if (added.length) out.push({ kind: 'observed', text: `New data: ${added.map(p => `${p.year} ${r1(p.value)}${unit}`).join(', ')}.` })
  const revised = now.tail.filter(p => prevYears.has(p.year) && !near(prevYears.get(p.year)!, p.value))
  if (revised.length) out.push({ kind: 'observed', text: `Revised by the World Bank: ${revised.map(p => `${p.year} ${r1(prevYears.get(p.year)!)} → ${r1(p.value)}${unit}`).join(', ')}.` })
  if (prev.model !== now.model) out.push({ kind: 'statistical', text: `Headline model changed from ${prev.model === 'ar' ? 'AR(2)' : '"no change"'} to ${now.model === 'ar' ? 'AR(2)' : '"no change"'}.` })
  const prevFc = new Map(prev.points.map(p => [p.year, p.value]))
  const moved = now.points.filter(p => prevFc.has(p.year))
  if (moved.length) {
    const parts = moved.map(p => near(prevFc.get(p.year)!, p.value) ? `${p.year} unchanged at ${r1(p.value)}${unit}` : `${p.year} ${r1(prevFc.get(p.year)!)} → ${r1(p.value)}${unit}`)
    const why = added.length || revised.length ? ' because of the data changes above' : ''
    out.push({ kind: 'statistical', text: `Our forecast: ${parts.join(', ')}${why}.` })
  }
  if (prev.imf && now.imf && prev.imf.vintage !== now.imf.vintage) {
    const before = new Map(prev.imf.points.map(p => [p.year, p.value]))
    const imfMoves = now.imf.points.filter(p => before.has(p.year) && !near(before.get(p.year)!, p.value))
    out.push({ kind: 'observed', text: `New IMF edition: ${prev.imf.vintage} → ${now.imf.vintage}${imfMoves.length ? `; ${imfMoves.map(p => `${p.year} ${r1(before.get(p.year)!)} → ${r1(p.value)}${unit}`).join(', ')}` : ''}.` })
  }
  return out
}

export interface ScoredForecast {
  issued: string
  year: number
  /** years between the last data year it was made from and the year scored */
  horizon: number
  forecast: number
  lo: number
  hi: number
  actual: number
  inside: boolean
  imf?: { value: number; vintage: string }
}

/**
 * Every recorded forecast whose year now has a published figure, newest first. The same year forecast from the same
 * data is scored once (from its first record), so revisiting the panel can't inflate the record.
 */
export function scoreRecords(records: readonly ForecastRecord[], actuals: readonly { x: number; y: number }[]): ScoredForecast[] {
  const actual = new Map(actuals.map(p => [p.x, p.y]))
  const seen = new Set<string>()
  const out: ScoredForecast[] = []
  for (const rec of [...records].sort((a, b) => a.issued.localeCompare(b.issued))) {
    const base = rec.tail.length ? rec.tail[rec.tail.length - 1].year : null
    if (base === null) continue
    for (const p of rec.points) {
      const a = actual.get(p.year)
      if (a === undefined) continue
      const id = `${p.year}|${base}`
      if (seen.has(id)) continue
      seen.add(id)
      const imf = rec.imf?.points.find(q => q.year === p.year)
      out.push({ issued: rec.issued, year: p.year, horizon: p.year - base, forecast: p.value, lo: p.lo, hi: p.hi, actual: a, inside: a >= p.lo && a <= p.hi, imf: imf && { value: imf.value, vintage: rec.imf!.vintage } })
    }
  }
  return out.sort((a, b) => b.issued.localeCompare(a.issued) || a.year - b.year)
}
