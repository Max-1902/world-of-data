# Handoff: Country Lookup (single-country research tool)

Status as of 2026-10-07. Read `CLAUDE.md` first; everything there applies.

## What the owner asked for (keep to this)

- A **new, separate sidebar menu entry "COUNTRY LOOKUP", placed directly below ANALYSIS**. It is its own research tool. **Do not touch the existing ANALYSIS workspace** (Country Analytics, Hazard Analytics, Analyst chat, Briefing). The owner was explicit and angry about this.
- For one chosen country: **every World Bank series we have**, with **one box and one chart per category**, starting with the World Bank DataBank country profile (Social, Economic, Environment, Institutions, exactly the profile's 24 indicators) and then the rest of the record.
- For **European countries**: ECB, Eurostat (and BIS) data, also in boxes with charts.
- **Under all of that, an analytics tool for economic analysis.** It must analyse the country's own data, not just compare countries.
- Historic data: World Bank history is pulled from **1960**.
- It is a **research project**: chart quality, defensible methods, sample sizes, caveats, no overclaiming.

## What was built (all new files unless noted)

| File | Role |
|---|---|
| `src/services/countryLookup.ts` | World Bank catalogue (15 categories, ~95 series; sources 2 = WDI, 3 = WGI, 63 = HCI), country list, full-history fetch in batches of ≤30 (API requires one source per request), formatting |
| `src/services/europeMacro.ts` | ECB (key rates, 10y yields, MIR lending rates, FX), Eurostat (HICP `prc_hicp_minr`, unemployment, quarterly GDP, debt, deficit/interest/debt annual, ESI, house prices, nominal GDP), BIS policy rates for non-euro; JSON-stat / SDMX-JSON / CSV parsers |
| `src/utils/econAnalysis.ts` | Pure statistics (see methods below) |
| `src/hooks/useCountryLookup.ts` | Selected country (localStorage `country-lookup-iso2`, default DE), loading state |
| `src/components/charts/LineChart.tsx`, `XYChart.tsx` | New charts: one y-axis, gaps not bridged, ref lines, shaded bands, crosshair tooltip, legend only for ≥2 series |
| `src/components/panels/CountryLookupPanel.tsx` | The page: search → category boxes → Europe section → analysis |
| `src/components/panels/countryLookup/{CategoryBox,EuropeSection,AnalysisSection,shared}.tsx` | Sections |
| Edited: `src/panels/types.ts` (`'country'` group, optional `minHeight`), `src/panels/registry.tsx` (panel + `GROUP_ORDER` entry after analysis), `src/components/Sidebar.tsx` (icon/hint), `src/components/PanelDock/PanelDock.tsx` (uses `def.minHeight`), `src/services/sourceHealth.ts` (ecb/eurostat/bis rules), `src/index.css` (`.cl-*` classes, appended at the end) |
| Tests | `econAnalysis.test.ts` (incl. Monte Carlo calibration), `countryLookup.test.ts`, `europeMacro.test.ts`, `CountryLookupPanel.test.tsx`, `charts/LineChart.test.tsx` — all pass |

All sources are free, keyless and CORS-open (verified with live requests): `api.worldbank.org`, `data-api.ecb.europa.eu`, `ec.europa.eu/eurostat`, `stats.bis.org`.

## Analysis section — methods (each card shows result, method, caveats, n)

1. **Coverage**: series reported, observations, median latest year, stale series.
2. **Trends across all series**: Mann–Kendall + Sen's slope over the last 15 observations, variance inflated for lag-1 autocorrelation (Yue & Wang 2004 effective sample size, r₁ bias-corrected as (n·r₁+1)/(n−4)). Benjamini–Hochberg FDR across all tests; "expected by chance" shown.
3. **Growth & cycle**: contractions (years of negative real growth), depth, recovery year; decade mean/sd; 10/20-yr CAGR; **Quandt–Andrews sup-F** mean-break test (15% trim, Andrews 5% cv 8.68).
4. **Output gap**: HP filter on log real GDP, λ = 6.25 (Ravn–Uhlig, annual).
5. **Sources of growth**: population vs per-person growth by decade; structural shares now vs 20 years earlier.
6. **Okun's law** (ΔU on growth) with CI and stable-growth rate. For European countries it uses Eurostat measured unemployment, otherwise ILO modelled estimates, which can make the relation partly mechanical (stated in the caveats).
7. **Inflation**: AR(1) persistence, regime break, accelerationist Phillips curve (Δπ on u).
8. **Sectoral balances**: private = CA − government (Eurostat general gov. for Europe, otherwise WB central gov.).
9. **Debt dynamics (Europe only)**: EC identity Δd = −pb + d₋₁(i−g)/(1+g) + sfa, with the effective interest rate from Eurostat D41PAY/GD; debt-stabilising primary balance.
10. **Monetary stance (Europe)**: ex-post real policy rate = policy − HICP.
11. **Anomaly scan**: robust z (median/MAD) of the latest yearly change vs the series' own history; |z| ≥ 3; chance baseline shown.

## Research finding to keep (recorded in the README research notes)

I first implemented trend-free pre-whitening (TFPW, Yue et al. 2002). A calibration test showed it **inflates** false positives on short autocorrelated series: on trendless AR(1) series with ρ = 0.6 and n = 15, the plain test rejected 24% and TFPW 29%, against a nominal 5%. The ESS correction with bias-corrected r₁ rejected 9%. At ρ = 0.8, n = 25: 42% / 53% / 10%. The cost is lower power (ρ = 0.6, n = 25, slope 0.2: 68% vs 98% for the plain test). Simulation: 2,000 draws per cell; the calibration tests in `econAnalysis.test.ts` pin this behaviour.

## Not done / open — verify before claiming anything

- **Not yet opened in a real browser.** Unit and component tests pass, but nobody has looked at the rendered page with live data. Do that first (`npm run dev` → COUNTRY LOOKUP), and check DE, GR (Eurostat code EL), PL (BIS, PLN), BR (no Europe section), and a small state with sparse data.
- Response size: about 95 series × 66 years, about 1–1.5 MB of World Bank JSON per country (6 requests, 2 at a time). Check the load time.
- The analysis cards were checked against synthetic fixtures and hand-worked numbers, **not against published estimates** (e.g. official output gaps or Okun coefficients). That comparison would be the obvious validation study.
- The break test over-rejects on persistent series (inflation); this is stated in the UI but not quantified. A Monte Carlo on AR(1) data would quantify it.
- The AI Analyst is **not** wired to this panel's results. If you add that, follow the "computed locally, model explains" control and the NOT MEASURED convention from the AI panel.
- The ECB HICP series `ICP/...000000...` stopped at 2025-12 (ECOICOP 2 switch), which is why HICP comes from Eurostat `prc_hicp_minr` with `coicop18=TOTAL`.
- The euro area comparator is Eurostat `EA21` (Bulgaria joined 2026-01-01).

## Multi-session warning

During this work a sibling session was mid-rewrite of trade data (`tradeStats.ts`, `TradeSections.tsx`, `EconomyPanels.tsx`, the Map `tradeStats` layer, `scripts/build-trade.mjs`). Its missing `src/data/trade-profiles.json` makes `npm run typecheck` fail in `TradeSections.tsx`/`tradeStats.ts`, and it stops 3 test files from loading (`datasets`, `lookups`, `layers`). None of that is Country Lookup code. Don't "fix" those files without checking with the owner. Those files were left out of this commit.
