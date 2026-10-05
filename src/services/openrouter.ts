import type { CrisisEvent, Flight } from '../types'
import type { TrajectoryEntry } from '../utils/trajectory'
import { resourceCapabilitySummary } from './resources'

const BASE = '/api/openrouter'

export interface DSMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

// ── Available free models on OpenRouter ────────────────────────────────────
// OpenRouter's free-tier catalog rotates — these IDs are checked live against
// GET /api/v1/models. If chat requests start 404ing again, the slugs below
// have likely been retired; re-verify against that endpoint.
export const FREE_MODELS: { id: string; label: string; ctx: string }[] = [
  { id: 'liquid/lfm-2.5-2.6b:free',                           label: 'LFM 2.6B',          ctx: '32k' },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron Omni 30B', ctx: '32k' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free',             label: 'Nemotron Super 120B', ctx: '32k' },
  { id: 'google/gemma-4-26b-a4b-it:free',                     label: 'Gemma 4 26B',       ctx: '32k' },
  { id: 'google/gemma-4-31b-it:free',                         label: 'Gemma 4 31B',       ctx: '32k' },
  { id: 'qwen/qwen3.8-27b:free',                              label: 'Qwen 3.8 27B',      ctx: '32k' },
]
export const DEFAULT_MODEL = FREE_MODELS[0].id

// ── Full catalogue (free + paid) ───────────────────────────────────────────
// Everything OpenRouter lists, fetched live via /api/openrouter/models. Paid models
// bill the OpenRouter account whose key is in OPENROUTER_KEY — the default stays free.
export interface ModelOption {
  id:      string
  label:   string
  ctx:     string
  /** USD per 1M tokens (prompt / completion); 0 for free models */
  priceIn:  number
  priceOut: number
  free:    boolean
  created: number
}

const fmtCtx = (n: number) => n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`

let modelsCache: ModelOption[] | null = null

/** Every text-output chat model OpenRouter offers, newest first. Rejects on network/HTTP errors. */
export async function fetchAllModels(): Promise<ModelOption[]> {
  if (modelsCache) return modelsCache
  const res = await fetch(`${BASE}/models`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}`)
  const json = await res.json()
  const data: unknown = json?.data
  if (!Array.isArray(data)) throw new Error('Unexpected OpenRouter models response')
  const out: ModelOption[] = []
  for (const m of data as Record<string, any>[]) {
    const id = m?.id
    if (typeof id !== 'string' || id.endsWith(':batch')) continue // batch variants can't stream
    const outputs: unknown = m.architecture?.output_modalities
    if (Array.isArray(outputs) && !(outputs.length === 1 && outputs[0] === 'text')) continue
    const priceIn  = Number(m.pricing?.prompt) * 1e6
    const priceOut = Number(m.pricing?.completion) * 1e6
    // Negative prices are OpenRouter's marker for auto-routing models with variable pricing.
    if (!(priceIn >= 0) || !(priceOut >= 0)) continue
    out.push({
      id,
      label: typeof m.name === 'string' && m.name ? m.name : id,
      ctx: fmtCtx(Number(m.context_length) || 0),
      priceIn, priceOut,
      free: priceIn === 0 && priceOut === 0,
      created: Number(m.created) || 0,
    })
  }
  modelsCache = out.sort((a, b) => b.created - a.created)
  return modelsCache
}

const PROVIDER_ORDER = ['anthropic', 'openai']
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Claude (Anthropic)', openai: 'ChatGPT / OpenAI', google: 'Google', 'meta-llama': 'Meta Llama',
  mistralai: 'Mistral', deepseek: 'DeepSeek', 'x-ai': 'xAI Grok', qwen: 'Qwen', nvidia: 'NVIDIA', 'z-ai': 'Z.ai',
  moonshotai: 'Moonshot', minimax: 'MiniMax',
}

export function formatModelPrice(m: ModelOption): string {
  if (m.free) return 'free'
  const f = (n: number) => n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(2).replace(/\.?0+$/, '') : n.toFixed(2)
  return `$${f(m.priceIn)}/$${f(m.priceOut)} per 1M`
}

/** Group models by provider — Claude and OpenAI first, then the rest A–Z, with free models last. */
export function groupModels(models: ModelOption[]): { label: string; models: ModelOption[] }[] {
  const byProvider = new Map<string, ModelOption[]>()
  const free: ModelOption[] = []
  for (const m of models) {
    if (m.free) { free.push(m); continue }
    const provider = m.id.split('/')[0].replace(/^~/, '') // ~anthropic/... are "latest" aliases of the same provider
    byProvider.set(provider, [...(byProvider.get(provider) ?? []), m])
  }
  const providers = [...byProvider.keys()].sort((a, b) => {
    const ia = PROVIDER_ORDER.indexOf(a), ib = PROVIDER_ORDER.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.localeCompare(b)
  })
  const groups = providers.map(p => ({ label: PROVIDER_NAMES[p] ?? p, models: byProvider.get(p)! }))
  if (free.length) groups.push({ label: 'Free models', models: free })
  return groups
}

// ── Streaming call ─────────────────────────────────────────────────────────
// Some free models are "reasoning" variants that stream their internal
// chain-of-thought via delta.reasoning before any delta.content appears —
// on a tight max_tokens budget the whole turn can be consumed by reasoning,
// leaving content empty and the UI looking dead. We surface reasoning text
// too (via onReasoning) so streaming is always visibly alive, and give a
// generous budget so real content still gets a chance to follow.
export async function streamAI(
  messages: DSMessage[],
  onToken:  (token: string) => void,
  signal?:  AbortSignal,
  model     = DEFAULT_MODEL,
  onReasoning?: (token: string) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream:      true,
      max_tokens:  4000,
      temperature: 0.65,
    }),
    signal,
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${msg.slice(0, 200)}`)
  }
  if (!res.body) throw new Error('No response body')

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let   buf     = ''
  let   gotContent = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const json  = JSON.parse(data)
        if (json.error) throw new Error(json.error.message || 'Upstream provider error')
        const delta = json.choices?.[0]?.delta ?? {}
        const token = delta.content ?? ''
        if (token) { gotContent = true; onToken(token) }
        else if (!gotContent && typeof delta.reasoning === 'string' && delta.reasoning) {
          onReasoning?.(delta.reasoning)
        }
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
      }
    }
  }
}

// ── Context builder ────────────────────────────────────────────────────────
export function buildDashboardContext(crises: CrisisEvent[], flights: Flight[], trajectories: TrajectoryEntry[] = [], dataHealth = ''): string {
  const now      = new Date().toUTCString()
  const critical = crises.filter(c => c.severity === 'critical')
  const high     = crises.filter(c => c.severity === 'high')

  const topCrises = critical.slice(0, 8).map(c =>
    `  • [${c.type.toUpperCase()}] ${c.country} — ${c.title.slice(0, 80)}`
  ).join('\n')

  const countryCounts: Record<string, number> = {}
  for (const c of crises) {
    countryCounts[c.country] = (countryCounts[c.country] ?? 0) + 1
  }
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c, n]) => `${c} (${n})`)
    .join(', ')

  const risingTrend = trajectories.filter(t => t.trend === 'rising')
  const trajectoryLines = trajectories.map(t =>
    `  • ${t.country}: ${t.trend.toUpperCase()} (velocity ${t.velocity}/100) — ${t.reason}`
  ).join('\n')

  return `\
=== WORLD SURVEILLANCE DASHBOARD — LIVE CONTEXT ===
Timestamp (UTC): ${now}

ACTIVE CONFLICTS & CRISES
  Total events: ${crises.length}
  Critical: ${critical.length} | High: ${high.length} | Other: ${crises.length - critical.length - high.length}
  Most affected countries: ${topCountries || 'none'}
${topCrises ? '\nTop critical events:\n' + topCrises : ''}
${trajectories.length > 0 ? `
TRAJECTORY SIGNALS (rule-based, last 3d vs prior 7d — computed locally, not model-generated)
  ${risingTrend.length} of ${trajectories.length} tracked regions trending upward
${trajectoryLines}` : ''}

${dataHealth ? `
DATA SOURCE HEALTH (observed from this session's requests — treat figures from DOWN or intermittent sources as incomplete)
${dataHealth}
` : ''}
AIR TRAFFIC
  Airborne flights tracked: ${flights.length.toLocaleString()}

DASHBOARD CAPABILITIES
  Live flight positions (OpenSky ADS-B, ~10s latency)
  Conflict events (ACLED — 230+ countries)
  Internet outage detection (IODA — BGP + probing)
  News feeds (GDELT, BBC, Reuters, Guardian, NYT)
  Market data (equities, ETFs, crypto, forex, bonds — Finnhub/CoinGecko)
  Wildfire hotspots (NASA FIRMS)
  Military bases & nuclear facilities
  Energy infrastructure (dams, LNG, pipelines, refineries)
  Airspace closure overlays (FIR regions)
  EarthCam live CCTV cameras (45 locations worldwide)
  ${resourceCapabilitySummary()}
===================================================`
}

// ── Preset quick-prompts ───────────────────────────────────────────────────
export const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  {
    label:  'Threat Brief',
    prompt: 'Give me a concise intelligence brief on the current global threat landscape based on the active data. Highlight the most critical situations and any notable patterns.',
  },
  {
    label:  'Conflict Map',
    prompt: 'Analyze the active conflict zones. Which regions are most destabilized? Are there any escalation risks or interconnected conflicts I should monitor closely?',
  },
  {
    label:  'Air Traffic',
    prompt: 'Based on current flight data, what anomalies or noteworthy patterns can you identify? Are there any airspace restrictions or unusual military air activity worth noting?',
  },
  {
    label:  'Geo Risk',
    prompt: 'What are the top 5 geopolitical flashpoints right now, and what second-order effects could they have on global stability, markets, and trade routes?',
  },
  {
    label:  'Markets',
    prompt: 'How are the current conflict zones and geopolitical tensions likely to impact global markets, energy prices, and supply chains? What sectors are most exposed?',
  },
  {
    label:  'Cyber',
    prompt: 'Assess internet outage patterns and their potential geopolitical causes. Are any outages consistent with information operations, conflict-related infrastructure attacks, or government shutdowns?',
  },
]
