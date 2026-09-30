import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse, quietConsole } from '../test/helpers'

// opensky.ts caches its bearer token at module level — reload it for each test.
async function load() {
  vi.resetModules()
  return import('./opensky')
}

// OpenSky state vector: [icao24, callsign, origin, time_pos, last_contact, lon, lat, baro_alt, on_ground, velocity, heading, ...]
const state = (o: Partial<Record<number, unknown>> = {}) => {
  const base: unknown[] = ['abc123', 'DLH400  ', 'Germany', 0, 0, 8.5, 50.0, 10000, false, 230, 90]
  for (const [i, v] of Object.entries(o)) base[Number(i)] = v
  return base
}

const TOKEN_URL = '/api/opensky-token'
const STATES_URL = '/api/opensky/states/all'

describe('fetchFlights', () => {
  beforeEach(() => quietConsole())

  it('parses airborne state vectors, trimming callsigns', async () => {
    mockFetch(url => url === TOKEN_URL
      ? jsonResponse({ access_token: 'tok', expires_in: 1800 })
      : jsonResponse({ states: [state()] }))
    const { fetchFlights } = await load()
    expect(await fetchFlights()).toEqual([{
      icao24: 'abc123', callsign: 'DLH400', origin_country: 'Germany',
      longitude: 8.5, latitude: 50.0, altitude: 10000, on_ground: false, velocity: 230, heading: 90,
    }])
  })

  it('drops aircraft on the ground and those without a position', async () => {
    mockFetch(url => url === TOKEN_URL
      ? jsonResponse({ access_token: 'tok', expires_in: 1800 })
      : jsonResponse({ states: [
          state({ 0: 'air' }),
          state({ 0: 'gnd', 8: true }),
          state({ 0: 'nolon', 5: null }),
          state({ 0: 'nolat', 6: null }),
        ] }))
    const { fetchFlights } = await load()
    const flights = await fetchFlights()
    expect(flights.map(f => f.icao24)).toEqual(['air'])
  })

  it('sends the bearer token and reuses it across calls', async () => {
    const fetchMock = mockFetch(url => url === TOKEN_URL
      ? jsonResponse({ access_token: 'tok', expires_in: 1800 })
      : jsonResponse({ states: [] }))
    const { fetchFlights } = await load()
    await fetchFlights()
    await fetchFlights()
    const tokenCalls = fetchMock.mock.calls.filter(c => c[0] === TOKEN_URL)
    const stateCalls = fetchMock.mock.calls.filter(c => c[0] === STATES_URL)
    expect(tokenCalls).toHaveLength(1)
    expect(stateCalls).toHaveLength(2)
    expect((stateCalls[0][1]!.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('falls back to anonymous requests when the token endpoint fails', async () => {
    const fetchMock = mockFetch(url => url === TOKEN_URL
      ? jsonResponse({}, { status: 500 })
      : jsonResponse({ states: [state()] }))
    const { fetchFlights } = await load()
    expect(await fetchFlights()).toHaveLength(1)
    const stateCall = fetchMock.mock.calls.find(c => c[0] === STATES_URL)!
    expect((stateCall[1]!.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('retries once without auth on a 401 and clears the cached token', async () => {
    let stateCalls = 0
    const fetchMock = mockFetch(url => {
      if (url === TOKEN_URL) return jsonResponse({ access_token: 'stale', expires_in: 1800 })
      stateCalls++
      return stateCalls === 1 ? jsonResponse({}, { status: 401 }) : jsonResponse({ states: [state()] })
    })
    const { fetchFlights } = await load()
    expect(await fetchFlights()).toHaveLength(1)
    const retry = fetchMock.mock.calls.filter(c => c[0] === STATES_URL)[1]
    expect((retry[1]!.headers as Record<string, string>).Authorization).toBeUndefined()
    // next call must fetch a fresh token
    await fetchFlights()
    expect(fetchMock.mock.calls.filter(c => c[0] === TOKEN_URL)).toHaveLength(2)
  })

  it('returns [] on server errors, a failed anonymous retry, missing states, and network failure', async () => {
    mockFetch(url => url === TOKEN_URL ? jsonResponse({ access_token: 't', expires_in: 1800 }) : jsonResponse({}, { status: 500 }))
    expect(await (await load()).fetchFlights()).toEqual([])

    mockFetch(url => url === TOKEN_URL ? jsonResponse({ access_token: 't', expires_in: 1800 }) : jsonResponse({}, { status: 401 }))
    expect(await (await load()).fetchFlights()).toEqual([])

    mockFetch(url => url === TOKEN_URL ? jsonResponse({ access_token: 't', expires_in: 1800 }) : jsonResponse({ states: null }))
    expect(await (await load()).fetchFlights()).toEqual([])

    mockFetch(() => { throw new Error('offline') })
    expect(await (await load()).fetchFlights()).toEqual([])
  })
})
