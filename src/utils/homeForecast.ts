import { arForecast, backtestForecast, naiveForecast, type Forecast, type ForecastBacktest, type Pt } from './econAnalysis'
import { AR_ORDER, FORECAST_HORIZON, MIN_HISTORY, headlineForecast, type Headline, type Policy } from './forecastPolicy'
import type { EvidenceKind } from './evidence'
import { vintageYear, weoPoints, type WeoPayload } from '../services/imfWeo'

/** The flagship forecast: real GDP growth, the series the Predictions panel evaluated most thoroughly. */
export const FLAGSHIP_SERIES = 'NY.GDP.MKTP.KD.ZG'

export interface Basis { kind: EvidenceKind; text: string }

export interface HomeForecast {
  last: Pt
  forecast: Forecast
  headline: Headline
  policy: Policy | null
  fallbackHorizons: number[]
  /** the fitted AR(2) is non-stationary, so its multi-year numbers mean nothing */
  unstable: boolean
  backtest: ForecastBacktest | null
  /** the IMF's figures for the forecast years only */
  imf: { year: number; value: number; projection: boolean }[]
  imfVintage: string | null
  /** what the number rests on, each line labelled observed / statistical; never a causal claim */
  basis: Basis[]
}

export type HomeForecastResult = { kind: 'short'; n: number } | ({ kind: 'ok' } & HomeForecast)

const f1 = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`

/**
 * Everything the home page says about one country's GDP-growth forecast, from the same functions the Predictions
 * panel uses (headline model, interval policy, backtest) so the two can never disagree. Pure.
 */
export function buildHomeForecast(series: Pt[], weo: WeoPayload | null, iso3: string): HomeForecastResult {
  const hf = headlineForecast(FLAGSHIP_SERIES, series, FORECAST_HORIZON)
  const naive = naiveForecast(series, FORECAST_HORIZON)
  if (series.length < MIN_HISTORY || !hf || !hf.ar || !naive) return { kind: 'short', n: series.length }

  const { forecast, headline, ar, policy, fallbackHorizons } = hf
  const last = series[series.length - 1]
  const backtest = backtestForecast(series, s => arForecast(s, AR_ORDER, 1), MIN_HISTORY)
  const imf = weo ? weoPoints(weo, iso3, forecast.points.map(p => p.year)) : []
  const unstable = headline === 'ar' && ar.longRun == null
  const first = forecast.points[0]

  const basis: Basis[] = []
  basis.push({ kind: 'observed', text: `World Bank, latest reported years: ${series.slice(-5).map(p => `${p.x} ${f1(p.y)}%`).join(', ')}.` })
  if (unstable) {
    basis.push({ kind: 'statistical', text: `The fitted AR(${AR_ORDER}) is non-stationary: iterated forward its forecast runs away instead of settling, so the multi-year numbers are not meaningful.` })
  } else if (headline === 'ar') {
    basis.push({ kind: 'statistical', text: `AR(${AR_ORDER}) fitted to ${forecast.n} years of this country's own growth. Iterated forward it settles toward ${f1(ar.longRun!)}%, a level set by the whole history; if the economy has changed structurally since, that pull is an assumption of the model, not evidence.` })
  } else {
    basis.push({ kind: 'statistical', text: `"No change": the forecast repeats the last reported value, ${f1(last.y)}%. That is a default, not a claim that nothing will change.` })
  }
  if (backtest && backtest.mae != null && backtest.baselineMae != null) {
    basis.push({ kind: 'statistical', text: `On this country's own record, ${backtest.folds} one-year-ahead tests: AR(${AR_ORDER}) missed by ${backtest.mae.toFixed(2)} pp on average, repeating the last value by ${backtest.baselineMae.toFixed(2)} pp.` })
  }
  const imfFirst = imf.find(p => p.year === first.year)
  if (imfFirst && weo) {
    basis.push({ kind: 'statistical', text: `The IMF’s ${weo.vintage} projects ${f1(imfFirst.value)}% for ${first.year}; this model says ${f1(first.value)}%. The IMF uses far more information than this one-series model and beat it in most economies in backtests.` })
  }

  return {
    kind: 'ok', last, forecast, headline, policy, fallbackHorizons, unstable, backtest,
    imf, imfVintage: weo?.vintage ?? null, basis,
  }
}

/** G20 member states (the EU and the African Union are members too, but are not economies with a World Bank series). */
export const G20_ISO3 = ['ARG', 'AUS', 'BRA', 'CAN', 'CHN', 'FRA', 'DEU', 'IND', 'IDN', 'ITA', 'JPN', 'KOR', 'MEX', 'RUS', 'SAU', 'ZAF', 'TUR', 'GBR', 'USA'] as const

export interface CompareRow { iso3: string; thisYear: number | null; nextYear: number | null }

/**
 * The IMF's own projections of one indicator (growth, inflation or unemployment) for the G20, for the edition's year and the next. Entirely the IMF's figures,
 * ranked by the later year; economies the edition has no figure for are listed last, not dropped.
 */
export function g20Projections(weo: WeoPayload): { years: [number, number]; rows: CompareRow[] } | null {
  const vy = vintageYear(weo.vintage)
  if (vy === null) return null
  const years: [number, number] = [vy, vy + 1]
  const rows = G20_ISO3.map(iso3 => {
    const pts = weoPoints(weo, iso3, years)
    return { iso3, thisYear: pts.find(p => p.year === years[0])?.value ?? null, nextYear: pts.find(p => p.year === years[1])?.value ?? null }
  })
  rows.sort((a, b) => (b.nextYear ?? -Infinity) - (a.nextYear ?? -Infinity))
  return { years, rows }
}
