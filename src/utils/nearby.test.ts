import { describe, it, expect } from 'vitest'
import { distanceKm } from './geo'
import { within, nearbyData, RADIUS_KM } from './nearby'
import type { CrisisEvent, Flight } from '../types'

const NOLA = { lat: 29.95, lng: -90.07 }
const crisis = (id: string, lat: number, lng: number, source = 'ACLED'): CrisisEvent =>
  ({ id, title: id, type: 'conflict', severity: 'high', latitude: lat, longitude: lng, country: 'X', date: '2026-10-01', description: '', source })
const flight = (icao24: string, lat: number | null, lng: number | null, on_ground = false): Flight =>
  ({ icao24, callsign: icao24, origin_country: 'US', latitude: lat, longitude: lng, altitude: 1, velocity: 1, heading: 1, on_ground })

describe('distanceKm', () => {
  it('is ~0 for the same point and close to known city distances', () => {
    expect(distanceKm(NOLA, NOLA)).toBe(0)
    // New Orleans → Baton Rouge is roughly 120 km
    expect(distanceKm(NOLA, { lat: 30.45, lng: -91.19 })).toBeGreaterThan(105)
    expect(distanceKm(NOLA, { lat: 30.45, lng: -91.19 })).toBeLessThan(135)
  })
})

describe('within', () => {
  it('keeps items inside the radius, nearest first, and skips bad coordinates', () => {
    const pts = [{ n: 'far', lat: 31, lng: -90 }, { n: 'near', lat: 29.96, lng: -90.07 }, { n: 'mid', lat: 30.2, lng: -90.07 }, { n: 'bad', lat: NaN, lng: 0 }]
    const out = within(pts, NOLA, 50, p => p)
    expect(out.map(o => o.item.n)).toEqual(['near', 'mid'])
    expect(out[0].km).toBeLessThan(out[1].km)
  })
  it('skips items the accessor has no position for', () => {
    expect(within([1, 2], NOLA, 50, () => null)).toEqual([])
  })
})

describe('nearbyData', () => {
  it('finds incidents, ignoring baseline markers and anything outside the radius', () => {
    const d = nearbyData(NOLA, {
      crises: [crisis('a', 29.99, -90.0), crisis('baseline-x', 29.95, -90.07), crisis('b', 29.95, -90.07, 'Baseline'), crisis('far', 40, -100)],
      flights: [],
    })
    expect(d.incidents.map(i => i.item.id)).toEqual(['a'])
  })

  it('counts airborne vs grounded aircraft within range and ignores ones without a position', () => {
    const d = nearbyData(NOLA, { crises: [], flights: [flight('a', 30.0, -90.0), flight('b', 29.99, -90.0, true), flight('c', null, null), flight('d', 45, -100)] })
    expect(d.flights).toMatchObject({ airborne: 1, onGround: 1 })
    expect(d.flights.sample.map(f => f.icao24).sort()).toEqual(['a', 'b'])
  })

  it('uses the wider quake radius and the narrower fire radius', () => {
    const quake = (id: string, lat: number) => ({ id, magnitude: 4.6, place: 'p', time: 0, latitude: lat, longitude: NOLA.lng, depth: 1, url: '' })
    const fire = (id: string, lat: number) => ({ id, latitude: lat, longitude: NOLA.lng, frp: 1, confidence: 'high' as const, date: '', time: '', satellite: '', daynight: 'D' as const, brightness: 1 })
    // ~1° latitude ≈ 111 km: inside 200 km quake radius, outside the 50 km fire radius
    const d = nearbyData(NOLA, { crises: [], flights: [], earthquakes: [quake('q', NOLA.lat + 1)], fires: [fire('f', NOLA.lat + 1), fire('f2', NOLA.lat + 0.2)] })
    expect(d.quakes).toHaveLength(1)
    expect(d.fires.map(f => f.item.id)).toEqual(['f2'])
    expect(RADIUS_KM.quakes).toBeGreaterThan(RADIUS_KM.fires)
  })

  it('finds curated facilities around a known base', () => {
    // Ramstein Air Base is in the military dataset at 49.437, 7.600
    const d = nearbyData({ lat: 49.44, lng: 7.6 }, { crises: [], flights: [] })
    expect(d.military.map(m => m.item.id)).toContain('us-ramstein')
    expect(nearbyData(NOLA, { crises: [], flights: [] }).military.every(m => m.km <= RADIUS_KM.assets)).toBe(true)
  })
})
