# Predictor backtest — results

Run 2026-10-28 by `scripts/backtest-predictors.ts` on the protocol in `docs/predictor-backtest-protocol.md` (written and committed first). Horizon: one year ahead, forecast origins 1990–2024, current-vintage World Bank data (not real-time).

Ratio = geometric-mean MAE of (AR(2) + indicator) ÷ baseline across economies; below 1 means the indicator helped. Share = economies where it helped. Periods: origins 1990–2009 | 2010–2024. DM p = Diebold–Mariano across origin years on the cross-economy mean error (pass needs p < 0.0042). A = per-economy slope, B = pooled slope.

## vs the shipped AR(2) (all history)

| Indicator | Var | Economies (early / late) | Ratio early | Ratio late | Share early | Share late | DM p | Ratio late, excl. 2020 | Pass |
|---|---|---|---|---|---|---|---|---|---|
| Inflation, change (pp) | A | 107 / 157 | 1.051 | 1.018 | 33% | 38% | 0.005 | 1.017 | no |
| Inflation, change (pp) | B | 107 / 157 | 0.998 | 1.001 | 59% | 52% | 0.977 | 0.997 | no |
| Private credit / GDP, change (pp) | A | 84 / 112 | 1.076 | 1.042 | 30% | 41% | 0.009 | 1.057 | no |
| Private credit / GDP, change (pp) | B | 84 / 112 | 0.996 | 1.002 | 54% | 51% | 0.289 | 1.007 | no |
| Current account / GDP, level | A | 102 / 152 | 1.054 | 1.024 | 37% | 43% | 0.002 | 1.028 | no |
| Current account / GDP, level | B | 102 / 152 | 0.974 | 1.004 | 47% | 52% | 0.966 | 1.006 | no |
| Unemployment rate, change (pp) | A | 0 / 174 | – | 1.085 | – | 37% | 0.002 | 1.093 | no |
| Unemployment rate, change (pp) | B | 0 / 174 | – | 0.988 | – | 45% | 0.297 | 0.983 | no |
| Real interest rate, level | A | 45 / 99 | 1.034 | 1.030 | 42% | 34% | <0.001 | 1.030 | no |
| Real interest rate, level | B | 45 / 99 | 0.996 | 0.994 | 40% | 46% | 0.030 | 0.988 | no |
| World GDP growth, level | A | 145 / 191 | 1.056 | 1.064 | 26% | 21% | 0.029 | 1.080 | no |
| World GDP growth, level | B | 145 / 191 | 1.020 | 1.035 | 37% | 18% | 0.263 | 1.046 | no |
| Brent oil price, log change (exploratory) | A | 0 / 191 | – | 1.040 | – | 34% | 0.002 | 1.047 | exploratory |
| Brent oil price, log change (exploratory) | B | 0 / 191 | – | 1.007 | – | 42% | 0.054 | 1.006 | exploratory |

## vs AR(2) fit on the same years as the indicator model

| Indicator | Var | Economies (early / late) | Ratio early | Ratio late | Share early | Share late | DM p | Ratio late, excl. 2020 | Pass |
|---|---|---|---|---|---|---|---|---|---|
| Inflation, change (pp) | A | 107 / 157 | 1.051 | 1.014 | 32% | 42% | 0.005 | 1.017 | no |
| Inflation, change (pp) | B | 107 / 157 | 0.998 | 0.997 | 59% | 61% | 0.440 | 0.996 | no |
| Private credit / GDP, change (pp) | A | 84 / 112 | 1.078 | 1.038 | 27% | 37% | 0.015 | 1.048 | no |
| Private credit / GDP, change (pp) | B | 84 / 112 | 0.997 | 0.998 | 57% | 55% | 0.505 | 0.999 | no |
| Current account / GDP, level | A | 102 / 152 | 1.068 | 1.024 | 36% | 38% | <0.001 | 1.025 | no |
| Current account / GDP, level | B | 102 / 152 | 0.987 | 1.004 | 63% | 49% | 0.642 | 1.003 | no |
| Unemployment rate, change (pp) | A | 0 / 174 | – | 1.103 | – | 22% | 0.002 | 1.119 | no |
| Unemployment rate, change (pp) | B | 0 / 174 | – | 1.004 | – | 39% | 0.486 | 1.006 | no |
| Real interest rate, level | A | 45 / 99 | 1.040 | 1.032 | 27% | 34% | <0.001 | 1.038 | no |
| Real interest rate, level | B | 45 / 99 | 1.002 | 0.997 | 44% | 51% | 0.894 | 0.996 | no |
| World GDP growth, level | A | 145 / 191 | 1.056 | 1.064 | 26% | 21% | 0.029 | 1.080 | no |
| World GDP growth, level | B | 145 / 191 | 1.020 | 1.035 | 37% | 18% | 0.263 | 1.046 | no |
| Brent oil price, log change (exploratory) | A | 0 / 191 | – | 1.040 | – | 24% | 0.007 | 1.049 | exploratory |
| Brent oil price, log change (exploratory) | B | 0 / 191 | – | 1.007 | – | 26% | 0.079 | 1.008 | exploratory |

## Verdict

- **Inflation, change (pp)**: tested, did not improve the forecast under the protocol
- **Private credit / GDP, change (pp)**: tested, did not improve the forecast under the protocol
- **Current account / GDP, level**: tested, did not improve the forecast under the protocol
- **Unemployment rate, change (pp)**: tested, did not improve the forecast under the protocol
- **Real interest rate, level**: tested, did not improve the forecast under the protocol
- **World GDP growth, level**: tested, did not improve the forecast under the protocol

## Slope sign stability (variant A, final origin)

| Indicator | Economies | Share with positive slope |
|---|---|---|
| Inflation, change (pp) | 159 | 39% |
| Private credit / GDP, change (pp) | 110 | 60% |
| Current account / GDP, level | 144 | 65% |
| Unemployment rate, change (pp) | 166 | 51% |
| Real interest rate, level | 76 | 51% |
| World GDP growth, level | 181 | 52% |
| Brent oil price, log change (exploratory) | 181 | 45% |

## Harness controls (run after the protocol was fixed; they check the harness, not the indicators)

`CONTROLS=1 npx tsx scripts/backtest-predictors.ts <data-dir> <out.md>` replaces the candidates with two synthetic ones.

| Control | Var | Ratio early | Ratio late | Share early | Share late | DM p | Pass |
|---|---|---|---|---|---|---|---|
| Next-year growth (deliberate leak) | A | 0.000 | 0.000 | 100% | 100% | <0.001 | yes |
| Next-year growth (deliberate leak) | B | 0.549 | 0.527 | 83% | 87% | <0.001 | yes |
| Random noise | A | 1.029 | 1.038 | 30% | 24% | <0.001 | no |
| Random noise | B | 1.000 | 1.001 | 53% | 49% | 0.994 | no |

So the harness detects a real signal and does not invent one. It also shows what "no gain" looks like here: pure noise
scores about 1.03 with a per-economy slope (A) and about 1.00 with a pooled slope (B). Every real candidate's ratio sits
in that noise band (A: 1.01–1.10, B: 0.97–1.04).

## Reading the results

- **None of the six indicators improved one-year-ahead GDP-growth forecasts** under the pre-set rule, against either
  baseline. The per-economy versions (A) are mostly *worse* than AR(2), the usual cost of fitting an extra parameter on
  about 30 annual points; the pooled versions (B) are indistinguishable from AR(2).
- Where the DM p-value is small (e.g. current account, variant A), the sign is *against* the indicator model, so it is
  evidence of harm, not benefit.
- Unemployment and Brent have no "early" column: their series start in 1991 and 1992, and 20 (15 for Brent) joint years
  are needed, so they could only be scored from the 2010s. Under the protocol that means they cannot pass; it does not
  mean they were shown to be useless over a longer sample.
- Not tested here, so no conclusion either way: horizons of 2–3 years, trade-weighted partner growth (needs historical
  bilateral trade), terms of trade and the real exchange rate (coverage), quarterly or monthly data, and real-time
  vintages. Current-vintage data flatters models slightly, which makes a "no gain" result stronger, not weaker.
- Consequence for the app: the Outlook may show these indicators as "moves with" (the existing cross-country
  correlations) or "tested, no gain in forecast accuracy", never as predictors of the headline forecast.
