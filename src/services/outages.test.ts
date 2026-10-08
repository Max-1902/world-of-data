import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse } from '../test/helpers'

type Mod = typeof import('./outages')
let m: Mod
beforeEach(async () => { vi.resetModules(); m = await import('./outages') })   // region points are cached per module

const alert = (o: Record<string, unknown>) => ({
  entity: { name: 'Testland', type: 'country', code: 'DE' }, datasource: 'bgp',
  time: 1_700_000_000, level: 'critical', value: 20, historyValue: 100, ...o,
})
const region = (code: string, cc = 'CM') => ({ name: 'Nord', type: 'region', code, attrs: { country_code: cc } })
const REGIONS = { '684': [13.908, 8.462, 'Nord', 'CM'] as [number, number, string, string] }

/** Serves the IODA alert payload and the static region file. */
function serve(data: unknown, regions: unknown = { regions: REGIONS }) {
  return mockFetch((url: string) => String(url).startsWith('/data/') ? jsonResponse(regions) : jsonResponse({ data }))
}

describe('foldOutageAlerts', () => {
  it('folds an entity\'s alert stream into one event, ongoing while any signal is still critical', () => {
    const [e] = m.foldOutageAlerts([
      alert({ time: 1, datasource: 'bgp', value: 40, historyValue: 100 }),
      alert({ time: 2, datasource: 'ping-slash24', value: 10, historyValue: 100 }),
      alert({ time: 3, datasource: 'bgp', level: 'normal', value: 100, historyValue: 100 }),
    ])
    expect(e).toMatchObject({ id: 'country:DE', status: 'ongoing', level: 'critical', dropPct: 90, severity: 'severe', start: 1, lastAlert: 3 })
    expect(e.signals.map(s => [s.source, s.level])).toEqual([['ping-slash24', 'critical'], ['bgp', 'normal']])
  })

  it('marks an entity recovered once every signal is back to normal, keeping the worst drop seen', () => {
    const [e] = m.foldOutageAlerts([alert({ time: 1, value: 70 }), alert({ time: 5, level: 'normal', value: 100 })])
    expect(e).toMatchObject({ status: 'recovered', level: 'normal', dropPct: 30, severity: 'major', lastAlert: 5 })
  })

  it('drops entities that only have recovery notices (their outage began before the window)', () => {
    expect(m.foldOutageAlerts([alert({ level: 'normal' })])).toEqual([])
  })

  it('grades severity by drop: ≥50 severe, 20–49 major, under 20 minor', () => {
    expect([50, 49, 20, 19, 0].map(m.outageSeverity)).toEqual(['severe', 'major', 'major', 'minor', 'minor'])
  })

  it('never yields a negative or NaN drop when value exceeds baseline or baseline is 0', () => {
    const out = m.foldOutageAlerts([
      alert({ entity: { type: 'country', code: 'AA' }, value: 150, historyValue: 100 }),
      alert({ entity: { type: 'country', code: 'BB' }, value: 0, historyValue: 0 }),
    ])
    for (const e of out) expect(e.dropPct).toBe(0)
  })

  it('sorts ongoing before recovered, then deepest drop first', () => {
    const out = m.foldOutageAlerts([
      alert({ entity: { type: 'country', code: 'AA' }, value: 90 }),
      alert({ entity: { type: 'country', code: 'BB' }, value: 10 }),
      alert({ entity: { type: 'country', code: 'CC' }, value: 0 }), alert({ entity: { type: 'country', code: 'CC' }, time: 1_700_000_100, level: 'normal' }),
    ])
    expect(out.map(e => e.entityCode)).toEqual(['BB', 'AA', 'CC'])
  })

  it('places regions on their region point, network-in-region on the region, countries on the country, plain networks nowhere', () => {
    const out = m.foldOutageAlerts([
      alert({ entity: region('684') }),
      alert({ entity: { name: 'X -- Nord', type: 'geoasn', code: '1234-684', attrs: { org: 'Telco' } } }),
      alert({ entity: { name: 'Y -- Canada', type: 'geoasn', code: '36522-CA' } }),
      alert({ entity: { name: 'AS1', type: 'asn', code: '1' } }),
      alert({ entity: region('9999', 'CM') }),   // unknown region → country fallback
    ], REGIONS)
    const loc = Object.fromEntries(out.map(e => [e.id, e.location]))
    expect(loc['region:684']).toEqual({ lng: 13.908, lat: 8.462, precision: 'region', label: 'Nord, CM' })
    expect(loc['geoasn:1234-684']).toMatchObject({ precision: 'region', label: 'Nord, CM' })
    expect(loc['geoasn:36522-CA']).toMatchObject({ precision: 'country', label: 'CA' })
    expect(loc['asn:1']).toBeNull()
    expect(loc['region:9999']).toMatchObject({ precision: 'country', label: 'CM' })
    expect(out.find(e => e.id === 'geoasn:1234-684')?.org).toBe('Telco')
  })

  it('tolerates junk entries and missing fields', () => {
    const out = m.foldOutageAlerts([null, 7, 'x', { level: 'critical' }])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ entityName: '—', entityType: 'unknown', entityCode: '', location: null })
  })
})

describe('fetchOutageEvents', () => {
  it('requests the look-back window with a limit large enough for a full day of alerts', async () => {
    const f = serve([])
    await m.fetchOutageEvents(6)
    const url = new URL(String(f.mock.calls.find(c => String(c[0]).startsWith('https://'))![0]))
    expect(url.pathname).toBe('/v2/outages/alerts')
    expect(Number(url.searchParams.get('until')) - Number(url.searchParams.get('from'))).toBe(6 * 3600)
    expect(Number(url.searchParams.get('limit'))).toBeGreaterThanOrEqual(5000)
  })

  it('places region alerts with the static region file', async () => {
    serve([alert({ entity: region('684') })])
    const [e] = await m.fetchOutageEvents()
    expect(e.location).toMatchObject({ precision: 'region', lng: 13.908 })
  })

  it('falls back to the country when the region file cannot be loaded', async () => {
    mockFetch((url: string) => String(url).startsWith('/data/') ? jsonResponse({}, { status: 404 }) : jsonResponse({ data: [alert({ entity: region('684') })] }))
    const [e] = await m.fetchOutageEvents()
    expect(e.location).toMatchObject({ precision: 'country', label: 'CM' })
  })

  it('returns [] when the payload has no data array', async () => {
    serve('nope')
    expect(await m.fetchOutageEvents()).toEqual([])
  })

  it('throws on HTTP errors', async () => {
    mockFetch((url: string) => String(url).startsWith('/data/') ? jsonResponse({ regions: REGIONS }) : jsonResponse({}, { status: 502 }))
    await expect(m.fetchOutageEvents()).rejects.toThrow('IODA HTTP 502')
  })
})

describe('getCountryCentroid', () => {
  it('looks up case-insensitively', () => {
    expect(m.getCountryCentroid('de')).toEqual(m.COUNTRY_CENTROIDS.DE)
    expect(m.getCountryCentroid('DE')).toEqual(m.COUNTRY_CENTROIDS.DE)
  })
  it('returns null for unknown codes', () => {
    expect(m.getCountryCentroid('ZZ')).toBeNull()
    expect(m.getCountryCentroid('')).toBeNull()
  })
  it('stores every centroid as a valid [lng, lat] pair', () => {
    for (const [code, [lng, lat]] of Object.entries(m.COUNTRY_CENTROIDS)) {
      expect(code, code).toMatch(/^[A-Z]{2}$/)
      expect(lng, `${code} lng`).toBeGreaterThanOrEqual(-180)
      expect(lng, `${code} lng`).toBeLessThanOrEqual(180)
      expect(lat, `${code} lat`).toBeGreaterThanOrEqual(-90)
      expect(lat, `${code} lat`).toBeLessThanOrEqual(90)
    }
  })
})
