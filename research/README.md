# Research apparatus

Tools for turning the dashboard into something that can be measured. Code is in `src/research/` (pure, unit-tested) and `scripts/research/` (Node runners, `npx tsx`). Results and data live here. Findings are in [`FINDINGS.md`](FINDINGS.md).

All external calls are free: ACLED (free non-commercial account) and OpenRouter `:free` models. The eval runner refuses a paid model unless `--allow-paid` is passed.

## 1. AI run log (in the app)

Every AI Analyst call is stored in the browser's IndexedDB (`src/services/aiRuns.ts`). Each record holds the full message list sent (system prompt with the live context, prior turns, question), the sampling settings, the model requested and the model that answered, the raw answer, the outcome and the inputs marked NOT MEASURED. **Export runs** (history menu in the AI panel) downloads them as JSONL. The log never leaves the browser unless you export it.

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
