# Owner to-do

Steps only the owner can do (account sign-ups and secrets). Tick them off here when done.

## 1. Register for a free EIA API key (Energy Inventories panel)

The Energy Inventories panel (Forecasts → Energy Inventories) shows "Not measured" until this is done. The key is free and there is no billing.

- [x] Register at <https://www.eia.gov/opendata/register.php>. The key arrives by email.
- [x] Add it to your local `.env`: `EIA_API_KEY=<your key>`, then restart the dev server.
- [ ] Only if you deploy the site somewhere: add `EIA_API_KEY` to that host's environment variables.
- [x] First run: all five series load through the local proxy (checked 2026-10-19, data to the week of 2026-10-09), including the natural-gas id `NG.NW2_EPG0_SWO_R48_BCF.W`; the key is not echoed in responses.

## 2. Optional

- [ ] `VITE_NEWSAPI_KEY` is empty. It is optional: the news panels work from RSS, Google News and NYT without it. NewsAPI's free plan only works from localhost.
