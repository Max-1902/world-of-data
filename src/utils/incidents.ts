import type { Earthquake } from '../services/earthquakes'
import type { OutageEvent } from '../services/outages'
import type { DisasterAlert } from '../services/gdacs'

export interface IncidentSummary {
  total: number
  conflict: number
  disasters: number
  earthquakes: number
  outages: number
}

/** Only quakes this strong are counted as incidents — M4.5+ happens dozens of times a week and is routine. */
export const INCIDENT_MIN_MAGNITUDE = 5.5

/**
 * Live incidents across the free feeds: ACLED conflict events (when that feed is connected), GDACS
 * Orange/Red disaster alerts, M5.5+ earthquakes and critical internet outages. The hand-entered baseline
 * conflict list is deliberately not counted. A GDACS earthquake alert and the matching USGS quake are
 * the same event, so earthquakes already covered by a GDACS alert are not counted twice.
 */
export function summarizeIncidents(input: {
  liveConflictCount: number
  alerts: DisasterAlert[]
  earthquakes: Earthquake[]
  outages: OutageEvent[]
}): IncidentSummary {
  const { liveConflictCount, alerts, outages } = input
  const gdacsQuakes = alerts.filter(a => a.type === 'EQ')
  const quakes = input.earthquakes.filter(q =>
    q.magnitude >= INCIDENT_MIN_MAGNITUDE &&
    !gdacsQuakes.some(a => Math.abs(a.latitude - q.latitude) < 1.5 && Math.abs(a.longitude - q.longitude) < 1.5)
  ).length
  const criticalOutages = outages.filter(o => o.level === 'critical').length
  return {
    total: liveConflictCount + alerts.length + quakes + criticalOutages,
    conflict: liveConflictCount,
    disasters: alerts.length,
    earthquakes: quakes,
    outages: criticalOutages,
  }
}
