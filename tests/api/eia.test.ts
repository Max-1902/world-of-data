import { describe, it, expect, vi } from 'vitest'
import handler, { EIA_ALLOWED_SERIES } from '../../api/eia'
import { EIA_SERIES } from '../../src/services/eia'
import { mockReq, mockRes, mockUpstream } from './helpers'

const lastUrl = (fetchMock: ReturnType<typeof mockUpstream>) => new URL(String((fetchMock.mock.calls[0] as unknown[])[0]))

describe('EIA proxy', () => {
  it('reports "not configured" (503) without calling upstream when no key is set', async () => {
    vi.stubEnv('EIA_API_KEY', '')
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ query: { series: 'PET.WCESTUS1.W' } }), out.res)
    expect(out.statusCode()).toBe(503)
    expect(out.body()).toMatchObject({ error: { code: 'not_configured' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects series outside the allowlist without calling upstream', async () => {
    vi.stubEnv('EIA_API_KEY', 'K')
    const fetchMock = mockUpstream()
    for (const series of ['PET.SOMETHING.W', '', '../v2/electricity']) {
      const out = mockRes()
      await handler(mockReq({ query: { series } }), out.res)
      expect(out.statusCode()).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls the seriesid route with the server key and nothing else from the client', async () => {
    vi.stubEnv('EIA_API_KEY', 'SERVER-KEY')
    const fetchMock = mockUpstream({ response: { data: [] } })
    await handler(mockReq({ query: { series: 'NG.NW2_EPG0_SWO_R48_BCF.W', api_key: 'ATTACKER-KEY', out: 'xml', length: '99999' } }), mockRes().res)
    const url = lastUrl(fetchMock)
    expect(url.origin + url.pathname).toBe('https://api.eia.gov/v2/seriesid/NG.NW2_EPG0_SWO_R48_BCF.W')
    expect(url.searchParams.getAll('api_key')).toEqual(['SERVER-KEY'])
    expect([...url.searchParams.keys()]).toEqual(['api_key'])
    expect(url.toString()).not.toContain('ATTACKER-KEY')
  })

  it('relays upstream status and never echoes the key back, even if EIA includes it', async () => {
    vi.stubEnv('EIA_API_KEY', 'SERVER-KEY')
    mockUpstream('{"request":{"params":{"api_key":"SERVER-KEY"}},"error":"limit"}', { status: 429 })
    const out = mockRes()
    await handler(mockReq({ query: { series: 'PET.WCESTUS1.W' } }), out.res)
    expect(out.statusCode()).toBe(429)
    expect(JSON.stringify([out.body(), out.headers()])).not.toContain('SERVER-KEY')
  })

  it('allows exactly the series the client service asks for', () => {
    expect([...EIA_ALLOWED_SERIES].sort()).toEqual(EIA_SERIES.map(s => s.id).sort())
  })
})
