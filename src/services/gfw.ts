/**
 * Dark vessels and at-sea encounters from Global Fishing Watch (GFW) Events API v3.
 *
 * Source: GFW, via this app's /api/gfw proxy (free token, non-commercial use only, CC BY-NC 4.0; attribution
 * "Powered by Global Fishing Watch" is required wherever this data is shown). Two datasets:
 *   - AIS off events (`public-global-gaps-events`): a vessel stopped broadcasting AIS for 12 h or more, starting
 *     at least 50 nm from shore, in an area with good satellite reception. GFW classes these as likely
 *     intentional disabling. GFW calls the dataset a prototype, and "likely intentional" is GFW's model output,
 *     not proof: going dark can also be a security measure (e.g. against piracy) or a transponder fault.
 *   - Encounters (`public-global-encounters-events`): two vessels close together, slowly, for a while, often a
 *     fishing vessel and a carrier (possible transshipment). `potentialRisk` is GFW's own flag: on the high seas
 *     or in an RFMO area, one of the vessels has no matching public authorisation. GFW never flags encounters
 *     inside an EEZ, because it has no national registries.
 * Field names follow GFW's official API client (gfw-api-python-client, EventItem/Gap/EventEncounter models).
 *
 * GFW processes AIS in batches, so the newest events are days old, not live; the panel shows the newest date
 * actually present rather than claiming a fixed delay.
 *
 * Like eia.ts, failures are not collapsed into `[]`: "not configured", "error" and "ok" stay distinct.
 */

export type GfwKind = 'gaps' | 'encounters'
export type GfwDays = 7 | 30 | 90

export interface GfwVessel { name: string; flag: string; type: string; ssvid: string }

export interface GfwEvent {
  id: string
  kind: GfwKind
  /** ms since epoch */
  start: number
  end: number
  /** where it is drawn: gaps at the point AIS went off; encounters at the meeting point */
  lat: number
  lon: number
  vessel: GfwVessel
  /** the other vessel, for encounters */
  other: GfwVessel | null
  durationHours: number
  /** gaps: straight-line distance between the last position before and the first after the gap */
  gapDistanceKm: number | null
  /** gaps: where AIS came back on, when GFW gives it */
  onPosition: { lat: number; lon: number } | null
  /** encounters, e.g. "fishing-carrier" */
  encounterType: string
  /** encounters: GFW's flag for a missing matching public authorisation */
  potentialRisk: boolean
  /** true when GFW places the event on the high seas (outside every EEZ) */
  highSeas: boolean
  distanceFromShoreKm: number | null
}

export type GfwResult =
  | { status: 'ok'; events: GfwEvent[]; capped: boolean; total: number | null; newest: number | null }
  | { status: 'not_configured' }
  | { status: 'error'; message: string }

/** Must match api/gfw.ts GFW_LIMIT: a full page means the window held more events than one request returns. */
export const GFW_PAGE = 1000

export const GFW_ATTRIBUTION = { text: 'Powered by Global Fishing Watch', url: 'https://globalfishingwatch.org' }

export const GFW_KIND_LABEL: Record<GfwKind, string> = { gaps: 'AIS switched off', encounters: 'Encounter at sea' }

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
const time = (v: unknown) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null }
const obj = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {})
function point(v: unknown): { lat: number; lon: number } | null {
  const p = obj(v)
  const lat = num(p.lat), lon = num(p.lon)
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null
  return { lat, lon }
}
const vessel = (v: unknown): GfwVessel => {
  const o = obj(v)
  return { name: str(o.name).trim(), flag: str(o.flag).toUpperCase(), type: str(o.type).toLowerCase(), ssvid: str(o.ssvid) }
}

/** GFW events payload → GfwEvent[]; entries without an id, valid times or a usable position are dropped. Exported for tests. */
export function parseGfwEvents(json: unknown, kind: GfwKind): GfwEvent[] | null {
  const rows = obj(json).entries
  if (!Array.isArray(rows)) return null
  const out: GfwEvent[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const e = r as Record<string, unknown>
    const id = str(e.id)
    const start = time(e.start)
    const end = time(e.end) ?? start
    if (!id || start === null || end === null) continue
    const gap = obj(e.gap)
    const enc = obj(e.encounter)
    // A gap is drawn where the vessel went dark; fall back to the event position.
    const at = (kind === 'gaps' ? point(gap.offPosition) : null) ?? point(e.position)
    if (!at) continue
    const regions = obj(e.regions)
    const distances = obj(e.distances)
    out.push({
      id, kind, start, end, lat: at.lat, lon: at.lon,
      vessel: vessel(e.vessel),
      other: kind === 'encounters' && enc.vessel ? vessel(enc.vessel) : null,
      durationHours: num(gap.durationHours) ?? Math.max(0, (end - start) / 3_600_000),
      gapDistanceKm: kind === 'gaps' ? num(gap.distanceKm) : null,
      onPosition: kind === 'gaps' ? point(gap.onPosition) : null,
      encounterType: kind === 'encounters' ? str(enc.type).toLowerCase() : '',
      potentialRisk: kind === 'encounters' && enc.potentialRisk === true,
      highSeas: Array.isArray(regions.highSeas) && regions.highSeas.length > 0,
      distanceFromShoreKm: num(distances.startDistanceFromShoreKm),
    })
  }
  return out.sort((a, b) => b.start - a.start)
}

const TTL_MS = 60 * 60 * 1000
const rawCount = (body: unknown) => { const e = obj(body).entries; return Array.isArray(e) ? e.length : 0 }
const cache = new Map<string, { at: number; result: GfwResult }>()

export async function fetchGfwEvents(kind: GfwKind, days: GfwDays = 30): Promise<GfwResult> {
  const key = `${kind}:${days}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result
  let result: GfwResult
  try {
    const res = await fetch(`/api/gfw?kind=${kind}&days=${days}`, { signal: AbortSignal.timeout(30_000) })
    const body = await res.json().catch(() => null) as Record<string, unknown> | null
    const err = obj(body?.error)
    if (res.status === 503 && err.code === 'not_configured') return { status: 'not_configured' }   // not cached
    if (!res.ok) {
      const msg = str(err.message) || str(body?.message) || (Array.isArray(body?.messages) ? str(obj(body!.messages[0]).detail) : '')
      result = { status: 'error', message: `Global Fishing Watch returned HTTP ${res.status}${msg ? `: ${msg}` : ''}` }
    } else {
      const events = parseGfwEvents(body, kind)
      const total = num(body?.total)
      result = events
        // GFW sets nextOffset even on the last page (see its own examples), so `total` decides whether rows were left out.
        ? { status: 'ok', events, total, capped: total !== null ? total > rawCount(body) : rawCount(body) >= GFW_PAGE,
            newest: events.length ? Math.max(...events.map(e => e.start)) : null }
        : { status: 'error', message: 'Unexpected response from Global Fishing Watch (no entries).' }
    }
  } catch {
    return { status: 'error', message: 'Global Fishing Watch could not be reached.' }
  }
  if (result.status === 'ok') cache.set(key, { at: Date.now(), result })
  return result
}

/** Both datasets at once, for the map layer and the analyst. */
export async function fetchGfwAll(days: GfwDays = 30): Promise<{ gaps: GfwResult; encounters: GfwResult }> {
  const [gaps, encounters] = await Promise.all([fetchGfwEvents('gaps', days), fetchGfwEvents('encounters', days)])
  return { gaps, encounters }
}
