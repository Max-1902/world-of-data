#!/usr/bin/env node
/**
 * Builds src/data/chokepoints-portwatch.json — vessel-transit statistics for
 * the chokepoints in src/services/chokepoints.ts.
 *
 * Source: IMF PortWatch (https://portwatch.imf.org), "Daily Chokepoint
 * Transit Calls and Trade Volume Estimates" — free, keyless ArcGIS feature
 * service, derived from AIS by the IMF and the University of Oxford. For each
 * chokepoint we average one full calendar year of daily rows, and copy the
 * three top-ranked industries from the PortWatch chokepoints database.
 * Nothing here is hand-typed.
 *
 * Usage: node scripts/build-chokepoints.mjs [year]   (default: last full year)
 */
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services'
const DAILY = `${BASE}/Daily_Chokepoints_Data/FeatureServer/0/query`
const DB = `${BASE}/PortWatch_chokepoints_database/FeatureServer/0/query`
const OUT = 'src/data/chokepoints-portwatch.json'
const YEAR = Number(process.argv[2]) || new Date().getUTCFullYear() - 1

async function query(url, params) {
  const res = await fetch(`${url}?${new URLSearchParams({ f: 'json', ...params })}`)
  if (!res.ok) throw new Error(`PortWatch HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(`PortWatch error: ${JSON.stringify(json.error)}`)
  return json.features.map(f => f.attributes)
}

const stats = await query(DAILY, {
  where: `year=${YEAR}`,
  groupByFieldsForStatistics: 'portid,portname',
  outStatistics: JSON.stringify([
    { statisticType: 'avg', onStatisticField: 'n_total', outStatisticFieldName: 'avgTotal' },
    { statisticType: 'avg', onStatisticField: 'n_tanker', outStatisticFieldName: 'avgTanker' },
    { statisticType: 'avg', onStatisticField: 'n_container', outStatisticFieldName: 'avgContainer' },
    { statisticType: 'avg', onStatisticField: 'capacity', outStatisticFieldName: 'avgCapacity' },
    { statisticType: 'count', onStatisticField: 'n_total', outStatisticFieldName: 'days' },
  ]),
})
const db = await query(DB, { where: '1=1', outFields: 'portid,lat,lon,industry_top1,industry_top2,industry_top3', returnGeometry: 'false' })
const meta = new Map(db.map(r => [r.portid, r]))
const industriesOf = r => (r ? [r.industry_top1, r.industry_top2, r.industry_top3].filter(Boolean) : [])

const out = {
  source: 'IMF PortWatch — Daily Chokepoint Transit Calls and Trade Volume Estimates',
  url: 'https://portwatch.imf.org/pages/chokepoints',
  year: YEAR,
  retrieved: new Date().toISOString().slice(0, 10),
  chokepoints: Object.fromEntries(stats
    .sort((a, b) => a.portid.localeCompare(b.portid, 'en', { numeric: true }))
    .map(s => [s.portid, {
      name: s.portname,
      lat: Math.round(meta.get(s.portid)?.lat * 1e4) / 1e4,
      lng: Math.round(meta.get(s.portid)?.lon * 1e4) / 1e4,
      days: s.days,
      avgDailyTransits: Math.round(s.avgTotal * 10) / 10,
      avgDailyTankers: Math.round(s.avgTanker * 10) / 10,
      avgDailyContainerShips: Math.round(s.avgContainer * 10) / 10,
      avgDailyCapacityDwt: Math.round(s.avgCapacity),
      topIndustries: industriesOf(meta.get(s.portid)),
    }])),
}

await mkdir('src/data', { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`wrote ${OUT}: ${stats.length} chokepoints, year ${YEAR}`)
