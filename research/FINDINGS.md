# Findings — 2026-10-08

**Status: automatic scores, not yet reviewed by hand.** The scorers are pattern-based heuristics (see [README](README.md)). Every answer and every flag is in [`eval/review.csv`](eval/review.csv), with empty verdict columns for manual review. Treat the numbers below as provisional until that review is done.

## Bugs found in the system itself (verified in code, fixed)

1. **Trend flag: steady activity read as "falling".** `computeTrajectories` kept events up to 13 days old, so the prior bucket covered 10 days but was scaled as 7. One event a day for two weeks came out as "falling — 3 events in 72h, down from 10 in the prior week". This was the second time this happened: the earlier 3-vs-7 fix was incomplete. Fixed, with a regression test.
2. **"Not measured" sent to the AI as zero.** With ACLED unavailable, the context said `Total events: 16` (the hand-entered baseline list) and `Airborne flights tracked: 0` (empty feed). The panel header showed the same numbers to people. Fixed: inputs that weren't measured are now listed as NOT MEASURED, and the baseline is shown as a reference list, not as events.
3. **The context listed layers as if their data were present** (outages, wildfires, news) when none of that data was in it. They're now labelled "data NOT in this context unless it appears above".
4. **The default free model never produces a briefing.** `liquid/lfm-2.5-2.6b:free` returned 0 briefings out of 40. It reasons in a hidden field, then emits only native tool-call markup (`<|tool_call_start|>[COUNTRY(name='Ukraine')…]`) and stops. The panel showed that markup raw. It now strips it, so the user sees "did not return a briefing". The default model itself was **not** changed. That's your call.
5. `qwen/qwen3.8-27b:free` is no longer free (OpenRouter returns 404). It was removed from the free fallback list.

## A/B eval: same recorded state, old vs new context

State: 2026-10-08, ACLED unavailable, flights not measured. Arm A is the context and prompt exactly as at commit `9e66b54`; arm B is the current version. 10 frozen questions × 2 repeats, $0 (free models).

| model | arm | briefings | answers flagged for a NOT MEASURED violation | mean number fidelity |
|---|---|---|---|---|
| lfm-2.5-2.6b (default) | A | 0/20 | — | — |
| lfm-2.5-2.6b (default) | B | 0/20 | — | — |
| nemotron-3-super-120b | A | 19/20 | 11/19 | 0.94 (19 answers with numbers) |
| nemotron-3-super-120b | B | 20/20 | 1/20 | 0.75 (8 answers with numbers) |

Reading, provisional:
- In arm A, the model mostly repeated the context's numbers faithfully (high fidelity), but those numbers were false: "16 events", "0 flights". **High number fidelity didn't mean a correct answer.** The context was wrong, not the model.
- In arm B, flags dropped from 11 to 1, and fewer answers cited numbers at all. The lower fidelity mean comes from only 8 answers and needs the manual review.
- n = 20 per arm, one recorded state, one usable model. This is a first measurement, not a result. Gemma 4 was rate-limited throughout and isn't included.

## GDP-growth forecast (Predictions panel), 2026-10-14

Measured with `npm run research:forecast -- --input research/data/worldbank-gdp/2026-10-14.json`. Data: World Bank real GDP growth (`NY.GDP.MKTP.KD.ZG`, free and keyless), 52 European and Asian economies, latest year 2025. Design: rolling origin, forecast origins 1990–2025 with at least 30 years of history before each, all methods scored on the same folds (1,388 one-year-ahead folds; fewer at three years). Origins are split at 2005, so a choice made on 1990–2004 can be checked on 2005–2025. Full output: [`backtest/forecast_gdp_2026-10-14.json`](backtest/forecast_gdp_2026-10-14.json).

**Bugs found in the forecast itself (verified in code, fixed):**

1. **The interval widened by √h, a random-walk rule, not the AR model's own error growth.** The correct h-step variance for an AR(p) is σ̂²·Σψⱼ² for j < h, where ψ₀ = 1 and ψⱼ = Σφᵢψⱼ₋ᵢ (Hamilton 1994, ch. 4; Hyndman & Athanasopoulos, FPP3 §9.8). These series revert to a mean, so √h made the 3-year interval too wide: in 1990–2004 it held the real value **98.8%** of the time at three years ahead, against a nominal 95%. Fixed: 96.4%.
2. **σ̂ divided by n − 1, not by the regression's degrees of freedom, n − p − 1.** This made intervals very slightly too narrow. Fixed. Effect on one-year coverage: 96.4% → 96.6% (1990–2004).
3. **The docstring said `arForecast` returns null below p×4 + 3 points.** The code returns null below 2p + 3. Docstring corrected; behaviour unchanged.

Point forecasts are unchanged by all three fixes. Tests check the interval against an independent closed-form AR(1) regression.

**Interval coverage after the fix (nominal 95%):**

| | 1990–2004 origins | 2005–2025 origins |
|---|---|---|
| 1 year ahead | 96.6% | **89.9%** |
| 3 years ahead | 96.4% | **92.2%** |

Since 2005 the textbook interval undercovers. It assumes the past error spread holds and ignores uncertainty in the fitted coefficients, and the period includes 2008–09 and 2020. The pre-fix √h rule happened to come closer at three years in this period (96.0%) because it was too wide everywhere, not because it modelled anything. The panel now states the measured 2005–2025 coverage rather than claiming 95%.

**Point accuracy (mean absolute error, pp; lower is better):**

| method | 1y, 1990–2004 | 1y, 2005–2025 | 3y, 1990–2004 | 3y, 2005–2025 |
|---|---|---|---|---|
| naive (repeat last year) | 2.149 | 2.717 | 2.649 | 3.224 |
| AR(2), full history (shipped) | **1.967** | 2.493 | **2.024** | 2.624 |
| AR(2), last 30 years | 2.021 | 2.431 | 2.072 | 2.422 |
| AR(2), last 20 years | 2.042 | 2.502 | 2.158 | 2.462 |
| mean, last 20 years | 2.066 | **2.230** | 1.999 | **2.322** |

The shipped AR(2) beats the naive forecast in 42 of 52 countries.

**Structural break: suspected, tested, not fixed.** Iterated forward, AR(2) converges to c / (1 − φ₁ − φ₂), a level set by the whole series. For economies that have slowed structurally, that pulls the forecast up: China 5.0% (2025) → 9.2% (2028), long-run level 8.5%; Korea 1.0% → 4.9%, long-run level 6.9%. For China and Korea the AR model loses to the naive forecast out of sample. Fitting on recent years only was tested as the fix:

- Chosen on 1990–2004, the full history wins (1.967 vs 2.021–2.042), so the pre-planned rule keeps it.
- On 2005–2025 the shorter windows do better (last 30: 2.431 vs 2.493), and a 20-year mean beats every AR variant. The ranking flips between periods.
- Per country, a 30-year window beats the full history in 26 of 52 countries, no better than a coin flip.
- In the countries suspected in advance (CN, KR, JP, TH), shorter windows do reduce error. China's AR error falls from 2.04 to 1.74 with 20 years, but the naive forecast (1.50) still wins. Those four were picked after looking at the forecasts, so this is not evidence for a general change.

Decision: the estimation window is unchanged. The panel now prints the long-run level each forecast converges to and the years it comes from, and says that this pull is an assumption of the model, not evidence. A window or break-detection rule should only ship if it wins on a pre-registered split. This run's 2005 split is now used up for that purpose.

The World Bank revises past figures, so each vintage is stored and later runs may differ slightly.

### Inflation and unemployment (the panel's other two targets)

Same script and code, each indicator's design fixed before running: inflation (`FP.CPI.TOTL.ZG`) uses the GDP design; unemployment (`SL.UEM.TOTL.ZS`, World Bank/ILO modelled estimates from 1991 only) uses the panel's own 15-year minimum and a split at 2015, so its forecasts start in 2006. Outputs: [`forecast_cpi_2026-10-14.json`](backtest/forecast_cpi_2026-10-14.json), [`forecast_unemployment_2026-10-14.json`](backtest/forecast_unemployment_2026-10-14.json).

| target | method | 1y MAE early / late | 1y median AE early / late | 3y MAE early / late | beats naive (countries) |
|---|---|---|---|---|---|
| inflation | naive | 2.035 / 2.247 | 0.823 / 1.105 | 3.011 / 3.224 | — |
| inflation | AR(2) full (shipped) | 4.118 / 6.166 | 1.465 / 1.616 | 7.217 / 9.344 | **13 of 50** |
| unemployment | naive | 0.845 / 0.595 | 0.460 / 0.429 | 1.827 / 1.215 | — |
| unemployment | AR(2) full (shipped) | 0.874 / 0.678 | 0.468 / 0.442 | **3.787 / 2.352** | 20 of 52 |

(early/late = before/after the split year: 2005 for inflation, 2015 for unemployment.)

- **Inflation: the shipped forecast is worse than "same as last year"**, on the mean and the median, in both periods, in 37 of 50 countries. No fit was non-stationary, so this is the mean-reversion pull again: the full history includes the high-inflation 1970s–90s (Turkey, Iran, transition economies), and the model pulls forecasts toward it. Shorter windows help (last 20 years, late period: 2.72) but still lose to naive.
- **Unemployment: the three-year forecast has double the naive error, and most of it comes from non-stationary fits.** 44 of 1,040 folds produced an AR(2) whose iterated forecast diverges rather than settling (e.g. Greece, origin 2015: forecast −1.2% for a realised 21.4%). On those folds the 3-year MAE was about 32 pp; on stationary fits it was 1.69. GDP and inflation had none.
- A rule "use naive when the fit is non-stationary" brings unemployment's 3-year MAE to 1.719 / 1.643. That beats naive before 2015 but not after (1.215). The rule was found on this data, so it is recorded, **not shipped**. What did ship: the panel now flags a non-stationary fit as an unstable forecast and does not report a long-run level for it.

### Against the IMF's own forecasts

`npx tsx scripts/research/imfCompare.ts --imf research/data/imf-weo/mfpd-oct2025.json --gdp research/data/worldbank-gdp/2026-10-14.json --cpi research/data/worldbank-cpi/2026-10-14.json` → [`imf_compare_2026-10-14.json`](backtest/imf_compare_2026-10-14.json).

IMF data: the IMF Historical WEO Forecasts Database as republished in the IMF WEO Macroeconomic Forecasts Panel Dataset (MFPD), Mendeley Data, [doi:10.17632/8dt6xpp6x4.9](https://doi.org/10.17632/8dt6xpp6x4.9), CC BY 4.0, file `WEO_MacroForecasts_Oct_2025.xlsx` (sha256 verified against the publisher's listing). imf.org refuses scripted downloads of the original (HTTP 403), so the republication was used. Changes made: subset to the 52 economies, h ≤ 3, GDP growth and CPI inflation only, keyed by ISO2 (`scripts/research/mfpd_extract.py`; values unchanged). The MFPD has no unemployment forecasts, so unemployment has no IMF comparison.

Question: the October WEO's forecast for next year (made in October of year W for W+1) vs the AR, on the same folds. The AR runs under two information sets, chosen so the comparison can't be rigged against the AR:
- **fair**: annual data to W−1, two steps ahead. This is less than the IMF had in October, when about three quarters of year W were known.
- **oracle**: data including the full year W. That is more than the IMF had, an upper bound that flatters the AR.

Outcomes: the World Bank series the panel uses, with the IMF's own realised values as a robustness check.

| variable | IMF Oct WEO | AR(2) fair | AR(2) oracle | naive (year W repeated) | folds |
|---|---|---|---|---|---|
| GDP growth, MAE (median) | **1.891** (1.180) | 2.392 (1.649) | 2.256 (1.524) | 2.455 (1.399) | 1,330 |
| CPI inflation, MAE (median) | **2.084** (0.971) | 7.506 (2.498) | 5.220 (1.527) | 2.120 (0.989) | 1,258 |

- **GDP:** the IMF beats the AR in 44 of 52 countries, even when the AR is given the oracle information. The IMF beats naive in 48 of 52.
- **Inflation:** the IMF and naive are level (2.08 vs 2.12; naive better before 2005, the IMF after), and the AR is far behind both.
- Scored against the IMF's own realised values instead, every ranking above holds (GDP: 1.973 / 2.470 / 2.354 / 2.571).

Not measured: European Commission and central-bank forecasts (no free archive of past vintages was wired in), April WEO vintages, and horizons beyond next year.

### Panel changes from this round

The panel's charts now show:
- a marker on every year;
- the 95% interval as a shaded band;
- a shaded forecast period;
- the recent trend line, drawn only when the Mann–Kendall test is significant;
- a time-range switch (the model still uses the full history);
- a table with every actual and forecast value.

The text states the forecast direction with its start and end values, and whether "no change" lies inside the final-year interval. Each target shows the evidence above. Reading the result for China: recent trend significantly downward (−0.25 pp/yr since 2011, p < 0.001), AR forecast rising to 9.2%. The chart now shows that contradiction rather than hiding it.

## Analyst investigation tools, 2026-10-16

The analyst can now request data (`services/aiTools.ts`, loop in `services/aiAgent.ts`). Each query runs in the browser against the dashboard's existing free sources. The result goes back to the model as text, and charts are drawn only from those results.

**What was checked.** Unit tests cover the parser, every local tool, the not-measured paths and the loop: round cap, per-round cap, deduplication and model fallback. A smoke run of the keyless tools against the live APIs on 2026-10-16 (World Bank series, profile, rank and forecast; USGS; GDACS; Ember; trade) returned well-formed results.

**Found by that smoke run:**

1. **A World Bank aggregate ranked as a country.** "Fragility, Conflict, and Violence (FCV) situations" came 5th on military spending (6.8% of GDP). The aggregate-exclusion lists in `countryIndicators.ts`, `militaryPersonnel.ts` and `infraIndicators.ts` had the old code `FCS`, but the API now returns `FCV`. This affected Country Analytics and the rankings, not only the analyst. Fixed, with a regression test.
2. **A forecast that loses to "no change".** For Türkiye CPI inflation, AR(2) over 54 one-year-ahead folds had a mean absolute error of 11.72 pp against 9.96 pp for the naive forecast (Diebold–Mariano p = 0.07). The tool passes this verdict to the model with the forecast. Whether models then present such a forecast with the right caution is not yet measured.

**Not measured:**

- Answer quality, grounding or usefulness compared with the single-shot analyst. No eval has been run.
- Whether models follow the protocol. Small free models may ignore `[DATA:…]`, or mix requests and prose in one turn. The default free model's native tool-call markup is mapped onto the tools when it names one, but it hasn't been re-tested end to end.
- Number fidelity of tool runs. `scripts/research/eval.ts` takes its context from the system message only, and tool results arrive as later user messages, so a re-score would wrongly count tool numbers as unsupported. The exported run log keeps every round in `messages` and lists the queries in `toolCalls`, so the scorer can be extended.

## Not done

- **Trend-flag backtest:** the code is built and tested (it reproduces the dashboard's flag exactly), but it hasn't run on real data. The ACLED account returned `flood_user_blocked` (locked after failed logins) and was left alone so the lock wouldn't be extended. Run `npm run research:backtest -- --fetch-days 180` once access is back.
- **Daily recorder:** the workflow is committed but records "ACLED not measured" until `ACLED_EMAIL` / `ACLED_PASSWORD` are added as repository Actions secrets.
