import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse } from '../test/helpers'

type Mod = typeof import('./radarOutages')
let m: Mod
beforeEach(async () => { vi.resetModules(); m = await import('./radarOutages') })   // results are cached per module

const annotation = (o: Record<string, unknown> = {}) => ({
  id: 'a1', dataSource: 'ALL', description: 'Shutdown ordered during protests', scope: 'Tehran',
  startDate: '2026-10-18T06:00:00Z', endDate: null, linkedUrl: 'https://x.com/CloudflareRadar/status/1',
  locations: ['IR'], locationsDetails: [{ code: 'IR', name: 'Iran' }],
  asns: [58224], asnsDetails: [{ asn: '58224', name: 'TCI', location: { code: 'IR', name: 'Iran' } }],
  outage: { outageCause: 'GOVERNMENT_DIRECTED', outageType: 'REGIONAL' }, ...o,
})
const payload = (rows: unknown[]) => ({ success: true, result: { annotations: rows } })

describe('parseRadarOutages', () => {
  it('normalises an annotation: cause, type, countries, networks, times and link', () => {
    const [o] = m.parseRadarOutages(payload([annotation()]))!
    expect(o).toEqual({
      id: 'a1', cause: 'GOVERNMENT_DIRECTED', type: 'REGIONAL', scope: 'Tehran',
      countries: [{ code: 'IR', name: 'Iran' }], asns: [{ asn: 58224, name: 'TCI' }],
      start: Date.parse('2026-10-18T06:00:00Z'), end: null,
      description: 'Shutdown ordered during protests', linkedUrl: 'https://x.com/CloudflareRadar/status/1',
    })
  })

  it('lists open outages first, then the most recent', () => {
    const rows = m.parseRadarOutages(payload([
      annotation({ id: 'old-closed', startDate: '2026-10-01T00:00:00Z', endDate: '2026-10-02T00:00:00Z' }),
      annotation({ id: 'new-closed', startDate: '2026-10-10T00:00:00Z', endDate: '2026-10-11T00:00:00Z' }),
      annotation({ id: 'open', startDate: '2026-09-30T00:00:00Z' }),
    ]))!
    expect(rows.map(r => r.id)).toEqual(['open', 'new-closed', 'old-closed'])
  })

  it('tolerates partial entries and drops ones without an id or a start date', () => {
    const rows = m.parseRadarOutages(payload([
      { id: 'bare', startDate: '2026-10-18T00:00:00Z', locations: ['sd'] },
      { id: 'no-start' }, { startDate: '2026-10-18T00:00:00Z' }, null, 'junk',
      annotation({ id: 'bad-link', linkedUrl: 'javascript:alert(1)', asnsDetails: [{ asn: 'x' }] }),
    ]))!
    expect(rows.map(r => r.id).sort()).toEqual(['bad-link', 'bare'])
    const bare = rows.find(r => r.id === 'bare')!
    expect(bare).toMatchObject({ cause: 'UNKNOWN', type: '', countries: [{ code: 'SD', name: 'SD' }], asns: [], end: null, linkedUrl: '' })
    expect(rows.find(r => r.id === 'bad-link')).toMatchObject({ linkedUrl: '', asns: [] })
  })

  it('returns null for a payload with no annotations array', () => {
    expect(m.parseRadarOutages({ result: {} })).toBeNull()
    expect(m.parseRadarOutages(null)).toBeNull()
  })

  it('labels known causes and turns unknown enum values into words', () => {
    expect(m.radarCauseLabel('CABLE_CUT')).toBe('Cable cut')
    expect(m.radarCauseLabel('SOLAR_FLARE')).toBe('Solar flare')
  })
})

describe('fetchRadarOutages', () => {
  it('asks the proxy for the range and returns the outages', async () => {
    const f = mockFetch(() => jsonResponse(payload([annotation()])))
    const r = await m.fetchRadarOutages('14d')
    expect(String(f.mock.calls[0][0])).toBe('/api/cloudflare-radar?range=14d')
    expect(r).toMatchObject({ status: 'ok', outages: [{ id: 'a1' }] })
  })

  it('caches a good result per range', async () => {
    const f = mockFetch(() => jsonResponse(payload([])))
    await m.fetchRadarOutages('7d'); await m.fetchRadarOutages('7d')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('reports "not configured" distinctly, and does not cache it', async () => {
    const f = mockFetch(() => jsonResponse({ error: { code: 'not_configured' } }, { status: 503 }))
    expect(await m.fetchRadarOutages()).toEqual({ status: 'not_configured' })
    await m.fetchRadarOutages()
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('reports HTTP errors with Cloudflare\'s message', async () => {
    mockFetch(() => jsonResponse({ success: false, errors: [{ message: 'Authentication error' }] }, { status: 403 }))
    expect(await m.fetchRadarOutages()).toEqual({ status: 'error', message: 'Cloudflare Radar returned HTTP 403: Authentication error' })
  })

  it('reports a malformed payload as an error, not as zero outages', async () => {
    mockFetch(() => jsonResponse({ result: null }))
    expect(await m.fetchRadarOutages()).toMatchObject({ status: 'error' })
  })

  it('reports a network failure as an error', async () => {
    mockFetch(() => { throw new Error('offline') })
    expect(await m.fetchRadarOutages()).toEqual({ status: 'error', message: 'Cloudflare Radar could not be reached.' })
  })
})
