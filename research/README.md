# Research apparatus

Tools for turning the dashboard into something that can be measured. Code is in `src/research/` (pure, unit-tested) and `scripts/research/` (Node runners, `npx tsx`). Results and data live here. Findings are in [`FINDINGS.md`](FINDINGS.md).

All external calls are free: ACLED (free non-commercial account) and OpenRouter `:free` models. The eval runner refuses a paid model unless `--allow-paid` is passed.

## 1. AI run log (in the app)

Every AI Analyst call is stored in the browser's IndexedDB (`src/services/aiRuns.ts`). Each record holds the full message list sent (system prompt with the live context, prior turns, question), the sampling settings, the model requested and the model that answered, the raw answer, the outcome and the inputs marked NOT MEASURED. **Export runs** (history menu in the AI panel) downloads them as JSONL. The log never leaves the browser unless you export it.

Runs where the analyst fetched data (since 2026-10-16) also hold every round in `messages`: the model's `[DATA:…]` request, then the `TOOL RESULTS` message sent back. They also carry `toolCalls` (id, query, ok, source) and `steps`. The eval harness below replays only the system context, so it does not yet cover tool runs.

## 2. Eval harness

```bash
npm run research:eval -- --contexts research/eval/contexts --repeats 2
npm run research:eval -- --contexts ai-runs-2026-10-08.jsonl        # contexts from exported runs
npm run research:eval -- --contexts research/data/dashboard         # contexts from the daily recorder
```

- Questions: [`eval/questions.json`](eval/questions.json), frozen. Add a new version; don't edit in place.
- Contexts: any recorder file, any JSON with a `context` (and optionally a verbatim `system` and a ground-truth `notMeasured`), or an exported run log.
- Same system prompt and sampling settings as the app (`buildSystemPrompt`, `CHAT_PARAMS`), sent without streaming.
- Scores per answer (`src/research/fidelity.ts`):
  - **Number fidelity:** the share of stated numbers (years excluded) that occur in the context or question, allowing rounding. It's a heuristic. A correct sum, a date or marked background knowledge also counts as "unsupported", so each unsupported number is saved with its surrounding text for manual review.
  - **NOT MEASURED violations:** sentences that give a count, an absence or a level for an input the context marked as not measured. The check is pattern-based, so it catches the observed failure ("0 flights" read as "no aircraft") but not every paraphrase.
- Output: `eval/results/<stamp>_<model>.jsonl` (every answer) and `.summary.json`.

## 3. Daily recorder

`.github/workflows/research-record.yml` runs `scripts/research/record.ts` once a day and commits:

- `data/dashboard/<day>.json`: what the dashboard computes from the exact ACLED poll the app sends (14 days, capped at 500 events), plus the trajectories and the frozen AI context. The context doubles as an eval fixture.
- `data/acled-daily/<day>.json`: per-day, per-country ACLED aggregates for the last 30 days, uncapped. Each day's file is a vintage, so comparing files shows how much ACLED backfills after the fact.

Only aggregates and the dashboard's own derived context are stored, not raw ACLED event rows. A failed login is recorded as a failure, so gaps in the series stay visible. Flights are not polled.

## 4. Trend-flag backtest

```bash
npm run research:backtest -- --fetch-days 180                       # one ACLED login; stores aggregates in data/acled-history/
npm run research:backtest -- --input research/data/acled-daily/<day>.json
```

The backtest replays `classifyTrend`, the same function the Watchlist uses (a test asserts it reproduces `computeTrajectories` exactly), for every country and day. It then compares each flag with the next 72 hours:

- **elevated:** next 72h above the prior week's pace by more than the flat band.
- **escalated:** next 72h higher than the last 72h.
- **lift:** P(elevated | rising) ÷ P(elevated | all). A lift of 1 means the flag carries no information.

The backtest also reports the flags the Watchlist would actually have shown (top 6 per day) and a naive comparison flag.

Limits: the replay uses ACLED data as reported at fetch time, which includes events added after the day in question. That makes it optimistic about what the live flag could have known. The recorder's vintages are there to measure that gap. Flight and news boosts are left out because no history exists for them, and they don't change the flag itself.

## 5. ML comparison: does a learned model beat the hand-written rule?

```bash
npm run research:backtest -- --input research/data/acled-daily/<day>.json --ml
npm run research:backtest -- --input research/data/acled-daily/<day>.json --ml --train-fraction 0.7
```

`classifyTrend` (`src/utils/trajectory.ts`) is one hand-written rule: last-72h severity score against the
prior week's pace. `--ml` trains a small logistic regression (`src/research/mlTrend.ts`, no framework, plain
gradient descent) on seven features per (as-of day, country) observation — the same two the rule uses, plus
a mid-window score, raw event counts, short-term momentum and days-since-last-event — and reports its lift
against the rule's, **on the same held-out days**.

The split is time-based, not random: the model trains only on the earlier `--train-fraction` of as-of days
(default 70%) and is scored only on the later days, so it cannot have seen the outcomes it's being graded
on. The rule's lift is recomputed on that same held-out slice (not the whole range) so the two numbers
answer the same question.

This is a comparison, not a migration path. `classifyTrend` ships in the app unchanged; nothing here is
wired into the Watchlist. The question it answers is narrow: given the real ACLED history collected so far,
does a model with more features than one scalar delta actually separate "goes on to look busier" from
"doesn't" better than the rule — and the honest answer may well be no, especially while the recorder has
only a few months of real data. A model that *matches* the rule on scarce data is itself a finding, not a
failed experiment, and should be written up as one in `FINDINGS.md` the same way the rule's own bugs were.

## 6. GDP-growth forecast evaluation (Predictions panel)

```bash
npm run research:forecast -- --indicator gdp --fetch                              # gdp | cpi | unemployment; World Bank, free and keyless; stores a vintage
npm run research:forecast -- --input research/data/worldbank-gdp/2026-10-14.json  # offline, reproducible
```

Scores `arForecast` (`src/utils/econAnalysis.ts`), the function the Predictions panel ships, on each of the panel's targets (real GDP growth, CPI inflation, unemployment) for 52 European and Asian economies. It uses a rolling origin (origins from 1990, at least 30 years of history each, the same folds for every method) and reports the 1- and 3-year mean absolute error and the real coverage of the 95% interval, split before and after 2005. It compares the naive and historical-mean baselines and shorter estimation windows, plus the pre-fix interval (derived exactly from the shipped output) and a post-hoc "naive if non-stationary" variant. Output: `backtest/forecast_<indicator>_<day>.json`. Results and decisions are in `FINDINGS.md`.

## 7. Against the IMF's own forecasts

```bash
npx tsx scripts/research/imfCompare.ts --imf research/data/imf-weo/mfpd-oct2025.json \
  --gdp research/data/worldbank-gdp/2026-10-14.json --cpi research/data/worldbank-cpi/2026-10-14.json
```

Compares the October WEO's next-year forecast with the AR, run on less information than the IMF had (fair) and on more (oracle), plus the naive forecast, on the same folds. Outcomes are the World Bank series and, as a robustness check, the IMF's realised values. The IMF data is a CC BY 4.0 republication of the IMF Historical WEO Forecasts Database (MFPD, doi:10.17632/8dt6xpp6x4.9), subset by `scripts/research/mfpd_extract.py`, which verifies the source file's sha256.
