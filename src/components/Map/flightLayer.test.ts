import { describe, it, expect } from 'vitest'
import { buildFlightGeoJSON, destinationPoint } from './flightLayer'
import { detectFlightType } from '../../utils/flightType'
import type { Flight } from '../../types'

const f = (o: Partial<Flight>): Flight => ({
  icao24: '3c6444', callsign: 'DLH400', origin_country: 'Germany', latitude: 50, longitude: 8,
  altitude: 10000, velocity: 230, heading: 90, on_ground: false, ...o,
})

describe('buildFlightGeoJSON', () => {
  const military = f({ icao24: 'ae1234', callsign: 'RCH01', origin_country: 'United States' })
  const flights = [f({}), military, f({ icao24: '4ca1a1', callsign: 'RYR12', origin_country: 'Ireland' })]

  it('places each located aircraft at [lng, lat] with its detected type', () => {
    const fc = buildFlightGeoJSON([f({}), f({ latitude: null })])
    expect(fc.features).toHaveLength(1)
    expect(fc.features[0].geometry).toEqual({ type: 'Point', coordinates: [8, 50] })
    expect(fc.features[0].properties).toMatchObject({ callsign: 'DLH400', flightType: detectFlightType('DLH400', '3c6444') })
  })

  it('matches the search against callsign, country and ICAO address, case-insensitively', () => {
    const ids = (q: string) => buildFlightGeoJSON(flights, q).features.map(x => x.properties!.icao24)
    expect(ids('ryr')).toEqual(['4ca1a1'])
    expect(ids(' united ')).toEqual(['ae1234'])
    expect(ids('3C64')).toEqual(['3c6444'])
  })

  it('keeps only the selected types, and nothing at all while hidden', () => {
    expect(buildFlightGeoJSON(flights, '', new Set(['military'])).features.map(x => x.properties!.icao24)).toEqual(['ae1234'])
    expect(buildFlightGeoJSON(flights, '', undefined, false).features).toEqual([])
  })

  it('falls back to the ICAO address when there is no callsign, and to heading 0', () => {
    const [feat] = buildFlightGeoJSON([f({ callsign: '', heading: null })]).features
    expect(feat.properties).toMatchObject({ callsign: '3c6444', heading: 0 })
  })
})

describe('destinationPoint', () => {
  it('moves due north by the expected arc and due east along the equator', () => {
    const [lng, lat] = destinationPoint(0, 0, 0, 111.195)
    expect(lng).toBeCloseTo(0, 6)
    expect(lat).toBeCloseTo(1, 3)
    expect(destinationPoint(0, 0, 90, 111.195)[0]).toBeCloseTo(1, 3)
  })
})
