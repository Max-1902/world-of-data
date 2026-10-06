// Vercel serverless function — GPS interference from GPSJAM.org's daily H3 file.
// gpsjam.org aggregates ADS-B navigation-accuracy reports (airplanes.live + ADS-B Exchange) into one
// CSV per UTC day, `hex,count_good_aircraft,count_bad_aircraft` at H3 resolution 4. It sends no CORS
// headers, so the browser can't read it directly. No key, no billing account.
//
// This fetches only that one fixed host/path shape (not an open proxy), keeps the newest published day
// in memory so a busy deploy asks upstream at most once an hour, and returns just the cells that
// matter: { date, cells: [{ h, good, bad }] }. GPSJAM publishes no licence or terms for this file;
// the app credits GPSJAM, airplanes.live and ADS-B Exchange wherever it shows the data.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface JamCell { h: string; good: number; bad: number }
export interface JamPayload { date: string; cells: JamCell[] }

/** GPSJAM's own definition: 100 * (bad - 1) / (good + bad). The -1 suppresses single-aircraft false positives. */
export function percentBad(good: number, bad: number): number {
  const total = good + bad
  return total > 0 ? (100 * (bad - 1)) / total : 0
}

/** GPSJAM colours a hex yellow from 2% bad aircraft and red above 10%; below 2% is "good" and not worth shipping. */
export const MIN_PERCENT_BAD = 2

const H3_CELL = /^[0-9a-f]{15}$/
const MAX_BYTES = 5_000_000
const TIMEOUT_MS = 12_000
const CACHE_MS = 60 * 60_000
/** Today's file doesn't exist yet and yesterday's appears "soon after midnight UTC", so look back a few days. */
const LOOKBACK_DAYS = 4

export function parseCsv(csv: string): JamCell[] {
  const cells: JamCell[] = []
  for (const line of csv.split('\n').slice(1)) {
    const [h, g, b] = line.trim().split(',')
    if (!h || !H3_CELL.test(h)) continue
    const good = Number(g), bad = Number(b)
    if (!Number.isInteger(good) || !Number.isInteger(bad) || good < 0 || bad < 0) continue
    if (percentBad(good, bad) >= MIN_PERCENT_BAD) cells.push({ h, good, bad })
  }
  return cells
}

export function utcDay(offsetDays: number, now = Date.now()): string {
  return new Date(now - offsetDays * 86_400_000).toISOString().slice(0, 10)
}

let cached: { at: number; payload: JamPayload } | null = null

export function resetCache() { cached = null }

async function loadLatest(): Promise<JamPayload | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.payload
  for (let back = 1; back <= LOOKBACK_DAYS; back++) {
    const date = utcDay(back)
    const upstream = await fetch(`https://gpsjam.org/data/${date}-h3_4.csv`, {
      headers: { 'User-Agent': 'WorldSurveillanceDashboard/1.0', Accept: 'text/csv' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (upstream.status === 404) continue
    if (!upstream.ok) throw new Error(`GPSJAM HTTP ${upstream.status}`)
    const csv = await upstream.text()
    if (csv.length > MAX_BYTES) throw new Error('GPSJAM file unexpectedly large')
    const payload = { date, cells: parseCsv(csv) }
    cached = { at: Date.now(), payload }
    return payload
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  try {
    const payload = await loadLatest()
    if (!payload) return res.status(502).json({ error: 'no recent GPSJAM data published' })
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600')
    return res.status(200).json(payload)
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'GPSJAM request failed' })
  }
}
