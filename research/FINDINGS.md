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

## Not done

- **Trend-flag backtest:** the code is built and tested (it reproduces the dashboard's flag exactly), but it hasn't run on real data. The ACLED account returned `flood_user_blocked` (locked after failed logins) and was left alone so the lock wouldn't be extended. Run `npm run research:backtest -- --fetch-days 180` once access is back.
- **Daily recorder:** the workflow is committed but records "ACLED not measured" until `ACLED_EMAIL` / `ACLED_PASSWORD` are added as repository Actions secrets.
