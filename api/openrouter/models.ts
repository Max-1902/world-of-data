// Vercel Edge Function — proxies OpenRouter's public model catalogue so the AI
// Analyst can offer every available model. The catalogue is public: no key is
// sent upstream (and none is needed), so nothing here can bill anyone.
export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  const upstream = await fetch('https://openrouter.ai/api/v1/models')
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'public, max-age=600',
    },
  })
}
