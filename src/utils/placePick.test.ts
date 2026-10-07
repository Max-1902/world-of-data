import { describe, it, expect } from 'vitest'
import { pickClickedPlace } from './placePick'

const nola = {
  text: 'New Orleans',
  center: [-90.07, 29.95],
  bbox: [-90.14, 29.87, -89.62, 30.2],
  context: [{ id: 'region.1', text: 'Louisiana' }, { id: 'country.2', text: 'United States' }],
}

describe('pickClickedPlace', () => {
  it('returns the city when the click is inside its bounding box', () => {
    expect(pickClickedPlace({ features: [nola] }, { lng: -89.9, lat: 30.0 })).toEqual({
      name: 'New Orleans', region: 'Louisiana', country: 'United States', lat: 29.95, lng: -90.07,
    })
  })

  it('without a bbox, accepts only clicks near the centre', () => {
    const noBox = { ...nola, bbox: undefined }
    expect(pickClickedPlace({ features: [noBox] }, { lng: -90.05, lat: 29.96 })?.name).toBe('New Orleans')
    expect(pickClickedPlace({ features: [noBox] }, { lng: -88.0, lat: 29.95 })).toBeNull()
  })

  it('rejects a faraway nearest-place so open country stays a country click', () => {
    expect(pickClickedPlace({ features: [nola] }, { lng: -95, lat: 35 })).toBeNull()
  })

  it('skips a rejected feature and takes the next acceptable one', () => {
    const far = { ...nola, text: 'Elsewhere', center: [10, 10], bbox: [9, 9, 11, 11] }
    expect(pickClickedPlace({ features: [far, nola] }, { lng: -90.0, lat: 29.95 })?.name).toBe('New Orleans')
  })

  it('needs a country, and tolerates a missing region', () => {
    const noCountry = { ...nola, context: [{ id: 'region.1', text: 'Louisiana' }] }
    expect(pickClickedPlace({ features: [noCountry] }, { lng: -90.0, lat: 29.95 })).toBeNull()
    const noRegion = { ...nola, context: [{ id: 'country.2', text: 'Monaco' }] }
    expect(pickClickedPlace({ features: [noRegion] }, { lng: -90.0, lat: 29.95 })).toMatchObject({ country: 'Monaco', region: undefined })
  })

  it('survives malformed responses', () => {
    for (const bad of [null, undefined, {}, { features: 'x' }, { features: [null] }, { features: [{ text: 'X' }] }, { features: [{ text: 'X', center: ['a', 'b'] }] }]) {
      expect(pickClickedPlace(bad, { lng: 0, lat: 0 })).toBeNull()
    }
  })
})
