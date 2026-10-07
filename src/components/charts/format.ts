// All chart times are UTC: the feeds timestamp in UTC and a reader's local zone would shift buckets.
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const pad = (n: number) => String(n).padStart(2, '0')

export const fmtDay = (t: number) => day.format(t)
export const fmtHour = (t: number) => `${pad(new Date(t).getUTCHours())}:00`
export const fmtDayHour = (t: number) => `${fmtDay(t)} ${fmtHour(t)}`

/** 1,234 → "1.2K", 12,345 → "12K"; small numbers stay exact. */
export const compact = (n: number) => n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(n >= 1e4 ? 0 : 1)}K` : String(Math.round(n))

/** Rounds a maximum up to 1, 2, 5 × 10ⁿ so axis ticks land on clean numbers. */
export function niceMax(v: number): number {
  if (v <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(v))
  const f = v / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
}
