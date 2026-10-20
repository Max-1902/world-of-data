// Vercel serverless function — proxies the Global Fishing Watch Events API (v3) for two datasets, injecting
// the token server-side. Env var (Vercel project settings, no VITE_ prefix):
//   GFW_TOKEN — free API token, https://globalfishingwatch.org/our-apis/tokens (non-commercial use only,
//   CC BY-NC 4.0, attribution "Powered by Global Fishing Watch" required; no paid tier or billing exists).
//
// The endpoint is public once deployed, so it fails closed: only the two datasets below can be asked for,
// the date window is computed here from an allowlisted number of days, and every other client parameter is
// dropped. Responses are edge-cached for an hour so a public deployment can't burn the token's daily quota.
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UPSTREAM = 'https://gateway.api.globalfishingwatch.org/v3/events'

/** Dataset ids from GFW's Events API docs (checked 2026-10-19). Keep in step with src/services/gfw.ts. */
export const GFW_DATASETS = {
  gaps: 'public-global-gaps-events:latest',             // AIS off events ("going dark")
  encounters: 'public-global-encounters-events:latest', // two vessels meeting at sea (possible transshipment)
} as const
export const GFW_DAYS = ['7', '30', '90'] as const
export const GFW_LIMIT = 1000

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.GFW_TOKEN
  // Not configured is reported as such (never as an empty list that would read as "no dark vessels").
  if (!token) return res.status(503).json({ error: { code: 'not_configured', message: 'GFW_TOKEN is not set on this deployment.' } })

  const kind = one(req.query.kind)
  if (kind !== 'gaps' && kind !== 'encounters') {
    return res.status(400).json({ error: { code: 'kind_not_allowed', message: 'kind must be gaps or encounters.' } })
  }
  const days = one(req.query.days) ?? '30'
  if (!(GFW_DAYS as readonly string[]).includes(days)) {
    return res.status(400).json({ error: { code: 'days_not_allowed', message: `days must be one of ${GFW_DAYS.join(', ')}.` } })
  }

  const end = Date.now()
  const qs = new URLSearchParams({
    'datasets[0]': GFW_DATASETS[kind],
    'start-date': ymd(end - Number(days) * 86_400_000),
    'end-date': ymd(end),
    limit: String(GFW_LIMIT),
    offset: '0',
  })
  let upstream: Response
  try {
    upstream = await fetch(`${UPSTREAM}?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    return res.status(502).json({ error: { code: 'upstream_unreachable', message: 'Global Fishing Watch could not be reached.' } })
  }
  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  if (upstream.ok) res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600')
  res.send(text.split(token).join('[redacted]'))
}
