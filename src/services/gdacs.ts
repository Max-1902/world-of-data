// GDACS — Global Disaster Alert and Coordination System (EU JRC + UN OCHA).
// Free, no key, CORS-enabled: https://www.gdacs.org/gdacsapi/ — no billing account involved.
// Only Orange/Red alerts are kept; Green is routine and would bury the signal.

export type DisasterType = 'EQ' | 'TC' | 'FL' | 'VO' | 'DR' | 'WF'

export const DISASTER_LABELS: Record<DisasterType, string> = {
  EQ: 'Earthquake', TC: 'Tropical cyclone', FL: 'Flood', VO: 'Volcano', DR: 'Drought', WF: 'Wildfire',
}

export interface DisasterAlert {
  id: string
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
    if (p.alertlevel !== 'Orange' && p.alertlevel !== 'Red') continue
    const report = p.url?.report ?? ''
    out.push({
      id: `${type}-${p.eventid}-${p.episodeid ?? 0}`,
      type,
      name: p.name || p.eventname || DISASTER_LABELS[type],
      country: p.country ?? '',
      alert: p.alertlevel,
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

/** `loadDisasterAlerts` for the map layer and panel: returns [] on any failure. */
export async function fetchDisasterAlerts(days = 14): Promise<DisasterAlert[]> {
  try {
    return await loadDisasterAlerts(days)
  } catch (err) {
    console.warn('[GDACS] fetch error:', err)
    return []
  }
}
