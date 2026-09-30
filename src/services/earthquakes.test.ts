import { describe, it, expect } from 'vitest'
import { fetchEarthquakes } from './earthquakes'
import { mockFetch, jsonResponse, quietConsole } from '../test/helpers'

describe('fetchEarthquakes', () => {
  it('maps USGS GeoJSON features, swapping [lng, lat, depth] into named fields', async () => {
    const fetchMock = mockFetch(() => jsonResponse({
      features: [{
        id: 'us1',
        properties: { mag: 6.1, place: '10km N of Somewhere', time: 1_700_000_000_000, url: 'https://x/us1' },
        geometry: { coordinates: [139.5, 35.2, 12.3] },
      }],
    }))
    const result = await fetchEarthquakes('day', '4.5')
    expect(result).toEqual([{
      id: 'us1', magnitude: 6.1, place: '10km N of Somewhere', time: 1_700_000_000_000,
      latitude: 35.2, longitude: 139.5, depth: 12.3, url: 'https://x/us1',
    }])
    expect(fetchMock.mock.calls[0][0]).toBe('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson')
  })

  it('defaults to the 4.5 / week feed', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ features: [] }))
    await fetchEarthquakes()
    expect(String(fetchMock.mock.calls[0][0])).toContain('4.5_week.geojson')
  })

  it('returns [] when features is missing', async () => {
    mockFetch(() => jsonResponse({}))
    expect(await fetchEarthquakes()).toEqual([])
  })

  it('returns [] on HTTP errors and network failures instead of throwing', async () => {
    quietConsole()
    mockFetch(() => jsonResponse({}, { status: 503 }))
    expect(await fetchEarthquakes()).toEqual([])
    mockFetch(() => { throw new Error('offline') })
    expect(await fetchEarthquakes()).toEqual([])
  })
})
