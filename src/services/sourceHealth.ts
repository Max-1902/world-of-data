/**
 * Source health. Nearly every service here swallows its own errors and returns `[]`, so a hook
 * can't tell "nothing happening" from "feed is down". Instead of touching each service, this
 * observes `fetch` outcomes centrally and attributes each request to a named data source by URL.
 *
 * Observation only: the wrapper never alters a request or response, and only records the
 * source id, success/failure and timestamps — no URLs with query strings, no payloads.
 */

export interface SourceRule {
  id: string
  label: string
  match: (url: string) => boolean
}

const has = (...needles: string[]) => (url: string) => needles.some(n => url.includes(n))

/** First match wins. Direct hosts and this app's own /api proxy paths both count as the same source. */
export const SOURCE_RULES: SourceRule[] = [
  { id: 'acled',     label: 'Conflict events (ACLED)',   match: has('/api/acled') },
  { id: 'opensky',   label: 'Flights (OpenSky)',         match: has('/api/opensky', 'opensky-network.org') },
  { id: 'usgs',      label: 'Earthquakes (USGS)',        match: has('earthquake.usgs.gov') },
  { id: 'firms',     label: 'Wildfires (NASA FIRMS)',    match: has('/api/firms', 'firms.modaps.eosdis.nasa.gov') },
  { id: 'gdacs',     label: 'Disaster alerts (GDACS)',   match: has('gdacs.org') },
  { id: 'ioda',      label: 'Internet outages (IODA)',   match: has('api.ioda.inetintel.cc.gatech.edu') },
  { id: 'rss',       label: 'RSS headlines',             match: has('/api/rss') },
  { id: 'gdelt',     label: 'GDELT news search',         match: has('/api/gdelt', 'api.gdeltproject.org') },
  { id: 'guardian',  label: 'The Guardian',              match: has('/api/guardian') },
  { id: 'nyt',       label: 'New York Times',            match: has('/api/nyt') },
  { id: 'newsapi',   label: 'NewsAPI',                   match: has('newsapi.org') },
  { id: 'geocode',   label: 'Place lookup (Open-Meteo)', match: has('geocoding-api.open-meteo.com') },
  { id: 'markets',   label: 'Markets (Finnhub)',         match: has('/api/finnhub') },
  { id: 'unhcr',     label: 'Displacement (UNHCR)',      match: has('api.unhcr.org') },
  { id: 'worldbank', label: 'Economy (World Bank)',      match: has('api.worldbank.org') },
  { id: 'owid',      label: 'Our World in Data',         match: has('ourworldindata.org') },
  { id: 'osm',       label: 'OpenStreetMap (Overpass)',  match: has('overpass-api.de', 'overpass.openstreetmap.fr') },
  { id: 'ai',        label: 'AI Analyst (OpenRouter)',   match: has('/api/openrouter') },
]

export function sourceForUrl(url: string): SourceRule | null {
  return SOURCE_RULES.find(r => r.match(url)) ?? null
}

export type HealthStatus = 'ok' | 'degraded' | 'down'

export interface SourceHealth {
  id: string
  label: string
  status: HealthStatus
  lastOk: number | null
  lastFail: number | null
  lastError: string | null
  /** successes / attempts across the most recent window */
  okCount: number
  attempts: number
}

/** Outcomes remembered per source. Small on purpose: health should reflect "lately", not all session. */
const WINDOW = 10

interface Record_ { label: string; recent: boolean[]; lastOk: number | null; lastFail: number | null; lastError: string | null }

export function statusOf(recent: boolean[]): HealthStatus {
  const ok = recent.filter(Boolean).length
  if (ok === recent.length) return 'ok'
  if (ok === 0) return 'down'
  return 'degraded'
}

const STATUS_RANK: Record<HealthStatus, number> = { down: 0, degraded: 1, ok: 2 }

export function createHealthTracker(now: () => number = Date.now) {
  const records = new Map<string, Record_>()
  let list: SourceHealth[] = []
  const listeners = new Set<() => void>()

  function rebuild() {
    // worst first, then alphabetical, so problems are at the top of the list
    list = [...records.entries()].map(([id, r]): SourceHealth => ({
      id, label: r.label, status: statusOf(r.recent), lastOk: r.lastOk, lastFail: r.lastFail, lastError: r.lastError,
      okCount: r.recent.filter(Boolean).length, attempts: r.recent.length,
    })).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.label.localeCompare(b.label))
    listeners.forEach(l => l())
  }

  return {
    record(rule: Pick<SourceRule, 'id' | 'label'>, ok: boolean, error?: string) {
      const r = records.get(rule.id) ?? { label: rule.label, recent: [], lastOk: null, lastFail: null, lastError: null }
      r.recent = [...r.recent, ok].slice(-WINDOW)
      if (ok) r.lastOk = now()
      else { r.lastFail = now(); r.lastError = error ?? 'failed' }
      records.set(rule.id, r)
      rebuild()
    },
    getAll: () => list,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  }
}

export const healthTracker = createHealthTracker()

function isAbort(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError'
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

/**
 * Wraps `target.fetch` so each request to a known source is recorded. Returns an uninstall function.
 * Caller-initiated aborts are ignored (not a source failure); timeouts count as failures.
 */
export function installFetchObserver(tracker = healthTracker, target: { fetch: typeof fetch } = globalThis): () => void {
  const original = target.fetch
  const wrapped: typeof fetch = async (input, init) => {
    const rule = sourceForUrl(urlOf(input))
    try {
      const res = await original.call(target, input, init)
      if (rule) tracker.record(rule, res.ok, res.ok ? undefined : `HTTP ${res.status}`)
      return res
    } catch (e) {
      if (rule && !isAbort(e)) tracker.record(rule, false, e instanceof Error ? e.message : String(e))
      throw e
    }
  }
  target.fetch = wrapped
  return () => { if (target.fetch === wrapped) target.fetch = original }
}

/** One line per unhealthy source, for grounding the AI Analyst in what data it can't trust right now. */
export function healthSummary(list: SourceHealth[]): string {
  const bad = list.filter(s => s.status !== 'ok')
  if (bad.length === 0) return list.length ? 'All observed data sources responding normally.' : ''
  return bad.map(s => `  • ${s.label}: ${s.status === 'down' ? 'DOWN' : 'intermittent'}${s.lastError ? ` (${s.lastError})` : ''}`).join('\n')
}
