import { describe, it, expect, vi } from 'vitest'
import handler, { config } from '../../api/openrouter/chat/completions'
import modelsHandler, { config as modelsConfig } from '../../api/openrouter/models'

function upstreamStub(body: BodyInit | null = 'data: [DONE]\n\n', init: ResponseInit = {}) {
  const fn = vi.fn(async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init }))
  vi.stubGlobal('fetch', fn)
  return fn
}
const req = (body = '{"model":"m","messages":[]}', headers: Record<string, string> = {}) =>
  new Request('https://app.example/api/openrouter/chat/completions', { method: 'POST', body, headers })

describe('openrouter edge proxy', () => {
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

  it('forwards the body verbatim with the server-side bearer key', async () => {
    vi.stubEnv('OPENROUTER_KEY', 'sk-server')
    const fetchMock = upstreamStub()
    const payload = '{"model":"liquid/lfm:free","messages":[{"role":"user","content":"hi"}],"stream":true}'
    await handler(req(payload))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(payload)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-server')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
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
