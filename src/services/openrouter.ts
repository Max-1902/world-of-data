import type { CrisisEvent, Flight } from '../types'

const BASE = '/api/openrouter'

export interface DSMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

// ── Available free models on OpenRouter ────────────────────────────────────
export const FREE_MODELS: { id: string; label: string; ctx: string }[] = [
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free',         label: 'Nemotron 30B',       ctx: '32k'  },
  { id: 'stepfun/step-3.5-flash:free',                 label: 'Step 3.5 Flash',     ctx: '32k'  },
  { id: 'arcee-ai/trinity-large-preview:free',         label: 'Trinity Large',      ctx: '32k'  },
  { id: 'arcee-ai/trinity-mini:free',                  label: 'Trinity Mini',       ctx: '32k'  },
  { id: 'liquid/lfm-2.5-1.2b-thinking:free',           label: 'LFM Thinking',       ctx: '32k'  },
  { id: 'liquid/lfm-2.5-1.2b-instruct:free',           label: 'LFM Instruct',       ctx: '32k'  },
]
export const DEFAULT_MODEL = FREE_MODELS[0].id

// ── Streaming call ─────────────────────────────────────────────────────────
export async function streamAI(
  messages: DSMessage[],
  onToken:  (token: string) => void,
  signal?:  AbortSignal,
  model     = DEFAULT_MODEL,
): Promise<void> {
  const key = import.meta.env.VITE_OPENROUTER_KEY
  if (!key) throw new Error('VITE_OPENROUTER_KEY not set')

  const res = await fetch(`${BASE}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer':  'http://localhost:3000',
      'X-Title':       'World Surveillance',
    },
    body: JSON.stringify({
      model,
      messages,
      stream:      true,
      max_tokens:  1800,
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
        const token = json.choices?.[0]?.delta?.content ?? ''
        if (token) onToken(token)
      } catch { /* ignore partial JSON */ }
    }
  }
}

// ── Context builder ────────────────────────────────────────────────────────
export function buildDashboardContext(crises: CrisisEvent[], flights: Flight[]): string {
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

  return `\
=== WORLD SURVEILLANCE DASHBOARD — LIVE CONTEXT ===
Timestamp (UTC): ${now}

ACTIVE CONFLICTS & CRISES
  Total events: ${crises.length}
  Critical: ${critical.length} | High: ${high.length} | Other: ${crises.length - critical.length - high.length}
  Most affected countries: ${topCountries || 'none'}
${topCrises ? '\nTop critical events:\n' + topCrises : ''}

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
===================================================`
}

// ── Preset quick-prompts ───────────────────────────────────────────────────
export const QUICK_PROMPTS: { label: string; icon: string; prompt: string }[] = [
  {
    label:  'Threat Brief',
    icon:   '🎯',
    prompt: 'Give me a concise intelligence brief on the current global threat landscape based on the active data. Highlight the most critical situations and any notable patterns.',
  },
  {
    label:  'Conflict Map',
    icon:   '⚔',
    prompt: 'Analyze the active conflict zones. Which regions are most destabilized? Are there any escalation risks or interconnected conflicts I should monitor closely?',
  },
  {
    label:  'Air Traffic',
    icon:   '✈',
    prompt: 'Based on current flight data, what anomalies or noteworthy patterns can you identify? Are there any airspace restrictions or unusual military air activity worth noting?',
  },
  {
    label:  'Geo Risk',
    icon:   '🌍',
    prompt: 'What are the top 5 geopolitical flashpoints right now, and what second-order effects could they have on global stability, markets, and trade routes?',
  },
  {
    label:  'Markets',
    icon:   '📈',
    prompt: 'How are the current conflict zones and geopolitical tensions likely to impact global markets, energy prices, and supply chains? What sectors are most exposed?',
  },
  {
    label:  'Cyber',
    icon:   '⚡',
    prompt: 'Assess internet outage patterns and their potential geopolitical causes. Are any outages consistent with information operations, conflict-related infrastructure attacks, or government shutdowns?',
  },
]
