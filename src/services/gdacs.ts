// GDACS — Global Disaster Alert and Coordination System (EU JRC + UN OCHA).
// Free, no key, CORS-enabled: https://www.gdacs.org/gdacsapi/ — no billing account involved.
// Only Orange/Red alerts are kept; Green is routine and would bury the signal.


import { healthTracker } from './sourceHealth'

export type DisasterType = 'EQ' | 'TC' | 'FL' | 'VO' | 'DR' | 'WF'

export const DISASTER_LABELS: Record<DisasterType, string> = {
  EQ: 'Earthquake', TC: 'Tropical cyclone', FL: 'Flood', VO: 'Volcano', DR: 'Drought', WF: 'Wildfire',
}

export interface DisasterAlert {
  id: string
  /** one per event, shared by all its episodes (`id` is per episode) */
  eventKey: string
  type: DisasterType
  name: string
  country: string
  alert: 'Orange' | 'Red'
  /** GDACS's own alert score; used for ranking only */
  score: number
  latitude: number
  longitude: number
  from: string
  to: string
  reportUrl: string
  /** GDACS's own plain-language severity, e.g. "Magnitude 6.8M, Depth:10km" or "Tropical Storm (maximum wind speed of 204 km/h)" */
  severityText: string
  /** agency that reported the underlying event (USGS, NOAA, JRC …) */
  source: string
  /** every country GDACS lists as affected; `country` is only the primary one */
  affectedCountries: string[]
  /** false once GDACS marks the event as over */
  isCurrent: boolean
}

/** What GDACS's alert levels mean, paraphrasing GDACS's alert-level definitions (gdacs.org). */
export const ALERT_MEANING: Record<DisasterAlert['alert'], string> = {
  Red: 'High expected humanitarian impact — international assistance likely needed',
  Orange: 'Medium expected impact — international assistance may be needed',
}

const BASE = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH'
const ymd = (d: Date) => d.toISOString().slice(0, 10)

interface RawFeature {
  geometry?: { type?: string; coordinates?: unknown }
  properties?: {
    eventtype?: string; eventid?: number | string; episodeid?: number | string
    name?: string; eventname?: string; country?: string; alertlevel?: string; alertscore?: number
    fromdate?: string; todate?: string; url?: { report?: string }
    source?: string; iscurrent?: string | boolean
    severitydata?: { severitytext?: string }
    affectedcountries?: { countryname?: string }[]
  }
}

export function parseDisasterAlerts(json: unknown): DisasterAlert[] {
  const features = (json as { features?: RawFeature[] } | null)?.features
  if (!Array.isArray(features)) return []
  const out: DisasterAlert[] = []
  for (const f of features) {
    const p = f.properties
    const c = f.geometry?.coordinates
    if (!p || f.geometry?.type !== 'Point' || !Array.isArray(c)) continue
    const [lng, lat] = c as number[]
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue
    const type = p.eventtype as DisasterType
    if (!(type in DISASTER_LABELS)) continue
    // GDACS spells levels both ways ("Orange" for earthquakes, "ORANGE" for floods)
    const alert = typeof p.alertlevel === 'string' ? p.alertlevel.toLowerCase() : ''
    if (alert !== 'orange' && alert !== 'red') continue
    const report = p.url?.report ?? ''
    out.push({
      id: `${type}-${p.eventid}-${p.episodeid ?? 0}`,
      eventKey: `${type}-${p.eventid}`,
      type,
      name: p.name || p.eventname || DISASTER_LABELS[type],
      country: p.country ?? '',
      alert: alert === 'red' ? 'Red' : 'Orange',
      score: typeof p.alertscore === 'number' ? p.alertscore : 0,
      latitude: lat,
      longitude: lng,
      from: p.fromdate ?? '',
      to: p.todate ?? '',
      // only ever link back to GDACS itself
      reportUrl: report.startsWith('https://www.gdacs.org/') ? report : '',
      severityText: typeof p.severitydata?.severitytext === 'string' ? p.severitydata.severitytext.trim() : '',
      source: typeof p.source === 'string' ? p.source : '',
      affectedCountries: Array.isArray(p.affectedcountries)
        ? p.affectedcountries.map(c => c?.countryname).filter((n): n is string => typeof n === 'string' && n.length > 0)
        : [],
      isCurrent: p.iscurrent !== false && p.iscurrent !== 'false',
    })
  }
  return out.sort((a, b) =>
    (a.alert === b.alert ? 0 : a.alert === 'Red' ? -1 : 1) || b.score - a.score || b.to.localeCompare(a.to))
}

/** Orange/Red alerts for events active in the last `days` days. Throws on failure, so an empty list means none. */
export async function loadDisasterAlerts(days = 14): Promise<DisasterAlert[]> {
  const now = new Date()
  const from = new Date(now.getTime() - days * 86_400_000)
  const url = `${BASE}?eventtype=${Object.keys(DISASTER_LABELS).join(',')}&fromDate=${ymd(from)}&toDate=${ymd(now)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`GDACS ${res.status}`)
  return parseDisasterAlerts(await res.json())
}

/** GDACS returns at most this many events per page of a search. */
const PAGE = 100
/** Disasters that strike at a known moment; droughts and wildfires build up over weeks, so they have no event day. */
export const SUDDEN_ONSET: DisasterType[] = ['EQ', 'TC', 'FL', 'VO']

async function searchYear(year: number, page: number): Promise<{ alerts: DisasterAlert[]; full: boolean }> {
  const url = `${BASE}?eventtype=${SUDDEN_ONSET.join(',')}&fromDate=${year}-01-01&toDate=${year}-12-31&alertlevel=Orange;Red&pagenumber=${page}`
  const res = await fetch(url, { signal: AbortSignal.timeout(40_000) })
  if (!res.ok) throw new Error(`GDACS ${res.status}`)
  const json = await res.json() as { features?: unknown[] }
  return { alerts: parseDisasterAlerts(json), full: (json.features?.length ?? 0) >= PAGE }
}

/**
 * Every Orange/Red sudden-onset alert from `fromYear` to now, one entry per event (its first episode GDACS lists),
 * oldest first. Throws when any year can't be loaded, so a gap in history is never mistaken for a quiet year.
 */
export async function loadAlertHistory(fromYear: number, now = new Date()): Promise<DisasterAlert[]> {
  const years: number[] = []
  for (let y = fromYear; y <= now.getUTCFullYear(); y++) years.push(y)
  const byEvent = new Map<string, DisasterAlert>()
  for (let i = 0; i < years.length; i += 4) {
    const chunks = await Promise.all(years.slice(i, i + 4).map(async y => {
      const out: DisasterAlert[] = []
      for (let page = 1; page <= 10; page++) {
        const r = await searchYear(y, page)
        out.push(...r.alerts)
        if (!r.full) break
      }
      return out
    }))
    for (const a of chunks.flat()) {
      if (!SUDDEN_ONSET.includes(a.type)) continue
      const seen = byEvent.get(a.eventKey)
      if (!seen || a.from < seen.from) byEvent.set(a.eventKey, a)
    }
  }
  return [...byEvent.values()].sort((a, b) => a.from.localeCompare(b.from))
}

/** `loadDisasterAlerts` for the map layer and panel: returns [] on any failure. */
export async function fetchDisasterAlerts(days = 14): Promise<DisasterAlert[]> {
  try {
    const alerts = await loadDisasterAlerts(days)
    healthTracker.note('gdacs', { coverage: `${alerts.length} Orange or Red alerts in the last ${days} days (lower alert levels are not requested)` })
    return alerts
  } catch (err) {
    console.warn('[GDACS] fetch error:', err)
    return []
  }
}
