/**
 * Result of the predictor backtest, transcribed from docs/predictor-backtest-results.md (run 2026-10-28 by
 * scripts/backtest-predictors.ts on the protocol in docs/predictor-backtest-protocol.md). Nothing here is computed
 * in the browser; regenerate the report and update this file together.
 *
 * Ratio = geometric-mean MAE of (AR(2) + indicator) ÷ AR(2) across economies, origins 2010–2024, against the shipped
 * AR(2) fit on all history. Below 1 would mean the indicator helped. "pooled" = one slope for all economies,
 * "own" = a slope fitted per economy.
 */
export const BACKTEST_AS_OF = '2026-10-28'

export interface BacktestRow {
  id: string
  label: string
  exploratory: boolean
  /** economies scored in the 2010–2024 origins */
  economies: number
  /** economies scored in the 1990–2009 origins; 0 where the indicator has no data that early */
  economiesEarly: number
  /** 1990–2009 ratio / share, per-economy and pooled slope; null where economiesEarly is 0 */
  ratioEarlyOwn: number | null
  ratioEarlyPooled: number | null
  shareEarlyOwn: number | null
  shareEarlyPooled: number | null
  /** share of economies where the pooled-slope version beat AR(2), 2010–2024 */
  sharePooled: number
  ratioOwn: number
  ratioPooled: number
  /** share of economies where the per-economy version beat AR(2) */
  shareOwn: number
  /** Diebold–Mariano p, per-economy / pooled; the pass bar was p < 0.0042 AND a ratio below 1 */
  dmOwn: string
  dmPooled: string
  passed: boolean
}

export const BACKTEST_ROWS: BacktestRow[] = [
  { id: 'inflation', label: 'Inflation, change', exploratory: false, economies: 157, economiesEarly: 107, ratioEarlyOwn: 1.051, ratioEarlyPooled: 0.998, shareEarlyOwn: 0.33, shareEarlyPooled: 0.59, sharePooled: 0.52, ratioOwn: 1.018, ratioPooled: 1.001, shareOwn: 0.38, dmOwn: '0.005', dmPooled: '0.977', passed: false },
  { id: 'credit', label: 'Private credit / GDP, change', exploratory: false, economies: 112, economiesEarly: 84, ratioEarlyOwn: 1.076, ratioEarlyPooled: 0.996, shareEarlyOwn: 0.3, shareEarlyPooled: 0.54, sharePooled: 0.51, ratioOwn: 1.042, ratioPooled: 1.002, shareOwn: 0.41, dmOwn: '0.009', dmPooled: '0.289', passed: false },
  { id: 'current_account', label: 'Current account / GDP', exploratory: false, economies: 152, economiesEarly: 102, ratioEarlyOwn: 1.054, ratioEarlyPooled: 0.974, shareEarlyOwn: 0.37, shareEarlyPooled: 0.47, sharePooled: 0.52, ratioOwn: 1.024, ratioPooled: 1.004, shareOwn: 0.43, dmOwn: '0.002', dmPooled: '0.966', passed: false },
  { id: 'unemployment', label: 'Unemployment rate, change', exploratory: false, economies: 174, economiesEarly: 0, ratioEarlyOwn: null, ratioEarlyPooled: null, shareEarlyOwn: null, shareEarlyPooled: null, sharePooled: 0.45, ratioOwn: 1.085, ratioPooled: 0.988, shareOwn: 0.37, dmOwn: '0.002', dmPooled: '0.297', passed: false },
  { id: 'real_rate', label: 'Real interest rate', exploratory: false, economies: 99, economiesEarly: 45, ratioEarlyOwn: 1.034, ratioEarlyPooled: 0.996, shareEarlyOwn: 0.42, shareEarlyPooled: 0.4, sharePooled: 0.46, ratioOwn: 1.030, ratioPooled: 0.994, shareOwn: 0.34, dmOwn: '<0.001', dmPooled: '0.030', passed: false },
  { id: 'world_growth', label: 'World GDP growth', exploratory: false, economies: 191, economiesEarly: 145, ratioEarlyOwn: 1.056, ratioEarlyPooled: 1.02, shareEarlyOwn: 0.26, shareEarlyPooled: 0.37, sharePooled: 0.18, ratioOwn: 1.064, ratioPooled: 1.035, shareOwn: 0.21, dmOwn: '0.029', dmPooled: '0.263', passed: false },
  { id: 'brent', label: 'Brent oil price, log change', exploratory: true, economies: 191, economiesEarly: 0, ratioEarlyOwn: null, ratioEarlyPooled: null, shareEarlyOwn: null, shareEarlyPooled: null, sharePooled: 0.42, ratioOwn: 1.040, ratioPooled: 1.007, shareOwn: 0.34, dmOwn: '0.002', dmPooled: '0.054', passed: false },
]

/** What a pure-noise predictor scores in the same harness, so a ratio can be read against it. */
export const NOISE_BAND = { own: 1.038, pooled: 1.001 }
