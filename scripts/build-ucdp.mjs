#!/usr/bin/env node
/**
 * Builds src/data/ucdp-candidate.json — monthly counts of lethal organised violence per country, for the
 * Regional activity trend when the live ACLED feed has no recent events.
 *
 * Source: UCDP Candidate Events Dataset (Uppsala Conflict Data Program, https://ucdp.uu.se/downloads/),
 * monthly releases, free and keyless CSV downloads, CC BY 4.0. Cite: Hegre, Croicu, Eck & Högbladh (2020),
 * "Introducing the UCDP Candidate Events Dataset", Research & Politics. Candidate events are preliminary: UCDP
 * marks each with a `code_status`, and only "Clear" ones have passed its checks. Both counts are stored.
 *
 * Each month is counted from its own monthly release only (events dated in that month). A later release also
 * carries a few late-found events for earlier months; they are left out so every month is equally fresh,
 * otherwise the latest month would always look low against back-filled older ones.
 *
 * Usage: node scripts/build-ucdp.mjs [months]   (default 7: the latest released month plus 6 before it)
 */
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://ucdp.uu.se/downloads/candidateged'
const OUT = 'src/data/ucdp-candidate.json'
const MONTHS = Number(process.argv[2]) || 7

const fileFor = (y, m) => `${BASE}/GEDEvent_v${String(y % 100).padStart(2, '0')}_0_${m}.csv`
const prev = ({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })
const key = ({ y, m }) => `${y}-${String(m).padStart(2, '0')}`

/** RFC 4180: quoted fields may hold commas, doubled quotes and line breaks. */
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows
  return body.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

// the newest release: UCDP publishes a month's file some weeks after it ends
let latest = prev({ y: new Date().getUTCFullYear(), m: new Date().getUTCMonth() + 1 })
for (let tries = 0; ; tries++) {
  const res = await fetch(fileFor(latest.y, latest.m), { method: 'HEAD' })
  if (res.ok) break
  if (tries >= 3) throw new Error('No UCDP monthly release found in the last four months')
  latest = prev(latest)
}

const months = []
for (let ym = latest; months.length < MONTHS; ym = prev(ym)) months.unshift(ym)

// UCDP names carry historical names in brackets ("Yemen (North Yemen)", "DR Congo (Zaire)")
const countryName = s => s.replace(/\s*\(.*\)\s*$/, '').trim()

const countries = {}
const releases = []
for (const [i, ym] of months.entries()) {
  const url = fileFor(ym.y, ym.m)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`UCDP HTTP ${res.status} for ${url}`)
  const rows = parseCsv(await res.text()).filter(r => r.date_start?.slice(0, 7) === key(ym))
  if (!rows.length) throw new Error(`UCDP release ${url} has no events dated ${key(ym)}`)
  releases.push({ month: key(ym), file: url.split('/').pop(), events: rows.length })
  for (const r of rows) {
    const c = (countries[countryName(r.country)] ??= { events: Array(months.length).fill(0), clear: Array(months.length).fill(0), deaths: Array(months.length).fill(0) })
    c.events[i]++
    if (r.code_status === 'Clear') c.clear[i]++
    c.deaths[i] += Number(r.best) || 0
  }
}

const out = {
  source: 'UCDP Candidate Events Dataset, monthly releases',
  url: 'https://ucdp.uu.se/downloads/',
  license: 'CC BY 4.0',
  citation: 'Hegre, Croicu, Eck & Högbladh (2020), "Introducing the UCDP Candidate Events Dataset", Research & Politics',
  scope: 'lethal organised violence: state-based conflict, non-state conflict and one-sided violence (at least one death)',
  retrieved: new Date().toISOString().slice(0, 10),
  months: months.map(key),
  releases,
  countries: Object.fromEntries(Object.entries(countries).sort(([a], [b]) => a.localeCompare(b))),
}

await mkdir('src/data', { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`Wrote ${OUT}: ${Object.keys(countries).length} countries, ${months.map(key).join(', ')}`)
