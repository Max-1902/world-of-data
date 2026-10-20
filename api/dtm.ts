// Vercel serverless function — proxies the IOM Displacement Tracking Matrix API (v3) for IDP
// figures, injecting the key server-side. Env var (Vercel project settings, no VITE_ prefix):
//   DTM_API_KEY — free key, https://dtm.iom.int/data-and-analysis/dtm-api (register, subscribe to
//                 "API-V3", copy the Primary key from your profile). No paid tier exists.
//
// The endpoint is public once deployed, so it fails closed: only the admin0/admin1 displacement
// routes are reachable, only an ISO3 country code is taken from the client, and the reporting
// window is fixed server-side — every other query parameter is dropped.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const DTM_LEVELS = ['admin0', 'admin1'] as const
/** How far back to ask for rounds; DTM rounds are months apart, so this always spans several. */
export const DTM_WINDOW_DAYS = 730

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.DTM_API_KEY
  if (!key) return res.status(503).json({ error: { code: 'not_configured', message: 'DTM_API_KEY is not set on this deployment.' } })

  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)
  const level = first(req.query.level)
  const iso3 = first(req.query.iso3)
  if (typeof level !== 'string' || !(DTM_LEVELS as readonly string[]).includes(level)) {
    return res.status(400).json({ error: { code: 'level_not_allowed', message: 'level must be admin0 or admin1.' } })
  }
  if (typeof iso3 !== 'string' || !/^[A-Z]{3}$/.test(iso3)) {
    return res.status(400).json({ error: { code: 'bad_country', message: 'iso3 must be an ISO 3166-1 alpha-3 code.' } })
  }

  const from = new Date(Date.now() - DTM_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const url = `https://dtmapi.iom.int/v3/displacement/${level}?Admin0Pcode=${iso3}&FromReportingDate=${from}`
  try {
    const upstream = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': key }, signal: AbortSignal.timeout(25_000) })
    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    // DTM publishes rounds weeks apart; let the CDN absorb repeat views.
    if (upstream.ok) res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400')
    res.send(text.split(key).join('[redacted]'))
  } catch {
    res.status(502).json({ error: { code: 'upstream_unreachable', message: 'IOM DTM did not respond.' } })
  }
}
