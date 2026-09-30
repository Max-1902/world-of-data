import { describe, it, expect } from 'vitest'
import { fetchOutageEvents, getCountryCentroid, COUNTRY_CENTROIDS } from './outages'
import { mockFetch, jsonResponse } from '../test/helpers'

const alert = (o: Record<string, unknown>) => ({
  entity: { name: 'Testland', type: 'country', code: 'TL' },
  time: 1_700_000_000, level: 'critical', value: 20, historyValue: 100, ...o,
})

describe('fetchOutageEvents', () => {
  it('scores by percent drop below baseline, weighting critical 5x and others 2x', async () => {
    mockFetch(() => jsonResponse({ data: [
      alert({ id: 'a', level: 'critical', value: 20, historyValue: 100 }),                                   // 80% * 5
      alert({ id: 'b', entity: { name: 'X', type: 'country', code: 'XX' }, level: 'warning', value: 50, historyValue: 100 }), // 50% * 2
    ] }))
    const events = await fetchOutageEvents()
    expect(events.map(e => [e.id, e.score])).toEqual([['a', 400], ['b', 100]])
    expect(events[0]).toMatchObject({ entityName: 'Testland', entityCode: 'TL', entityType: 'country', start: 1_700_000_000, overallScore: 100 })
  })

  it('sorts most severe first', async () => {
    mockFetch(() => jsonResponse({ data: [
      alert({ id: 'low',  entity: { name: 'A', type: 'country', code: 'AA' }, level: 'warning',  value: 90, historyValue: 100 }),
      alert({ id: 'high', entity: { name: 'B', type: 'country', code: 'BB' }, level: 'critical', value: 10, historyValue: 100 }),
    ] }))
    const events = await fetchOutageEvents()
    expect(events.map(e => e.id)).toEqual(['high', 'low'])
  })

  it('never yields a negative score when value exceeds baseline, or NaN when baseline is 0', async () => {
    mockFetch(() => jsonResponse({ data: [
      alert({ id: 'up',   entity: { name: 'A', type: 'country', code: 'AA' }, value: 150, historyValue: 100 }),
      alert({ id: 'zero', entity: { name: 'B', type: 'country', code: 'BB' }, value: 0,   historyValue: 0 }),
    ] }))
    const events = await fetchOutageEvents()
    for (const e of events) {
      expect(e.score).toBe(0)
      expect(Number.isNaN(e.score)).toBe(false)
    }
  })

  it('de-duplicates alerts with the same entity code and level', async () => {
    mockFetch(() => jsonResponse({ data: [alert({ id: '1' }), alert({ id: '2' }), alert({ id: '3', level: 'warning' })] }))
    const events = await fetchOutageEvents()
    expect(events).toHaveLength(2)
    expect(events.map(e => e.id).sort()).toEqual(['1', '3'])
  })

  it('tolerates missing fields, generating an id and defaults', async () => {
    mockFetch(() => jsonResponse({ data: [{}] }))
    const [e] = await fetchOutageEvents()
    expect(e).toMatchObject({ id: 'ioda-0', entityName: '—', entityType: 'unknown', entityCode: '', level: 'warning', start: 0 })
  })

  it('returns [] when the payload has no data array', async () => {
    mockFetch(() => jsonResponse({ data: 'nope' }))
    expect(await fetchOutageEvents()).toEqual([])
    mockFetch(() => jsonResponse(null))
    expect(await fetchOutageEvents()).toEqual([])
  })

  it('requests the requested lookback window and throws on HTTP errors', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ data: [] }))
    await fetchOutageEvents(6)
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/v2/outages/alerts')
    expect(Number(url.searchParams.get('until')) - Number(url.searchParams.get('from'))).toBe(6 * 3600)

    mockFetch(() => jsonResponse({}, { status: 502 }))
    await expect(fetchOutageEvents()).rejects.toThrow('IODA HTTP 502')
  })
})

describe('getCountryCentroid', () => {
  it('looks up case-insensitively', () => {
    expect(getCountryCentroid('de')).toEqual(COUNTRY_CENTROIDS.DE)
    expect(getCountryCentroid('DE')).toEqual(COUNTRY_CENTROIDS.DE)
  })
  it('returns null for unknown codes', () => {
    expect(getCountryCentroid('ZZ')).toBeNull()
    expect(getCountryCentroid('')).toBeNull()
  })
  it('stores every centroid as a valid [lng, lat] pair', () => {
    for (const [code, [lng, lat]] of Object.entries(COUNTRY_CENTROIDS)) {
      expect(code, code).toMatch(/^[A-Z]{2}$/)
      expect(lng, `${code} lng`).toBeGreaterThanOrEqual(-180)
      expect(lng, `${code} lng`).toBeLessThanOrEqual(180)
      expect(lat, `${code} lat`).toBeGreaterThanOrEqual(-90)
      expect(lat, `${code} lat`).toBeLessThanOrEqual(90)
    }
  })
})
