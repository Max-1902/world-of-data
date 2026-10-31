import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler, { parseWeo, resetCache } from '../../api/imf-weo'
import { mockReq, mockRes } from './helpers'

const DATA = { values: { NGDP_RPCH: { DEU: { '2025': 0.2, '2026': 1.3, x: 5 }, USA: { '2026': 2.3, '2027': null }, WEOWORLD: { '2026': 3, '2027': null }, EU: { '2026': 1 }, ADVEC: { x: 1 } } } }
const META = { indicators: { NGDP_RPCH: { label: 'Real GDP growth', unit: 'Annual percent change', source: 'World Economic Outlook (October 2026)', 'last-modified': '2026-10-08 14:43:32' } } }

describe('parseWeo', () => {
  it('keeps countries, numeric years only, and the stated edition', () => {
    const p = parseWeo('NGDP_RPCH', DATA, META)
    expect(p.values).toEqual({ DEU: { '2025': 0.2, '2026': 1.3 }, USA: { '2026': 2.3 } })
  })
  it('keeps the allowlisted IMF aggregates apart from countries, and drops every other group', () => {
    const p = parseWeo('NGDP_RPCH', DATA, META)
    expect(p.groups).toEqual({ WEOWORLD: { '2026': 3 } })   // EU is not allowlisted; ADVEC has no numeric year
    expect(p.vintage).toBe('World Economic Outlook (October 2026)')
    expect(p.lastModified).toBe('2026-10-08 14:43:32')
  })
  it('says when the edition is not stated, and rejects an unexpected shape', () => {
    expect(parseWeo('NGDP_RPCH', DATA, {}).vintage).toContain('not stated')
    expect(() => parseWeo('NGDP_RPCH', { values: {} }, META)).toThrow('Unexpected IMF response shape')
  })
})

describe('GET /api/imf-weo', () => {
  beforeEach(() => resetCache())
  afterEach(() => vi.unstubAllGlobals())
  const upstream = () => {
    const fn = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/indicators') ? META : DATA), { status: 200 }))
    vi.stubGlobal('fetch', fn)
    return fn
  }

  it('fetches only the fixed IMF host for an allowlisted indicator, and caches it', async () => {
    const fn = upstream()
    const r = mockRes()
    await handler(mockReq({ query: { indicator: 'NGDP_RPCH', url: 'https://evil.example' } }), r.res)
    expect(r.statusCode()).toBe(200)
    expect((r.body() as { vintage: string }).vintage).toContain('October 2026')
    for (const [url] of fn.mock.calls as unknown as [string][]) expect(url).toMatch(/^https:\/\/www\.imf\.org\/external\/datamapper\/api\/v1\/(NGDP_RPCH|indicators)$/)
    await handler(mockReq({ query: { indicator: 'NGDP_RPCH' } }), mockRes().res)
    expect(fn).toHaveBeenCalledTimes(2)   // data + metadata once, then memory
    expect(r.headers()['cache-control']).toContain('s-maxage=21600')
  })
  it('400s on any indicator outside the allowlist without calling upstream', async () => {
    const fn = upstream()
    const r = mockRes()
    await handler(mockReq({ query: { indicator: '../NGDP_RPCH' } }), r.res)
    expect(r.statusCode()).toBe(400)
    expect(fn).not.toHaveBeenCalled()
  })
  it('502s on upstream errors and network failure, and 405s non-GET', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    let r = mockRes(); await handler(mockReq({ query: { indicator: 'LUR' } }), r.res)
    expect(r.statusCode()).toBe(502)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    r = mockRes(); await handler(mockReq({ query: { indicator: 'LUR' } }), r.res)
    expect(r.statusCode()).toBe(502)
    r = mockRes(); await handler(mockReq({ method: 'POST', query: { indicator: 'LUR' } }), r.res)
    expect(r.statusCode()).toBe(405)
  })
})
