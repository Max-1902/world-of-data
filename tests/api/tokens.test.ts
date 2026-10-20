import { describe, it, expect, vi, beforeEach } from 'vitest'
import acledToken from '../../api/acled-token'
import openskyToken from '../../api/opensky-token'
import { mockReq, mockRes, mockUpstream } from './helpers'

const handlers = [
  { name: 'acled-token', handler: acledToken, envs: { ACLED_EMAIL: 'me@example.com', ACLED_PASSWORD: 'p@ss&word' }, upstream: 'https://acleddata.com/oauth/token' },
  { name: 'opensky-token', handler: openskyToken, envs: { OPENSKY_USER: 'client-id', OPENSKY_PASS: 's3cret/+=' }, upstream: 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token' },
]

describe.each(handlers)('$name', ({ handler, envs, upstream }) => {
  beforeEach(() => {
    for (const k of Object.keys(envs)) vi.stubEnv(k, '')
  })

  it.each(['GET', 'PUT', 'DELETE'])('rejects %s with 405 and never calls upstream', async (method) => {
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ method }), out.res)
    expect(out.statusCode()).toBe(405)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a null token (200) when credentials are not configured, without calling upstream', async () => {
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ method: 'POST' }), out.res)
    expect(out.statusCode()).toBe(200)
    expect(out.body()).toEqual({ access_token: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('also treats a half-configured credential pair as unconfigured', async () => {
    const [first] = Object.keys(envs)
    vi.stubEnv(first, 'only-one')
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ method: 'POST' }), out.res)
    expect(out.body()).toEqual({ access_token: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts credentials form-encoded to the provider and relays its status and JSON body', async () => {
    for (const [k, v] of Object.entries(envs)) vi.stubEnv(k, v)
    const fetchMock = mockUpstream({ access_token: 'tok', expires_in: 3600 }, { status: 200 })
    const out = mockRes()
    await handler(mockReq({ method: 'POST' }), out.res)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(upstream)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded')
    const sent = new URLSearchParams(String(init.body))
    for (const v of Object.values(envs)) expect([...sent.values()]).toContain(v) // special chars survive encoding
    expect(out.statusCode()).toBe(200)
    expect(out.body()).toEqual({ access_token: 'tok', expires_in: 3600 })
  })

  it('relays upstream error statuses instead of masking them as success', async () => {
    for (const [k, v] of Object.entries(envs)) vi.stubEnv(k, v)
    mockUpstream({ error: 'invalid_grant' }, { status: 401 })
    const out = mockRes()
    await handler(mockReq({ method: 'POST' }), out.res)
    expect(out.statusCode()).toBe(401)
    expect(out.body()).toEqual({ error: 'invalid_grant' })
  })
})

describe.each(handlers)('$name with a non-JSON reply', ({ handler, envs }) => {
  it('relays the status with a JSON error instead of crashing', async () => {
    for (const [k, v] of Object.entries(envs)) vi.stubEnv(k, v)
    mockUpstream('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })
    const out = mockRes()
    await handler(mockReq({ method: 'POST' }), out.res)
    expect(out.statusCode()).toBe(502)
    expect(out.body()).toEqual({ error: expect.stringContaining('HTTP 502') })
  })
})

describe('token grant types', () => {
  it('acled uses the password grant with the acled client id', async () => {
    vi.stubEnv('ACLED_EMAIL', 'e'); vi.stubEnv('ACLED_PASSWORD', 'p')
    const fetchMock = mockUpstream({})
    await acledToken(mockReq({ method: 'POST' }), mockRes().res)
    const sent = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(Object.fromEntries(sent)).toEqual({ username: 'e', password: 'p', grant_type: 'password', client_id: 'acled', scope: 'authenticated' })
  })

  it('opensky uses the client_credentials grant', async () => {
    vi.stubEnv('OPENSKY_USER', 'id'); vi.stubEnv('OPENSKY_PASS', 'secret')
    const fetchMock = mockUpstream({})
    await openskyToken(mockReq({ method: 'POST' }), mockRes().res)
    const sent = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(Object.fromEntries(sent)).toEqual({ grant_type: 'client_credentials', client_id: 'id', client_secret: 'secret' })
  })
})
