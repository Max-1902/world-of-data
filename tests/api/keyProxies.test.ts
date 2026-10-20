import { describe, it, expect, vi } from 'vitest'
import finnhub from '../../api/finnhub/[...path]'
import nyt from '../../api/nyt'
import { mockReq, mockRes, mockUpstream } from './helpers'

const lastUrl = (fetchMock: ReturnType<typeof mockUpstream>) => new URL(String((fetchMock.mock.calls[0] as unknown[])[0]))

describe.each([
  { name: 'finnhub', handler: finnhub, env: 'FINNHUB_KEY', keyParam: 'token', origin: 'https://finnhub.io', base: '/api/v1/', empty: {} },
])('$name proxy', ({ handler, env, keyParam, origin, base, empty }) => {
  it('returns an empty payload without calling upstream when no key is configured', async () => {
    vi.stubEnv(env, '')
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ query: { path: 'quote' } }), out.res)
    expect(out.statusCode()).toBe(200)
    expect(out.body()).toEqual(empty)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('injects the server-side key and forwards the path and query', async () => {
    vi.stubEnv(env, 'SERVER-KEY')
    const fetchMock = mockUpstream({ ok: true })
    const out = mockRes()
    await handler(mockReq({ query: { path: 'quote', symbol: 'SPY', q: 'a b' } }), out.res)
    const url = lastUrl(fetchMock)
    expect(url.origin).toBe(origin)
    expect(url.pathname).toBe(`${base}quote`)
    expect(url.searchParams.get(keyParam)).toBe('SERVER-KEY')
    expect(url.searchParams.get('symbol')).toBe('SPY')
    expect(url.searchParams.get('q')).toBe('a b')
    expect(url.searchParams.has('path')).toBe(false)
  })

  it.each(['search', 'stock/candle', 'x', '../../anything', ''])('refuses the path %j, which the app never calls', async (path) => {
    vi.stubEnv(env, 'K')
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ query: { path: path.split('/') } }), out.res)
    expect(out.statusCode()).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 502 instead of crashing when upstream is unreachable', async () => {
    vi.stubEnv(env, 'K')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const out = mockRes()
    await handler(mockReq({ query: { path: 'quote' } }), out.res)
    expect(out.statusCode()).toBe(502)
  })

  it('supports the "...path" key used by `vercel dev` local mode', async () => {
    vi.stubEnv(env, 'K')
    const fetchMock = mockUpstream()
    await handler(mockReq({ query: { '...path': 'quote', symbol: 'X' } }), mockRes().res)
    const url = lastUrl(fetchMock)
    expect(url.pathname).toBe(`${base}quote`)
    expect(url.searchParams.has('...path')).toBe(false)
  })

  it('does not let a client-supplied key parameter override the server key', async () => {
    vi.stubEnv(env, 'SERVER-KEY')
    const fetchMock = mockUpstream()
    await handler(mockReq({ query: { path: 'quote', [keyParam]: 'ATTACKER-KEY' } }), mockRes().res)
    const url = lastUrl(fetchMock)
    expect(url.searchParams.getAll(keyParam)).toEqual(['SERVER-KEY'])
    expect(url.toString()).not.toContain('ATTACKER-KEY')
  })

  it('relays upstream status and content-type, and does not echo the key back', async () => {
    vi.stubEnv(env, 'SERVER-KEY')
    mockUpstream('{"error":"limit"}', { status: 429, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
    const out = mockRes()
    await handler(mockReq({ query: { path: 'quote' } }), out.res)
    expect(out.statusCode()).toBe(429)
    expect(out.headers()['content-type']).toBe('application/json; charset=utf-8')
    expect(out.body()).toBe('{"error":"limit"}')
    expect(JSON.stringify([out.body(), out.headers()])).not.toContain('SERVER-KEY')
  })

  it('defaults the content type to JSON when upstream sends none', async () => {
    vi.stubEnv(env, 'K')
    vi.stubGlobal('fetch', vi.fn(async () => { const r = new Response('{}'); r.headers.delete('content-type'); return r }))
    const out = mockRes()
    await handler(mockReq({ query: { path: 'quote' } }), out.res)
    expect(out.headers()['content-type']).toBe('application/json')
  })
})

describe('nyt proxy', () => {
  it('returns empty docs without calling upstream when no key is configured', async () => {
    vi.stubEnv('NYT_KEY', '')
    const fetchMock = mockUpstream()
    const out = mockRes()
    await nyt(mockReq({ query: { q: 'war' } }), out.res)
    expect(out.body()).toEqual({ response: { docs: [] } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards the query with the server key to the Article Search endpoint', async () => {
    vi.stubEnv('NYT_KEY', 'NYT-SERVER')
    const fetchMock = mockUpstream({ response: { docs: [1] } })
    const out = mockRes()
    await nyt(mockReq({ query: { q: 'war', sort: 'newest' } }), out.res)
    const url = lastUrl(fetchMock)
    expect(url.origin + url.pathname).toBe('https://api.nytimes.com/svc/search/v2/articlesearch.json')
    expect(url.searchParams.get('q')).toBe('war')
    expect(url.searchParams.get('api-key')).toBe('NYT-SERVER')
    expect(JSON.parse(String(out.body()))).toEqual({ response: { docs: [1] } })
  })

  it('does not let the client override the api-key', async () => {
    vi.stubEnv('NYT_KEY', 'NYT-SERVER')
    const fetchMock = mockUpstream()
    await nyt(mockReq({ query: { q: 'x', 'api-key': 'ATTACKER' } }), mockRes().res)
    expect(lastUrl(fetchMock).searchParams.getAll('api-key')).toEqual(['NYT-SERVER'])
  })
})
