// Vercel Edge Function — tells the AI Analyst which chat models this deployment will actually send upstream, so
// the model picker can stop offering ones the proxy would reject with 403. `:free` models are always allowed;
// this reports only the extra allowance from OPENROUTER_ALLOWED_MODELS. Model ids are not secret and the key
// is never read here.
import { modelPolicy } from './chat/completions'

export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  return new Response(JSON.stringify(modelPolicy()), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
