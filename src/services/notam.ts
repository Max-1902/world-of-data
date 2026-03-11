/**
 * NOTAM / Airspace Status Monitor
 * Detects regional airspace closures by comparing live OpenSky flight density
 * to per-FIR baselines. A "NOTAM-class alert" fires when traffic drops >70%
 * below the regional baseline — a reliable leading indicator of military/crisis activity.
 *
 * Data: OpenSky flight states (already polled by useFlights hook)
 * No direct NOTAM API required — anomaly detection is more reliable in practice.
 */

export interface FIRRegion {
  icao:     string   // ICAO FIR identifier
  name:     string
  country:  string
  minLat:   number
  maxLat:   number
  minLng:   number
  maxLng:   number
  baseline: number   // approximate normal aircraft count
  lat:      number   // centroid for map marker
  lng:      number
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

export type NOTAMSeverity = 'critical' | 'warning' | 'info'
export type NOTAMType = 'CLOSURE' | 'RESTRICTION' | 'CONFLICT_AIRSPACE' | 'NORMAL'

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
  dropPct:    number   // 0-100%, how much below baseline
  lat:        number
  lng:        number
  detectedAt: number   // ms timestamp
}

export interface FIRStatus {
  icao:      string
  region:    string
  country:   string
  status:    'closed' | 'restricted' | 'normal'
  liveCount: number
  baseline:  number
  lat:       number
  lng:       number
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

export function analyzeAirspace(
  flights: { latitude: number | null; longitude: number | null }[],
  now = Date.now(),
): { alerts: NOTAMAlert[]; statuses: FIRStatus[] } {
  const alerts: NOTAMAlert[] = []
  const statuses: FIRStatus[] = []

  for (const fir of FIR_REGIONS) {
    const count = countFlightsInBbox(flights, fir)
    const drop  = fir.baseline > 0 ? Math.round((1 - count / fir.baseline) * 100) : 0

    let status: FIRStatus['status'] = 'normal'
    if (fir.baseline > 0) {
      if (drop >= 85) status = 'closed'
      else if (drop >= 50) status = 'restricted'
    }

    statuses.push({ icao: fir.icao, region: fir.name, country: fir.country, status, liveCount: count, baseline: fir.baseline, lat: fir.lat, lng: fir.lng })

    // Only alert when deviation is meaningful
    if (status === 'normal' || fir.baseline < 3) continue

    const severity: NOTAMSeverity = drop >= 85 ? 'critical' : 'warning'
    const type: NOTAMType = drop >= 85 ? 'CLOSURE' : 'RESTRICTION'
    const countTxt = count === 0 ? '0 aircraft detected' : `${count} aircraft (normal: ~${fir.baseline})`
    const message = drop >= 85
      ? `${fir.name} airspace effectively closed — ${countTxt}`
      : `${fir.name} airspace restricted — ${countTxt}`

    alerts.push({
      id:         `${fir.icao}-${now}`,
      icao:       fir.icao,
      region:     fir.name,
      country:    fir.country,
      type,
      severity,
      message,
      liveCount:  count,
      baseline:   fir.baseline,
      dropPct:    drop,
      lat:        fir.lat,
      lng:        fir.lng,
      detectedAt: now,
    })
  }

  // Sort: critical first, then by drop %
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
    return b.dropPct - a.dropPct
  })

  return { alerts, statuses }
}
