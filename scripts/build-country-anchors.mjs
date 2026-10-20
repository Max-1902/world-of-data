#!/usr/bin/env node
/**
 * Builds src/data/country-anchors.json — one map point per country, used to anchor
 * displacement corridors (origin → country of asylum) and per-country circles.
 *
 * Source: Natural Earth 1:50m Admin 0 – Countries (public domain,
 * https://www.naturalearthdata.com), via the project's own GitHub mirror
 * (nvkelso/natural-earth-vector). The point is Natural Earth's LABEL_X/LABEL_Y:
 * a cartographer-placed label position inside the country's main landmass, which
 * reads better than a geometric centroid (France's centroid isn't pulled into the
 * Atlantic by overseas territories; Chile's isn't off the coast).
 * Nothing here is hand-typed. Countries whose ISO_A3 is "-99" (France, Norway,
 * Kosovo…) fall back to ADM0_A3, which is what UNHCR uses for them.
 *
 * Usage: node scripts/build-country-anchors.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'

const SRC = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'
const OUT = 'src/data/country-anchors.json'

const res = await fetch(SRC)
if (!res.ok) throw new Error(`Natural Earth download failed: HTTP ${res.status}`)
const { features } = await res.json()

const round = n => Math.round(n * 1000) / 1000
const anchors = {}
for (const { properties: p } of features) {
  const iso3 = p.ISO_A3 !== '-99' ? p.ISO_A3 : p.ADM0_A3
  if (!/^[A-Z]{3}$/.test(iso3) || typeof p.LABEL_X !== 'number' || typeof p.LABEL_Y !== 'number') continue
  const iso2 = /^[A-Z]{2}$/.test(p.ISO_A2) ? p.ISO_A2 : /^[A-Z]{2}$/.test(p.ISO_A2_EH) ? p.ISO_A2_EH : ''
  anchors[iso3] = [round(p.LABEL_X), round(p.LABEL_Y), p.NAME, iso2]
}

await mkdir('src/data', { recursive: true })
const sorted = Object.fromEntries(Object.entries(anchors).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(OUT, JSON.stringify({
  source: 'Natural Earth 1:50m Admin 0 Countries, LABEL_X/LABEL_Y (public domain)',
  url: SRC,
  fetched: new Date().toISOString().slice(0, 10),
  format: '[lng, lat, name, iso2]',
  anchors: sorted,
}, null, 0).replace(/\],"/g, '],\n"') + '\n')
console.log(`wrote ${Object.keys(sorted).length} anchors to ${OUT}`)
