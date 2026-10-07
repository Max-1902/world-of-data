import { describe, it, expect } from 'vitest'
import { computeTrajectories } from './trajectory'
import type { CrisisEvent, Flight, NewsArticle } from '../types'

function crisis(overrides: Partial<CrisisEvent>): CrisisEvent {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: 'Event',
    type: 'conflict',
    severity: 'medium',
    latitude: 0,
    longitude: 0,
    country: 'Testland',
    date: new Date().toISOString(),
    description: '',
    source: 'Test',
    ...overrides,
  }
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('computeTrajectories as-of time', () => {
  it('scores relative to the supplied time and ignores events after it', () => {
    const asOf = Date.UTC(2025, 0, 20, 23, 59, 59)
    const day = (d: number) => new Date(Date.UTC(2025, 0, d)).toISOString().slice(0, 10)
    const crises = [
      crisis({ country: 'Past', severity: 'critical', date: day(19) }),
      crisis({ country: 'Past', severity: 'critical', date: day(20) }),
      crisis({ country: 'Future', severity: 'critical', date: day(25) }),   // after asOf: must not count
    ]
    const entries = computeTrajectories(crises, [], 6, [], null, asOf)
    expect(entries.map(e => e.country)).toEqual(['Past'])
    expect(entries[0]).toMatchObject({ trend: 'rising', recentCount: 2, priorCount: 0 })
  })
})

describe('computeTrajectories', () => {
  it('marks a country rising when recent activity outweighs prior activity', () => {
    const crises = [
      crisis({ country: 'Ruritania', severity: 'critical', date: daysAgo(1) }),
      crisis({ country: 'Ruritania', severity: 'critical', date: daysAgo(2) }),
    ]
    const [entry] = computeTrajectories(crises, [], 6)
    expect(entry.country).toBe('Ruritania')
    expect(entry.trend).toBe('rising')
    expect(entry.recentCount).toBe(2)
    expect(entry.priorCount).toBe(0)
  })

  it('marks a country falling when prior activity outweighs recent activity', () => {
    const crises = [
      crisis({ country: 'Genovia', severity: 'critical', date: daysAgo(6) }),
      crisis({ country: 'Genovia', severity: 'critical', date: daysAgo(8) }),
      crisis({ country: 'Genovia', severity: 'low', date: daysAgo(1) }),
    ]
    const [entry] = computeTrajectories(crises, [], 6)
    expect(entry.country).toBe('Genovia')
    expect(entry.trend).toBe('falling')
  })

  it('marks a country flat when recent and prior severity scores are close', () => {
    const crises = [
      crisis({ country: 'Freedonia', severity: 'medium', date: daysAgo(1) }),
      crisis({ country: 'Freedonia', severity: 'medium', date: daysAgo(6) }),
    ]
    const [entry] = computeTrajectories(crises, [], 6)
    expect(entry.trend).toBe('flat')
  })

  it('excludes baseline/synthetic entries from trajectory scoring', () => {
    const crises = [
      crisis({ id: 'baseline-1', country: 'Sylvania', source: 'Baseline', severity: 'critical' }),
    ]
    const result = computeTrajectories(crises, [], 6)
    expect(result.find(e => e.country === 'Sylvania')).toBeUndefined()
  })

  it('ignores events outside the tracked 10-day window', () => {
    const crises = [
      crisis({ country: 'OldNews', severity: 'critical', date: daysAgo(30) }),
    ]
    const result = computeTrajectories(crises, [], 6)
    expect(result.find(e => e.country === 'OldNews')).toBeUndefined()
  })

  it('boosts velocity when flights cluster near a country\'s crisis coordinates', () => {
    const crises = [
      crisis({ country: 'Aeropolis', severity: 'low', date: daysAgo(1), latitude: 10, longitude: 10 }),
      crisis({ country: 'Aeropolis', severity: 'low', date: daysAgo(6), latitude: 10, longitude: 10 }),
    ]
    const nearbyFlights: Flight[] = Array.from({ length: 20 }, (_, i) => ({
      icao24: `abc${i}`, callsign: `FL${i}`, origin_country: 'x',
      latitude: 10.1, longitude: 10.1, altitude: 1000, velocity: 200, heading: 0, on_ground: false,
    }))
    const withFlights = computeTrajectories(crises, nearbyFlights, 6)
    const withoutFlights = computeTrajectories(crises, [], 6)
    expect(withFlights[0].velocity).toBeGreaterThan(withoutFlights[0].velocity)
    expect(withFlights[0].reason).toContain('elevated air traffic nearby')
  })

  it('boosts and annotates when a country is mentioned in recent news', () => {
    const crises = [
      crisis({ country: 'Newsland', severity: 'high', date: daysAgo(1) }),
    ]
    const articles: NewsArticle[] = [{
      id: 'a1', title: 'Crisis deepens in Newsland', description: '', url: '',
      source: 'Test Wire', publishedAt: new Date().toISOString(),
    }]
    const [entry] = computeTrajectories(crises, [], 6, articles)
    expect(entry.newsHit).toBe('Crisis deepens in Newsland')
    expect(entry.reason).toContain('hot in recent news')
  })

  it('returns an explicit quiet entry for a focusCountry with no tracked activity', () => {
    const result = computeTrajectories([], [], 6, [], 'Quietland')
    expect(result).toHaveLength(1)
    expect(result[0].country).toBe('Quietland')
    expect(result[0].trend).toBe('flat')
    expect(result[0].reason).toContain('No tracked crisis activity')
  })

  it('returns only the matching entry when focusCountry has tracked activity', () => {
    const crises = [
      crisis({ country: 'Alpha', severity: 'critical', date: daysAgo(1) }),
      crisis({ country: 'Beta', severity: 'critical', date: daysAgo(1) }),
    ]
    const result = computeTrajectories(crises, [], 6, [], 'Beta')
    expect(result).toHaveLength(1)
    expect(result[0].country).toBe('Beta')
  })

  it('sorts results by delta descending and respects the limit', () => {
    const crises = [
      crisis({ country: 'Small', severity: 'low', date: daysAgo(1) }),
      crisis({ country: 'Big', severity: 'critical', date: daysAgo(1) }),
      crisis({ country: 'Medium', severity: 'medium', date: daysAgo(1) }),
    ]
    const result = computeTrajectories(crises, [], 2)
    expect(result).toHaveLength(2)
    expect(result[0].country).toBe('Big')
    expect(result[0].delta).toBeGreaterThanOrEqual(result[1].delta)
  })
})
