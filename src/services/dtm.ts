/**
 * IOM Displacement Tracking Matrix (DTM) — survey-based IDP counts per assessment round, through
 * this app's /api/dtm proxy (free key, DTM_API_KEY server-side). DTM only covers countries where
 * IOM runs a tracking operation, and one country can have several operations (for example a
 * nationwide one and a regional one) that must not be added together, so they are kept apart.
 *
 * Field names follow the v3 API (admin0Name, operation, reportingDate, roundNumber,
 * numPresentIdpInd, admin1Name, admin1Pcode, displacementReason). Rows can be split by
 * displacement reason or origin, so figures are summed within one operation + round + area.
 */

export interface DtmOperation {
  operation: string
  reportingDate: string   // YYYY-MM-DD
  round: number | null
  idps: number
  /** the operation's previous round inside the fetched window, when there is one */
  prevDate: string | null
  prevIdps: number | null
  /** displacement reasons with their share, largest first (only when DTM splits by reason) */
  reasons: { reason: string; idps: number }[]
}

export interface DtmRegion {
  name: string
  pcode: string | null
  idps: number
}

export type DtmResult =
  | { status: 'ok'; iso3: string; operations: DtmOperation[]; regions: DtmRegion[]; regionsFrom: { operation: string; reportingDate: string } | null }
  | { status: 'not_configured' }
  | { status: 'error'; message: string }

type Row = Record<string, unknown>

const pick = (r: Row, ...keys: string[]): unknown => { for (const k of keys) if (r[k] != null) return r[k]; return undefined }
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown) => { const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN; return Number.isFinite(n) && n > 0 ? n : 0 }

const opOf = (r: Row) => str(pick(r, 'operation', 'Operation'))
const dateOf = (r: Row) => str(pick(r, 'reportingDate', 'ReportingDate')).slice(0, 10)
const roundOf = (r: Row) => { const n = Number(pick(r, 'roundNumber', 'RoundNumber')); return Number.isFinite(n) ? n : null }
const idpsOf = (r: Row) => num(pick(r, 'numPresentIdpInd', 'NumPresentIdpInd'))

/** Unwraps DTM's `{ isSuccess, result }` envelope; null when the payload isn't one. */
function rowsOf(body: unknown): Row[] | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { isSuccess?: unknown; result?: unknown }
  if (b.isSuccess === false) return null
  return Array.isArray(b.result) ? b.result.filter((r): r is Row => !!r && typeof r === 'object') : null
}

/** Pure: latest round per operation (with the one before it), from admin0 rows. */
export function parseOperations(rows: Row[]): DtmOperation[] {
  // operation → date → { idps, round, reasons }
  const byOp = new Map<string, Map<string, { idps: number; round: number | null; reasons: Map<string, number> }>>()
  for (const r of rows) {
    const op = opOf(r), date = dateOf(r), n = idpsOf(r)
    if (!op || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !n) continue
    const dates = byOp.get(op) ?? new Map()
    byOp.set(op, dates)
    const slot = dates.get(date) ?? { idps: 0, round: roundOf(r), reasons: new Map<string, number>() }
    dates.set(date, slot)
    slot.idps += n
    const reason = str(pick(r, 'displacementReason', 'DisplacementReason'))
    if (reason) slot.reasons.set(reason, (slot.reasons.get(reason) ?? 0) + n)
  }
  const out: DtmOperation[] = []
  for (const [operation, dates] of byOp) {
    const sorted = [...dates.entries()].sort(([a], [b]) => b.localeCompare(a))
    const [latestDate, latest] = sorted[0]
    const prev = sorted[1]
    out.push({
      operation, reportingDate: latestDate, round: latest.round, idps: latest.idps,
      prevDate: prev?.[0] ?? null, prevIdps: prev?.[1].idps ?? null,
      reasons: [...latest.reasons.entries()].map(([reason, idps]) => ({ reason, idps })).sort((a, b) => b.idps - a.idps),
    })
  }
  return out.sort((a, b) => b.idps - a.idps)
}

/** Pure: admin1 breakdown for one operation's latest round. */
export function parseRegions(rows: Row[], operation: string): { regions: DtmRegion[]; reportingDate: string } | null {
  const own = rows.filter(r => opOf(r) === operation && /^\d{4}-\d{2}-\d{2}$/.test(dateOf(r)))
  if (!own.length) return null
  const latest = own.map(dateOf).sort().pop()!
  const regions = new Map<string, DtmRegion>()
  for (const r of own) {
    if (dateOf(r) !== latest) continue
    const name = str(pick(r, 'admin1Name', 'Admin1Name'))
    const n = idpsOf(r)
    if (!name || !n) continue
    const pcode = str(pick(r, 'admin1Pcode', 'Admin1Pcode')) || null
    const key = pcode ?? name
    const reg = regions.get(key) ?? { name, pcode, idps: 0 }
    regions.set(key, reg)
    reg.idps += n
  }
  return { regions: [...regions.values()].sort((a, b) => b.idps - a.idps), reportingDate: latest }
}

const TTL_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; result: DtmResult }>()

async function getLevel(level: 'admin0' | 'admin1', iso3: string): Promise<{ rows: Row[] } | DtmResult> {
  const res = await fetch(`/api/dtm?level=${level}&iso3=${iso3}`, { signal: AbortSignal.timeout(30_000) })
  const body = await res.json().catch(() => null) as { error?: { code?: string; message?: string } } | null
  if (res.status === 503 && body?.error?.code === 'not_configured') return { status: 'not_configured' }
  if (!res.ok) return { status: 'error', message: `IOM DTM returned HTTP ${res.status}${body?.error?.message ? `: ${body.error.message}` : ''}` }
  const rows = rowsOf(body)
  if (!rows) return { status: 'error', message: 'IOM DTM sent a response in an unexpected format.' }
  return { rows }
}

/** DTM rounds for one country (ISO3). Never throws; a country DTM doesn't cover is `ok` with no operations. */
export async function fetchDtm(iso3: string, now = Date.now()): Promise<DtmResult> {
  const code = iso3.toUpperCase()
  const hit = cache.get(code)
  if (hit && now - hit.at < TTL_MS) return hit.result
  let result: DtmResult
  try {
    const [a0, a1] = await Promise.all([getLevel('admin0', code), getLevel('admin1', code)])
    if (!('rows' in a0)) result = a0
    else {
      const operations = parseOperations(a0.rows)
      const main = operations[0]
      const reg = main && 'rows' in a1 ? parseRegions(a1.rows, main.operation) : null
      result = {
        status: 'ok', iso3: code, operations,
        regions: reg?.regions ?? [],
        regionsFrom: reg ? { operation: main.operation, reportingDate: reg.reportingDate } : null,
      }
    }
  } catch (e) {
    result = { status: 'error', message: e instanceof Error ? e.message : 'IOM DTM could not be reached.' }
  }
  if (result.status !== 'error') cache.set(code, { at: now, result })
  return result
}
