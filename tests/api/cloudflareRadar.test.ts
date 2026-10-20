import { describe, it, expect, vi } from 'vitest'
import handler from '../../api/cloudflare-radar'
import { mockReq, mockRes, mockUpstream } from './helpers'

const lastCall = (fetchMock: ReturnType<typeof mockUpstream>) => {
  const [input, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  return { url: new URL(input), headers: new Headers(init?.headers) }
}

describe('Cloudflare Radar proxy', () => {
  it('reports "not configured" (503) without calling upstream when no token is set', async () => {
    vi.stubEnv('CLOUDFLARE_RADAR_TOKEN', '')
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ query: { range: '7d' } }), out.res)
    expect(out.statusCode()).toBe(503)
    expect(out.body()).toMatchObject({ error: { code: 'not_configured' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects ranges outside the allowlist without calling upstream', async () => {
    vi.stubEnv('CLOUDFLARE_RADAR_TOKEN', 'T')
    const fetchMock = mockUpstream()
    for (const range of ['365d', '', '7d&location=US', '../traffic']) {
      const out = mockRes()
      await handler(mockReq({ query: { range } }), out.res)
      expect(out.statusCode()).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls only the outage-annotations route, with the server token as a bearer header', async () => {
    vi.stubEnv('CLOUDFLARE_RADAR_TOKEN', 'SERVER-TOKEN')
    const fetchMock = mockUpstream({ result: { annotations: [] } })
    await handler(mockReq({ query: { range: '14d', location: 'US', token: 'ATTACKER', path: 'radar/http' }, headers: { authorization: 'Bearer ATTACKER' } }), mockRes().res)
    const { url, headers } = lastCall(fetchMock)
    expect(url.origin + url.pathname).toBe('https://api.cloudflare.com/client/v4/radar/annotations/outages')
    expect(Object.fromEntries(url.searchParams)).toEqual({ dateRange: '14d', limit: '200', format: 'json' })
    expect(headers.get('authorization')).toBe('Bearer SERVER-TOKEN')
    expect(url.toString()).not.toContain('ATTACKER')
  })

  it('defaults to a 7-day window', async () => {
    vi.stubEnv('CLOUDFLARE_RADAR_TOKEN', 'T')
    const fetchMock = mockUpstream({ result: { annotations: [] } })
    await handler(mockReq(), mockRes().res)
    expect(lastCall(fetchMock).url.searchParams.get('dateRange')).toBe('7d')
  })

  it('relays upstream status and never echoes the token back', async () => {
    vi.stubEnv('CLOUDFLARE_RADAR_TOKEN', 'SERVER-TOKEN')
    mockUpstream('{"errors":[{"message":"bad token SERVER-TOKEN"}]}', { status: 403 })
    const out = mockRes()
    await handler(mockReq(), out.res)
    expect(out.statusCode()).toBe(403)
    expect(JSON.stringify([out.body(), out.headers()])).not.toContain('SERVER-TOKEN')
  })

  it('returns 502 instead of crashing when upstream is unreachable', async () => {
    vi.stubEnv('CLOUDFLARE_RADAR_TOKEN', 'T')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const out = mockRes()
    await handler(mockReq(), out.res)
    expect(out.statusCode()).toBe(502)
  })
})
