// Vercel serverless function — exchanges OpenSky OAuth2 client credentials
// server-side so CLIENT_ID/CLIENT_SECRET never reach the browser bundle.
// Env vars (set in Vercel project settings, no VITE_ prefix): OPENSKY_USER, OPENSKY_PASS
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const clientId = process.env.OPENSKY_USER
  const clientSecret = process.env.OPENSKY_PASS
  if (!clientId || !clientSecret) return res.status(200).json({ access_token: null })

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const upstream = await fetch(
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  )

  // an HTML error page from the provider would otherwise crash the function
  const data = await upstream.json().catch(() => ({ error: `token endpoint returned HTTP ${upstream.status} without JSON` }))
  res.status(upstream.status).json(data)
}
