// Vercel serverless function — proxies the US EIA Open Data API (v2) for the weekly inventory
// series, injecting the key server-side. Env var (Vercel project settings, no VITE_ prefix):
//   EIA_API_KEY — free key, https://www.eia.gov/opendata/register.php (no billing exists)
//
// The endpoint is public once deployed, so it fails closed: only the series ids below are
// forwarded (through EIA's APIv1-compatible /v2/seriesid/ route), and every other query
// parameter from the client is dropped, so the key can't be used for arbitrary calls.
import type { VercelRequest, VercelResponse } from '@vercel/node'

/** APIv1 series ids, checked against EIA's own tables (eia.gov/dnav) on 2026-10-14. Keep in step with src/services/eia.ts. */
export const EIA_ALLOWED_SERIES = [
  'PET.WCESTUS1.W',          // commercial crude oil, excl. SPR, thousand barrels
  'PET.WCSSTUS1.W',          // crude oil in the Strategic Petroleum Reserve, thousand barrels
  'PET.WGTSTUS1.W',          // total motor gasoline, thousand barrels
  'PET.WDISTUS1.W',          // distillate fuel oil, thousand barrels
  'NG.NW2_EPG0_SWO_R48_BCF.W', // working gas in underground storage, Lower 48, billion cubic feet
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.EIA_API_KEY
  // Not configured is reported as such (never as an empty series that would read as "no stocks").
  if (!key) return res.status(503).json({ error: { code: 'not_configured', message: 'EIA_API_KEY is not set on this deployment.' } })

  const series = Array.isArray(req.query.series) ? req.query.series[0] : req.query.series
  if (typeof series !== 'string' || !(EIA_ALLOWED_SERIES as readonly string[]).includes(series)) {
    return res.status(400).json({ error: { code: 'series_not_allowed', message: 'Unknown or disallowed series.' } })
  }

  const upstream = await fetch(`https://api.eia.gov/v2/seriesid/${encodeURIComponent(series)}?api_key=${encodeURIComponent(key)}`)
  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  // EIA's JSON echoes the request parameters; strip the key in case it is among them.
  res.send(text.split(key).join('[redacted]'))
}
