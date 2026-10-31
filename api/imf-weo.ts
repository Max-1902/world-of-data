// Vercel serverless function — IMF World Economic Outlook figures from the IMF DataMapper API.
// The DataMapper API (https://www.imf.org/external/datamapper/api/v1/) is free and keyless but sends no CORS headers,
// so the browser can't read it directly. No key, no billing account.
//
// This fetches only the fixed host and an allowlist of three indicators (not an open proxy), keeps each in memory for
// six hours, and returns countries (ISO 3166 alpha-3 codes) plus an allowlist of the IMF's own group aggregates (the
// world, advanced and emerging economies, the euro area, emerging Asia; every other group is dropped) with the edition
// the figures come from, e.g. "World Economic Outlook (October 2026)".
import type { VercelRequest, VercelResponse } from '@vercel/node'

const BASE = 'https://www.imf.org/external/datamapper/api/v1'
/** Real GDP growth, average CPI inflation, unemployment rate. */
export const WEO_INDICATORS = ['NGDP_RPCH', 'PCPIPCH', 'LUR'] as const
export type WeoIndicator = (typeof WEO_INDICATORS)[number]
/** The IMF's aggregates kept, by its DataMapper group code. These are the IMF's own figures, not sums made here. */
export const WEO_GROUPS = ['WEOWORLD', 'ADVEC', 'OEMDC', 'EURO', 'DA'] as const

export interface WeoPayload {
  indicator: WeoIndicator
  label: string
  unit: string
  /** the edition, as the IMF states it ("World Economic Outlook (October 2026)") */
  vintage: string
  lastModified: string | null
  /** ISO3 → year → value */
  values: Record<string, Record<string, number>>
  /** WEO_GROUPS code → year → value; a group the IMF publishes no figure for is absent */
  groups: Record<string, Record<string, number>>
}

const TIMEOUT_MS = 20_000
const CACHE_MS = 6 * 60 * 60_000
const ISO3 = /^[A-Z]{3}$/
const YEAR = /^\d{4}$/

let cache = new Map<WeoIndicator, { at: number; payload: WeoPayload }>()
export function resetCache() { cache = new Map() }

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'WorldOfData/1.0' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`IMF HTTP ${res.status}`)
  return res.json()
}

/** Pure: the API's `{ values: { IND: { ISO: { year: v } } } }` plus its indicator metadata → countries and the allowlisted groups. */
export function parseWeo(indicator: WeoIndicator, data: unknown, meta: unknown): WeoPayload {
  const raw = (data as { values?: Record<string, Record<string, Record<string, unknown>>> })?.values?.[indicator]
  if (!raw || typeof raw !== 'object') throw new Error('Unexpected IMF response shape')
  const values: WeoPayload['values'] = {}
  const groups: WeoPayload['groups'] = {}
  for (const [code, years] of Object.entries(raw)) {
    const target = ISO3.test(code) ? values : (WEO_GROUPS as readonly string[]).includes(code) ? groups : null
    if (!target || !years || typeof years !== 'object') continue
    const row: Record<string, number> = {}
    for (const [y, v] of Object.entries(years)) if (YEAR.test(y) && typeof v === 'number' && Number.isFinite(v)) row[y] = v
    if (Object.keys(row).length) target[code] = row
  }
  const m = (meta as { indicators?: Record<string, { label?: unknown; unit?: unknown; source?: unknown; 'last-modified'?: unknown }> })?.indicators?.[indicator]
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)
  return {
    indicator, values, groups,
    label: str(m?.label, indicator), unit: str(m?.unit, ''),
    vintage: str(m?.source, 'World Economic Outlook (edition not stated)'),
    lastModified: typeof m?.['last-modified'] === 'string' ? m['last-modified'] : null,
  }
}

async function load(indicator: WeoIndicator): Promise<WeoPayload> {
  const hit = cache.get(indicator)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.payload
  const [data, meta] = await Promise.all([getJson(`${BASE}/${indicator}`), getJson(`${BASE}/indicators`)])
  const payload = parseWeo(indicator, data, meta)
  cache.set(indicator, { at: Date.now(), payload })
  return payload
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const indicator = String(req.query?.indicator ?? '')
  if (!(WEO_INDICATORS as readonly string[]).includes(indicator)) return res.status(400).json({ error: `indicator must be one of ${WEO_INDICATORS.join(', ')}` })
  try {
    const payload = await load(indicator as WeoIndicator)
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
    return res.status(200).json(payload)
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'IMF request failed' })
  }
}
