import { describe, it, expect } from 'vitest'
import { vesselTypeFromCode, detectVesselType, VESSEL_TYPE_COLORS } from './aisstream'

describe('vesselTypeFromCode (AIS ship type codes)', () => {
  it.each([
    [70, 'cargo'], [79, 'cargo'],
    [80, 'tanker'], [89, 'tanker'],
    [60, 'passenger'], [69, 'passenger'],
    [30, 'fishing'],
    [31, 'tug'], [32, 'tug'],
    [35, 'military'],
    [0, 'other'], [33, 'other'], [59, 'other'], [90, 'other'], [99, 'other'], [-1, 'other'], [NaN, 'other'],
  ])('maps code %s to %s', (code, expected) => {
    expect(vesselTypeFromCode(code)).toBe(expected)
  })
})

describe('detectVesselType (by name)', () => {
  it.each([
    ['USS NIMITZ', 'military'],
    ['HMS DEFENDER', 'military'],
    ['Frigate Bravo', 'military'],
    ['CRUDE VOYAGER', 'tanker'],
    ['Pacific Tanker', 'tanker'],
    ['Carnival CRUISE Star', 'passenger'],
    ['Baltic Ferry', 'passenger'],
    ['Ocean TRAWL One', 'fishing'],
    ['Harbour TUG 4', 'tug'],
    ['MAERSK ALABAMA', 'cargo'],
    ['Evergreen Star', 'cargo'],
    ['Random Name', 'other'],
    ['', 'other'],
  ])('%s -> %s', (name, expected) => {
    expect(detectVesselType(name)).toBe(expected)
  })

  it('is case-insensitive', () => {
    expect(detectVesselType('maersk alabama')).toBe('cargo')
  })

  it('prefers military over other keywords', () => {
    expect(detectVesselType('NAVY OIL TANKER')).toBe('military')
  })

  it('does not match keywords embedded inside words', () => {
    expect(detectVesselType('BOXER')).toBe('other')
    expect(detectVesselType('FISHERMAN')).toBe('other')
  })
})

describe('vessel type lookup tables', () => {
  const types = ['cargo', 'tanker', 'passenger', 'fishing', 'military', 'tug', 'other'] as const
  it('cover every vessel type', () => {
    for (const t of types) {
      expect(VESSEL_TYPE_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
