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
