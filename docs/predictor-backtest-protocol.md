# Predictor backtest — protocol (written 2026-10-28, before any accuracy was computed)

Question: does adding one indicator to the shipped GDP-growth model (AR(2), see `src/utils/forecastPolicy.ts`) improve
out-of-sample forecasts of next year's real GDP growth? Until an indicator passes, the app may say it "moves with"
growth, never that it predicts or drives it.

What was looked at before writing this: only how many economies have each series (coverage). No forecast error of any
candidate model had been computed. Coverage decided which candidates are eligible (below); nothing else was tuned.

## Data

- Target: World Bank `NY.GDP.MKTP.KD.ZG`, 217 World Bank economies (`src/data/wb-economies.json`), data vintage
  fetched 2026-10-28 (WDI last updated 2026-10-08). Current vintage, **not real-time**: values were revised after first
  release, which flatters any model slightly. Stated as a limitation; not corrected.
- Candidates (all free and keyless), with the transformation fixed here:

| id | series | transformation at origin year T |
|---|---|---|
| inflation | WB `FP.CPI.TOTL.ZG` | change: π(T) − π(T−1) |
| credit | WB `FS.AST.PRVT.GD.ZS` (private credit, % GDP) | change: c(T) − c(T−1) |
| current_account | WB `BN.CAB.XOKA.GD.ZS` (% GDP) | level at T |
| unemployment | WB `SL.UEM.TOTL.ZS` | change: u(T) − u(T−1) |
| real_rate | WB `FR.INR.RINR` | level at T |
| world_growth | WB `NY.GDP.MKTP.KD.ZG` for `WLD` | level at T |
| brent (exploratory) | FRED `POILBREUSDA`, annual Brent | log change at T |

- Eligibility rule: at least 100 economies with ≥ 20 joint years with GDP growth. Dropped for failing it: terms of
  trade (`TT.PRI.MRCH.XD.WD`, no joint years), real effective exchange rate (`PX.REX.REER`, 94 economies). Not included
  because the data does not exist here yet: trade-weighted partner growth (needs historical bilateral trade; the
  bundled trade profiles are one recent year, top six partners only). Brent has a 1992 start, so it is short-sample and
  can never pass; it is reported as exploratory.
- Exports, investment, consumption and other components of GDP are excluded by design: they move with GDP by identity.
- Every predictor is dated at or before the origin year T, the same availability as the last GDP-growth value the model
  sees. Nothing dated after T is used. No lag search: one specification per candidate.

## Design

- Rolling origin: for each origin year T = 1990…2024 and each economy, fit on data up to T only, forecast growth in
  T + 1 (horizon 1 only), score the absolute error. Training needs ≥ 30 years of growth history and, for the predictor
  models, ≥ 20 joint years (15 for Brent). Origin–economy pairs failing that are skipped for that candidate, and the
  baselines are scored on exactly the same pairs.
- Baseline 1 (shipped): AR(2) on all growth history up to T (`arForecast`).
- Baseline 2 (same sample): AR(2) fit on exactly the years the candidate model uses. Isolates the predictor from the
  effect of a shorter window.
- Candidate variant A, per-economy: y(t+1) = c + φ1 y(t) + φ2 y(t−1) + β x(t), OLS on that economy's data.
- Candidate variant B, pooled slope: the economy's own AR(2) as above; then one slope β shared by all economies is
  estimated by OLS of the AR(2) residuals on x(t) standardised within each economy (mean and sd from data up to T),
  pooling all economies' data up to T. Forecast = AR(2) forecast + β · standardised x. Shrinks the noisy per-economy
  slope, at the cost of assuming the same effect everywhere.

## Pass rule (all must hold, for variant A or B, against both baselines)

1. Geometric-mean ratio of MAE (candidate / baseline) across economies below 1 in both origin periods, 1990–2009 and
   2010–2024 (Davydenko & Fildes 2013, the same scoring as the headline-model decision).
2. Lower error in more than 50% of economies in each period.
3. Significance with cross-country dependence handled: per origin year, mean across economies of |error| for candidate
   and baseline, then the Diebold–Mariano test (HLN-corrected, `dieboldMariano` in `econAnalysis.ts`) across origin
   years. Two-sided p < 0.05 / 12 = 0.0042 (Bonferroni over 6 candidates × 2 variants), and the sign must favour the
   candidate. Years, not economy-years, are the unit because global shocks (2009, 2020) hit all economies together.

Reported regardless of the result: all ratios, shares, p-values and n; the same table excluding 2020; the share of
economies where the per-economy slope has a stable sign. A candidate that fails is shown as "tested, no gain", not
hidden.

## Not claimed

A pass means "improved accuracy on this data, one step ahead, in a current-vintage pseudo-out-of-sample test". It does
not show cause, does not hold for horizons 2–3, and is not a real-time result.
