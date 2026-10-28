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
  { id: 'inflation', label: 'Inflation, change', exploratory: false, economies: 157, ratioOwn: 1.018, ratioPooled: 1.001, shareOwn: 0.38, dmOwn: '0.005', dmPooled: '0.977', passed: false },
  { id: 'credit', label: 'Private credit / GDP, change', exploratory: false, economies: 112, ratioOwn: 1.042, ratioPooled: 1.002, shareOwn: 0.41, dmOwn: '0.009', dmPooled: '0.289', passed: false },
  { id: 'current_account', label: 'Current account / GDP', exploratory: false, economies: 152, ratioOwn: 1.024, ratioPooled: 1.004, shareOwn: 0.43, dmOwn: '0.002', dmPooled: '0.966', passed: false },
  { id: 'unemployment', label: 'Unemployment rate, change', exploratory: false, economies: 174, ratioOwn: 1.085, ratioPooled: 0.988, shareOwn: 0.37, dmOwn: '0.002', dmPooled: '0.297', passed: false },
  { id: 'real_rate', label: 'Real interest rate', exploratory: false, economies: 99, ratioOwn: 1.030, ratioPooled: 0.994, shareOwn: 0.34, dmOwn: '<0.001', dmPooled: '0.030', passed: false },
  { id: 'world_growth', label: 'World GDP growth', exploratory: false, economies: 191, ratioOwn: 1.064, ratioPooled: 1.035, shareOwn: 0.21, dmOwn: '0.029', dmPooled: '0.263', passed: false },
  { id: 'brent', label: 'Brent oil price, log change', exploratory: true, economies: 191, ratioOwn: 1.040, ratioPooled: 1.007, shareOwn: 0.34, dmOwn: '0.002', dmPooled: '0.054', passed: false },
]

/** What a pure-noise predictor scores in the same harness, so a ratio can be read against it. */
export const NOISE_BAND = { own: 1.038, pooled: 1.001 }
