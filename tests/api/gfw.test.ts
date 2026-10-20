import { describe, it, expect, vi, afterEach } from 'vitest'
import handler, { GFW_DATASETS, GFW_LIMIT } from '../../api/gfw'
import { GFW_PAGE } from '../../src/services/gfw'
import { mockReq, mockRes, mockUpstream } from './helpers'

const lastCall = (fetchMock: ReturnType<typeof mockUpstream>) => {
  const [input, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  return { url: new URL(input), headers: new Headers(init?.headers) }
}
afterEach(() => { vi.useRealTimers() })

describe('Global Fishing Watch proxy', () => {
  it('reports "not configured" (503) without calling upstream when no token is set', async () => {
    vi.stubEnv('GFW_TOKEN', '')
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ query: { kind: 'gaps' } }), out.res)
    expect(out.statusCode()).toBe(503)
    expect(out.body()).toMatchObject({ error: { code: 'not_configured' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each<Record<string, string>>([{ kind: 'fishing' }, { kind: '' }, { kind: 'gaps', days: '365' }, { kind: 'gaps', days: '7&limit=99999' }])(
    'rejects %j without calling upstream', async (query) => {
      vi.stubEnv('GFW_TOKEN', 'T')
      const fetchMock = mockUpstream()
      const out = mockRes()
      await handler(mockReq({ query }), out.res)
      expect(out.statusCode()).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    })

  it('asks for one allowlisted dataset over a server-computed window, with the token as a bearer header', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 19, 12) })
    vi.stubEnv('GFW_TOKEN', 'SERVER-TOKEN')
    const fetchMock = mockUpstream({ entries: [] })
    await handler(mockReq({ query: { kind: 'encounters', days: '7', 'datasets[0]': 'private-x', limit: '99999', token: 'ATTACKER' }, headers: { authorization: 'Bearer ATTACKER' } }), mockRes().res)
    const { url, headers } = lastCall(fetchMock)
    expect(url.origin + url.pathname).toBe('https://gateway.api.globalfishingwatch.org/v3/events')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'datasets[0]': GFW_DATASETS.encounters, 'start-date': '2026-10-12', 'end-date': '2026-10-19', limit: String(GFW_LIMIT), offset: '0',
    })
    expect(headers.get('authorization')).toBe('Bearer SERVER-TOKEN')
    expect(url.toString()).not.toContain('ATTACKER')
  })

  it('defaults to 30 days and edge-caches successful responses to protect the quota', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 19, 12) })
    vi.stubEnv('GFW_TOKEN', 'T')
    const fetchMock = mockUpstream({ entries: [] })
    const out = mockRes()
    await handler(mockReq({ query: { kind: 'gaps' } }), out.res)
    expect(lastCall(fetchMock).url.searchParams.get('start-date')).toBe('2026-09-19')
    expect(lastCall(fetchMock).url.searchParams.get('datasets[0]')).toBe(GFW_DATASETS.gaps)
    expect(out.headers()['cache-control']).toContain('s-maxage=3600')
  })

  it('relays upstream errors uncached and never echoes the token back', async () => {
    vi.stubEnv('GFW_TOKEN', 'SERVER-TOKEN')
    mockUpstream('{"message":"invalid token SERVER-TOKEN"}', { status: 401 })
    const out = mockRes()
    await handler(mockReq({ query: { kind: 'gaps' } }), out.res)
    expect(out.statusCode()).toBe(401)
    expect(out.headers()['cache-control']).toBeUndefined()
    expect(JSON.stringify([out.body(), out.headers()])).not.toContain('SERVER-TOKEN')
  })

  it('returns 502 instead of crashing when upstream is unreachable', async () => {
    vi.stubEnv('GFW_TOKEN', 'T')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const out = mockRes()
    await handler(mockReq({ query: { kind: 'gaps' } }), out.res)
    expect(out.statusCode()).toBe(502)
  })

  it('uses the page size the client service expects', () => {
    expect(GFW_LIMIT).toBe(GFW_PAGE)
  })
})
