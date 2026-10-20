/**
 * Verified Internet outages from Cloudflare Radar's Outage Center.
 *
 * Source: Cloudflare Radar API, /radar/annotations/outages, via this app's /api/cloudflare-radar proxy
 * (free Cloudflare account token, Account > Radar > Read; no paid tier). Data is CC BY-NC 4.0.
 *
 * How this differs from IODA (services/outages.ts): IODA is an automatic detector, with many alerts,
 * percentage drops and no cause. Radar's entries are fewer and curated by Cloudflare staff. Each one gives
 * the cause Cloudflare states (government directed, power outage, cable cut, military action …), its scope
 * (nationwide / regional / network) and usually a link to the write-up. The cause is Cloudflare's own
 * attribution, not something this app infers.
 *
 * Like eia.ts, failures are not collapsed into `[]`: "not configured", "error" and "ok" stay distinct,
 * so a missing token never reads as "no outages".
 */

export interface RadarOutage {
  id: string
  /** Radar's cause enum, e.g. GOVERNMENT_DIRECTED, POWER_OUTAGE, CABLE_CUT ('UNKNOWN' when absent) */
  cause: string
  /** NATIONWIDE | REGIONAL | NETWORK | PLATFORM ('' when absent) */
  type: string
  /** Radar's free-text scope, e.g. a region or city name ('' when absent) */
  scope: string
  countries: { code: string; name: string }[]
  asns: { asn: number; name: string }[]
  /** ms since epoch */
  start: number
  /** ms since epoch; null while Radar has no end time recorded */
  end: number | null
  description: string
  linkedUrl: string
}

export type RadarResult =
  | { status: 'ok'; outages: RadarOutage[] }
  | { status: 'not_configured' }
  | { status: 'error'; message: string }

export type RadarRange = '1d' | '7d' | '14d' | '28d'

export const RADAR_CAUSE_LABEL: Record<string, string> = {
  GOVERNMENT_DIRECTED: 'Government-directed shutdown',
  MILITARY_ACTION: 'Military action',
  CYBERATTACK: 'Cyberattack',
  BLOCKING: 'Blocking',
  POWER_OUTAGE: 'Power outage',
  CABLE_CUT: 'Cable cut',
  NATURAL_DISASTER: 'Natural disaster',
  WEATHER: 'Weather',
  FIRE: 'Fire',
  MAINTENANCE: 'Maintenance',
  MECHANICAL: 'Mechanical failure',
  MISCONFIGURATION: 'Misconfiguration',
  NETWORK_PROBLEM: 'Network problem',
  TECHNICAL_PROBLEM: 'Technical problem',
  SOFTWARE: 'Software',
  DNS: 'DNS',
  UNKNOWN: 'Cause not stated',
}

/** Causes that are deliberate or conflict-driven: the ones that tend to accompany unrest. */
export const RADAR_UNREST_CAUSES = new Set(['GOVERNMENT_DIRECTED', 'MILITARY_ACTION', 'BLOCKING', 'CYBERATTACK'])

export const radarCauseLabel = (cause: string) =>
  RADAR_CAUSE_LABEL[cause] ?? cause.toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const time = (v: unknown) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null }

/** Radar annotations → RadarOutage[]; entries without an id or a parseable start are dropped. Exported for tests. */
export function parseRadarOutages(json: unknown): RadarOutage[] | null {
  const rows = (json as { result?: { annotations?: unknown } } | null)?.result?.annotations
  if (!Array.isArray(rows)) return null
  const out: RadarOutage[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const a = r as Record<string, unknown>
    const id = str(a.id)
    const start = time(a.startDate)
    if (!id || start === null) continue
    const outage = (a.outage && typeof a.outage === 'object' ? a.outage : {}) as Record<string, unknown>
    const details = Array.isArray(a.locationsDetails) ? a.locationsDetails : []
    const codes = Array.isArray(a.locations) ? a.locations.filter((c): c is string => typeof c === 'string') : []
    const countries = details.length
      ? details.filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && typeof (d as { code?: unknown }).code === 'string')
          .map(d => ({ code: str(d.code).toUpperCase(), name: str(d.name) || str(d.code).toUpperCase() }))
      : codes.map(c => ({ code: c.toUpperCase(), name: c.toUpperCase() }))
    const asns = (Array.isArray(a.asnsDetails) ? a.asnsDetails : [])
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
      .map(d => ({ asn: Number(d.asn), name: str(d.name) }))
      .filter(d => Number.isFinite(d.asn) && d.asn > 0)
    out.push({
      id,
      cause: str(outage.outageCause) || 'UNKNOWN',
      type: str(outage.outageType),
      scope: str(a.scope),
      countries,
      asns,
      start,
      end: time(a.endDate),
      description: str(a.description),
      linkedUrl: /^https?:\/\//.test(str(a.linkedUrl)) ? str(a.linkedUrl) : '',
    })
  }
  // open entries first, then the most recent start
  return out.sort((x, y) => (x.end === null ? 0 : 1) - (y.end === null ? 0 : 1) || y.start - x.start)
}

const TTL_MS = 15 * 60 * 1000
const cache = new Map<RadarRange, { at: number; result: RadarResult }>()

export async function fetchRadarOutages(range: RadarRange = '7d'): Promise<RadarResult> {
  const hit = cache.get(range)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result
  let result: RadarResult
  try {
    const res = await fetch(`/api/cloudflare-radar?range=${range}`, { signal: AbortSignal.timeout(25_000) })
    const body = await res.json().catch(() => null) as { error?: { code?: string; message?: string }; errors?: { message?: string }[] } | null
    if (res.status === 503 && body?.error?.code === 'not_configured') {
      return { status: 'not_configured' }   // not cached: a token added to .env shows up on the next poll
    }
    if (!res.ok) {
      const msg = body?.error?.message ?? body?.errors?.[0]?.message
      result = { status: 'error', message: `Cloudflare Radar returned HTTP ${res.status}${msg ? `: ${msg}` : ''}` }
    } else {
      const parsed = parseRadarOutages(body)
      result = parsed ? { status: 'ok', outages: parsed } : { status: 'error', message: 'Unexpected response from Cloudflare Radar (no annotations).' }
    }
  } catch {
    return { status: 'error', message: 'Cloudflare Radar could not be reached.' }
  }
  if (result.status === 'ok') cache.set(range, { at: Date.now(), result })
  return result
}
