// Vercel serverless function — proxies NYT Article Search, injecting the key
// server-side. Env var (Vercel project settings, no VITE_ prefix): NYT_KEY
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.NYT_KEY
  if (!key) return res.status(200).json({ response: { docs: [] } })

  const params = new URLSearchParams(req.query as Record<string, string>)
  params.set('api-key', key)

  const upstream = await fetch(`https://api.nytimes.com/svc/search/v2/articlesearch.json?${params.toString()}`)
  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(text)
}
