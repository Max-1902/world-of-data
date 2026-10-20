/**
 * Which forecast is shown as the headline for each evaluated World Bank series, and the interval it carries.
 *
 * Decided by a rolling-origin backtest written down before it was run (2026-10-19): 217 World Bank economies,
 * data vintage 2026-10-16, forecast origins 1990–2025, ≥ 30 years of history (15 for unemployment), scored at 1 and 3
 * years ahead with each country's error relative to "no change" (geometric mean across countries, Davydenko & Fildes
 * 2013), split at 2010. Candidates were naive, the AR(2) shipped until then, SES, a guarded AR(2) on 20 years and an
 * equal-weight combination of the last three; a candidate had to beat naive and the shipped AR(2) in both periods at both
 * horizons. None did on all counts, so GDP keeps AR(2) and inflation/unemployment show "no change", the model that
 * the shipped AR(2) lost to. Series not listed here have not been evaluated and keep AR(2), with the per-country
 * backtest as the only evidence.
 */
import { arForecast, empiricalInterval, naiveForecast, type Forecast, type Pt } from './econAnalysis'

export type Headline = 'ar' | 'naive'
export interface Policy {
  headline: Headline
  interval: 'empirical' | 'parametric'
  /**
   * Half-width multiplier per horizon (1, 2, 3 years), set so the interval held the real value 95% of the time on
   * forecasts made before 2010; checked on forecasts made from 2010 on (addendum 2 of the 2026-10-19 backtest).
   */
  scale: [number, number, number]
  /** what the scaled interval actually held on forecasts made 2010–2024, per horizon — shown instead of "95%" */
  measured: [number, number, number]
  evidence: string
}

/** "95% interval" plus what it actually held in the backtest, e.g. 'interval (held 94.7% of outcomes since 2010)'. */
export function coverageLabel(policy: Policy | null, horizon: number): string {
  if (!policy) return '95% interval (coverage not measured for this series)'
  return `95% interval (held ${policy.measured[Math.min(horizon, 3) - 1]}% of outcomes in backtests since 2010)`
}

/** Past errors the empirical interval is calibrated on (the most recent ones only); see `empiricalInterval`. */
export const INTERVAL_RECENT = 20

export const POLICY: Record<string, Policy> = {
  'NY.GDP.MKTP.KD.ZG': {
    headline: 'ar', interval: 'empirical', scale: [0.94, 0.93, 0.92], measured: [93.1, 92.9, 92.6],
    evidence: 'Backtested on 192 World Bank economies (forecasts made 1990–2025): AR(2)\'s error was on average 8% below "repeat last year" one year ahead and 20% below three years ahead, and lower in 139 of 192 economies one year ahead — but in no single economy was the gap significant after correcting for testing many countries. An average of "no change", exponential smoothing and a 20-year AR did better one year ahead (13% below "no change") but not three years ahead, so it did not pass the test set in advance and is not shown. The IMF\'s October World Economic Outlook beats this model in 142 of 185 economies (data to 2025). Interval: set from AR(2)\'s own last 20 out-of-sample errors on this country, then scaled by horizon so it held 95% of outcomes on forecasts made before 2010; on forecasts made since, it held 93.1% one year ahead and 92.6% three years ahead. Those errors overlap and are not independent, so treat the coverage as measured, not guaranteed.',
  },
  'FP.CPI.TOTL.ZG': {
    headline: 'naive', interval: 'parametric', scale: [0.90, 0.77, 0.65], measured: [96.3, 95.4, 95.1],
    evidence: 'Backtested on 150 World Bank economies (forecasts made 1990–2025): the AR(2) model shown here until 2026-10-19 had about 1.5× the error of "same as last year" (median miss 2.2 pp vs 1.4 pp) and lost in 100 of the 129 economies with enough history to score, because its long-run level is set by 1980s–90s inflation. Exponential smoothing, a 20-year AR and an average of models were also tested; none beat "same as last year" in both periods. The headline forecast is therefore "no change". Interval: from the spread of this country\'s past year-to-year changes, narrowed by horizon (unscaled it held 97–98% of outcomes, too wide) so it held 95% on forecasts made before 2010; on forecasts made since, it held 96.3% one year ahead and 95.1% three years ahead. It is still enormous where the history includes hyperinflation.',
  },
  'SL.UEM.TOTL.ZS': {
    headline: 'naive', interval: 'parametric', scale: [1.69, 2.12, 2.21], measured: [94.7, 95.4, 94.9],
    evidence: 'Backtested on 187 World Bank economies (forecasts made 2006–2025): the AR(2) model shown here until 2026-10-19 had about 1.2× the error of "same as last year" one year ahead and 1.4× three years ahead, and lost in 144 of 187 economies. Exponential smoothing, a 20-year AR and an average of models were also tested; the best (the average) only tied with "no change". The headline forecast is therefore "no change". Interval: from the spread of past year-to-year changes, widened by horizon (×1.7 one year ahead, ×2.2 three years) because unscaled it held only 89% and 83% of outcomes. The factors were set on forecasts made 2006–2009, a short stretch that includes the 2008–09 crisis; on forecasts made since 2010 the widened interval held 94.7% one year ahead and 94.9% three years ahead.',
  },
}

export interface Headlined {
  forecast: Forecast
  headline: Headline
  /** the AR(2) fit, always computed: the panel and the analyst still report how it did on this country */
  ar: Forecast | null
  /** horizons (1-based) where an empirical interval was wanted but too few past errors existed, so the textbook one is shown */
  fallbackHorizons: number[]
  policy: Policy | null
}

export function headlineForecast(indicatorId: string, pts: Pt[], horizon: number): Headlined | null {
  const policy = POLICY[indicatorId] ?? null
  const ar = arForecast(pts, 2, horizon)
  const naive = naiveForecast(pts, horizon)
  const headline: Headline = policy?.headline ?? 'ar'
  const base = headline === 'ar' ? ar : naive
  if (!base) return null
  if (!policy) return { forecast: base, headline, ar, fallbackHorizons: [], policy }
  const fallbackHorizons: number[] = []
  let points = base.points
  if (policy.interval === 'empirical') {
    const make = headline === 'ar' ? (t: Pt[], h: number) => arForecast(t, 2, h) : naiveForecast
    points = empiricalInterval(pts, base, make, INTERVAL_RECENT).points.map((p, i) => {
      if (Number.isFinite(p.lo)) return p
      fallbackHorizons.push(i + 1)
      return base.points[i]
    })
  }
  // the factors were measured for horizons 1–3; a longer horizon keeps the last one
  points = points.map((p, i) => {
    const k = policy.scale[Math.min(i, 2)], half = ((p.hi - p.lo) / 2) * k
    return { ...p, lo: p.value - half, hi: p.value + half }
  })
  return { forecast: { ...base, points }, headline, ar, fallbackHorizons, policy }
}
