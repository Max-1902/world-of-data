// All chart times are UTC: the feeds timestamp in UTC and a reader's local zone would shift buckets.
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const pad = (n: number) => String(n).padStart(2, '0')

export const fmtDay = (t: number) => day.format(t)
export const fmtHour = (t: number) => `${pad(new Date(t).getUTCHours())}:00`
export const fmtDayHour = (t: number) => `${fmtDay(t)} ${fmtHour(t)}`

/** 1,234 → "1.2K", 12,345 → "12K"; small numbers stay exact. */
export const compact = (n: number) => n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(n >= 1e4 ? 0 : 1)}K` : String(Math.round(n))

/**
 * Zero-based axis for a count: the 1 / 2 / 2.5 / 5 × 10ⁿ step that gives 3–6 intervals with the least headroom, and a
 * max that is the first step at or above the data — so the tallest mark fills most of the plot instead of 40% of it.
 */
export function niceAxis(v: number): { max: number; ticks: number[] } {
  if (!(v > 0)) return { max: 1, ticks: [0, 1] }
  const pow = 10 ** Math.floor(Math.log10(v))
  let best = { max: Infinity, step: 1 }
  for (const p of [pow / 10, pow]) for (const f of [1, 2, 2.5, 5]) {
    const step = f * p
    if (v >= 1 && !Number.isInteger(step)) continue   // counts: no fractional ticks
    const max = Math.ceil(v / step - 1e-9) * step
    const n = Math.round(max / step)
    if (n >= 3 && n <= 6 && max < best.max) best = { max, step }
  }
  if (best.max === Infinity) best = { max: Math.max(1, Math.ceil(v)), step: Math.max(1, Math.ceil(v)) }   // tiny counts (1–2)
  return { max: best.max, ticks: Array.from({ length: Math.round(best.max / best.step) + 1 }, (_, i) => +(i * best.step).toPrecision(12)) }
}

/** Tick text: exact below 10K (compact would round 1,250 to "1.3K"), compact above. */
export const tickLabel = (n: number) => n < 1e4 ? n.toLocaleString('en-US') : compact(n)

/** Snaps a coordinate to the pixel grid so 1px hairlines render sharp instead of smeared over two rows. */
export const crisp = (v: number) => Math.round(v - 0.5) + 0.5

/** Axis tick text: muted, tabular so stacked numbers line up. */
export const TICK = { fontSize: 10, fill: 'var(--text3)', style: { fontVariantNumeric: 'tabular-nums' } } as const

/** Rough rendered width of a label (Inter at `size` px) for layout before the text is in the DOM. */
export const textWidth = (s: string, size: number) => s.length * size * 0.56
