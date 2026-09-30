import { describe, it, expect } from 'vitest'
import { detectFlightType, countFlightTypes, headingToCompass, FLIGHT_TYPE_COLORS, FLIGHT_TYPE_LABELS } from './flightType'
import type { Flight } from '../types'

describe('detectFlightType', () => {
  it.each([
    ['RCH123', 'aaaaaa', 'military'],     // USAF REACH callsign
    ['FORTE11', '123456', 'military'],
    ['CNV4', '123456', 'military'],
    ['GAF123', '123456', 'military'],
    ['  rch123  ', '123456', 'military'], // trims + case-insensitive
  ])('classifies %s as military by callsign', (cs, icao, expected) => {
    expect(detectFlightType(cs, icao)).toBe(expected)
  })

  it('classifies by US military ICAO24 hex range, regardless of callsign', () => {
    expect(detectFlightType('DLH123', 'ae1234')).toBe('military')
    expect(detectFlightType('', 'AF0000')).toBe('military')
    expect(detectFlightType('', 'a92000')).toBe('military')
    expect(detectFlightType('', 'a97fff')).toBe('military')
    expect(detectFlightType('', 'ae0000')).toBe('military') // lower bound of the USAF/USN/USMC block
    expect(detectFlightType('', 'afffff')).toBe('military') // upper bound
  })

  it('treats hex range bounds as inclusive and neighbours as outside', () => {
    expect(detectFlightType('', 'adffff')).toBe('unknown')
    expect(detectFlightType('', 'b00000')).toBe('unknown')
    expect(detectFlightType('', 'a91fff')).toBe('unknown')
    expect(detectFlightType('', 'a98000')).toBe('unknown')
  })

  it.each([
    ['UPS1234', 'cargo'],
    ['FDX88', 'cargo'],
    ['DHL45', 'cargo'],
  ])('classifies %s as cargo', (cs, expected) => {
    expect(detectFlightType(cs, '400000')).toBe(expected)
  })

  it.each([
    ['N123AB'],
    ['N1'],
    ['G-ABCD'],
    ['D-EFGH'],
    ['PH-ABC'],
    ['OE-XYZ'],
  ])('classifies bare registration %s as private', (cs) => {
    expect(detectFlightType(cs, '400000')).toBe('private')
  })

  it.each([
    ['DLH400'],
    ['BAW123'],
    ['UAL100'],
    ['EZY12A'],
  ])('classifies airline callsign %s as passenger', (cs) => {
    expect(detectFlightType(cs, '400000')).toBe('passenger')
  })

  it('falls back to unknown for empty, garbage, or missing input', () => {
    expect(detectFlightType('', '')).toBe('unknown')
    expect(detectFlightType('???', 'zzzz')).toBe('unknown')
    expect(detectFlightType(undefined as unknown as string, undefined as unknown as string)).toBe('unknown')
    expect(detectFlightType('A1', '400000')).toBe('unknown') // too short to be a flight number
  })

  it('checks military before cargo/passenger when both could match', () => {
    // "RCH1" would otherwise look like a passenger callsign
    expect(detectFlightType('RCH1', '400000')).toBe('military')
  })
})

describe('countFlightTypes', () => {
  const f = (callsign: string, icao24 = '400000'): Flight => ({
    icao24, callsign, origin_country: '', latitude: 0, longitude: 0,
    altitude: null, velocity: null, heading: null, on_ground: false,
  })

  it('returns all-zero counts for an empty list', () => {
    expect(countFlightTypes([])).toEqual({ passenger: 0, cargo: 0, military: 0, private: 0, unknown: 0 })
  })

  it('counts each type and the total matches the input length', () => {
    const flights = [f('DLH400'), f('BAW1234'), f('UPS12'), f('RCH1'), f('N123AB'), f('')]
    const counts = countFlightTypes(flights)
    expect(counts).toEqual({ passenger: 2, cargo: 1, military: 1, private: 1, unknown: 1 })
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(flights.length)
  })
})

describe('headingToCompass', () => {
  it.each([
    [0, 'N'], [44, 'NE'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'],
    [225, 'SW'], [270, 'W'], [315, 'NW'], [359, 'N'], [360, 'N'],
  ])('maps %i° to %s', (deg, expected) => {
    expect(headingToCompass(deg)).toBe(expected)
  })
})

describe('flight type lookup tables', () => {
  it('define a color and label for every flight type', () => {
    const types = ['passenger', 'cargo', 'military', 'private', 'unknown'] as const
    for (const t of types) {
      expect(FLIGHT_TYPE_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i)
      expect(FLIGHT_TYPE_LABELS[t]).toBeTruthy()
    }
  })
})
