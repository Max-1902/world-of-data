// Vercel Edge Function — proxies OpenRouter chat completions, injecting the key
// server-side so OPENROUTER_KEY never reaches the browser bundle. Edge runtime
// streams the upstream SSE response straight through with no buffering.
// Env var (Vercel project settings, no VITE_ prefix): OPENROUTER_KEY
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.OPENROUTER_KEY
  if (!key) return new Response('OPENROUTER_KEY not configured', { status: 500 })

  const body = await req.text()

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': req.headers.get('origin') || 'https://worldview.app',
      'X-Title': 'Meridian',
    },
    body,
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'text/event-stream' },
  })
}
