import { describe, it, expect } from 'vitest'
import { summarizeIncidents } from './incidents'
import type { DisasterAlert } from '../services/gdacs'
import type { Earthquake } from '../services/earthquakes'
import type { OutageEvent } from '../services/outages'

const alert = (type: DisasterAlert['type'], latitude: number, longitude: number): DisasterAlert =>
  ({ id: `${type}${latitude}`, type, name: 'n', country: 'c', alert: 'Orange', score: 1, latitude, longitude, from: '', to: '', reportUrl: '', severityText: '', source: '', affectedCountries: [], isCurrent: true })
const quake = (magnitude: number, latitude: number, longitude: number): Earthquake =>
  ({ id: `${magnitude}${latitude}`, magnitude, place: 'p', time: 0, latitude, longitude, depth: 10, url: '' })
const outage = (level: 'critical' | 'normal'): OutageEvent =>
  ({ id: level, entityType: 'country', entityName: 'n', entityCode: 'XX', org: '', status: level === 'critical' ? 'ongoing' : 'recovered', level, severity: 'minor', dropPct: 5, start: 0, lastAlert: 0, signals: [], location: null })

describe('summarizeIncidents', () => {
  it('is zero with no feeds', () => {
    expect(summarizeIncidents({ liveConflictCount: 0, alerts: [], earthquakes: [], outages: [] }).total).toBe(0)
  })

  it('sums conflict, alerts, M5.5+ quakes and critical outages; skips routine quakes and recovered outages', () => {
    const s = summarizeIncidents({
      liveConflictCount: 3,
      alerts: [alert('FL', 10, 10)],
      earthquakes: [quake(6.1, 40, 40), quake(4.9, 41, 41)],
      outages: [outage('critical'), outage('normal')],
    })
    expect(s).toEqual({ total: 6, conflict: 3, disasters: 1, earthquakes: 1, outages: 1 })
  })

  it('does not double-count a quake already covered by a GDACS earthquake alert', () => {
    const s = summarizeIncidents({ liveConflictCount: 0, alerts: [alert('EQ', 35, 140)], earthquakes: [quake(7, 35.4, 140.3)], outages: [] })
    expect(s.total).toBe(1)
  })
})
