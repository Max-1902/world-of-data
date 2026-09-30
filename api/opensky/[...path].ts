// Vercel serverless function — forwards to OpenSky's REST API, passing through
// whatever Authorization header the client already attached (its bearer token
// came from /api/opensky-token, which never exposed the client secret).
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // `vercel dev`'s local (unlinked) mode puts the catch-all segment under the
  // literal key "...path" instead of "path" (production doesn't) — read both.
  const rawPath = req.query.path ?? req.query['...path']
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '')
  const query = req.url?.split('?')[1]
  const url = `https://opensky-network.org/api/${path}${query ? `?${query}` : ''}`

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (req.headers.authorization) headers.Authorization = req.headers.authorization as string

  const upstream = await fetch(url, { headers })
  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(text)
}
