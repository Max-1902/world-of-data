import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse } from '../test/helpers'

type Mod = typeof import('./gfw')
let m: Mod
beforeEach(async () => { vi.resetModules(); m = await import('./gfw') })   // results are cached per module

// Shapes follow GFW's documented encounter example and its API client's Gap model.
const gap = (o: Record<string, unknown> = {}) => ({
  id: 'g1', type: 'gap', start: '2026-10-10T00:00:00.000Z', end: '2026-10-11T06:00:00.000Z',
  position: { lat: -10.5, lon: -80.2 },
  regions: { eez: [], highSeas: ['1'] }, distances: { startDistanceFromShoreKm: 420.4 },
  vessel: { id: 'v1', name: 'SEA STAR', ssvid: '412000000', flag: 'chn', type: 'FISHING' },
  gap: { distanceKm: '312.5', durationHours: 30, offPosition: { lat: -10.1, lon: -80.0 }, onPosition: { lat: -12.0, lon: -81.0 } },
  ...o,
})
const encounter = (o: Record<string, unknown> = {}) => ({
  id: 'e1', type: 'encounter', start: '2017-01-01T00:50:00.000Z', end: '2017-01-01T04:30:00.000Z',
  position: { lat: -17.4783, lon: -130.7285 }, regions: { eez: [], highSeas: ['63203'] },
  distances: { startDistanceFromShoreKm: 602 },
  vessel: { id: 'a', name: 'JINHSIANGFA', ssvid: '416077500' },
  encounter: { vessel: { id: 'b', flag: 'TWN', name: 'SHUNTIANFA168', type: 'carrier', ssvid: '416602000' }, type: 'fishing-carrier', potentialRisk: true },
  ...o,
})
const page = (entries: unknown[], o: Record<string, unknown> = {}) => ({ limit: 1000, offset: 0, nextOffset: entries.length, total: entries.length, entries, ...o })

describe('parseGfwEvents', () => {
  it('places an AIS-off event where the signal stopped and keeps GFW\'s gap measurements', () => {
    const [e] = m.parseGfwEvents(page([gap()]), 'gaps')!
    expect(e).toMatchObject({
      id: 'g1', kind: 'gaps', lat: -10.1, lon: -80.0, durationHours: 30, gapDistanceKm: 312.5,
      onPosition: { lat: -12, lon: -81 }, highSeas: true, distanceFromShoreKm: 420.4,
      vessel: { name: 'SEA STAR', flag: 'CHN', type: 'fishing', ssvid: '412000000' }, other: null, potentialRisk: false,
    })
  })

  it('reads an encounter: both vessels, type, GFW risk flag, and duration from start/end', () => {
    const [e] = m.parseGfwEvents(page([encounter()]), 'encounters')!
    expect(e).toMatchObject({
      kind: 'encounters', lat: -17.4783, lon: -130.7285, encounterType: 'fishing-carrier', potentialRisk: true,
      other: { name: 'SHUNTIANFA168', flag: 'TWN', type: 'carrier' }, gapDistanceKm: null,
    })
    expect(e.durationHours).toBeCloseTo(3.667, 2)
  })

  it('falls back to the event position, and drops entries without an id, times or a usable position', () => {
    const rows = m.parseGfwEvents(page([
      gap({ id: 'fallback', gap: { durationHours: 13 } }),
      gap({ id: '' }), gap({ id: 'no-start', start: 'nope' }),
      gap({ id: 'null-island', position: { lat: 0, lon: 0 }, gap: {} }),
      gap({ id: 'off-globe', position: { lat: 95, lon: 0 }, gap: {} }),
      null, 'junk',
    ]), 'gaps')!
    expect(rows.map(r => r.id)).toEqual(['fallback'])
    expect(rows[0]).toMatchObject({ lat: -10.5, lon: -80.2, onPosition: null, gapDistanceKm: null })
  })

  it('tolerates missing vessel, regions and distances', () => {
    const [e] = m.parseGfwEvents(page([{ id: 'x', start: '2026-10-01T00:00:00Z', position: { lat: 1, lon: 2 } }]), 'encounters')!
    expect(e).toMatchObject({ vessel: { name: '', flag: '', type: '', ssvid: '' }, other: null, highSeas: false, distanceFromShoreKm: null, durationHours: 0 })
  })

  it('returns null for a payload without entries', () => {
    expect(m.parseGfwEvents({ message: 'x' }, 'gaps')).toBeNull()
    expect(m.parseGfwEvents(null, 'gaps')).toBeNull()
  })
})

describe('fetchGfwEvents', () => {
  it('asks the proxy for the dataset and window, newest first, with the newest date', async () => {
    const f = mockFetch(() => jsonResponse(page([gap({ id: 'old', start: '2026-10-01T00:00:00Z' }), gap()])))
    const r = await m.fetchGfwEvents('gaps', 7)
    expect(String(f.mock.calls[0][0])).toBe('/api/gfw?kind=gaps&days=7')
    if (r.status !== 'ok') throw new Error(r.status)
    expect(r.events.map(e => e.id)).toEqual(['g1', 'old'])
    expect(r.newest).toBe(Date.parse('2026-10-10T00:00:00.000Z'))
    expect(r.capped).toBe(false)   // nextOffset is set even on the last page; total decides
  })

  it('marks the result capped when GFW reports more events than were returned', async () => {
    mockFetch(() => jsonResponse(page([gap()], { total: 4321 })))
    expect(await m.fetchGfwEvents('gaps')).toMatchObject({ status: 'ok', capped: true, total: 4321 })
  })

  it('caches a good result per dataset and window', async () => {
    const f = mockFetch(() => jsonResponse(page([])))
    await m.fetchGfwEvents('gaps', 30); await m.fetchGfwEvents('gaps', 30); await m.fetchGfwEvents('encounters', 30)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('reports "not configured" distinctly, and does not cache it', async () => {
    const f = mockFetch(() => jsonResponse({ error: { code: 'not_configured' } }, { status: 503 }))
    expect(await m.fetchGfwEvents('gaps')).toEqual({ status: 'not_configured' })
    await m.fetchGfwEvents('gaps')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('reports HTTP errors with GFW\'s message', async () => {
    mockFetch(() => jsonResponse({ statusCode: 422, messages: [{ title: 'start-date', detail: 'Invalid date range' }] }, { status: 422 }))
    expect(await m.fetchGfwEvents('gaps')).toEqual({ status: 'error', message: 'Global Fishing Watch returned HTTP 422: Invalid date range' })
  })

  it('reports a malformed payload and a network failure as errors, not as zero events', async () => {
    mockFetch(() => jsonResponse({ total: 3 }))
    expect(await m.fetchGfwEvents('gaps')).toMatchObject({ status: 'error' })
    vi.resetModules(); m = await import('./gfw')
    mockFetch(() => { throw new Error('offline') })
    expect(await m.fetchGfwEvents('gaps')).toEqual({ status: 'error', message: 'Global Fishing Watch could not be reached.' })
  })

  it('fetchGfwAll loads both datasets', async () => {
    const f = mockFetch((url) => jsonResponse(page([url.includes('kind=gaps') ? gap() : encounter()])))
    const { gaps, encounters } = await m.fetchGfwAll()
    expect(f).toHaveBeenCalledTimes(2)
    expect(gaps).toMatchObject({ status: 'ok', events: [{ kind: 'gaps' }] })
    expect(encounters).toMatchObject({ status: 'ok', events: [{ kind: 'encounters' }] })
  })
})
