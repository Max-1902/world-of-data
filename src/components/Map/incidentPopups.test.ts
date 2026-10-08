import { describe, it, expect } from 'vitest'
import { outagePopupHtml, disasterPopupHtml, timeAgo } from './incidentPopups'
import { outageFeatures } from './layers/outages'
import { disasterFeatures } from './layers/disasters'
import type { OutageEvent } from '../../services/outages'
import type { DisasterAlert } from '../../services/gdacs'

const NOW = Date.parse('2026-10-08T03:00:00Z')

const outage = (over: Partial<OutageEvent> = {}): OutageEvent => ({
  id: 'region:684', entityType: 'region', entityName: 'Nord', entityCode: '684', org: '', status: 'ongoing', level: 'critical',
  severity: 'severe', dropPct: 62, start: NOW / 1000 - 3 * 3600, lastAlert: NOW / 1000 - 600,
  signals: [{ source: 'ping-slash24', level: 'critical', dropPct: 62, value: 38, baseline: 100, time: 0 }],
  location: { lng: 13.9, lat: 8.5, precision: 'region', label: 'Nord, CM' }, ...over,
})

const disaster = (over: Partial<DisasterAlert> = {}): DisasterAlert => ({
  id: 'TC-1-3', type: 'TC', name: 'Tropical Cyclone SIMON-26', country: 'Mexico', alert: 'Red', score: 3,
  latitude: 18.2, longitude: -104.5, from: '2026-10-07T15:00:00', to: '2026-10-08T03:00:00',
  reportUrl: 'https://www.gdacs.org/report.aspx?eventid=1', severityText: 'Tropical Storm (maximum wind speed of 204 km/h)',
  source: 'NOAA', affectedCountries: ['Mexico'], isCurrent: true, ...over,
})

describe('outagePopupHtml', () => {
  it('says what the severity means, how far the signal fell, what measured it and how precise the pin is', () => {
    const html = outagePopupHtml(outage(), NOW)
    expect(html).toContain('SEVERE · ONGOING')
    expect(html).toContain('62%')
    expect(html).toContain('most of the area offline')
    expect(html).toContain('Active probing')
    expect(html).toContain('3 h ago')
    expect(html).toContain('pin marks the region (Nord, CM)')
  })
  it('labels recovered and country-wide outages as such', () => {
    const html = outagePopupHtml(outage({ status: 'recovered', level: 'normal', location: { lng: 0, lat: 1, precision: 'country', label: 'CM' } }), NOW)
    expect(html).toContain('RECOVERED')
    expect(html).toContain('IODA only reports it country-wide')
  })
  it('escapes feed text', () => {
    const html = outagePopupHtml(outage({ entityName: '<img src=x onerror=alert(1)>', org: '"><script>' }), NOW)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
  })
})

describe('disasterPopupHtml', () => {
  it('explains the alert level and shows GDACS severity, countries, status and source', () => {
    const html = disasterPopupHtml(disaster(), NOW)
    expect(html).toContain('RED ALERT')
    expect(html).toContain('international assistance likely needed')
    expect(html).toContain('maximum wind speed of 204 km/h')
    expect(html).toContain('Mexico')
    expect(html).toContain('Active')
    expect(html).toContain('NOAA')
    expect(html).toContain('href="https://www.gdacs.org/report.aspx?eventid=1"')
  })
  it('marks ended events and omits the link when there is none', () => {
    const html = disasterPopupHtml(disaster({ isCurrent: false, reportUrl: '' }), NOW)
    expect(html).toContain('Ended')
    expect(html).not.toContain('<a ')
  })
  it('escapes feed text', () => {
    expect(disasterPopupHtml(disaster({ name: '<b onmouseover=x>' }), NOW)).not.toContain('<b onmouseover')
  })
})

describe('timeAgo', () => {
  it('formats minutes, hours and days', () => {
    expect(timeAgo(NOW - 30_000, NOW)).toBe('just now')
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe('5 min ago')
    expect(timeAgo(NOW - 5 * 3_600_000, NOW)).toBe('5 h ago')
    expect(timeAgo(NOW - 3 * 86_400_000, NOW)).toBe('3 d ago')
  })
})

describe('pin features', () => {
  it('draws only outages that have a location, ranking ongoing severe highest', () => {
    const f = outageFeatures([
      outage(),
      outage({ id: 'asn:1', location: null }),
      outage({ id: 'r2', status: 'recovered', level: 'normal' }),
    ])
    expect(f.map(x => x.properties?.id)).toEqual(['region:684', 'r2'])
    expect(f[0].geometry).toEqual({ type: 'Point', coordinates: [13.9, 8.5] })
    expect(f[0].properties).toMatchObject({ ongoing: true, severity: 'severe', precision: 'region', rank: 3 })
    expect(f[1].properties).toMatchObject({ ongoing: false, rank: 0 })
  })
  it('draws disaster alerts at GDACS coordinates in [lng, lat] order', () => {
    const [f] = disasterFeatures([disaster()])
    expect(f.geometry).toEqual({ type: 'Point', coordinates: [-104.5, 18.2] })
    expect(f.properties).toMatchObject({ type: 'TC', alert: 'Red', current: true })
  })
})
