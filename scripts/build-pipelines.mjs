#!/usr/bin/env node
/**
 * Builds public/data/pipelines-trunk.geojson — a world-scale snapshot of
 * long-distance oil & gas pipelines.
 *
 * Source: OpenStreetMap (© OpenStreetMap contributors, ODbL) via the free,
 * keyless Overpass API. We take every `route=pipeline` relation tagged
 * substance=oil|gas — OSM's own grouping of a pipeline's segments into one
 * named line, i.e. the long-distance backbone — and pull each member way's
 * real geometry. Nothing here is hand-typed.
 *
 * Why a snapshot instead of a live query: a world-wide Overpass query for
 * this times out (504) on the public instances, and a single dense tile can
 * be 25 MB. Detail at high zoom is loaded live instead (see
 * src/services/pipelinesOsm.ts).
 *
 * Usage: node scripts/build-pipelines.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const UA = 'WorldMap-pipeline-snapshot/1.0 (open-source dashboard build script)'
const BATCH = 12
const TOLERANCE_DEG = 0.004 // ~400 m; invisible below zoom ~9, live tiles take over there
const OUT = 'public/data/pipelines-trunk.geojson'

async function overpass(query, attempt = 0) {
  const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': UA,
      },
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()).elements ?? []
  } catch (err) {
    if (attempt >= 5) throw err
    const wait = 4000 * (attempt + 1)
    console.warn(`  retry ${attempt + 1} (${err.message}) in ${wait / 1000}s`)
    await new Promise(r => setTimeout(r, wait))
    return overpass(query, attempt + 1)
  }
}

// Douglas–Peucker on [lng, lat]
function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let max = 0, idx = -1
    const [ax, ay] = pts[a], [bx, by] = pts[b]
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
      if (d > max) { max = d; idx = i }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]) }
  }
  return pts.filter((_, i) => keep[i])
}

const round = n => Math.round(n * 1e4) / 1e4

console.log('1/2 listing pipeline relations…')
const rels = await overpass(
  '[out:json][timeout:60];relation["route"="pipeline"]["substance"~"^(oil|gas)$"];out tags;',
)
console.log(`  ${rels.length} relations`)

console.log('2/2 fetching member-way geometry in batches…')
const features = []
for (let i = 0; i < rels.length; i += BATCH) {
  const batch = rels.slice(i, i + BATCH)
  const ids = batch.map(r => r.id).join(',')
  const els = await overpass(
    `[out:json][timeout:110];relation(id:${ids});out body;way(r);out geom qt;`,
  )
  const relEls = els.filter(e => e.type === 'relation')
  const wayEls = new Map(els.filter(e => e.type === 'way').map(w => [w.id, w]))
  for (const rel of relEls) {
    const t = rel.tags ?? {}
    const lines = []
    for (const m of rel.members ?? []) {
      if (m.type !== 'way') continue
      const w = wayEls.get(m.ref)
      if (!w?.geometry || w.geometry.length < 2) continue
      const coords = simplify(w.geometry.map(p => [p.lon, p.lat]), TOLERANCE_DEG).map(([x, y]) => [round(x), round(y)])
      if (coords.length >= 2) lines.push(coords)
    }
    if (!lines.length) continue
    features.push({
      type: 'Feature',
      id: rel.id,
      geometry: { type: 'MultiLineString', coordinates: lines },
      properties: {
        osm: `relation/${rel.id}`,
        name: t['name:en'] ?? t.name ?? t.ref ?? '',
        substance: t.substance,
        operator: t.operator ?? '',
        // OSM lifecycle prefixes; absent means an ordinary, existing pipeline
        state: t.construction || t.proposed ? (t.construction ? 'construction' : 'proposed') : 'operating',
      },
    })
  }
  console.log(`  ${Math.min(i + BATCH, rels.length)}/${rels.length} → ${features.length} features`)
}

await mkdir('public/data', { recursive: true })
const body = JSON.stringify({
  type: 'FeatureCollection',
  attribution: '© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright',
  generated: new Date().toISOString().slice(0, 10),
  features,
})
await writeFile(OUT, body)
console.log(`wrote ${OUT}: ${features.length} pipelines, ${(body.length / 1e6).toFixed(2)} MB`)
