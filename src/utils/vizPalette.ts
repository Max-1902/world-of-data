/**
 * Colour ramps for charts and the map's analytics layer, in one place so both agree.
 * This app has a single dark theme, so there is one set. Categorical series colours live in index.css
 * (--series-1..5, validated against the #0d161d surface); the ramps below are for continuous magnitude.
 *
 * Sequential: one hue (blue), dark → light as magnitude rises (on a dark surface "more" is brighter).
 */
export const SEQUENTIAL = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'] as const

type RGB = [number, number, number]
const rgb = (hex: string): RGB => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as RGB
const hex = (c: RGB) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** Piecewise-linear colour along a list of stops, t in 0..1. */
export function rampColor(stops: readonly string[], t: number): string {
  const x = clamp01(t) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return hex(mix(rgb(stops[i]), rgb(stops[i + 1]), x - i))
}

export const sequentialColor = (t: number) => rampColor(SEQUENTIAL, t)
