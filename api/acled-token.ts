// Vercel serverless function — exchanges ACLED OAuth password-grant credentials
// server-side so ACLED_EMAIL/ACLED_PASSWORD never reach the browser bundle.
// Env vars (Vercel project settings, no VITE_ prefix): ACLED_EMAIL, ACLED_PASSWORD
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const email = process.env.ACLED_EMAIL
  const password = process.env.ACLED_PASSWORD
  if (!email || !password) return res.status(200).json({ access_token: null })

  const body = new URLSearchParams({
    username: email,
    password: password,
    grant_type: 'password',
    client_id: 'acled',
    scope: 'authenticated', // required by ACLED's current OAuth docs
  })

  const upstream = await fetch('https://acleddata.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = await upstream.json()
  res.status(upstream.status).json(data)
}
