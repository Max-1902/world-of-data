/**
 * NASA FIRMS (Fire Information for Resource Management System)
 * Active fire detections from NOAA-20 VIIRS — last 24h, global
 * Proxied via Vite dev server to avoid CORS.
 * No API key required for the public CSV feeds.
 */

export interface FirePoint {
  id:         string
  latitude:   number
  longitude:  number
  frp:        number   // Fire Radiative Power (MW) — intensity indicator
  confidence: 'high' | 'nominal' | 'low'
  date:       string   // acq_date YYYY-MM-DD
  time:       string   // acq_time HHMM
  satellite:  string   // e.g. "N21"
  daynight:   'D' | 'N'
  brightness: number   // bright_ti4 (K)
}

// Proxy path — Vite rewrites /api/firms → https://firms.modaps.eosdis.nasa.gov
const FIRMS_CSV = '/api/firms/data/active_fire/noaa-20-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv'

export async function fetchWildfires(): Promise<FirePoint[]> {
  const res = await fetch(FIRMS_CSV, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`)
  const text = await res.text()

  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  // Header: latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
  const points: FirePoint[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 13) continue
    const lat  = parseFloat(cols[0])
    const lon  = parseFloat(cols[1])
    const frp  = parseFloat(cols[11])
    if (isNaN(lat) || isNaN(lon)) continue

    const conf = cols[8].trim().toLowerCase()
    points.push({
      id:         `fire-${i}`,
      latitude:   lat,
      longitude:  lon,
      brightness: parseFloat(cols[2]),
      frp:        isNaN(frp) ? 0 : frp,
      date:       cols[5].trim(),
      time:       cols[6].trim(),
      satellite:  cols[7].trim(),
      confidence: conf === 'high' ? 'high' : conf === 'low' ? 'low' : 'nominal',
      daynight:   (cols[12].trim() as 'D' | 'N') || 'D',
    })
  }

  console.info(`[FIRMS] ${points.length} active fire detections loaded`)
  return points
}
