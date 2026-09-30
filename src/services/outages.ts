/**
 * Internet outage data via IODA (Internet Outage Detection and Analysis)
 * API: https://api.ioda.inetintel.cc.gatech.edu/v2/
 * No authentication required.
 *
 * Confirmed working endpoint: /outages/alerts
 * Response shape: { data: [ { entity: { name, type, code }, time, level, value, historyValue } ] }
 */

export interface OutageEvent {
  id: string
  entityType: 'country' | 'asn' | 'region' | 'geoasn' | string
  entityName: string
  entityCode: string
  start: number       // unix epoch seconds
  duration: number    // seconds (0 for alerts — point-in-time)
  score: number       // current value (lower = worse outage)
  overallScore: number // historical baseline value
  level: 'critical' | 'warning' | string
}

const BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2'

// Representative point per ISO2/ISO3 country code, for map placement —
// IODA entities are country/ASN/region level with no lat/lon of their own.
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AF:[66.0,33.9], AL:[20.2,41.2], DZ:[2.6,28.0], AO:[17.9,-11.2], AR:[-63.6,-38.4],
  AM:[45.0,40.1], AU:[133.8,-25.3], AT:[14.6,47.6], AZ:[47.6,40.1], BH:[50.6,26.0],
  BD:[90.4,23.7], BY:[27.9,53.7], BE:[4.5,50.5], BJ:[2.3,9.3], BO:[-63.6,-16.3],
  BA:[17.7,43.9], BW:[24.7,-22.3], BR:[-51.9,-14.2], BN:[114.7,4.5], BG:[25.5,42.7],
  BF:[-1.6,12.2], BI:[29.9,-3.4], KH:[104.9,12.6], CM:[12.4,7.4], CA:[-106.3,56.1],
  TD:[18.7,15.5], CL:[-71.5,-35.7], CN:[104.2,35.9], CO:[-74.3,4.6], CD:[23.6,-4.0],
  CG:[15.8,-0.2], CR:[-84.1,9.7], CI:[-5.5,7.5], HR:[15.2,45.1], CU:[-77.8,21.5],
  CY:[33.4,35.1], CZ:[15.5,49.8], DK:[9.5,56.3], DJ:[42.6,11.8], DO:[-70.2,18.7],
  EC:[-78.2,-1.8], EG:[30.8,26.8], SV:[-88.9,13.8], ER:[39.8,15.2], EE:[25.0,58.6],
  ET:[40.5,9.1], FJ:[178.1,-17.7], FI:[25.7,61.9], FR:[2.2,46.6], GA:[11.6,-0.8],
  GM:[-15.3,13.4], GE:[43.4,42.3], DE:[10.5,51.2], GH:[-1.0,7.9], GR:[21.8,39.1],
  GT:[-90.2,15.8], GN:[-9.7,9.9], GW:[-15.2,12.0], GY:[-58.9,4.9], HT:[-72.3,18.9],
  HN:[-86.2,15.2], HK:[114.2,22.3], HU:[19.5,47.2], IS:[-19.0,64.9], IN:[78.9,20.6],
  ID:[113.9,-0.8], IR:[53.7,32.4], IQ:[43.7,33.2], IE:[-8.2,53.4], IL:[34.9,31.0],
  IT:[12.6,41.9], JM:[-77.3,18.1], JP:[138.3,36.2], JO:[36.2,30.6], KZ:[66.9,48.0],
  KE:[37.9,-0.0], KW:[47.5,29.3], KG:[74.8,41.2], LA:[102.5,19.9], LV:[24.6,56.9],
  LB:[35.9,33.9], LR:[-9.4,6.4], LY:[17.2,26.3], LT:[23.9,55.2], LU:[6.1,49.8],
  MG:[46.9,-18.8], MW:[34.3,-13.3], MY:[101.9,4.2], ML:[-4.0,17.6], MR:[-10.9,21.0],
  MX:[-102.6,23.6], MD:[28.4,47.4], MN:[103.8,46.9], ME:[19.4,42.7], MA:[-7.1,31.8],
  MZ:[35.5,-18.7], MM:[95.9,21.9], NA:[18.5,-22.1], NP:[84.1,28.4], NL:[5.3,52.1],
  NZ:[174.9,-40.9], NI:[-85.2,12.9], NE:[8.1,17.6], NG:[8.7,9.1], KP:[127.5,40.3],
  MK:[21.7,41.6], NO:[8.5,60.5], OM:[56.1,21.5], PK:[69.3,30.4], PA:[-80.8,8.5],
  PG:[143.9,-6.3], PY:[-58.4,-23.4], PE:[-75.0,-9.2], PH:[121.8,12.9], PL:[19.1,51.9],
  PT:[-8.2,39.4], QA:[51.2,25.4], RO:[24.9,45.9], RU:[105.3,61.5], RW:[29.9,-1.9],
  SA:[45.1,23.9], SN:[-14.5,14.5], RS:[21.0,44.0], SL:[-11.8,8.5], SG:[103.8,1.3],
  SK:[19.7,48.7], SI:[14.8,46.1], SO:[46.2,5.2], ZA:[24.7,-30.6], KR:[127.8,35.9],
  SS:[30.0,7.0], ES:[-3.7,40.5], LK:[80.8,7.9], SD:[30.2,12.9], SE:[18.6,60.1],
  CH:[8.2,46.8], SY:[38.5,35.0], TW:[121.0,23.7], TJ:[71.3,38.9], TZ:[34.9,-6.4],
  TH:[101.0,15.9], TG:[1.2,8.6], TN:[9.5,33.9], TR:[35.2,38.9], TM:[59.6,38.97],
  UG:[32.3,1.4], UA:[31.2,48.4], AE:[54.0,24.0], GB:[-1.5,52.4], US:[-98.6,39.8],
  UY:[-55.8,-32.5], UZ:[64.6,41.4], VE:[-66.6,6.4], VN:[108.3,14.1], YE:[48.5,15.6],
  ZM:[27.8,-13.1], ZW:[29.2,-19.0], XK:[20.9,42.6],
}

export function getCountryCentroid(code: string): [number, number] | null {
  return COUNTRY_CENTROIDS[code.toUpperCase()] ?? null
}

export async function fetchOutageEvents(lookbackHours = 24): Promise<OutageEvent[]> {
  const until = Math.floor(Date.now() / 1000)
  const from  = until - lookbackHours * 3600

  // /outages/alerts is the correct, working endpoint (v2 API)
  const url = `${BASE}/outages/alerts?from=${from}&until=${until}&limit=200`

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'Accept': 'application/json' },
  })

  if (!resp.ok) throw new Error(`IODA HTTP ${resp.status}`)

  const json = await resp.json()

  // Response: { data: [ { entity: { name, type, code }, time, level, value, historyValue } ] }
  const raw: unknown[] = Array.isArray(json?.data) ? json.data : []

  const seen = new Set<string>()
  const results: OutageEvent[] = []

  for (let i = 0; i < raw.length; i++) {
    const e = raw[i] as Record<string, unknown>
    const entity = (e.entity ?? {}) as Record<string, unknown>
    const name   = String(entity.name ?? '—')
    const type   = String(entity.type ?? 'unknown')
    const code   = String(entity.code ?? '')
    const value  = Number(e.value ?? 0)
    const hist   = Number(e.historyValue ?? value)

    // Compute severity score: how far below historical baseline (higher = worse)
    // For outages, value < historyValue means degradation
    const drop = Math.max(0, hist - value)
    const pct  = hist > 0 ? Math.round((drop / hist) * 100) : 0
    const score = pct * (e.level === 'critical' ? 5 : 2)

    // Deduplicate by entity name + approximate time window
    const key = `${code}-${e.level}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      id:           String(e.id ?? `ioda-${i}`),
      entityType:   type,
      entityName:   name,
      entityCode:   code,
      start:        Number(e.time ?? 0),
      duration:     0,
      score,
      overallScore: hist,
      level:        String(e.level ?? 'warning'),
    })
  }

  // Sort by score descending (most severe first)
  return results.sort((a, b) => b.score - a.score)
}
