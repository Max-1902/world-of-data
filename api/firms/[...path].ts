// Vercel serverless function — NASA FIRMS global 24-hour VIIRS fire CSV (keyless, free, no billing account).
// FIRMS sends no CORS headers, and until 2026-10-15 /api/firms existed only in the Vite dev proxy, so on the
// deployed site the wildfire feed always failed (an empty fires layer and a red source-health entry).
//
// Same URL shape as the dev proxy (/api/firms/<path>), but only the files the app reads are forwarded: this is
// not an open proxy onto firms.modaps.eosdis.nasa.gov.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const ALLOWED_PATHS = new Set([
  'data/active_fire/noaa-20-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv',
])

const MAX_BYTES = 30_000_000
const TIMEOUT_MS = 20_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  // `vercel dev`'s local mode puts the catch-all segment under "...path"
  const rawPath = req.query.path ?? req.query['...path']
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '')
  if (!ALLOWED_PATHS.has(path)) return res.status(404).json({ error: 'not a FIRMS file this app uses' })
  try {
    const upstream = await fetch(`https://firms.modaps.eosdis.nasa.gov/${path}`, {
      headers: { Accept: 'text/csv' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!upstream.ok) return res.status(502).json({ error: `FIRMS HTTP ${upstream.status}` })
    if (Number(upstream.headers.get('content-length')) > MAX_BYTES) return res.status(502).json({ error: 'FIRMS file unexpectedly large' })
    const csv = await upstream.text()
    if (csv.length > MAX_BYTES) return res.status(502).json({ error: 'FIRMS file unexpectedly large' })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    // FIRMS refreshes the 24h file every few hours; a short shared cache keeps one fetch serving many visitors
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600')
    return res.status(200).send(csv)
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'FIRMS request failed' })
  }
}
