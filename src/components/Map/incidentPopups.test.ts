import { describe, it, expect } from 'vitest'
import { outageCountryPopupHtml, disasterPopupHtml, timeAgo, OUTAGE_COLORS, OUTAGE_CONFIRMED_COLORS } from './incidentPopups'
import { outageCountries, outagePaint } from './layers/outages'
import type { RadarOutage } from '../../services/radarOutages'
import { disasterFeatures } from './layers/disasters'
import type { OutageEvent } from '../../services/outages'
import type { DisasterAlert } from '../../services/gdacs'

const NOW = Date.parse('2026-10-08T03:00:00Z')

const outage = (over: Partial<OutageEvent> = {}): OutageEvent => ({
  id: 'region:684', entityType: 'region', entityName: 'Nord', entityCode: '684', countryCode: 'CM', org: '', status: 'ongoing', level: 'critical',
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

const radar = (over: Partial<RadarOutage> = {}): RadarOutage => ({
  id: 'r1', cause: 'GOVERNMENT_DIRECTED', type: 'NATIONWIDE', scope: '', countries: [{ code: 'CM', name: 'Cameroon' }], asns: [],
  start: NOW - 2 * 3_600_000, end: null, description: 'Shutdown during protests', linkedUrl: 'https://x.test/post', ...over,
})

describe('outageCountries', () => {
  it('groups ongoing IODA events by country, keeping the worst severity and whether any is country-wide', () => {
    const by = outageCountries([
      outage({ id: 'a', severity: 'minor', dropPct: 10 }),
      outage({ id: 'b', severity: 'severe', dropPct: 70 }),
      outage({ id: 'c', entityType: 'country', countryCode: 'IR', severity: 'major', dropPct: 30 }),
      outage({ id: 'gone', countryCode: 'PE', status: 'recovered', level: 'normal' }),
      outage({ id: 'net', entityType: 'asn', countryCode: '' }),
    ], [])
    expect([...by.keys()].sort()).toEqual(['CM', 'IR'])
    expect(by.get('CM')).toMatchObject({ severity: 'severe', countryWide: false })
    expect(by.get('CM')!.events.map(e => e.id)).toEqual(['b', 'a'])
    expect(by.get('IR')).toMatchObject({ severity: 'major', countryWide: true })
  })

  it('adds open Radar outages, flags deliberate causes, and ignores ended ones', () => {
    const by = outageCountries([], [radar(), radar({ id: 'p', cause: 'POWER_OUTAGE', countries: [{ code: 'LK', name: 'Sri Lanka' }] }), radar({ id: 'old', countries: [{ code: 'UY', name: 'Uruguay' }], end: NOW })])
    expect(by.get('CM')).toMatchObject({ severity: null, deliberate: true })
    expect(by.get('LK')).toMatchObject({ deliberate: false })
    expect(by.has('UY')).toBe(false)
  })
})

describe('outagePaint', () => {
  it('fills by severity (lighter when partial) and outlines Radar-confirmed countries, red when deliberate', () => {
    const p = outagePaint(outageCountries(
      [outage(), outage({ id: 'c', entityType: 'country', countryCode: 'IR', severity: 'major' })],
      [radar(), radar({ id: 'p', cause: 'POWER_OUTAGE', countries: [{ code: 'LK', name: 'Sri Lanka' }] })],
    ))
    expect(p.fillColor).toEqual(['match', ['get', 'iso_3166_1'], 'CM', OUTAGE_COLORS.severe, 'IR', OUTAGE_COLORS.major, 'rgba(0,0,0,0)'])
    expect(p.fillOpacity).toEqual(['match', ['get', 'iso_3166_1'], 'CM', 0.24, 'IR', 0.5, 0])
    expect(p.lineColor).toEqual(['match', ['get', 'iso_3166_1'], 'CM', OUTAGE_CONFIRMED_COLORS.deliberate, 'IR', OUTAGE_COLORS.major, 'LK', OUTAGE_CONFIRMED_COLORS.other, 'rgba(0,0,0,0)'])
    expect(p.lineWidth).toEqual(['match', ['get', 'iso_3166_1'], 'CM', 2, 'IR', 0.8, 'LK', 2, 0])
  })

  it('falls back to plain values when nothing is out (Mapbox rejects an empty match)', () => {
    expect(outagePaint(new Map())).toEqual({ fillColor: 'rgba(0,0,0,0)', fillOpacity: 0, lineColor: 'rgba(0,0,0,0)', lineWidth: 0 })
  })
})

describe('outageCountryPopupHtml', () => {
  it('names the country, lists what IODA measured and what Cloudflare confirmed, and says when shading is partial', () => {
    const html = outageCountryPopupHtml(outageCountries([outage()], [radar()]).get('CM')!, NOW)
    expect(html).toContain('Cameroon')
    expect(html).toContain('SEVERE · PARTIAL')
    expect(html).toContain('Nord, CM')
    expect(html).toContain('62% below normal')
    expect(html).toContain('Active probing')
    expect(html).toContain('since 3 h ago')
    expect(html).toContain('Government-directed shutdown')
    expect(html).toContain('href="https://x.test/post"')
    expect(html).toContain('IODA only reports a region or network inside it')
  })

  it('shows a Radar-only country as confirmed', () => {
    const html = outageCountryPopupHtml(outageCountries([], [radar({ cause: 'CABLE_CUT' })]).get('CM')!, NOW)
    expect(html).toContain('CONFIRMED')
    expect(html).toContain('Cable cut')
    expect(html).not.toContain('MEASURED')
  })

  it('escapes feed text', () => {
    const html = outageCountryPopupHtml(outageCountries(
      [outage({ entityType: 'asn', entityName: '<img src=x onerror=alert(1)>', org: '"><script>', location: null })],
      [radar({ description: '<script>x</script>', linkedUrl: '' })],
    ).get('CM')!, NOW)
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
  it('draws disaster alerts at GDACS coordinates in [lng, lat] order', () => {
    const [f] = disasterFeatures([disaster()])
    expect(f.geometry).toEqual({ type: 'Point', coordinates: [-104.5, 18.2] })
    expect(f.properties).toMatchObject({ type: 'TC', alert: 'Red', current: true })
  })
})
