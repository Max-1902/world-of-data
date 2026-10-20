// Vercel serverless function — proxies Cloudflare Radar's Outage Center (verified Internet outages,
// with cause and scope), injecting the token server-side. Env var (Vercel project settings, no VITE_ prefix):
//   CLOUDFLARE_RADAR_TOKEN — free Cloudflare account, custom API token with Account > Radar > Read.
//   Radar has no paid tier and the account needs no payment method. Data is CC BY-NC 4.0.
//
// The endpoint is public once deployed, so it fails closed: it only ever calls the outage-annotations
// route, and the only client input it honours is `range`, from the allowlist below.
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UPSTREAM = 'https://api.cloudflare.com/client/v4/radar/annotations/outages'
export const RADAR_RANGES = ['1d', '7d', '14d', '28d'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.CLOUDFLARE_RADAR_TOKEN
  // Not configured is reported as such (never as an empty list that would read as "no outages").
  if (!token) return res.status(503).json({ error: { code: 'not_configured', message: 'CLOUDFLARE_RADAR_TOKEN is not set on this deployment.' } })

  const raw = Array.isArray(req.query.range) ? req.query.range[0] : req.query.range
  const range = raw ?? '7d'
  if (!(RADAR_RANGES as readonly string[]).includes(range)) {
    return res.status(400).json({ error: { code: 'range_not_allowed', message: `range must be one of ${RADAR_RANGES.join(', ')}.` } })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${UPSTREAM}?dateRange=${range}&limit=200&format=json`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    return res.status(502).json({ error: { code: 'upstream_unreachable', message: 'Cloudflare Radar could not be reached.' } })
  }
  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(text.split(token).join('[redacted]'))
}
