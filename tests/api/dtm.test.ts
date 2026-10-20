import { describe, it, expect, vi } from 'vitest'
import handler from '../../api/dtm'
import { mockReq, mockRes, mockUpstream } from './helpers'

const lastCall = (fetchMock: ReturnType<typeof mockUpstream>) => fetchMock.mock.calls[0] as unknown as [string, RequestInit]

describe('IOM DTM proxy', () => {
  it('reports "not configured" (503) without calling upstream when no key is set', async () => {
    vi.stubEnv('DTM_API_KEY', '')
    const fetchMock = mockUpstream()
    const out = mockRes()
    await handler(mockReq({ query: { level: 'admin0', iso3: 'SDN' } }), out.res)
    expect(out.statusCode()).toBe(503)
    expect(out.body()).toMatchObject({ error: { code: 'not_configured' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects unknown levels and non-ISO3 countries without calling upstream', async () => {
    vi.stubEnv('DTM_API_KEY', 'K')
    const fetchMock = mockUpstream()
    const cases: Record<string, string>[] = [{ level: 'admin2', iso3: 'SDN' }, { level: '../hna', iso3: 'SDN' }, { level: 'admin0', iso3: 'sdn' }, { level: 'admin0', iso3: 'SDN&x=1' }, { level: 'admin0' }]
    for (const query of cases) {
      const out = mockRes()
      await handler(mockReq({ query }), out.res)
      expect(out.statusCode()).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the server key as a header and forwards nothing else from the client', async () => {
    vi.stubEnv('DTM_API_KEY', 'SERVER-KEY')
    const fetchMock = mockUpstream({ response: { isSuccess: true, result: [] } })
    await handler(mockReq({ query: { level: 'admin1', iso3: 'SDN', 'Ocp-Apim-Subscription-Key': 'ATTACKER-KEY', Operation: 'x', FromReportingDate: '1990-01-01' } }), mockRes().res)
    const [rawUrl, init] = lastCall(fetchMock)
    const url = new URL(rawUrl)
    expect(url.origin + url.pathname).toBe('https://dtmapi.iom.int/v3/displacement/admin1')
    expect([...url.searchParams.keys()]).toEqual(['Admin0Pcode', 'FromReportingDate'])
    expect(url.searchParams.get('Admin0Pcode')).toBe('SDN')
    expect(url.searchParams.get('FromReportingDate')).not.toBe('1990-01-01')
    expect((init.headers as Record<string, string>)['Ocp-Apim-Subscription-Key']).toBe('SERVER-KEY')
    expect(rawUrl + JSON.stringify(init)).not.toContain('ATTACKER-KEY')
  })

  it('relays upstream status and never echoes the key back', async () => {
    vi.stubEnv('DTM_API_KEY', 'SERVER-KEY')
    mockUpstream('{"isSuccess":false,"errorMessages":["key SERVER-KEY over quota"]}', { status: 429 })
    const out = mockRes()
    await handler(mockReq({ query: { level: 'admin0', iso3: 'SDN' } }), out.res)
    expect(out.statusCode()).toBe(429)
    expect(JSON.stringify([out.body(), out.headers()])).not.toContain('SERVER-KEY')
  })
})
