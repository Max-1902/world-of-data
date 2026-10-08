#!/usr/bin/env node
/**
 * Builds public/data/ioda-regions.json — one map point per IODA region, so
 * region-level internet-outage alerts can be pinned to the region they were
 * detected in instead of the middle of the country.
 *
 * Source: IODA (Georgia Tech, https://ioda.inetintel.cc.gatech.edu), the
 * region topology its own alerts are keyed on — GET /v2/topo/region, a
 * Natural Earth 10m admin-1 TopoJSON whose `id` property equals the `code` of
 * a `region` entity (and the suffix of a `geoasn` entity, "ASN-REGION").
 * Free and keyless. Nothing here is hand-typed: each point is computed from
 * the region's largest polygon (area centroid, or the middle of the widest
 * interior span on that latitude when the centroid falls outside a concave
 * shape), so it always lies inside the region.
 *
 * A point marks the region, not the outage's street address — IODA measures
 * reachability per region/network, it has no finer location.
 *
 * Usage: node scripts/build-ioda-regions.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

const URL_TOPO = 'https://api.ioda.inetintel.cc.gatech.edu/v2/topo/region'
const OUT = 'public/data/ioda-regions.json'

const res = await fetch(URL_TOPO)
if (!res.ok) throw new Error(`IODA HTTP ${res.status}`)
let buf = Buffer.from(await res.arrayBuffer())
if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)   // served as a gzip file, not Content-Encoding
const topo = JSON.parse(buf.toString('utf8')).data.topology
const object = Object.values(topo.objects)[0]

// Arcs are absolute here (no quantisation transform); ~i means arc i reversed.
const tf = topo.transform
const arcs = topo.arcs.map(arc => {
  if (!tf) return arc
  let x = 0, y = 0
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]] })
})
function ring(indices) {
  const pts = []
  for (const i of indices) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]
    pts.push(...(pts.length ? a.slice(1) : a))
  }
  return pts
}

function areaCentroid(pts) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a += f; cx += (pts[j][0] + pts[i][0]) * f; cy += (pts[j][1] + pts[i][1]) * f
  }
  if (a === 0) return { area: 0, c: pts[0] }
  return { area: Math.abs(a / 2), c: [cx / (3 * a), cy / (3 * a)] }
}

function inside([x, y], pts) {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Middle of the widest interior span along latitude `y`. */
function scanline(pts, y) {
  const xs = []
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi)
  }
  xs.sort((a, b) => a - b)
  let best = null
  for (let k = 0; k + 1 < xs.length; k += 2) if (!best || xs[k + 1] - xs[k] > best[1] - best[0]) best = [xs[k], xs[k + 1]]
  return best ? [(best[0] + best[1]) / 2, y] : null
}

function representativePoint(geom) {
  const polys = geom.type === 'Polygon' ? [geom.arcs] : geom.type === 'MultiPolygon' ? geom.arcs : []
  let best = null
  for (const p of polys) {
    const outer = ring(p[0])
    const { area, c } = areaCentroid(outer)
    if (!best || area > best.area) best = { area, c, outer }
  }
  if (!best) return null
  if (inside(best.c, best.outer)) return best.c
  const ys = best.outer.map(p => p[1])
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2
  return scanline(best.outer, best.c[1]) ?? scanline(best.outer, mid) ?? best.c
}

const regions = {}
let skipped = 0
for (const g of object.geometries) {
  const p = g.properties ?? {}
  const pt = representativePoint(g)
  if (!p.id || !pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) { skipped++; continue }
  regions[p.id] = [Math.round(pt[0] * 1000) / 1000, Math.round(pt[1] * 1000) / 1000, p.name ?? '', p.iso2cc ?? '']
}

await mkdir('public/data', { recursive: true })
await writeFile(OUT, JSON.stringify({
  source: 'IODA region topology (Georgia Tech) — /v2/topo/region, Natural Earth 10m admin-1; point = inside the largest polygon',
  generated: new Date().toISOString().slice(0, 10),
  regions,
}))
console.log(`wrote ${Object.keys(regions).length} regions to ${OUT} (${skipped} skipped)`)
