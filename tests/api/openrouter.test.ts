import { describe, it, expect, vi } from 'vitest'
import { beforeEach } from 'vitest'
import handler, { config, isModelAllowed, resetRateLimit, RATE_LIMIT, MAX_BODY_BYTES, MAX_TOKENS_CAP } from '../../api/openrouter/chat/completions'
import modelsHandler, { config as modelsConfig } from '../../api/openrouter/models'

function upstreamStub(body: BodyInit | null = 'data: [DONE]\n\n', init: ResponseInit = {}) {
  const fn = vi.fn(async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init }))
  vi.stubGlobal('fetch', fn)
  return fn
}
const req = (body = '{"model":"m:free","messages":[{"role":"user","content":"hi"}]}', headers: Record<string, string> = {}) =>
  new Request('https://app.example/api/openrouter/chat/completions', { method: 'POST', body, headers })

describe('openrouter edge proxy', () => {
  beforeEach(() => { resetRateLimit(); vi.stubEnv('OPENROUTER_ALLOWED_MODELS', '') })

  it('runs on the edge runtime so SSE streams are not buffered', () => {
    expect(config).toEqual({ runtime: 'edge' })
  })

  it('fails closed with 500 when the key is missing, without calling upstream', async () => {
    vi.stubEnv('OPENROUTER_KEY', '')
    const fetchMock = upstreamStub()
    const res = await handler(req())
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('not configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards a rebuilt body with the server-side bearer key', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'sk-server')
    const fetchMock = upstreamStub()
    const payload = '{"model":"liquid/lfm:free","messages":[{"role":"user","content":"hi"}],"stream":true,"temperature":0.65,"max_tokens":4000}'
    await handler(req(payload))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(JSON.parse(payload))
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-server')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('rejects paid models with 403 and never calls upstream', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    const fetchMock = upstreamStub()
    const res = await handler(req('{"model":"anthropic/claude-opus-4","messages":[{"role":"user","content":"hi"}]}'))
    expect(res.status).toBe(403)
    expect(await res.text()).toMatch(/not allowed on this deployment/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows extra models only when listed in OPENROUTER_ALLOWED_MODELS', () => {
    expect(isModelAllowed('x/y:free', '')).toBe(true)
    expect(isModelAllowed('openai/gpt-5', '')).toBe(false)
    expect(isModelAllowed('openai/gpt-5', 'anthropic/claude-sonnet-4, openai/gpt-5')).toBe(true)
    expect(isModelAllowed('openai/gpt-5-pro', 'openai/gpt-5')).toBe(false)
    expect(isModelAllowed('anything/at-all', '*')).toBe(true)
  })

  it('strips fields that could route to paid endpoints and caps max_tokens', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    const fetchMock = upstreamStub()
    await handler(req(JSON.stringify({
      model: 'x/y:free',
      models: ['anthropic/claude-opus-4'], route: 'fallback',
      plugins: [{ id: 'web' }], provider: { order: ['openai'] },
      messages: [{ role: 'user', content: 'hi', extra: 1 }],
      max_tokens: 1_000_000, temperature: 9,
    })))
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(Object.keys(sent).sort()).toEqual(['max_tokens', 'messages', 'model', 'stream', 'temperature'])
    expect(sent.max_tokens).toBe(MAX_TOKENS_CAP)
    expect(sent.temperature).toBe(2)
    expect(sent.messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it.each([
    ['not json', 400],
    ['{"messages":[{"role":"user","content":"hi"}]}', 400],
    ['{"model":"x:free","messages":[]}', 400],
    ['{"model":"x:free","messages":[{"role":"tool","content":"hi"}]}', 400],
    ['{"model":"x:free","messages":[{"role":"user","content":{"a":1}}]}', 400],
  ])('rejects malformed body %s', async (body, status) => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    const fetchMock = upstreamStub()
    expect((await handler(req(body))).status).toBe(status)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects oversized bodies with 413', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    const fetchMock = upstreamStub()
    const big = JSON.stringify({ model: 'x:free', messages: [{ role: 'user', content: 'a'.repeat(MAX_BODY_BYTES) }] })
    expect((await handler(req(big))).status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects non-POST methods', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    const res = await handler(new Request('https://app.example/api/openrouter/chat/completions'))
    expect(res.status).toBe(405)
  })

  it('rate-limits a single IP after RATE_LIMIT requests per window', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    const fetchMock = upstreamStub()
    const from = (ip: string) => req(undefined, { 'x-forwarded-for': ip })
    for (let i = 0; i < RATE_LIMIT; i++) expect((await handler(from('1.2.3.4'))).status).toBe(200)
    expect((await handler(from('1.2.3.4'))).status).toBe(429)
    expect((await handler(from('5.6.7.8'))).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(RATE_LIMIT + 1)
  })

  it('ignores any Authorization header supplied by the browser', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'sk-server')
    const fetchMock = upstreamStub()
    await handler(req(undefined, { Authorization: 'Bearer attacker' }))
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.stringify(init.headers)).not.toContain('attacker')
  })

  it('attributes requests to the caller origin, with a fallback', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    const fetchMock = upstreamStub()
    await handler(req(undefined, { origin: 'https://my.site' }))
    await handler(req())
    const h = (i: number) => (fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].headers as Record<string, string>
    expect(h(0)['HTTP-Referer']).toBe('https://my.site')
    expect(h(1)['HTTP-Referer']).toMatch(/^https:\/\//)
    expect(h(0)['X-Title']).toBe('Mundus Datorum')
  })

  it('streams the upstream body straight through with its status', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    upstreamStub('data: {"choices":[]}\n\ndata: [DONE]\n\n', { status: 200 })
    const res = await handler(req())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')
    expect(await res.text()).toContain('[DONE]')
  })

  it('relays upstream errors (e.g. 429) with their status', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'k')
    upstreamStub('{"error":"rate"}', { status: 429, headers: { 'Content-Type': 'application/json' } })
    const res = await handler(req())
    expect(res.status).toBe(429)
    expect(res.headers.get('content-type')).toBe('application/json')
  })

  it('never includes the key in the response', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'sk-super-secret')
    upstreamStub('data: hi\n\n')
    const res = await handler(req())
    expect(await res.text()).not.toContain('sk-super-secret')
    let headerText = ''
    res.headers.forEach((v, k) => { headerText += `${k}:${v};` })
    expect(headerText).not.toContain('sk-super-secret')
  })
})

describe('openrouter models proxy', () => {
  it('is an edge function that fetches the public catalogue without any key', async () => {
    expect(modelsConfig).toEqual({ runtime: 'edge' })
    vi.stubEnv('OPENROUTER_KEY', 'sk-server')
    const fn = vi.fn(async () => new Response('{"data":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fn)
    const res = await modelsHandler()
    expect(await res.text()).toBe('{"data":[]}')
    const calls = fn.mock.calls as unknown as [string, RequestInit | undefined][]
    expect(calls[0][0]).toBe('https://openrouter.ai/api/v1/models')
    expect(JSON.stringify(calls[0][1] ?? {})).not.toContain('sk-server')
  })
})
