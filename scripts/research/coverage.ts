/**
 * Live coverage check for "which rows are countries" (src/services/economies.ts). Free and keyless: World Bank API and
 * Our World in Data grapher CSVs.
 *
 *   npm run research:coverage
 *
 * 1. Re-fetches the World Bank's /country metadata and diffs it against src/data/wb-economies.json: any new, renamed or
 *    reclassified code is listed. A new aggregate is harmless (the filter is an allowlist); a new economy is missing from
 *    the app until the snapshot is refreshed.
 * 2. Runs one live World Bank indicator and every OWID chart the app ranks through the same filters, and lists what
 *    passes that is not a World Bank economy (should be only Kosovo) and what is dropped.
 * Writes research/coverage/<day>.json. Exit code 1 when the snapshot has drifted.
 */
import snapshot from '../../src/data/wb-economies.json'
import { isWbEconomy, isOwidCountry, WB_ECONOMY_ISO3 } from '../../src/services/economies'
import { OWID_CHARTS } from '../../src/services/owid'
import { ROOT, writeJson, isoDay } from './lib'
import { resolve } from 'node:path'

const WB = 'https://api.worldbank.org/v2'

async function json(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

async function main() {
  const meta = (await json(`${WB}/country?format=json&per_page=400`) as [unknown, { id: string; iso2Code: string; name: string; region: { value: string } }[]])[1]
  const live = new Map(meta.map(r => [r.id, { name: r.name.trim(), aggregate: r.region.value.trim() === 'Aggregates' }]))
  const snapEco = new Set(snapshot.economies.map(e => e[0])), snapAgg = new Set(snapshot.aggregates.map(a => a[0]))
  const drift = {
    newEconomies: [...live].filter(([c, v]) => !v.aggregate && !snapEco.has(c)).map(([c, v]) => `${c} ${v.name}`),
    newAggregates: [...live].filter(([c, v]) => v.aggregate && !snapAgg.has(c)).map(([c, v]) => `${c} ${v.name}`),
    goneEconomies: [...snapEco].filter(c => !live.has(c) || live.get(c)!.aggregate),
    goneAggregates: [...snapAgg].filter(c => !live.has(c)),
  }

  // one broad indicator, as the rankings fetch it
  const rows = (await json(`${WB}/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=20000&mrnev=1`) as [unknown, { countryiso3code: string; country: { value: string }; value: number | null }[]])[1]
  const wbDropped = rows.filter(r => r.value != null && !isWbEconomy(r.countryiso3code)).map(r => `${r.countryiso3code || '(none)'} ${r.country.value}`)
  const wbKept = rows.filter(r => r.value != null && isWbEconomy(r.countryiso3code)).length

  const owid: Record<string, { kept: number; keptNotWbEconomy: string[]; dropped: number } | { error: string }> = {}
  for (const c of OWID_CHARTS) {
    try {
      const res = await fetch(`https://ourworldindata.org/grapher/${c.slug}.csv?v=1&csvType=full&useColumnShortNames=true`, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ents = new Map<string, string>()
      for (const line of (await res.text()).split('\n').slice(1)) { const [e, code] = line.split(','); if (e) ents.set(code ?? '', e) }
      const kept = [...ents].filter(([code]) => isOwidCountry(code))
      owid[c.slug] = { kept: kept.length, keptNotWbEconomy: kept.filter(([code]) => !WB_ECONOMY_ISO3.has(code)).map(([code, e]) => `${code} ${e}`), dropped: ents.size - kept.length }
    } catch (e) { owid[c.slug] = { error: String((e as Error).message) } }
  }

  const drifted = Object.values(drift).some(v => v.length)
  const out = resolve(ROOT, 'research/coverage', `${isoDay(Date.now())}.json`)
  writeJson(out, { checked: new Date().toISOString(), snapshot: snapshot.fetched, drift, drifted, worldBank: { indicator: 'NY.GDP.MKTP.CD', kept: wbKept, dropped: wbDropped }, owid })
  console.log(`World Bank metadata vs snapshot ${snapshot.fetched}: ${drifted ? 'DRIFT' : 'no drift'}`, drift)
  console.log(`NY.GDP.MKTP.CD: ${wbKept} economies kept, ${wbDropped.length} rows dropped`)
  for (const [slug, r] of Object.entries(owid)) console.log(`OWID ${slug}:`, 'error' in r ? r.error : `${r.kept} kept (not WB economies: ${r.keptNotWbEconomy.join(', ') || 'none'}), ${r.dropped} dropped`)
  console.log(`→ ${out}`)
  if (drifted) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exit(1) })
