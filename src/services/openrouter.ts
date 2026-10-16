import type { CrisisEvent, Flight } from '../types'
import { isBaseline, type TrajectoryEntry } from '../utils/trajectory'
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

/** HTTP failure from the OpenRouter proxy; `body` is the raw response text. */
export class OpenRouterError extends Error {
  constructor(public status: number, public body: string) {
    super(`OpenRouter ${status}: ${body.slice(0, 200)}`)
    this.name = 'OpenRouterError'
  }
}

/** A user-facing explanation of why a chat request failed. */
export function describeAIError(err: unknown): string {
  if (err instanceof OpenRouterError) {
    switch (err.status) {
      case 402: return 'Your OpenRouter account has no credits for this model. Add credits at openrouter.ai/settings/credits, or pick a free model.'
      case 401: case 403:
        if (/not allowed on this deployment/i.test(err.body)) return 'This deployment only allows free models. Pick one from "Free models" in the model list.'
        return 'OpenRouter rejected the API key. Check OPENROUTER_KEY in .env and restart the dev server.'
      case 404: return 'OpenRouter no longer offers this model. Pick another one.'
      case 429: return 'This model is rate-limited right now. Retry in a moment or pick another model.'
      case 500: if (/not configured/i.test(err.body)) return 'OPENROUTER_KEY is not set. Add it to .env and restart the dev server.'
    }
    try {
      const m = JSON.parse(err.body)?.error?.message
      if (typeof m === 'string' && m) return `OpenRouter error ${err.status}: ${m.slice(0, 160)}`
    } catch { /* body wasn't JSON */ }
    return `OpenRouter error ${err.status}.`
  }
  // Errors raised from inside the stream carry the provider's own message.
  if (err instanceof Error && err.message && err.name !== 'TypeError') return `The model returned an error: ${err.message.slice(0, 160)}`
  return 'The analysis request could not be completed. Check your connection and try again.'
}

/** Sampling settings for every analyst call — exported so run logs and the eval harness record what was actually sent. */
export const CHAT_PARAMS = { max_tokens: 4000, temperature: 0.65 } as const

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
      ...CHAT_PARAMS,
    }),
    signal,
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new OpenRouterError(res.status, msg)
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
        if (json.error) {
          // Provider errors can arrive mid-stream with their own HTTP-style code (429 rate limit, …).
          if (typeof json.error.code === 'number') throw new OpenRouterError(json.error.code, JSON.stringify({ error: json.error }))
          throw new Error(json.error.message || 'Upstream provider error')
        }
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

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
})

/**
 * streamAI with rate-limit resilience. A rate-limited (429) free model is retried once, then the
 * other free models are tried in turn. Paid models are never swapped — switching one to another
 * would change what gets billed — they just get the one retry. Falls over only before any text
 * has streamed, so an answer is never spliced from two models. Returns the model that answered.
 */
export async function streamAIWithFallback(
  messages: DSMessage[],
  onToken:  (token: string) => void,
  signal:   AbortSignal | undefined,
  model:    string,
  onReasoning?: (token: string) => void,
  onFallback?: (from: string, to: string) => void,
  retryDelayMs = 1500,
): Promise<string> {
  let started = false
  const track = (cb?: (t: string) => void) => (t: string) => { started = true; cb?.(t) }
  const isFree = (id: string) => id.endsWith(':free')
  const candidates = [model, ...(isFree(model) ? FREE_MODELS.map(m => m.id).filter(id => id !== model) : [])]

  let lastErr: unknown
  for (let i = 0; i < candidates.length; i++) {
    const id = candidates[i]
    for (let attempt = 0; attempt < (i === 0 ? 2 : 1); attempt++) {
      try {
        if (attempt > 0) await sleep(retryDelayMs, signal)
        await streamAI(messages, track(onToken), signal, id, track(onReasoning))
        return id
      } catch (err) {
        lastErr = err
        const rateLimited = err instanceof OpenRouterError && err.status === 429
        if (!rateLimited || started) throw err
      }
    }
    if (i + 1 < candidates.length) onFallback?.(id, candidates[i + 1])
  }
  throw lastErr
}

// ── Context builder ────────────────────────────────────────────────────────
export interface ContextOptions {
  /** "As of" time printed in the context; fixed in tests and frozen research contexts. */
  now?: Date
  /** Whether the flights / crises layers are switched on. Omitted = on. */
  flightsLayer?: boolean
  crisesLayer?: boolean
  /** Set when flights are not measured for another reason (e.g. the research recorder does not poll OpenSky). */
  flightsUnmeasuredReason?: string
  /** The last ACLED poll hit its row cap, so event counts are a sample of the window, not totals. */
  conflictCapped?: boolean
}

/**
 * Dashboard inputs that are never passed to the analyst. Listed as NOT MEASURED so the model does not read their
 * absence from the context as an absence of events (e.g. "no outages reported"). Before 2026-10-15 only flights
 * and conflict events were listed, while the "Cyber" quick prompt asked about outage patterns.
 */
export const NOT_IN_CONTEXT: NotMeasured[] = [
  { what: 'Internet outages', why: 'IODA data is shown on the map but not passed to the analyst' },
  { what: 'Earthquakes', why: 'USGS data is shown on the map but not passed to the analyst' },
  { what: 'Wildfires', why: 'NASA FIRMS data is shown on the map but not passed to the analyst' },
  { what: 'Disaster alerts', why: 'GDACS data is shown on the map but not passed to the analyst' },
  { what: 'Airspace', why: 'the low-traffic heuristic is not passed to the analyst, and it is not a NOTAM feed in any case' },
  { what: 'Vessel positions', why: 'AIS data is not passed to the analyst' },
  { what: 'GPS interference', why: 'GPSJAM data is not passed to the analyst' },
  { what: 'News headlines', why: 'headlines are not passed to the analyst' },
]

/** One input the model must treat as absent, not as zero. */
export interface NotMeasured { what: string; why: string }

/**
 * Which inputs this context does not actually measure. An empty array is never a zero count: a flights
 * layer that is off (or an OpenSky poll that returned nothing) means "unknown", and a crisis list that
 * holds only the hand-entered baseline means the live conflict feed contributed nothing.
 */
export function notMeasured(crises: CrisisEvent[], flights: Flight[], opts: ContextOptions = {}): NotMeasured[] {
  const out: NotMeasured[] = []
  if (opts.flightsUnmeasuredReason) out.push({ what: 'Air traffic', why: opts.flightsUnmeasuredReason })
  else if (opts.flightsLayer === false) out.push({ what: 'Air traffic', why: 'flights layer switched off' })
  else if (flights.length === 0) out.push({ what: 'Air traffic', why: 'no flight data received from OpenSky' })
  if (opts.crisesLayer === false) out.push({ what: 'Live conflict events', why: 'crises layer switched off' })
  else if (!crises.some(c => !isBaseline(c))) out.push({ what: 'Live conflict events', why: 'no events received from ACLED' })
  return [...out, ...NOT_IN_CONTEXT]
}

export function buildDashboardContext(crises: CrisisEvent[], flights: Flight[], trajectories: TrajectoryEntry[] = [], dataHealth = '', marketSnapshot = '', countryAnalytics = '', opts: ContextOptions = {}): string {
  const now      = (opts.now ?? new Date()).toUTCString()
  const missing  = notMeasured(crises, flights, opts)
  const flightsMeasured = !missing.some(m => m.what === 'Air traffic')
  const crisesMeasured  = !missing.some(m => m.what === 'Live conflict events')
  // The hand-entered baseline is a reference list, not events: counting it as "events" made an ACLED outage
  // look like 16 live incidents.
  const live     = crisesMeasured ? crises.filter(c => !isBaseline(c)) : []
  const baseline = crises.filter(isBaseline)
  const critical = live.filter(c => c.severity === 'critical')
  const high     = live.filter(c => c.severity === 'high')

  const topCrises = critical.slice(0, 8).map(c =>
    `  • [${c.type.toUpperCase()}] ${c.country} — ${c.title.slice(0, 80)}`
  ).join('\n')

  const countryCounts: Record<string, number> = {}
  for (const c of live) {
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

  const conflicts = crisesMeasured ? `\
ACTIVE CONFLICTS & CRISES (live events, ACLED, last 14 days; events of one type within ~50 km are merged)${opts.conflictCapped ? `
  CAPPED: the feed returned its maximum number of rows, so these counts are a sample of the window, not totals. Do not present them as totals.` : ''}
  Total events: ${live.length}
  Critical: ${critical.length} | High: ${high.length} | Other: ${live.length - critical.length - high.length}
  Most affected countries: ${topCountries || 'none'}
${topCrises ? '\nTop critical events:\n' + topCrises : ''}` : `\
ACTIVE CONFLICTS & CRISES
  Live events: NOT MEASURED — no event counts, totals or trends are available.`
  const reference = baseline.length ? `
KNOWN ONGOING CONFLICTS (hand-entered reference list — not live events, not counts, not evidence of current activity)
${baseline.map(c => `  • ${c.country} — ${c.title}`).join('\n')}
` : ''

  const notMeasuredBlock = missing.length ? `
NOT MEASURED (absent from this context — this is unknown, NOT zero; never state a count, absence, decline or anomaly for these)
${missing.map(m => `  • ${m.what}: ${m.why}`).join('\n')}
` : ''

  return `\
=== WORLD SURVEILLANCE DASHBOARD — LIVE CONTEXT ===
Timestamp (UTC): ${now}
${notMeasuredBlock}
${conflicts}
${reference}${trajectories.length > 0 ? `
TRAJECTORY SIGNALS (rule-based, last 3d vs prior 7d — computed locally, not model-generated)
  ${risingTrend.length} of ${trajectories.length} tracked regions trending upward
${trajectoryLines}` : ''}

${countryAnalytics ? `
COUNTRY ANALYTICS — the comparison currently open in the Country Analytics panel (computed locally from World Bank / Our World in Data / Ember; not model-generated. For data questions, cite these numbers and say they come from here.)
  ${countryAnalytics}
` : ''}${dataHealth ? `
DATA SOURCE HEALTH (sources currently failing. Don't refuse because of them and don't list them unprompted; but if the answer depends on one of them, say so in one sentence.)
${dataHealth}
` : ''}${marketSnapshot ? `
MARKET SNAPSHOT (live quotes just pulled; these are the only prices you may cite)
${marketSnapshot}
` : ''}
AIR TRAFFIC
  ${flightsMeasured ? `Airborne flights tracked: ${flights.length.toLocaleString('en-US')}` : 'NOT MEASURED — no flight count is available.'}

DASHBOARD LAYERS (what the map can show — their data is NOT in this context unless it appears in a block above)
  Live flight positions (OpenSky ADS-B)
  Conflict events (ACLED)
  Internet outage detection (IODA)
  News feeds (RSS from public broadcasters and newspapers, Google News, NYT)
  Market data (ETF and stock quotes via Finnhub; crypto via CoinGecko; FX via open.er-api.com)
  Earthquakes (USGS), wildfire hotspots (NASA FIRMS), disaster alerts (GDACS)
  Military bases & nuclear facilities (curated, not individually re-verified)
  Energy infrastructure (curated dams/LNG/refineries; WRI power plants, 2021 vintage, no operating status)
  Airspace low-traffic heuristic (hand-drawn FIR boxes vs hand-set references; not NOTAMs, not closures)
  Public webcams (third-party listings)
  ${resourceCapabilitySummary()}
===================================================`
}

/**
 * The analyst's system prompt around a context from buildDashboardContext. Lives here (not in the panel)
 * so the offline eval harness sends exactly what the app sends.
 */
export function buildSystemPrompt(context: string, opts: { tools?: string } = {}): string {
  return `You are the analyst in the Macroeconomic Forecasting System, a live world monitoring dashboard. You receive the dashboard's current data below, including locally calculated regional activity trends for the last 72 hours compared with the prior week. Ground your analysis in this information. Distinguish current activity from changes in activity, and explain what evidence supports each assessment. Write in a clear, measured briefing style. Be concise, specific, and direct. Do not use emojis, terminal-style status text, decorative symbols, or unsupported confidence scores.

Anything listed under NOT MEASURED is unknown, not zero or absent: never state or imply a count, an absence, a decline or an anomaly for it. If the question depends on it, say in one sentence that the dashboard did not measure it, then answer the rest. Only cite numbers that appear in the data below; anything from your own knowledge must be marked as such and must not be presented as a live reading.

Label where each claim comes from. End every sentence that states a fact with one tag: [dashboard] when it rests on the data below, [background] when it rests on your general knowledge (which may be out of date), [inference] when it is your own reasoning. Example: "Sudan has the most live conflict events in the current data, 41 [dashboard]. The war began in April 2023 [background]. Fighting may spread toward El Fasher [inference]."

Don't refuse or open with a disclaimer because some data is missing; answer from what you have. Always give the user a substantive answer from whatever data you do have plus your own general knowledge, clearly separating what the live data shows from what is your inference. For data questions about countries, ground the answer in a COUNTRY ANALYTICS block when one is present, quoting its numbers and naming the countries it lists, then add context from your own knowledge clearly marked as such. For market questions, cite only prices from a MARKET SNAPSHOT block when one is present; otherwise give the risk-driven sector read (which sectors conflict and trend signals tend to affect, and how) without inventing any price, level or return.

IMPORTANT: You can execute dashboard commands by including them in your response. Commands are on their own line:

[FLY:location] — Fly the map to a location (city, country, coordinates). Example: [FLY:Tehran, Iran]
[COUNTRY:name] — Open the country intelligence drawer. Example: [COUNTRY:Iran]
[LAYER:id:on] or [LAYER:id:off] — Toggle a map layer. Layer IDs: flights, crises, wildfires, military, nuclear, sanctions, cameras, infrastructure, airspace, humanitarian, vessels, oil, gas, ports, pipelines, gpsjam
[DEEPSTATE:on] or [DEEPSTATE:off] — Toggle Ukraine frontline overlay

When a user asks about a specific country or region, ALWAYS include the FLY and COUNTRY commands to show it on the map. (If the user's message names a country, the dashboard has already flown there and opened its overview — repeating those commands is harmless.) When relevant, enable related layers. For example if asked about Iran, fly there, open the country drawer, and enable relevant layers like military, crises, airspace.

Execute commands BEFORE your analysis text — put them at the very start of your response.
${opts.tools ? `\n${toolInstructions(opts.tools)}\n` : ''}
${context}`
}

/**
 * The investigation half of the system prompt (panel only — the offline eval harness sends the plain prompt, so
 * frozen contexts stay comparable). `catalogue` is services/aiTools.ts toolCatalogue(); passed in rather than
 * imported so this module does not pull every data service into the eval script.
 */
export function toolInstructions(catalogue: string, rounds = 3, perRound = 6): string {
  return `INVESTIGATING WITH DATA TOOLS
The live context below is only a summary. You can query every dataset in the dashboard yourself. To request data, write one request per line in exactly this form, with nothing else in that turn:
[DATA:tool|argument|argument]
The dashboard runs the requests and replies with TOOL RESULTS, each with an id (R1, R2, …). Then either request more data or write the answer. You get at most ${rounds} rounds of requests and ${perRound} requests per round, so ask for everything a question needs in the same round.

Investigate before you answer. When a question touches a country, a market, an economic indicator, a hazard or the future, fetch the relevant data first instead of answering from memory, and combine sources (for a crisis: conflict, outages, disasters, news, markets; for an economy: profile, series, forecast, trade). For a general briefing, scan several live feeds. TOOL RESULTS count as "the data below" for every rule above, including [dashboard] tags. An input listed under NOT MEASURED becomes measured once a tool result for it is in the conversation, but only for what that result contains. A result marked NOT AVAILABLE is unknown, not zero.

Tools:
${catalogue}

Charts: to show a result as a chart, put [CHART:R2] on its own line where it belongs in the answer. Only results marked "chartable" can be charted, and the chart draws the result's own data. Use a chart when a trend, comparison or ranking is central to the answer, usually one or two per answer.

Answer format: open with a one- or two-sentence bottom line. Then use short "## " headings, bullet points, and a markdown table when comparing several items. Refer to the result behind a key claim by its id, e.g. (R2). When the question is about what comes next, end with "## What to watch": two or three concrete signals that would confirm or overturn the assessment. Never present a forecast as certain; give the method and its backtest skill when a forecast result is used.`
}

/** Dashboard command and data-request lines ([FLY:…], [LAYER:…], [DATA:…], …) the panel strips from what the user sees. [CHART:…] stays: the panel draws it. */
export const COMMAND_LINE = /^\[(FLY|COUNTRY|LAYER|DEEPSTATE|DATA):.+\]$/

/**
 * What the user should read: the model output without dashboard command lines and without model-native
 * tool-call blocks. Some small models emit `<|tool_call_start|>[COUNTRY(name='Ukraine')]<|tool_call_end|>`
 * instead of the `[COUNTRY:…]` syntax and then stop (observed with the default free model, 2026-10-08) —
 * shown raw, that looked like an answer.
 */
export function visibleText(full: string): string {
  return full
    .replace(/<\|tool_call_start\|>[\s\S]*?(?:<\|tool_call_end\|>|$)/g, '')
    .split('\n').filter(l => !COMMAND_LINE.test(l.trim())).join('\n')
}

// ── Preset quick-prompts ───────────────────────────────────────────────────
export const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  {
    label:  'Daily brief',
    prompt: 'Investigate the current world situation on your own. Scan the live feeds (conflict events, disaster alerts, internet outages, earthquakes, markets, headlines), decide which three developments matter most for the coming days, and brief me with the evidence, at least one chart, and what to watch.',
  },
  {
    label:  'Economy outlook',
    prompt: 'Pick the two or three economies most exposed to the current conflict and trend signals, pull their key indicators and a growth forecast, and explain the outlook with charts. Say how reliable the forecasts are.',
  },
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
