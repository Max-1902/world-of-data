import { describe, it, expect, vi } from 'vitest'
import { streamAI, CHAT_PARAMS, tierOf, buildDashboardContext, buildSystemPrompt, notMeasured, visibleText, FREE_MODELS, DEFAULT_MODEL, QUICK_PROMPTS, OpenRouterError, describeAIError, streamAIWithFallback, groupModels, formatModelPrice, NOT_IN_CONTEXT } from './openrouter'
import { mockFetch, streamResponse, textResponse, jsonResponse } from '../test/helpers'
import type { CrisisEvent, Flight } from '../types'
import type { TrajectoryEntry } from '../utils/trajectory'

const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`
const tok = (content: string) => sse({ choices: [{ delta: { content } }] })
const reasoning = (r: string) => sse({ choices: [{ delta: { reasoning: r } }] })

async function run(chunks: string[], opts: { onReasoning?: (t: string) => void } = {}) {
  mockFetch(() => streamResponse(chunks))
  const tokens: string[] = []
  await streamAI([{ role: 'user', content: 'hi' }], t => tokens.push(t), undefined, DEFAULT_MODEL, opts.onReasoning)
  return tokens
}

describe('streamAI', () => {
  it('emits content tokens in order and stops at [DONE]', async () => {
    const tokens = await run([tok('Hel'), tok('lo'), 'data: [DONE]\n\n', tok('IGNORED')])
    expect(tokens).toEqual(['Hel', 'lo'])
  })

  it('reassembles events split across arbitrary chunk boundaries', async () => {
    const full = tok('Hello') + tok(' world')
    const cut = 17
    const tokens = await run([full.slice(0, cut), full.slice(cut, cut + 9), full.slice(cut + 9)])
    expect(tokens).toEqual(['Hello', ' world'])
  })

  it('does not split multi-byte characters that straddle chunk boundaries', async () => {
    const bytes = new TextEncoder().encode(tok('héllo → 世界'))
    const enc = new TextEncoder()
    const mid = Math.floor(bytes.length / 2)
    mockFetch(() => new Response(new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(bytes.slice(0, mid)); c.enqueue(bytes.slice(mid)); c.enqueue(enc.encode('')); c.close() },
    })))
    const tokens: string[] = []
    await streamAI([], t => tokens.push(t))
    expect(tokens.join('')).toBe('héllo → 世界')
  })

  it('surfaces reasoning text only until real content arrives', async () => {
    const onReasoning = vi.fn()
    const tokens = await run([reasoning('think 1'), reasoning('think 2'), tok('answer'), reasoning('late thought')], { onReasoning })
    expect(tokens).toEqual(['answer'])
    expect(onReasoning.mock.calls.map(c => c[0])).toEqual(['think 1', 'think 2'])
  })

  it('ignores non-data lines (comments, keep-alives) and empty data', async () => {
    const tokens = await run([': OPENROUTER PROCESSING\n\n', 'data: \n\n', 'event: ping\n', tok('ok')])
    expect(tokens).toEqual(['ok'])
  })

  it('skips a data line that is not JSON instead of ending the answer', async () => {
    const tokens = await run([tok('a'), 'data: {not json\n\n', tok('b')])
    expect(tokens).toEqual(['a', 'b'])
  })

  it('tolerates deltas with no content and events with no choices', async () => {
    const tokens = await run([sse({ choices: [{ delta: { role: 'assistant' } }] }), sse({}), tok('x')])
    expect(tokens).toEqual(['x'])
  })

  it('throws upstream error payloads delivered mid-stream', async () => {
    mockFetch(() => streamResponse([tok('partial'), sse({ error: { message: 'rate limited upstream' } })]))
    const tokens: string[] = []
    await expect(streamAI([], t => tokens.push(t))).rejects.toThrow('rate limited upstream')
    expect(tokens).toEqual(['partial'])
  })

  it('throws a status-tagged error, truncating the body, for non-OK responses', async () => {
    mockFetch(() => textResponse('x'.repeat(1000), { status: 429 }))
    const err = await streamAI([], () => {}).then(() => new Error('did not throw'), (e: Error) => e)
    expect(err.message.startsWith('OpenRouter 429: ')).toBe(true)
    expect(err.message.length).toBe('OpenRouter 429: '.length + 200)
  })

  it('throws when the response has no body', async () => {
    mockFetch(() => new Response(null, { status: 200 }))
    await expect(streamAI([], () => {})).rejects.toThrow('No response body')
  })

  it('posts model, messages and stream flag to the server-side proxy without any credentials', async () => {
    const fetchMock = mockFetch(() => streamResponse(['data: [DONE]\n\n']))
    const messages = [{ role: 'system' as const, content: 's' }, { role: 'user' as const, content: 'u' }]
    const controller = new AbortController()
    await streamAI(messages, () => {}, controller.signal, 'some/model:free')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/openrouter/chat/completions')
    expect(init!.method).toBe('POST')
    expect(init!.signal).toBe(controller.signal)
    expect(JSON.parse(String(init!.body))).toMatchObject({ model: 'some/model:free', messages, stream: true })
    expect(JSON.stringify(init!.headers).toLowerCase()).not.toContain('authorization')
  })

  it('propagates aborts', async () => {
    mockFetch((_u, init) => new Promise<Response>((_res, rej) => {
      init!.signal!.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')))
    }) as unknown as Response)
    const controller = new AbortController()
    const p = streamAI([], () => {}, controller.signal)
    controller.abort()
    await expect(p).rejects.toThrow(/abort/i)
  })
})

describe('model catalogue and prompts', () => {
  it('default model is a listed free model', () => {
    expect(FREE_MODELS.map(m => m.id)).toContain(DEFAULT_MODEL)
  })
  it('defaults to the free model with the best measured answers, not the 2.6B one that mostly returned nothing', () => {
    expect(DEFAULT_MODEL).toBe('nvidia/nemotron-3-super-120b-a12b:free')
    expect(FREE_MODELS[FREE_MODELS.length - 1].id).toBe('liquid/lfm-2.5-2.6b:free')
  })
  it('every model is free-tier, has a label, and ids are unique', () => {
    for (const m of FREE_MODELS) {
      expect(m.id.endsWith(':free'), m.id).toBe(true)
      expect(m.label).toBeTruthy()
    }
    expect(new Set(FREE_MODELS.map(m => m.id)).size).toBe(FREE_MODELS.length)
  })
  it('quick prompts have unique labels and non-empty prompts', () => {
    expect(new Set(QUICK_PROMPTS.map(p => p.label)).size).toBe(QUICK_PROMPTS.length)
    for (const p of QUICK_PROMPTS) expect(p.prompt.length).toBeGreaterThan(20)
  })
})

describe('buildSystemPrompt', () => {
  it('wraps the context and carries the not-measured and number-citation rules', () => {
    const p = buildSystemPrompt('CTX-MARKER')
    expect(p.endsWith('CTX-MARKER')).toBe(true)
    expect(p).toMatch(/NOT MEASURED is unknown, not zero/)
    expect(p).toMatch(/Only cite numbers that appear in the data below/)
  })

  it('offers no map or panel commands: the reader stays in the conversation', () => {
    const p = buildSystemPrompt('')
    expect(p).not.toMatch(/\[(FLY|COUNTRY|LAYER|DEEPSTATE):/)
    expect(p).toMatch(/cannot move the map/)
  })

  it('requires a source tag on every factual sentence, with an example of each tag', () => {
    const p = buildSystemPrompt('')
    expect(p).toMatch(/\[dashboard\] when it rests on the data below/)
    expect(p).toMatch(/\[background\] when it rests on your general knowledge/)
    expect(p).toMatch(/\[inference\]/)
    expect(p).toMatch(/Example: .*\[dashboard\].*\[background\].*\[inference\]/)
  })

  it('no longer tells the model to hide source outages', () => {
    expect(buildSystemPrompt('')).not.toMatch(/Never mention source outages/)
  })
})

describe('buildSystemPrompt with tools', () => {
  it('is unchanged without tools, so frozen eval contexts stay comparable', () => {
    expect(buildSystemPrompt('CTX')).not.toContain('INVESTIGATING')
    expect(buildSystemPrompt('CTX', {})).toBe(buildSystemPrompt('CTX'))
  })

  it('adds the tool protocol, catalogue and chart rule before the context, which stays last', () => {
    const p = buildSystemPrompt('CTX-MARKER', { tools: '[DATA:quakes] — earthquakes' })
    expect(p.endsWith('CTX-MARKER')).toBe(true)
    expect(p.indexOf('INVESTIGATING WITH DATA TOOLS')).toBeLessThan(p.indexOf('CTX-MARKER'))
    expect(p).toContain('[DATA:quakes] — earthquakes')
    expect(p).toMatch(/TOOL RESULTS count as "the data below"/)
    expect(p).toMatch(/NOT AVAILABLE is unknown, not zero/)
    expect(p).toContain('[CHART:R2]')
  })
})

describe('visibleText', () => {
  it('hides data requests but keeps chart placements for the panel to draw', () => {
    expect(visibleText('[DATA:conflict|Sudan]\nText\n[CHART:R1]')).toBe('Text\n[CHART:R1]')
  })

  it('hides dashboard command lines and model-native tool-call blocks', () => {
    expect(visibleText("[FLY:Kyiv]\n<|tool_call_start|>[COUNTRY(name='Ukraine')]<|tool_call_end|>\nBriefing.")).toBe('\nBriefing.')
    expect(visibleText("<|tool_call_start|>[COUNTRY(name='Ukraine')]<|tool_call_end|>").trim()).toBe('')
    expect(visibleText('Plain answer [FLY:x] inline stays')).toBe('Plain answer [FLY:x] inline stays')
  })
})

describe('notMeasured', () => {
  it('lists only the layers never passed to the analyst when both feeds delivered data', () => {
    const ev = { id: 'x', source: 'ACLED' } as CrisisEvent
    expect(notMeasured([ev], [{}] as Flight[])).toEqual(NOT_IN_CONTEXT)
  })

  it('covers every map layer whose data is absent from the context (regression: outages were unlisted while the Cyber quick prompt asked about them)', () => {
    const listed = notMeasured([{ id: 'x', source: 'ACLED' } as CrisisEvent], [{}] as Flight[]).map(m => m.what)
    for (const w of ['Internet outages', 'Earthquakes', 'Wildfires', 'Disaster alerts', 'Airspace', 'Vessel positions', 'GPS interference', 'News headlines']) {
      expect(listed).toContain(w)
    }
    const ctx = buildDashboardContext([{ id: 'x', source: 'ACLED', country: 'A', severity: 'low', type: 'war', title: 't' } as CrisisEvent], [{}] as Flight[])
    expect(ctx).toContain('NOT MEASURED')
    expect(ctx).toContain('Internet outages: IODA data is shown on the map but not passed to the analyst')
  })

  it('every quick prompt that asks about a layer finds that layer either in the context or under NOT MEASURED', () => {
    const cyber = QUICK_PROMPTS.find(p => p.label === 'Cyber')!
    expect(cyber.prompt).toMatch(/outage/i)
    expect(NOT_IN_CONTEXT.map(m => m.what)).toContain('Internet outages')
  })
})

describe('context claims about the layers', () => {
  const ctx = buildDashboardContext([], [])
  it('does not advertise sources the app no longer uses or numbers it cannot back', () => {
    expect(ctx).not.toMatch(/GDELT|Reuters|230\+ countries|45 locations|closure overlays/)
    expect(ctx).toMatch(/not NOTAMs, not closures/)
  })
  it('says when the ACLED poll hit its cap, so counts are not read as totals', () => {
    const ev = { id: 'x', source: 'ACLED', country: 'A', severity: 'low', type: 'war', title: 't' } as CrisisEvent
    expect(buildDashboardContext([ev], [], [], '', '', '', { conflictCapped: true })).toMatch(/CAPPED: .* not totals/)
    expect(buildDashboardContext([ev], [])).not.toContain('CAPPED')
  })
})

describe('buildDashboardContext country analytics', () => {
  it('adds the analytics block only when a summary is given', () => {
    expect(buildDashboardContext([], [])).not.toContain('COUNTRY ANALYTICS')
    const ctx = buildDashboardContext([], [], [], '', '', 'Comparison: A against B, 12 countries.')
    expect(ctx).toContain('COUNTRY ANALYTICS')
    expect(ctx).toContain('Comparison: A against B, 12 countries.')
    expect(ctx).toContain('not model-generated')
  })
})

describe('buildDashboardContext', () => {
  const crisis = (o: Partial<CrisisEvent>): CrisisEvent => ({
    id: Math.random().toString(36), title: 'Event', type: 'war', severity: 'low', latitude: 0, longitude: 0,
    country: 'A', date: '2025-01-01', description: '', source: 't', ...o,
  })

  it('includes a data-health block only when a summary is given', () => {
    expect(buildDashboardContext([], [])).not.toContain('DATA SOURCE HEALTH')
    const ctx = buildDashboardContext([], [], [], '  • Conflict events (ACLED): DOWN (HTTP 401)')
    expect(ctx).toContain('DATA SOURCE HEALTH')
    expect(ctx).toContain('ACLED): DOWN (HTTP 401)')
    // used to read "Do NOT mention these, refuse, or caveat": a down source the answer depends on must be named
    expect(ctx).toMatch(/if the answer depends on one of them, say so in one sentence/)
    expect(ctx).not.toMatch(/Do NOT mention these/)
  })

  it('includes the IMF world block only when asked, and says plainly when the IMF figures are missing', () => {
    expect(buildDashboardContext([], [])).not.toContain('WORLD ECONOMY')
    expect(buildDashboardContext([], [], [], '', '', '', { worldEconomy: '  The IMF projects world real GDP growth of 3.1% in 2026.' })).toMatch(/WORLD ECONOMY \(IMF[^\n]*\n  The IMF projects/)
    expect(buildDashboardContext([], [], [], '', '', '', { worldEconomy: null })).toMatch(/WORLD ECONOMY[^\n]*\n  NOT AVAILABLE/)
    expect(buildSystemPrompt('')).toContain('WORLD ECONOMY block')
  })

  it('includes a market snapshot only when one is given', () => {
    expect(buildDashboardContext([], [])).not.toContain('MARKET SNAPSHOT')
    expect(buildDashboardContext([], [], [], '', '  • Brent: 80.00 USD, +1.00% today')).toContain('MARKET SNAPSHOT')
  })

  it('reports severity totals that add up', () => {
    const ctx = buildDashboardContext([
      crisis({ severity: 'critical' }), crisis({ severity: 'critical' }),
      crisis({ severity: 'high' }), crisis({ severity: 'medium' }), crisis({ severity: 'low' }),
    ], [])
    expect(ctx).toContain('Total events: 5')
    expect(ctx).toContain('Critical: 2 | High: 1 | Other: 2')
  })

  it('lists most affected countries by count, capped at six', () => {
    const crises = [
      ...Array.from({ length: 3 }, () => crisis({ country: 'Top' })),
      ...Array.from({ length: 2 }, () => crisis({ country: 'Second' })),
      ...'ABCDEFGH'.split('').map(c => crisis({ country: `C${c}` })),
    ]
    const line = buildDashboardContext(crises, []).split('\n').find(l => l.includes('Most affected countries'))!
    expect(line).toContain('Top (3), Second (2)')
    expect(line.split(',').length).toBe(6)
  })

  it('shows only critical events in the top list, at most eight, with titles truncated to 80 chars', () => {
    const crises = [
      ...Array.from({ length: 12 }, (_, i) => crisis({ severity: 'critical', title: `Crit ${i} ` + 'x'.repeat(200), country: 'X' })),
      crisis({ severity: 'high', title: 'HIGH-EVENT' }),
    ]
    const ctx = buildDashboardContext(crises, [])
    expect(ctx.match(/• \[WAR\]/g)).toHaveLength(8)
    expect(ctx).not.toContain('HIGH-EVENT')
    expect(ctx).not.toContain('x'.repeat(81))
  })

  it('handles an empty dashboard gracefully — as not measured, never as zero', () => {
    const ctx = buildDashboardContext([], [])
    expect(ctx).not.toContain('Total events: 0')
    expect(ctx).toContain('Live events: NOT MEASURED')
    expect(ctx).not.toContain('Top critical events')
    expect(ctx).not.toContain('TRAJECTORY SIGNALS')
  })

  it('reports zero live events only when the feed actually delivered events (never from the baseline)', () => {
    const ctx = buildDashboardContext([crisis({ country: 'B' })], [{ icao24: 'a' }] as unknown as Flight[])
    expect(ctx).toContain('Total events: 1')
    expect(ctx).toContain('Most affected countries: B (1)')
    expect(ctx).not.toContain('Live conflict events:')
    expect(ctx).not.toContain('Air traffic:')
  })

  it('never counts hand-entered baseline markers as live events', () => {
    const base = crisis({ id: 'baseline-ukraine', source: 'Baseline', country: 'Ukraine', title: 'Russia–Ukraine War', severity: 'critical' })
    const onlyBaseline = buildDashboardContext([base], [])
    expect(onlyBaseline).toContain('Live conflict events: no events received from ACLED')
    expect(onlyBaseline).toContain('KNOWN ONGOING CONFLICTS')
    expect(onlyBaseline).toContain('Ukraine — Russia–Ukraine War')
    expect(onlyBaseline).not.toMatch(/Critical: \d/)
    const mixed = buildDashboardContext([base, crisis({ country: 'Sudan', severity: 'critical' })], [])
    expect(mixed).toContain('Total events: 1')
    expect(mixed).toContain('Critical: 1 |')
  })

  it('marks a switched-off or empty flights feed as NOT MEASURED instead of 0 flights', () => {
    const off = buildDashboardContext([], [], [], '', '', '', { flightsLayer: false })
    expect(off).toContain('Air traffic: flights layer switched off')
    expect(off).toContain('AIR TRAFFIC\n  NOT MEASURED')
    expect(off).not.toMatch(/Airborne flights tracked: 0/)
    expect(buildDashboardContext([], [])).toContain('Air traffic: no flight data received from OpenSky')
    // layer switched off wins over stale flights still held in state
    const stale = buildDashboardContext([], [{ icao24: 'a' }] as unknown as Flight[], [], '', '', '', { flightsLayer: false })
    expect(stale).not.toContain('Airborne flights tracked')
  })

  it('marks a switched-off crises layer as not measured even when stale events are still loaded', () => {
    const ctx = buildDashboardContext([crisis({})], [], [], '', '', '', { crisesLayer: false })
    expect(ctx).toContain('Live conflict events: crises layer switched off')
    expect(ctx).not.toContain('Total events')
  })

  it('prints the given as-of time', () => {
    const ctx = buildDashboardContext([], [], [], '', '', '', { now: new Date(Date.UTC(2026, 9, 7, 12)) })
    expect(ctx).toContain('Timestamp (UTC): Wed, 07 Oct 2026 12:00:00 GMT')
  })

  it('includes locally computed trajectory signals when provided', () => {
    const t = (o: Partial<TrajectoryEntry>): TrajectoryEntry => ({
      country: 'Ruritania', recentScore: 10, priorScore: 0, delta: 10, trend: 'rising', velocity: 90,
      recentCount: 1, priorCount: 0, reason: 'because', baseline: null, unusual: null, sampled: false, ...o,
    })
    const ctx = buildDashboardContext([], [], [t({}), t({ country: 'Genovia', trend: 'falling', velocity: 20 })])
    expect(ctx).toContain('TRAJECTORY SIGNALS')
    expect(ctx).toContain('1 of 2 tracked regions trending upward')
    expect(ctx).toContain('Own-normal comparison: NOT MEASURED')
    expect(ctx).toContain('Ruritania: RISING (velocity 90/100) — because')
    expect(ctx).toContain('Genovia: FALLING (velocity 20/100)')
  })

  it('tells the model when the conflict feed was capped, and never asks it to quote a chance', () => {
    const t: TrajectoryEntry = {
      country: 'Ruritania', recentScore: 10, priorScore: 0, delta: 10, trend: 'rising', velocity: 90,
      recentCount: 1, priorCount: 0, reason: 'because', baseline: null, unusual: null, sampled: true,
    }
    const ctx = buildDashboardContext([], [], [t])
    expect(ctx).toContain('the conflict feed hit its row cap, so these counts are a sample')
    expect(ctx).not.toMatch(/chance under its normal/)
  })

  it('reports the airborne flight count', () => {
    const flights = Array.from({ length: 1234 }, (_, i) => ({ icao24: String(i) })) as unknown as Flight[]
    expect(buildDashboardContext([], flights)).toMatch(/Airborne flights tracked: 1,?234/)
  })

  it('does not claim access to source code or secrets', () => {
    const ctx = buildDashboardContext([], []).toLowerCase()
    expect(ctx).not.toMatch(/source code|api key|password/)
  })
})

describe('model catalogue', () => {
  const entry = (id: string, over: Record<string, unknown> = {}) => ({
    id, name: id.toUpperCase(), created: 1, context_length: 200000,
    architecture: { output_modalities: ['text'] }, pricing: { prompt: '0.000003', completion: '0.000015' }, ...over,
  })

  it('lists every text model (paid and free), newest first, dropping batch, image-output and variable-price entries', async () => {
    vi.resetModules()
    const mod = await import('./openrouter')
    mockFetch(url => {
      expect(url).toBe('/api/openrouter/models')
      return jsonResponse({ data: [
        entry('anthropic/claude-a', { created: 1 }),
        entry('anthropic/claude-a:batch', { created: 9 }),
        entry('openai/gpt-b', { created: 5 }),
        entry('x/free-c:free', { created: 3, pricing: { prompt: '0', completion: '0' } }),
        entry('x/image-d', { architecture: { output_modalities: ['text', 'image'] } }),
        entry('openrouter/auto', { pricing: { prompt: '-1', completion: '-1' } }),
        { nope: true },
      ] })
    })
    const list = await mod.fetchAllModels()
    expect(list.map(m => m.id)).toEqual(['openai/gpt-b', 'x/free-c:free', 'anthropic/claude-a'])
    expect(list[2]).toMatchObject({ priceIn: 3, priceOut: 15, free: false, ctx: '200k' })
    expect(list[1].free).toBe(true)
  })

  it('rejects on HTTP errors and malformed payloads', async () => {
    vi.resetModules()
    const mod = await import('./openrouter')
    mockFetch(() => jsonResponse({}, { status: 500 }))
    await expect(mod.fetchAllModels()).rejects.toThrow('OpenRouter models 500')
    mockFetch(() => jsonResponse({ data: 'x' }))
    await expect(mod.fetchAllModels()).rejects.toThrow('Unexpected')
  })

  it('groups Claude first, then OpenAI, then other providers A–Z, with free models last', () => {
    const m = (id: string, free = false) => ({ id, label: id, ctx: '8k', priceIn: free ? 0 : 1, priceOut: free ? 0 : 2, free, created: 1 })
    const groups = groupModels([m('mistralai/m'), m('google/g'), m('openai/o'), m('anthropic/c'), m('qwen/q:free', true)])
    expect(groups.map(g => g.label)).toEqual(['Claude (Anthropic)', 'ChatGPT / OpenAI', 'Google', 'Mistral', 'Free models'])
  })

  it('formats prices', () => {
    const base = { id: 'a/b', label: 'b', ctx: '1k', created: 1 }
    expect(formatModelPrice({ ...base, priceIn: 0, priceOut: 0, free: true })).toBe('free')
    expect(formatModelPrice({ ...base, priceIn: 3, priceOut: 15, free: false })).toBe('$3/$15 per 1M')
    expect(formatModelPrice({ ...base, priceIn: 0.25, priceOut: 1.25, free: false })).toBe('$0.25/$1.25 per 1M')
  })
})

describe('model policy', () => {
  it('reads the deployment allowance and mirrors the proxy rule', async () => {
    vi.resetModules()
    const mod = await import('./openrouter')
    mockFetch(url => { expect(url).toBe('/api/openrouter/allowed'); return jsonResponse({ all: false, extra: ['openai/gpt-y', 7] }) })
    const policy = await mod.fetchModelPolicy()
    expect(policy).toEqual({ all: false, extra: ['openai/gpt-y'] })
    expect(mod.isModelEnabled('qwen/q:free', policy)).toBe(true)
    expect(mod.isModelEnabled('openai/gpt-y', policy)).toBe(true)
    expect(mod.isModelEnabled('anthropic/claude-x', policy)).toBe(false)
    expect(mod.isModelEnabled('anthropic/claude-x', { all: true, extra: [] })).toBe(true)
  })

  it('treats an unreadable policy as unknown and offers everything', async () => {
    vi.resetModules()
    const mod = await import('./openrouter')
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await mod.fetchModelPolicy()).toBeNull()
    mockFetch(() => jsonResponse({ all: 'yes' }))
    expect(await mod.fetchModelPolicy()).toBeNull()
    mockFetch(() => { throw new Error('offline') })
    expect(await mod.fetchModelPolicy()).toBeNull()
    expect(mod.isModelEnabled('anthropic/claude-x', null)).toBe(true)
  })
})

describe('describeAIError', () => {
  it.each([
    [402, '{"error":{"message":"Insufficient credits"}}', /no credits.*free model/],
    [401, 'nope', /rejected the API key/],
    [403, 'nope', /rejected the API key/],
    [403, '{"error":{"message":"Model not allowed on this deployment: only free (:free) models are enabled."}}', /only allows free models/],
    [429, '{}', /rate-limited/],
    [404, '', /no longer offers/],
    [500, 'OPENROUTER_KEY not configured', /OPENROUTER_KEY is not set/],
    [400, '{"error":{"message":"bad param"}}', /OpenRouter error 400: bad param/],
    [502, '<html>', /OpenRouter error 502\./],
  ])('HTTP %s', (status, body, expected) => {
    expect(describeAIError(new OpenRouterError(status, body))).toMatch(expected)
  })

  it('passes through in-stream provider errors and explains network failures generically', () => {
    expect(describeAIError(new Error('Provider returned error'))).toContain('Provider returned error')
    expect(describeAIError(new TypeError('Failed to fetch'))).toMatch(/connection/)
  })

  it('streamAI throws OpenRouterError with the status on HTTP failure', async () => {
    mockFetch(() => jsonResponse({ error: { message: 'x' } }, { status: 402 }))
    await expect(streamAI([{ role: 'user', content: 'hi' }], () => {})).rejects.toMatchObject({ name: 'OpenRouterError', status: 402 })
  })
})

describe('settings per tier', () => {
  const sent = async (model: string) => {
    const fetchMock = mockFetch(() => streamResponse(['data: [DONE]\n\n']))
    await streamAI([], () => {}, undefined, model)
    return JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
  }

  it('a :free model is the free tier, anything else paid', () => {
    expect(tierOf('x/y:free')).toBe('free')
    expect(tierOf('anthropic/claude-x')).toBe('paid')
  })

  it('free models get low reasoning effort and a steadier temperature; paid models room for a full briefing', async () => {
    expect(await sent('x/y:free')).toMatchObject({ max_tokens: 4000, temperature: 0.4, reasoning: { effort: 'low' } })
    const paid = await sent('anthropic/claude-x')
    expect(paid).toMatchObject({ max_tokens: 8000, temperature: 0.65 })
    expect(paid.reasoning).toBeUndefined()
    expect(CHAT_PARAMS.paid.max_tokens).toBeLessThanOrEqual(8000) // the proxy's cap
  })
})

describe('streamAIWithFallback', () => {
  const msgs = [{ role: 'user' as const, content: 'hi' }]
  const limited = () => jsonResponse({ error: { message: 'rate limited' } }, { status: 429 })

  it('retries a rate-limited free model once, then moves to the next free model', async () => {
    const seen: string[] = []
    mockFetch((_url, init) => {
      const model = JSON.parse(String(init?.body)).model
      seen.push(model)
      return model === FREE_MODELS[0].id || model === FREE_MODELS[1].id ? limited() : streamResponse([tok('answer'), 'data: [DONE]\n\n'])
    })
    const tokens: string[] = []
    const fallbacks: string[][] = []
    const used = await streamAIWithFallback(msgs, t => tokens.push(t), undefined, FREE_MODELS[0].id, undefined, (a, b) => fallbacks.push([a, b]), 0)
    expect(used).toBe(FREE_MODELS[2].id)
    expect(tokens).toEqual(['answer'])
    expect(seen).toEqual([FREE_MODELS[0].id, FREE_MODELS[0].id, FREE_MODELS[1].id, FREE_MODELS[2].id])
    expect(fallbacks[0]).toEqual([FREE_MODELS[0].id, FREE_MODELS[1].id])
  })

  it('never swaps a paid model for another — one retry, then the error surfaces', async () => {
    const seen: string[] = []
    mockFetch((_url, init) => { seen.push(JSON.parse(String(init?.body)).model); return limited() })
    await expect(streamAIWithFallback(msgs, () => {}, undefined, 'anthropic/claude-x', undefined, undefined, 0)).rejects.toMatchObject({ status: 429 })
    expect(seen).toEqual(['anthropic/claude-x', 'anthropic/claude-x'])
  })

  it('moves a free model OpenRouter no longer offers (404) straight to the next one, and says why', async () => {
    const seen: string[] = []
    mockFetch((_url, init) => {
      const model = JSON.parse(String(init?.body)).model
      seen.push(model)
      return model === FREE_MODELS[0].id ? jsonResponse({ error: { message: 'No endpoints found' } }, { status: 404 }) : streamResponse([tok('ok'), 'data: [DONE]\n\n'])
    })
    const fallbacks: string[][] = []
    const used = await streamAIWithFallback(msgs, () => {}, undefined, FREE_MODELS[0].id, undefined, (a, b, why) => fallbacks.push([a, b, why]), 0)
    expect(used).toBe(FREE_MODELS[1].id)
    expect(seen).toEqual([FREE_MODELS[0].id, FREE_MODELS[1].id])
    expect(fallbacks).toEqual([[FREE_MODELS[0].id, FREE_MODELS[1].id, 'unavailable']])
  })

  it('never swaps a paid model that 404s', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ error: { message: 'gone' } }, { status: 404 }))
    await expect(streamAIWithFallback(msgs, () => {}, undefined, 'anthropic/claude-x', undefined, undefined, 0)).rejects.toMatchObject({ status: 404 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not fall over on non-rate-limit errors', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ error: { message: 'no credits' } }, { status: 402 }))
    await expect(streamAIWithFallback(msgs, () => {}, undefined, FREE_MODELS[0].id, undefined, undefined, 0)).rejects.toMatchObject({ status: 402 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats a 429 delivered inside the stream as a rate limit', async () => {
    let n = 0
    mockFetch(() => n++ === 0
      ? streamResponse([sse({ error: { code: 429, message: 'Provider returned error' } })])
      : streamResponse([tok('ok'), 'data: [DONE]\n\n']))
    const tokens: string[] = []
    await streamAIWithFallback(msgs, t => tokens.push(t), undefined, FREE_MODELS[0].id, undefined, undefined, 0)
    expect(tokens).toEqual(['ok'])
  })

  it('does not restart once text has started streaming', async () => {
    mockFetch(() => streamResponse([tok('partial'), sse({ error: { code: 429, message: 'x' } })]))
    const tokens: string[] = []
    await expect(streamAIWithFallback(msgs, t => tokens.push(t), undefined, FREE_MODELS[0].id, undefined, undefined, 0)).rejects.toMatchObject({ status: 429 })
    expect(tokens).toEqual(['partial'])
  })
})
