import { describe, it, expect } from 'vitest'
import acled from '../../api/acled/[...path]'
import opensky from '../../api/opensky/[...path]'
import { mockReq, mockRes, mockUpstream } from './helpers'

describe.each([
  { name: 'acled', handler: acled, origin: 'https://acleddata.com', base: '/api/acled/' },
  { name: 'opensky', handler: opensky, origin: 'https://opensky-network.org', base: '/api/' },
])('$name pass-through proxy', ({ handler, origin, base }) => {
  const call = async (req: Parameters<typeof handler>[0]) => {
    const fetchMock = mockUpstream({ ok: 1 })
    const out = mockRes()
    await handler(req, out.res)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    return { url: new URL(url), init, out }
  }

  it('forwards path and the original query string', async () => {
    const { url } = await call(mockReq({ query: { path: 'read' }, url: '/api/x/read?limit=5&a=b%20c' }))
    expect(url.origin).toBe(origin)
    expect(url.pathname).toBe(`${base}read`)
    expect(url.search).toBe('?limit=5&a=b%20c')
  })

  it('handles multi-segment paths and requests with no query string', async () => {
    const { url } = await call(mockReq({ query: { path: ['states', 'all'] }, url: '/api/x/states/all' }))
    expect(url.pathname).toBe(`${base}states/all`)
    expect(url.search).toBe('')
  })

  it('supports the "...path" key used by `vercel dev` local mode', async () => {
    const { url } = await call(mockReq({ query: { '...path': 'read' }, url: '/api/x/read' }))
    expect(url.pathname).toBe(`${base}read`)
  })

  it('passes through the caller\'s bearer token and asks for JSON', async () => {
    const { init } = await call(mockReq({ query: { path: 'read' }, headers: { authorization: 'Bearer client-token' } }))
    expect(init.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer client-token' })
  })

  it('sends no Authorization header when the caller has none (never invents credentials)', async () => {
    const { init } = await call(mockReq({ query: { path: 'read' } }))
    expect(init.headers).toEqual({ Accept: 'application/json' })
  })

  it('relays upstream status and body', async () => {
    mockUpstream('rate limited', { status: 429, headers: { 'Content-Type': 'text/plain' } })
    const out = mockRes()
    await handler(mockReq({ query: { path: 'read' }, url: '/api/x/read' }), out.res)
    expect(out.statusCode()).toBe(429)
    expect(out.body()).toBe('rate limited')
    expect(out.headers()['content-type']).toBe('text/plain')
  })
})
