// Vercel serverless function — proxies Finnhub, injecting the token server-side
// so FINNHUB_KEY never reaches the browser bundle or a request URL the client built.
// Env var (Vercel project settings, no VITE_ prefix): FINNHUB_KEY
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FINNHUB_KEY
  if (!key) return res.status(200).json({})

  // `vercel dev`'s local (unlinked) mode puts the catch-all segment under the
  // literal key "...path" instead of "path" (production doesn't) — read both.
  const rawPath = req.query.path ?? req.query['...path']
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '')
  const params = new URLSearchParams(req.query as Record<string, string>)
  params.delete('path')
  params.delete('...path')
  params.set('token', key)

  const upstream = await fetch(`https://finnhub.io/api/v1/${path}?${params.toString()}`)
  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(text)
}
