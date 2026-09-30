import { describe, it, expect } from 'vitest'
import { detectQueryType, parsePhone, getNameSearchLinks } from './osint'

describe('detectQueryType', () => {
  it.each([
    ['user@example.com', 'email'],
    ['first.last+tag@sub.example.co.uk', 'email'],
    ['+49 30 123456', 'phone'],
    ['(555) 123-4567', 'phone'],
    ['0044 20 7946 0958', 'phone'],
    ['John Smith', 'name'],
    ['Jane', 'name'],
    ['user@nodot', 'name'],
    ['two words@example.com', 'name'],
    ['12345', 'name'],           // too short to be a phone number
    ['', 'name'],
  ])('%j -> %s', (q, expected) => {
    expect(detectQueryType(q)).toBe(expected)
  })
})

describe('parsePhone', () => {
  it('normalises +, 00 and bare-digit prefixes to E.164-style', () => {
    expect(parsePhone('+49 30 1234567').normalized).toBe('+49301234567')
    expect(parsePhone('0049 30 1234567').normalized).toBe('+49301234567')
    expect(parsePhone('49 30 1234567').normalized).toBe('+49301234567')
  })

  it('resolves country from the calling code', () => {
    expect(parsePhone('+49 30 1234567')).toMatchObject({ country: 'Germany', countryCode: '+49', valid: true })
    expect(parsePhone('+44 20 7946 0958')).toMatchObject({ country: 'United Kingdom', countryCode: '+44' })
    expect(parsePhone('+81 3 1234 5678')).toMatchObject({ country: 'Japan' })
  })

  it('prefers the longest matching calling code (e.g. +220 Gambia over +2xx / +22)', () => {
    expect(parsePhone('+220 123 4567').country).toBe('Gambia')
    expect(parsePhone('+233 24 123 4567').country).toBe('Ghana')
  })

  it('flags implausible local-number lengths as invalid', () => {
    expect(parsePhone('+49 123').valid).toBe(false)
    expect(parsePhone('+49 1234567890123').valid).toBe(false)
  })

  it('handles an unrecognised code', () => {
    expect(parsePhone('+999 123456789')).toMatchObject({ country: 'Unknown', countryCode: '', valid: false })
  })

  it('preserves the raw input', () => {
    expect(parsePhone('  +49 (30) 123-4567 ').raw).toBe('  +49 (30) 123-4567 ')
  })
})

describe('getNameSearchLinks', () => {
  const links = getNameSearchLinks('John O\'Neil Smith & Co')

  it('returns fully-formed links with labels, descriptions, and https URLs', () => {
    expect(links.length).toBeGreaterThan(3)
    for (const l of links) {
      expect(l.label).toBeTruthy()
      expect(l.desc).toBeTruthy()
      expect(l.url).toMatch(/^https:\/\//)
      expect(() => new URL(l.url)).not.toThrow()
    }
  })

  it('URL-encodes the name so special characters cannot break out of the query', () => {
    for (const l of links) {
      expect(l.url).not.toContain('& Co')
      expect(l.url).not.toContain(' ')
    }
  })

  it('has unique labels', () => {
    expect(new Set(links.map(l => l.label)).size).toBe(links.length)
  })
})
