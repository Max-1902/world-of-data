/**
 * Airspace traffic monitor (not a NOTAM feed).
 * Compares live OpenSky flight counts inside rough FIR boxes with a hand-set reference count and flags
 * unusually low traffic. It cannot detect a closure: a low ADS-B count looks the same whether the airspace is
 * shut, it is night, or there are few receivers. The boxes and baselines below are hand-set heuristic
 * parameters, not official FIR boundaries or measured traffic — this is an anomaly
 * signal, not a NOTAM (see DATA_PROVENANCE.md).
 *
 * Data: OpenSky flight states (already polled by useFlights hook)
 * No NOTAM API is used, so nothing here is an official restriction.
 */

export interface FIRRegion {
  icao:     string   // ICAO FIR identifier
  name:     string
  country:  string
  minLat:   number
  maxLat:   number
  minLng:   number
  maxLng:   number
  baseline: number   // hand-set "normal" aircraft count; not measured, not hour-of-day
  lat:      number   // centroid for map marker
  lng:      number
  /**
   * True only once OpenSky receiver coverage for this box has been measured (e.g. from recorded counts by hour).
   * None has been, so no FIR can raise a CRITICAL alert.
   */
  coverageVerified?: boolean
}

// Major Flight Information Regions with geographic bounds and baseline traffic
export const FIR_REGIONS: FIRRegion[] = [
  // ── Middle East (high sensitivity — conflict zone) ────────────────────────
  { icao:'OIIX', name:'Tehran FIR',          country:'Iran',         minLat:25, maxLat:39, minLng:44, maxLng:63, baseline:30, lat:32.4, lng:53.7 },
  { icao:'LLLL', name:'Tel Aviv FIR',         country:'Israel',       minLat:29, maxLat:33, minLng:34, maxLng:36, baseline:15, lat:31.8, lng:35.0 },
  { icao:'OLBB', name:'Beirut FIR',           country:'Lebanon',      minLat:33, maxLat:34.5,minLng:35, maxLng:37, baseline:5,  lat:33.8, lng:36.0 },
  { icao:'OSTT', name:'Damascus FIR',         country:'Syria',        minLat:32, maxLat:37, minLng:36, maxLng:42, baseline:5,  lat:34.8, lng:38.9 },
  { icao:'ORBB', name:'Baghdad FIR',          country:'Iraq',         minLat:29, maxLat:38, minLng:38, maxLng:48, baseline:10, lat:33.3, lng:44.4 },
  { icao:'OJAC', name:'Amman FIR',            country:'Jordan',       minLat:29, maxLat:33, minLng:35, maxLng:39, baseline:8,  lat:31.9, lng:36.9 },
  { icao:'OEJD', name:'Jeddah FIR',           country:'Saudi Arabia', minLat:16, maxLat:32, minLng:36, maxLng:56, baseline:40, lat:24.7, lng:46.7 },
  { icao:'OYSC', name:'Sana\'a FIR',          country:'Yemen',        minLat:12, maxLat:20, minLng:42, maxLng:54, baseline:5,  lat:15.6, lng:48.2 },
  { icao:'OMAE', name:'Emirates FIR',         country:'UAE',          minLat:22, maxLat:27, minLng:51, maxLng:60, baseline:20, lat:24.5, lng:54.4 },
  { icao:'OBBB', name:'Bahrain FIR',          country:'Bahrain',      minLat:22, maxLat:27, minLng:47, maxLng:55, baseline:3,  lat:26.2, lng:50.6 },
  { icao:'OOMM', name:'Muscat FIR',           country:'Oman',         minLat:16, maxLat:26, minLng:52, maxLng:60, baseline:15, lat:23.6, lng:57.5 },
  { icao:'OTBD', name:'Doha FIR',             country:'Qatar',        minLat:24, maxLat:26.5,minLng:50, maxLng:52.5,baseline:10,lat:25.3, lng:51.5 },
  { icao:'OKAC', name:'Kuwait FIR',           country:'Kuwait',       minLat:28, maxLat:30.5,minLng:46, maxLng:50, baseline:8,  lat:29.4, lng:47.9 },
  // ── Eastern Europe / Ukraine ──────────────────────────────────────────────
  { icao:'UKBV', name:'Kyiv FIR',             country:'Ukraine',      minLat:44, maxLat:53, minLng:22, maxLng:40, baseline:0,  lat:49.0, lng:31.5 },
  { icao:'URRV', name:'Rostov FIR',           country:'Russia',       minLat:44, maxLat:52, minLng:36, maxLng:49, baseline:25, lat:47.5, lng:41.5 },
  { icao:'LKAA', name:'Prague FIR',           country:'Czechia',      minLat:49, maxLat:52, minLng:12, maxLng:18, baseline:55, lat:50.1, lng:14.4 },
  // ── East Asia ─────────────────────────────────────────────────────────────
  { icao:'ZSHA', name:'Shanghai FIR',         country:'China',        minLat:23, maxLat:35, minLng:117,maxLng:131,baseline:120,lat:31.2, lng:121.5 },
  { icao:'ZBPE', name:'Beijing FIR',          country:'China',        minLat:35, maxLat:43, minLng:111,maxLng:123,baseline:80, lat:39.9, lng:116.4 },
  { icao:'RKRR', name:'Incheon FIR',          country:'S.Korea',      minLat:32, maxLat:40, minLng:124,maxLng:132,baseline:55, lat:37.5, lng:127.0 },
  { icao:'RJJJ', name:'Fukuoka FIR',          country:'Japan',        minLat:24, maxLat:35, minLng:124,maxLng:136,baseline:90, lat:33.6, lng:130.4 },
  { icao:'ZYSH', name:'Shenyang FIR',         country:'China',        minLat:38, maxLat:48, minLng:116,maxLng:134,baseline:30, lat:41.8, lng:123.4 },
  // ── South/Central Asia ────────────────────────────────────────────────────
  { icao:'OPKR', name:'Karachi FIR',          country:'Pakistan',     minLat:22, maxLat:30, minLng:60, maxLng:74, baseline:20, lat:24.9, lng:67.1 },
  { icao:'OPLR', name:'Lahore FIR',           country:'Pakistan',     minLat:28, maxLat:38, minLng:68, maxLng:78, baseline:15, lat:31.5, lng:74.3 },
  { icao:'VIDF', name:'Delhi FIR',            country:'India',        minLat:24, maxLat:34, minLng:68, maxLng:82, baseline:40, lat:28.6, lng:77.2 },
  // ── Europe (high traffic) ─────────────────────────────────────────────────
  { icao:'EGTT', name:'London FIR',           country:'UK',           minLat:49, maxLat:55, minLng:-8,  maxLng:2,  baseline:250,lat:51.5, lng:-0.1 },
  { icao:'LFBB', name:'Bordeaux FIR',         country:'France',       minLat:43, maxLat:49, minLng:-5,  maxLng:3,  baseline:120,lat:44.8, lng:-0.6 },
  { icao:'EDGG', name:'Langen FIR',           country:'Germany',      minLat:47, maxLat:53, minLng:6,   maxLng:15, baseline:180,lat:50.0, lng:9.0  },
  // ── Africa ────────────────────────────────────────────────────────────────
  { icao:'HAAB', name:'Addis Ababa FIR',      country:'Ethiopia',     minLat:3,  maxLat:15, minLng:33,  maxLng:48, baseline:10, lat:9.0,  lng:40.0 },
  { icao:'DNKK', name:'Kano FIR',             country:'Nigeria',      minLat:4,  maxLat:14, minLng:3,   maxLng:15, baseline:8,  lat:12.0, lng:8.5  },
  // ── Americas ──────────────────────────────────────────────────────────────
  { icao:'KZNY', name:'New York Oceanic FIR', country:'US',           minLat:28, maxLat:46, minLng:-75, maxLng:-50,baseline:80, lat:37.0, lng:-62.0},
  { icao:'KZLA', name:'Los Angeles FIR',      country:'US',           minLat:30, maxLat:42, minLng:-125,maxLng:-113,baseline:120,lat:34.0, lng:-118.0},
]

/**
 * OpenSky's /states/all normally returns several thousand airborne aircraft worldwide. Fewer than this means the
 * response was empty or partial, so a low count inside a box says nothing about that airspace. A feed-sanity
 * gate, hand-set like the baselines, not a measured figure.
 */
export const MIN_GLOBAL_FLIGHTS = 1000
/** Local solar hours (at the FIR's marker) in which no alert is raised: the references are not hour-of-day baselines. */
export const NIGHT_HOURS: [number, number] = [0, 6]

export type NOTAMSeverity = 'critical' | 'warning' | 'info'
export type NOTAMType = 'VERY_LOW_TRAFFIC' | 'LOW_TRAFFIC'

export interface NOTAMAlert {
  id:         string
  icao:       string
  region:     string
  country:    string
  type:       NOTAMType
  severity:   NOTAMSeverity
  message:    string
  liveCount:  number
  baseline:   number
  dropPct:    number   // 0-100%, how much below the hand-set reference
  lat:        number
  lng:        number
  detectedAt: number   // ms timestamp
}

/**
 * normal / low / very_low: traffic compared with the hand-set reference. not_assessed: no usable reference (0 or
 * tiny) or local night. no_data: the flight feed was empty or partial, so nothing can be said about any FIR.
 * There is deliberately no "closed": a low ADS-B count cannot tell a closure from missing receiver coverage.
 */
export type FIRTrafficStatus = 'normal' | 'low' | 'very_low' | 'not_assessed' | 'no_data'

export interface FIRStatus {
  icao:      string
  region:    string
  country:   string
  status:    FIRTrafficStatus
  /** why the status is what it is, in one line, for the UI */
  reason:    string
  liveCount: number
  baseline:  number
  lat:       number
  lng:       number
}

export const FIR_STATUS_LABEL: Record<FIRTrafficStatus, string> = {
  normal: 'Normal', low: 'Low traffic', very_low: 'Very low traffic', not_assessed: 'Not assessed', no_data: 'No data',
}

// Count flights inside a bounding box
function countFlightsInBbox(
  flights: { latitude: number | null; longitude: number | null }[],
  fir: FIRRegion,
): number {
  return flights.filter(f =>
    f.latitude  != null && f.longitude != null &&
    f.latitude  >= fir.minLat && f.latitude  <= fir.maxLat &&
    f.longitude >= fir.minLng && f.longitude <= fir.maxLng
  ).length
}

/** Mean solar hour at a longitude: UTC hour shifted 1 h per 15°. Good enough to tell night from day. */
export function localSolarHour(now: number, lng: number): number {
  const d = new Date(now)
  const utc = d.getUTCHours() + d.getUTCMinutes() / 60
  return (((utc + lng / 15) % 24) + 24) % 24
}

export function analyzeAirspace(
  flights: { latitude: number | null; longitude: number | null }[],
  now = Date.now(),
): { alerts: NOTAMAlert[]; statuses: FIRStatus[]; feedOk: boolean } {
  const alerts: NOTAMAlert[] = []
  const statuses: FIRStatus[] = []
  const located = flights.filter(f => f.latitude != null && f.longitude != null).length
  const feedOk = located >= MIN_GLOBAL_FLIGHTS

  for (const fir of FIR_REGIONS) {
    const count = countFlightsInBbox(flights, fir)
    const base = { icao: fir.icao, region: fir.name, country: fir.country, liveCount: count, baseline: fir.baseline, lat: fir.lat, lng: fir.lng }

    if (!feedOk) {
      statuses.push({ ...base, status: 'no_data', reason: `flight feed empty or partial (${located.toLocaleString('en-US')} aircraft worldwide)` })
      continue
    }
    if (fir.baseline < 3) {
      statuses.push({ ...base, status: 'not_assessed', reason: fir.baseline === 0 ? 'no reference: airspace already closed to civil traffic' : 'reference too small to compare' })
      continue
    }
    const hour = localSolarHour(now, fir.lng)
    if (hour >= NIGHT_HOURS[0] && hour < NIGHT_HOURS[1]) {
      statuses.push({ ...base, status: 'not_assessed', reason: `local night (~${String(Math.floor(hour)).padStart(2, '0')}:00); the reference is not an hour-of-day baseline` })
      continue
    }

    const drop = Math.round((1 - count / fir.baseline) * 100)
    const status: FIRTrafficStatus = drop >= 85 ? 'very_low' : drop >= 50 ? 'low' : 'normal'
    const reason = `${count} aircraft vs a hand-set reference of ~${fir.baseline}`
    statuses.push({ ...base, status, reason })
    if (status === 'normal') continue

    // CRITICAL needs measured receiver coverage for this FIR; none has it yet, so no alert can be critical.
    const severity: NOTAMSeverity = fir.coverageVerified && status === 'very_low' ? 'critical' : status === 'very_low' ? 'warning' : 'info'
    alerts.push({
      id:         `${fir.icao}-${now}`,
      icao:       fir.icao,
      region:     fir.name,
      country:    fir.country,
      type:       status === 'very_low' ? 'VERY_LOW_TRAFFIC' : 'LOW_TRAFFIC',
      severity,
      message:    `${fir.name}: ${count} aircraft seen by OpenSky, ${drop}% below a hand-set reference of ~${fir.baseline}. Unverified: thin receiver coverage, time of day or a real restriction can each cause this.`,
      liveCount:  count,
      baseline:   fir.baseline,
      dropPct:    drop,
      lat:        fir.lat,
      lng:        fir.lng,
      detectedAt: now,
    })
  }

  const SEV_RANK: Record<NOTAMSeverity, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.dropPct - a.dropPct)

  return { alerts, statuses, feedOk }
}
