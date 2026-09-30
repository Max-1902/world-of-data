import { describe, it, expect } from 'vitest'
import { fetchDisasterAlerts, parseDisasterAlerts } from './gdacs'
import { mockFetch, jsonResponse, quietConsole } from '../test/helpers'

const feat = (o: Record<string, unknown> = {}, coords: unknown = [33.6, 0.76], geomType = 'Point') => ({
  geometry: { type: geomType, coordinates: coords },
  properties: {
    eventtype: 'DR', eventid: 1, episodeid: 7, name: 'Drought in X', country: 'X', alertlevel: 'Orange', alertscore: 2,
    fromdate: '2026-05-21T00:00:00', todate: '2026-09-30T00:00:00', url: { report: 'https://www.gdacs.org/report.aspx?eventid=1' },
    ...o,
  },
})

describe('parseDisasterAlerts', () => {
  it('maps a feature, reading GeoJSON [lng, lat] order', () => {
    const [a] = parseDisasterAlerts({ features: [feat()] })
    expect(a).toMatchObject({ id: 'DR-1-7', type: 'DR', alert: 'Orange', latitude: 0.76, longitude: 33.6, country: 'X' })
  })
  it('drops Green alerts, unknown types, non-points, bad and (0,0) coordinates', () => {
    const out = parseDisasterAlerts({ features: [
      feat({ alertlevel: 'Green' }), feat({ eventtype: 'XX' }), feat({}, [1, 1], 'Polygon'),
      feat({}, ['a', 'b']), feat({}, [0, 0]), feat({}, null), feat({ eventid: 9 }),
    ] })
    expect(out.map(a => a.id)).toEqual(['DR-9-7'])
  })
  it('ranks Red before Orange, then by score', () => {
    const out = parseDisasterAlerts({ features: [
      feat({ eventid: 1, alertscore: 3 }), feat({ eventid: 2, alertlevel: 'Red', alertscore: 1 }), feat({ eventid: 3, alertscore: 2 }),
    ] })
    expect(out.map(a => a.id)).toEqual(['DR-2-7', 'DR-1-7', 'DR-3-7'])
  })
  it('only keeps report links that point at gdacs.org', () => {
    const out = parseDisasterAlerts({ features: [feat({ eventid: 1, url: { report: 'https://evil.example/x' } }), feat({ eventid: 2, url: {} })] })
    expect(out.map(a => a.reportUrl)).toEqual(['', ''])
  })
  it('tolerates malformed payloads', () => {
    for (const bad of [null, undefined, {}, { features: 'no' }, []]) expect(parseDisasterAlerts(bad)).toEqual([])
  })
})

describe('fetchDisasterAlerts', () => {
  it('requests all event types over the lookback window', async () => {
    const f = mockFetch(() => jsonResponse({ features: [feat()] }))
    expect(await fetchDisasterAlerts(7)).toHaveLength(1)
    const url = String(f.mock.calls[0][0])
    expect(url).toContain('eventtype=EQ,TC,FL,VO,DR,WF')
    expect(url).toMatch(/fromDate=\d{4}-\d{2}-\d{2}&toDate=\d{4}-\d{2}-\d{2}/)
  })
  it('returns [] on HTTP errors and network failure', async () => {
    quietConsole()
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await fetchDisasterAlerts()).toEqual([])
    mockFetch(() => { throw new Error('offline') })
    expect(await fetchDisasterAlerts()).toEqual([])
  })
})
