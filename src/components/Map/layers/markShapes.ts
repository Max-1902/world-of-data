import type { Map as MapboxMap } from 'mapbox-gl'

/**
 * Point marks that tell their category by shape as well as colour. Mapbox circle layers can only draw circles, so the
 * facility layers use symbol layers over these generated SDF icons (SDF so `icon-color` and a halo still work per
 * feature). Each category in a dataset gets its own shape (`shapeFor`), up to SHAPES.length categories.
 */

type Pt = [number, number]

const poly = (...pts: Pt[]): Pt[] => pts
const ngon = (n: number, rot = -Math.PI / 2, r = 1): Pt[] => Array.from({ length: n }, (_, i) => [r * Math.cos(rot + 2 * Math.PI * i / n), r * Math.sin(rot + 2 * Math.PI * i / n)] as Pt)
const star = (): Pt[] => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.45 : 1, a = -Math.PI / 2 + Math.PI * i / 5; return [r * Math.cos(a), r * Math.sin(a)] as Pt })
const plus = (w: number): Pt[] => poly([-w, -1], [w, -1], [w, -w], [1, -w], [1, w], [w, w], [w, 1], [-w, 1], [-w, w], [-1, w], [-1, -w], [-w, -w])
const rotate = (pts: Pt[], a: number): Pt[] => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)] as Pt)

/** Outer outline plus optional holes (even-odd). Unit coordinates, y down, drawn inside [-1, 1]. */
const OUTLINES: Record<string, Pt[][]> = {
  circle: [ngon(24)],
  square: [poly([-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85])],
  diamond: [poly([0, -1], [1, 0], [0, 1], [-1, 0])],
  triangle: [poly([0, -1], [1, 0.85], [-1, 0.85])],
  'triangle-down': [poly([-1, -0.85], [1, -0.85], [0, 1])],
  pentagon: [ngon(5)],
  hexagon: [ngon(6, 0)],
  plus: [plus(0.38)],
  x: [rotate(plus(0.34), Math.PI / 4).map(([x, y]) => [x * 0.85, y * 0.85] as Pt)],
  star: [star()],
  ring: [ngon(24), ngon(24, 0, 0.5)],
  'square-ring': [poly([-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]), poly([-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45])],
  bowtie: [poly([-1, -0.8], [0, 0], [1, -0.8], [1, 0.8], [0, 0], [-1, 0.8])],
  chevron: [poly([0, -1], [1, 0.9], [0, 0.35], [-1, 0.9])],
  octagon: [ngon(8, Math.PI / 8)],
  house: [poly([0, -1], [1, -0.2], [0.75, 0.9], [-0.75, 0.9], [-1, -0.2])],
  parallelogram: [poly([-0.45, -0.8], [1, -0.8], [0.45, 0.8], [-1, 0.8])],
  trapezoid: [poly([-0.6, -0.8], [0.6, -0.8], [1, 0.8], [-1, 0.8])],
}

export const SHAPES = Object.keys(OUTLINES)

/** SVG path (even-odd) of a shape or aircraft silhouette in a `size` x `size` box, so a legend draws exactly what the map draws. */
export function shapePath(name: string, size = 12): string {
  const rings = OUTLINES[name] ?? FLIGHT_OUTLINES[name] ?? OUTLINES.circle
  const k = size / 2
  return rings.map(r => r.map(([x, y], i) => `${i ? 'L' : 'M'}${(k + x * k * 0.92).toFixed(2)} ${(k + y * k * 0.92).toFixed(2)}`).join('') + 'Z').join('')
}

/** One shape per category key, in the order the dataset's colour map lists them. Beyond SHAPES.length they would repeat. */
export function shapeFor(categories: readonly string[], category: string): string {
  const i = categories.indexOf(category)
  return SHAPES[(i < 0 ? 0 : i) % SHAPES.length]
}

const inPoly = (pts: Pt[], x: number, y: number) => {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const SIZE = 32          // image side in px
const HALF = 11          // shape half-extent in px (leaves room for the SDF falloff and the halo)
const RADIUS = 5         // SDF falloff distance in px

/** Signed-distance alpha for a shape, in Mapbox's SDF encoding (edge at 0.75). Pure, so it runs without a canvas. */
export function shapeSdf(name: string): Uint8Array {
  return sdfOf(OUTLINES[name] ?? FLIGHT_OUTLINES[name] ?? OUTLINES.circle)
}

function sdfOf(rings: Pt[][]): Uint8Array {
  const inside = new Uint8Array(SIZE * SIZE)
  const SUB = 4 // sub-samples per axis, so edges are smooth
  for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
    let hits = 0
    for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) {
      const x = (px + (sx + 0.5) / SUB - SIZE / 2) / HALF, y = (py + (sy + 0.5) / SUB - SIZE / 2) / HALF
      // even-odd across the outer outline and any hole
      let n = 0; for (const r of rings) if (inPoly(r, x, y)) n++
      if (n % 2 === 1) hits++
    }
    inside[py * SIZE + px] = hits * 2 >= SUB * SUB ? 1 : 0
  }
  const out = new Uint8Array(SIZE * SIZE * 4)
  for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
    const here = inside[py * SIZE + px]
    // distance to the nearest pixel of the opposite state
    let best = RADIUS
    for (let dy = -RADIUS; dy <= RADIUS; dy++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const x = px + dx, y = py + dy
      const other = x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : inside[y * SIZE + x]
      if (other !== here) best = Math.min(best, Math.hypot(dx, dy))
    }
    const signed = here ? -best : best                       // negative inside
    const a = Math.max(0, Math.min(255, Math.round(255 * (0.75 - signed / RADIUS))))
    const o = (py * SIZE + px) * 4
    out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = a
  }
  return out
}

/**
 * Aircraft silhouettes (nose up, so `icon-rotate` takes the heading). One per flight type, so a cargo freighter, a
 * military jet and a light aircraft differ by outline and not only by colour.
 */
const FLIGHT_OUTLINES: Record<string, Pt[][]> = {
  airline: [poly([0, -1], [0.12, -0.45], [1, 0.1], [0.12, 0.25], [0.12, 0.65], [0.4, 0.95], [-0.4, 0.95], [-0.12, 0.65], [-0.12, 0.25], [-1, 0.1], [-0.12, -0.45])],
  cargo: [poly([0, -1], [0.22, -0.8], [0.22, -0.2], [1, -0.2], [1, 0.15], [0.22, 0.15], [0.22, 0.65], [0.6, 0.65], [0.6, 0.95], [-0.6, 0.95], [-0.6, 0.65], [-0.22, 0.65], [-0.22, 0.15], [-1, 0.15], [-1, -0.2], [-0.22, -0.2], [-0.22, -0.8])],
  military: [poly([0, -1], [1, 0.9], [0.15, 0.55], [0, 0.85], [-0.15, 0.55], [-1, 0.9])],
  private: [poly([0, -1], [0.09, -0.7], [0.09, -0.1], [0.95, -0.1], [0.95, 0.1], [0.09, 0.1], [0.09, 0.62], [0.42, 0.64], [0.42, 0.8], [0.09, 0.8], [0.09, 0.95], [-0.09, 0.95], [-0.09, 0.8], [-0.42, 0.8], [-0.42, 0.64], [-0.09, 0.62], [-0.09, 0.1], [-0.95, 0.1], [-0.95, -0.1], [-0.09, -0.1], [-0.09, -0.7])],
  unknown: [poly([0, -1], [0.8, 0], [0, 1], [-0.8, 0])],
}
export const FLIGHT_SHAPES = Object.keys(FLIGHT_OUTLINES)
export const flightImageName = (type: string) => `flight-${type}`

/** Register one aircraft icon per flight type. Safe to call more than once. */
export function addFlightShapes(map: MapboxMap): void {
  for (const type of FLIGHT_SHAPES) {
    const id = flightImageName(type)
    if (map.hasImage(id)) continue
    map.addImage(id, { width: SIZE, height: SIZE, data: sdfOf(FLIGHT_OUTLINES[type]) }, { sdf: true })
  }
}

export const markImageName = (shape: string) => `mark-${shape}`

/** Register every shape as an SDF icon. Safe to call more than once. */
export function addMarkShapes(map: MapboxMap): void {
  for (const shape of SHAPES) {
    const id = markImageName(shape)
    if (map.hasImage(id)) continue
    map.addImage(id, { width: SIZE, height: SIZE, data: shapeSdf(shape) }, { sdf: true })
  }
}

/** Shapes have less area than a disc of the same width, so they are drawn a quarter larger to read at the same weight. */
const SHAPE_BOOST = 1.25
/** Convert a circle layer's radius (px) to the matching `icon-size`. */
export const iconSizeFor = (radius: number) => +(radius * 2 * SHAPE_BOOST / (2 * HALF)).toFixed(3)

/** Layout shared by the facility layers: the feature's own `shape` property picks the icon. */
export const MARK_ICON_LAYOUT = {
  'icon-image': ['concat', 'mark-', ['get', 'shape']],
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
} as const

/** Paint shared by the facility layers: category colour with a white halo (the SDF falloff holds the halo). */
export const MARK_ICON_PAINT = {
  'icon-color': ['get', 'color'],
  'icon-halo-color': '#ffffff',
  'icon-halo-width': 1.2,
  'icon-halo-blur': 0,
  'icon-opacity': 1,
} as const
