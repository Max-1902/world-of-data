// Vercel Edge Function — proxies OpenRouter chat completions, injecting the key
// server-side so OPENROUTER_KEY never reaches the browser bundle. Edge runtime
// streams the upstream SSE response straight through with no buffering.
// Env vars (Vercel project settings, no VITE_ prefix):
//   OPENROUTER_KEY            — required
//   OPENROUTER_ALLOWED_MODELS — optional, comma-separated model ids allowed on top of
//                               `:free` ones. `*` allows every model: only ever set that
//                               in a local .env, never on a public deployment.
//
// The endpoint is public once deployed, so it is the only thing standing between a
// stranger and the key. It therefore fails closed: `:free` models only unless allowlisted,
// the body is rebuilt from a fixed set of fields (OpenRouter's `models` fallback list,
// `plugins` (web search) and `provider` routing could otherwise reach paid endpoints), and
// size and request rate are capped.
export const config = { runtime: 'edge' }

export const MAX_BODY_BYTES   = 256 * 1024
export const MAX_MESSAGES     = 80
export const MAX_TOKENS_CAP   = 8000
export const RATE_LIMIT       = 20      // requests per IP per window
export const RATE_WINDOW_MS   = 60_000

const ROLES = new Set(['system', 'user', 'assistant'])

/** The deployment's extra allowance on top of `:free` models: `all` for `*`, else the listed ids. */
export function modelPolicy(allowList = process.env.OPENROUTER_ALLOWED_MODELS ?? ''): { all: boolean; extra: string[] } {
  const items = allowList.split(',').map(s => s.trim()).filter(Boolean)
  return { all: items.includes('*'), extra: items.filter(s => s !== '*') }
}

/** True when this deployment may send `model` upstream with its key. */
export function isModelAllowed(model: string, allowList = process.env.OPENROUTER_ALLOWED_MODELS ?? ''): boolean {
  const { all, extra } = modelPolicy(allowList)
  return all || model.endsWith(':free') || extra.includes(model)
}

// Best-effort, per-isolate limiter: edge instances don't share memory, so this slows a
// single abuser down rather than enforcing a global quota. The hard stop against billing
// is the model allowlist above; OpenRouter's own daily caps on free models bound the rest.
const hits = new Map<string, number[]>()
export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) { hits.set(ip, recent); return true }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear() // bound memory in a long-lived isolate
  return false
}
export function resetRateLimit() { hits.clear() }

const reject = (status: number, error: string) =>
  new Response(JSON.stringify({ error: { message: error } }), { status, headers: { 'Content-Type': 'application/json' } })

interface ChatMessage { role: string; content: string }

function isChatMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== 'object') return false
  const { role, content } = m as Record<string, unknown>
  return typeof role === 'string' && ROLES.has(role) && typeof content === 'string'
}

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.OPENROUTER_KEY
  if (!key) return new Response('OPENROUTER_KEY not configured', { status: 500 })
  if (req.method !== 'POST') return reject(405, 'Method not allowed')

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
  if (rateLimited(ip)) return reject(429, 'Too many requests to this deployment. Wait a minute and retry.')

  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return reject(413, 'Request too large')

  let input: Record<string, unknown>
  try { input = JSON.parse(raw) } catch { return reject(400, 'Body must be JSON') }
  if (!input || typeof input !== 'object') return reject(400, 'Body must be a JSON object')

  const { model, messages } = input
  if (typeof model !== 'string' || !model) return reject(400, 'model is required')
  if (!isModelAllowed(model)) return reject(403, `Model not allowed on this deployment: only free (:free) models are enabled.`)
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return reject(400, 'messages must be a non-empty array')
  if (!messages.every(isChatMessage)) {
    return reject(400, 'Each message needs a role (system/user/assistant) and string content')
  }

  const body: Record<string, unknown> = {
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: input.stream === true,
    max_tokens: Math.min(Number(input.max_tokens) > 0 ? Number(input.max_tokens) : MAX_TOKENS_CAP, MAX_TOKENS_CAP),
  }
  if (typeof input.temperature === 'number') body.temperature = Math.min(Math.max(input.temperature, 0), 2)
  if (typeof input.top_p === 'number') body.top_p = Math.min(Math.max(input.top_p, 0), 1)
  // reasoning effort only (the analyst sets it low on free models so hidden thinking leaves room for the answer);
  // rebuilt rather than passed through, like everything else here
  const effort = (input.reasoning as { effort?: unknown } | undefined)?.effort
  if (effort === 'low' || effort === 'medium' || effort === 'high') body.reasoning = { effort }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': req.headers.get('origin') || 'https://worldview.app',
      'X-Title': 'World of Data',
    },
    body: JSON.stringify(body),
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'text/event-stream' },
  })
}
