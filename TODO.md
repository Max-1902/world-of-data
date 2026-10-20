# Owner to-do

Steps only the owner can do (account sign-ups and secrets). Tick them off here when done.

## 1. Register for a free EIA API key (Energy Inventories panel)

The Energy Inventories panel (Economy → Inventories) shows "Not measured" until this is done. The key is free and there is no billing.

- [ ] Register at <https://www.eia.gov/opendata/register.php>. The key arrives by email.
- [ ] Add it to your local `.env`: `EIA_API_KEY=<your key>`, then restart the dev server.
- [ ] For the live site: Vercel → Project → Settings → Environment Variables → add `EIA_API_KEY`, then redeploy.
- [ ] First run: open the panel and check that all five series load (commercial crude, gasoline, distillate, natural-gas storage, SPR). The series ids were checked against EIA's own tables, but the natural-gas id (`NG.NW2_EPG0_SWO_R48_BCF.W`) could not be tested without a key. If that one shows an HTTP 404, tell the agent, so the id can be corrected rather than guessed.

## 2. Register for a free IOM DTM API key (Humanitarian → IDPS tab)

The IDPS tab lists UNHCR's internal-displacement figures without a key. The IOM Displacement Tracking Matrix survey rounds under each country (latest round, change since the previous round, which regions IDPs are in) show "need a free API key" until this is done. There is no paid tier.

- [ ] Register at <https://dtm.iom.int/data-and-analysis/dtm-api>, subscribe to **API-V3**, and copy the **Primary key** from your profile.
- [ ] Add it to your local `.env`: `DTM_API_KEY=<your key>`, then restart the dev server.
- [ ] For the live site: Vercel → Project → Settings → Environment Variables → add `DTM_API_KEY`, then redeploy.
- [ ] First run: open Humanitarian → IDPS and tap Sudan. The parser follows the field names in IOM's own `dtmapi` client (`operation`, `reportingDate`, `roundNumber`, `numPresentIdpInd`, `admin1Name`). It could not be tested against a live response without a key. If the numbers look doubled or empty, tell the agent, so the parser can be fixed rather than guessed.

## 3. Optional

- [ ] `VITE_NEWSAPI_KEY` is empty. It is optional: the news panels work from RSS, Google News and NYT without it. NewsAPI's free plan only works from localhost.
