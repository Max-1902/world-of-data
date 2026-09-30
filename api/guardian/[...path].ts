// Vercel serverless function — proxies The Guardian Content API, injecting the
// key server-side. Env var (Vercel project settings, no VITE_ prefix): GUARDIAN_KEY
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.GUARDIAN_KEY
  if (!key) return res.status(200).json({ response: { results: [] } })

  // `vercel dev`'s local (unlinked) mode puts the catch-all segment under the
  // literal key "...path" instead of "path" (production doesn't) — read both.
  const rawPath = req.query.path ?? req.query['...path']
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '')
  const params = new URLSearchParams(req.query as Record<string, string>)
  params.delete('path')
  params.delete('...path')
  params.set('api-key', key)

  const upstream = await fetch(`https://content.guardianapis.com/${path}?${params.toString()}`)
  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(text)
}
