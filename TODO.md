# Owner to-do

Steps only the owner can do (account sign-ups and secrets). Tick them off here when done.

## 1. Register for a free EIA API key (Energy Inventories panel)

The Energy Inventories panel (Economy → Inventories) shows "Not measured" until this is done. The key is free and there is no billing.

- [ ] Register at <https://www.eia.gov/opendata/register.php>. The key arrives by email.
- [ ] Add it to your local `.env`: `EIA_API_KEY=<your key>`, then restart the dev server.
- [ ] For the live site: Vercel → Project → Settings → Environment Variables → add `EIA_API_KEY`, then redeploy.
- [ ] First run: open the panel and check that all five series load (commercial crude, gasoline, distillate, natural-gas storage, SPR). The series ids were checked against EIA's own tables, but the natural-gas id (`NG.NW2_EPG0_SWO_R48_BCF.W`) could not be tested without a key. If that one shows an HTTP 404, tell the agent, so the id can be corrected rather than guessed.

## 2. Add ACLED credentials as GitHub Actions secrets (daily research recorder)

The daily recorder (`.github/workflows/research-record.yml`) currently records "ACLED_EMAIL / ACLED_PASSWORD not set" (latest: 2026-10-14). The repository has no Actions secrets, so the research series is collecting empty conflict data.

- [ ] GitHub → `Max-1902/world-of-data` → Settings → Secrets and variables → Actions → New repository secret: `ACLED_EMAIL`, `ACLED_PASSWORD` (the same values as in your `.env`).
- [ ] After the next scheduled run, check that `research/data/dashboard/<day>.json` shows `"acled": {"ok": true, …}`.

## 3. Optional

- [ ] `VITE_NEWSAPI_KEY` is empty. It is optional: the news panels work from RSS, Google News and NYT without it. NewsAPI's free plan only works from localhost.
