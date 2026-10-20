/** Great-circle geometry for drawing origin → destination arcs on a Web-Mercator map. */

type LngLat = [number, number]
const RAD = Math.PI / 180

const toVec = ([lng, lat]: LngLat) => [Math.cos(lat * RAD) * Math.cos(lng * RAD), Math.cos(lat * RAD) * Math.sin(lng * RAD), Math.sin(lat * RAD)]

/**
 * Points along the great circle from `a` to `b` (inclusive). Longitudes are unwrapped so the line
 * stays continuous across the antimeridian (Mapbox draws [179, 181] as a short hop, not a wrap).
 */
export function greatCircle(a: LngLat, b: LngLat, segments = 64): LngLat[] {
  const va = toVec(a), vb = toVec(b)
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))
  const omega = Math.acos(dot)
  if (omega < 1e-9) return [a, b]
  const s = Math.sin(omega)
  const out: LngLat[] = []
  let prevLng = a[0]
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const k1 = Math.sin((1 - t) * omega) / s, k2 = Math.sin(t * omega) / s
    const x = k1 * va[0] + k2 * vb[0], y = k1 * va[1] + k2 * vb[1], z = k1 * va[2] + k2 * vb[2]
    let lng = Math.atan2(y, x) / RAD
    const lat = Math.atan2(z, Math.hypot(x, y)) / RAD
    while (lng - prevLng > 180) lng -= 360
    while (lng - prevLng < -180) lng += 360
    prevLng = lng
    out.push([lng, lat])
  }
  return out
}

/** Great-circle length in km. */
export function distanceKm(a: LngLat, b: LngLat): number {
  const va = toVec(a), vb = toVec(b)
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))
  return Math.acos(dot) * 6371
}

/**
 * Bows a line sideways, to the right of its direction of travel, by `bend` × its chord length at
 * the midpoint (0 at the ends). Opposite-direction pairs (Sudan ⇄ South Sudan) then sit side by
 * side instead of on top of each other. Purely a drawing aid: it doesn't represent a route.
 */
export function bowRight(points: LngLat[], bend = 0.12): LngLat[] {
  if (points.length < 3) return points
  const [x0, y0] = points[0], [x1, y1] = points[points.length - 1]
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (!len) return points
  // right-hand normal of the chord in lng/lat space
  const nx = dy / len, ny = -dx / len
  const last = points.length - 1
  return points.map(([x, y], i) => {
    if (i === 0 || i === last) return [x, y]   // ends stay exactly on the anchors
    const off = Math.sin((i / (points.length - 1)) * Math.PI) * len * bend
    return [x + nx * off, y + ny * off]
  })
}
