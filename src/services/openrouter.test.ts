import { describe, it, expect, vi } from 'vitest'
import { streamAI, buildDashboardContext, FREE_MODELS, DEFAULT_MODEL, QUICK_PROMPTS, groupModels, formatModelPrice } from './openrouter'
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

  it('handles an empty dashboard gracefully', () => {
    const ctx = buildDashboardContext([], [])
    expect(ctx).toContain('Total events: 0')
    expect(ctx).toContain('Most affected countries: none')
    expect(ctx).not.toContain('Top critical events')
    expect(ctx).not.toContain('TRAJECTORY SIGNALS')
  })

  it('includes locally computed trajectory signals when provided', () => {
    const t = (o: Partial<TrajectoryEntry>): TrajectoryEntry => ({
      country: 'Ruritania', recentScore: 10, priorScore: 0, delta: 10, trend: 'rising', velocity: 90,
      recentCount: 1, priorCount: 0, reason: 'because', ...o,
    })
    const ctx = buildDashboardContext([], [], [t({}), t({ country: 'Genovia', trend: 'falling', velocity: 20 })])
    expect(ctx).toContain('TRAJECTORY SIGNALS')
    expect(ctx).toContain('1 of 2 tracked regions trending upward')
    expect(ctx).toContain('Ruritania: RISING (velocity 90/100) — because')
    expect(ctx).toContain('Genovia: FALLING (velocity 20/100)')
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
