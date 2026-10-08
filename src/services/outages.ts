/**
 * Internet outage data via IODA (Internet Outage Detection and Analysis, Georgia Tech).
 * API: https://api.ioda.inetintel.cc.gatech.edu/v2/ — free, no authentication.
 *
 * Endpoint: /outages/alerts → { data: [ { entity: { name, type, code, attrs }, datasource, time, level, condition, value, historyValue } ] }
 * IODA raises `level: "critical"` when a signal drops below its threshold and `level: "normal"` when it
 * recovers, so the feed is a stream of state changes. We fold it into one event per entity (country,
 * region, network or network-in-region): ongoing if any signal's latest alert is critical, recovered if
 * all of them have since returned to normal.
 *
 * Severity is this app's own grading of the measured drop below IODA's baseline (IODA itself only says
 * "critical"): ≥50 % severe, 20–49 % major, under 20 % minor.
 *
 * Location: IODA has no coordinates finer than a region. Region alerts (and network-in-region alerts)
 * are placed on their region via public/data/ioda-regions.json (built from IODA's own region topology
 * by scripts/build-ioda-regions.mjs); country alerts on the country; network-only alerts are left
 * unplaced rather than guessed.
 */

export type OutageSeverity = 'severe' | 'major' | 'minor'

/** One IODA measurement for an entity — its latest alert in the window. */
export interface OutageSignal {
  /** IODA datasource id: bgp, ping-slash24, merit-nt, gtr … */
  source: string
  level: string
  /** % below the baseline at that alert (0 when at/above baseline) */
  dropPct: number
  value: number
  baseline: number
  time: number
}

export interface OutageLocation {
  lng: number
  lat: number
  /** region = the sub-national region IODA detected it in; country = only known country-wide */
  precision: 'region' | 'country'
  /** human name of the place the point stands for */
  label: string
}

export interface OutageEvent {
  id: string
  entityType: 'country' | 'asn' | 'region' | 'geoasn' | string
  entityName: string
  entityCode: string
  /** network operator, for asn/geoasn entities */
  org: string
  status: 'ongoing' | 'recovered'
  /** 'critical' while ongoing, 'normal' once recovered (kept for callers that count critical outages) */
  level: 'critical' | 'normal'
  severity: OutageSeverity
  /** worst drop among the currently-critical signals (or, once recovered, the worst seen in the window) */
  dropPct: number
  /** first critical alert in the window, unix seconds */
  start: number
  /** latest alert of any kind, unix seconds — the recovery time when recovered */
  lastAlert: number
  signals: OutageSignal[]
  location: OutageLocation | null
}

/** Plain-language meaning of each IODA datasource, for popups and the panel. */
export const OUTAGE_SOURCES: Record<string, { label: string; meaning: string }> = {
  'bgp':          { label: 'BGP routing',      meaning: 'share of the area\'s address blocks still visible in global Internet routing' },
  'ping-slash24': { label: 'Active probing',   meaning: 'share of the area\'s /24 address blocks still answering IODA\'s pings' },
  'merit-nt':     { label: 'Network telescope', meaning: 'background traffic from the area reaching Merit\'s network telescope' },
  'gtr':          { label: 'Google traffic',   meaning: 'traffic to Google products from the area (Google Transparency Report)' },
}

export const SEVERITY_LABEL: Record<OutageSeverity, string> = { severe: 'Severe', major: 'Major', minor: 'Minor' }

export function outageSeverity(dropPct: number): OutageSeverity {
  return dropPct >= 50 ? 'severe' : dropPct >= 20 ? 'major' : 'minor'
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

/** [lng, lat, name, iso2] per IODA region code. */
export type RegionPoints = Record<string, [number, number, string, string]>

const REGIONS_URL = '/data/ioda-regions.json'
let regionsPromise: Promise<RegionPoints> | null = null

/** Region points, fetched once. Resolves to {} on failure (alerts then fall back to the country). */
export function loadRegionPoints(): Promise<RegionPoints> {
  regionsPromise ??= fetch(REGIONS_URL)
    .then(r => (r.ok ? r.json() : null))
    .then(j => (j && typeof j.regions === 'object' && j.regions ? (j.regions as RegionPoints) : {}))
    .catch(() => ({}))
    .then(r => { if (!Object.keys(r).length) regionsPromise = null; return r })
  return regionsPromise
}

export function locateOutage(entityType: string, code: string, countryCode: string, regions: RegionPoints): OutageLocation | null {
  const region = (id: string): OutageLocation | null => {
    const r = regions[id]
    return r ? { lng: r[0], lat: r[1], precision: 'region', label: r[3] ? `${r[2]}, ${r[3]}` : r[2] } : null
  }
  const country = (cc: string): OutageLocation | null => {
    const c = getCountryCentroid(cc)
    return c ? { lng: c[0], lat: c[1], precision: 'country', label: cc.toUpperCase() } : null
  }
  if (entityType === 'country') return country(code)
  if (entityType === 'region') return region(code) ?? (countryCode ? country(countryCode) : null)
  if (entityType === 'geoasn') {
    // "ASN-REGION" where REGION is an IODA region id, or "ASN-CC" for a network's whole-country slice
    const suffix = code.slice(code.indexOf('-') + 1)
    return /^\d+$/.test(suffix) ? region(suffix) : /^[A-Za-z]{2}$/.test(suffix) ? country(suffix) : null
  }
  return null   // plain ASN: IODA gives no location
}

interface RawAlert {
  entity?: { name?: unknown; type?: unknown; code?: unknown; attrs?: { org?: unknown; country_code?: unknown } }
  datasource?: unknown; time?: unknown; level?: unknown; value?: unknown; historyValue?: unknown
}

/** Folds IODA's alert stream into one event per entity. Exported for tests. */
export function foldOutageAlerts(raw: unknown[], regions: RegionPoints = {}): OutageEvent[] {
  type Acc = { type: string; code: string; name: string; org: string; cc: string; critical: boolean; first: number; last: number; worst: number; bySource: Map<string, OutageSignal> }
  const byEntity = new Map<string, Acc>()
  const alerts = raw
    .filter((a): a is RawAlert => !!a && typeof a === 'object')
    .map(a => ({ a, t: Number(a.time) || 0 }))
    .sort((x, y) => x.t - y.t)

  for (const { a, t } of alerts) {
    const e = a.entity ?? {}
    const type = String(e.type ?? 'unknown')
    const code = String(e.code ?? '')
    const key = `${type}:${code}`
    const value = Number(a.value) || 0
    const baseline = Number(a.historyValue ?? value) || 0
    const dropPct = baseline > 0 ? Math.round((Math.max(0, baseline - value) / baseline) * 100) : 0
    const level = a.level === 'critical' ? 'critical' : 'normal'
    let acc = byEntity.get(key)
    if (!acc) {
      acc = { type, code, name: String(e.name ?? '—'), org: String(e.attrs?.org ?? ''), cc: String(e.attrs?.country_code ?? ''), critical: false, first: 0, last: 0, worst: 0, bySource: new Map() }
      byEntity.set(key, acc)
    }
    if (level === 'critical') {
      if (!acc.critical) { acc.critical = true; acc.first = t }
      acc.worst = Math.max(acc.worst, dropPct)
    }
    acc.last = Math.max(acc.last, t)
    const source = String(a.datasource ?? 'unknown')
    acc.bySource.set(source, { source, level, dropPct, value, baseline, time: t })
  }

  const out: OutageEvent[] = []
  for (const [key, acc] of byEntity) {
    if (!acc.critical) continue   // only recovery notices for something that started before the window
    const signals = [...acc.bySource.values()].sort((x, y) => y.dropPct - x.dropPct)
    const live = signals.filter(s => s.level === 'critical')
    const ongoing = live.length > 0
    const dropPct = ongoing ? Math.max(...live.map(s => s.dropPct)) : acc.worst
    out.push({
      id: key,
      entityType: acc.type,
      entityName: acc.name,
      entityCode: acc.code,
      org: acc.org,
      status: ongoing ? 'ongoing' : 'recovered',
      level: ongoing ? 'critical' : 'normal',
      severity: outageSeverity(dropPct),
      dropPct,
      start: acc.first,
      lastAlert: acc.last,
      signals,
      location: locateOutage(acc.type, acc.code, acc.cc, regions),
    })
  }
  // ongoing first, then the deepest drop, then the most recent
  return out.sort((a, b) =>
    (a.status === b.status ? 0 : a.status === 'ongoing' ? -1 : 1) || b.dropPct - a.dropPct || b.lastAlert - a.lastAlert)
}

export async function fetchOutageEvents(lookbackHours = 24): Promise<OutageEvent[]> {
  const until = Math.floor(Date.now() / 1000)
  const from  = until - lookbackHours * 3600
  // The window holds ~1,200 alerts a day; a small limit silently drops most of them.
  const url = `${BASE}/outages/alerts?from=${from}&until=${until}&limit=10000`

  const [resp, regions] = await Promise.all([
    fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'Accept': 'application/json' } }),
    loadRegionPoints(),
  ])
  if (!resp.ok) throw new Error(`IODA HTTP ${resp.status}`)
  const json = await resp.json()
  return foldOutageAlerts(Array.isArray(json?.data) ? json.data : [], regions)
}
