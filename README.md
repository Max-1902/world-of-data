# Macroeconomic Forecasting System

A monitoring and analysis system for macroeconomic, political and industrial data — trade, sanctions, debt dynamics, conflict, hazards — on a 3D globe, with one-year-ahead forecasts of GDP growth, inflation and unemployment that are backtested out of sample against a naive baseline and the IMF (and mostly do not beat them; see [research/FINDINGS.md](research/FINDINGS.md)). It is a research case around two questions: **what does data become when you visualise it, and what happens when an LLM is wired into a system that can evaluate all of it?**

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![React](https://img.shields.io/badge/React-18-61dafb) ![Mapbox](https://img.shields.io/badge/Mapbox_GL-v3-000000) ![Vite](https://img.shields.io/badge/Vite-6-646cff)

![Macroeconomic Forecasting System on Ukraine: satellite globe with the country brief, country panel with military and nuclear sites, and the AI analyst's answer on the economic impact of the war](docs/screenshots/main.jpg)

## 30 overlays in 5 categories

![Satellite view of Europe with many overlays switched on at once, the Germany country brief open at bottom left and the Economy workspace with Germany's trade profile on the right](docs/screenshots/overlays-europe.jpg)

| Category | Overlays |
|---|---|
| **Live tracking** | flights (OpenSky), vessels (AIS), webcams |
| **Events & hazards** | crises, news, wildfires (NASA FIRMS), disaster alerts (GDACS), humanitarian, GPS jamming, internet outages, hazard hexagons |
| **Security & defence** | military sites, force size, nuclear, sanctions, airspace (low-traffic heuristic, not NOTAMs) |
| **Economy** | markets, trade, resources, oil, gas, supply chain, country data |
| **Infrastructure** | energy sites, infrastructure access, data centres, pipelines, ports, chokepoints, shipping density |

Panels add what isn't a map layer, e.g. weekly energy inventories (EIA). Curated layers (military sites, energy sites, sanctions…) are hand-entered from named sources and not all re-verified; [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md) says which.

![Split view over Donbas: Mapbox satellite map on the left, the embedded DeepState Ukraine battlefield monitor on the right, and a live news feed in the dock](docs/screenshots/deepstate-split.jpg)

Split view: the satellite map beside the embedded DeepState Ukraine battlefield monitor, with a live news feed in the dock.

![Infrastructure workspace on the United States: country panel listing dams, LNG terminals, refineries and the largest power plants, a hover card with electricity output against the trend, and the Power Output ranking in the dock](docs/screenshots/infrastructure-us.jpg)

Infrastructure workspace on the United States: the country panel lists its dams, LNG terminals, refineries and largest power plants, and the dock ranks countries by electricity generated (Ember via Our World in Data).

## Analytics

Pick any two of **50 country indicators** (World Bank, Our World in Data, Ember) and get the trend, Spearman correlation with a 95% interval, the biggest outliers, and a globe shaded by the result. Charts have a table view; all maths is unit-tested.

| | |
|---|---|
| ![Globe coloured red and blue by how far each country's life expectancy is above or below the trend predicted by GDP per capita, with the scatter in the dock](docs/screenshots/trend-map.jpg) | ![Population against armed forces personnel on log axes, with North Korea, Eritrea and Israel labelled above the trend](docs/screenshots/army-size.jpg) |
| **Wealth vs health**, 214 countries, ρ = 0.86. Map in *Vs trend* mode: red lives longer than income predicts, blue shorter | **Army size**, 165 countries, ρ = 0.79. North Korea, Eritrea and Israel sit furthest above the trend. Armed-forces counts are World Bank / IISS, and every country's latest value is **2020** (pre-dating the war in Ukraine) |
| ![Correlation matrix of twelve indicators, blue negative and red positive, values printed in each cell](docs/screenshots/correlation-matrix.jpg) | ![About 120,000 wildfire detections binned into extruded hexagons over Africa](docs/screenshots/hazard-hex.jpg) |
| **What moves together**: 12×12 Spearman matrix; click a cell to plot that pair | **Big data in the browser**: ~120,000 NASA FIRMS detections binned into 3D hexagons client-side. Also earthquakes, with a Gutenberg–Richter fit |

## An AI that reads the analytics

The analyst (any OpenRouter model, free by default) gets the comparison currently on screen as computed numbers, not as text to recall. I asked **Claude Sonnet 5.5** a data question:

> *Which countries spend far more on defence than their wealth predicts, and what explains the top two?*

| | |
|---|---|
| ![Scatter of military spending against GDP per capita with Ukraine as an extreme outlier](docs/screenshots/defence-analytics.jpg) | ![Claude's answer quoting the analytics numbers, with its own explanations labelled as such](docs/screenshots/ai-claude-panel.jpg) |
| **The data**: ρ = 0.16, wealth predicts almost nothing. Ukraine is +10.7 σ above the trend | **The answer**: every figure matches the panel (Ukraine 34.5% vs 2.2% expected, Israel 8.8% vs 2.5%, Algeria 8.0%…). It says the wealth link is negligible and labels its explanations "my context, not from the panel" |

The screenshot shows the World Bank's 2024 values as published then. They have since been revised (as of 2026-10-15: Ukraine 2024 34.0%, Israel 8.5%), and 2025 values now exist (Ukraine 39.6%), so the live panel shows different numbers.

It also drove the map (flew to Ukraine, switched layers on). One question, one run per model: an illustration, not a benchmark.

### It can investigate on its own

Since 2026-10-16 the analyst does more than read the summary it is given. It can query every dataset the dashboard holds: live conflict events, internet outages (IODA), disaster alerts (GDACS), earthquakes (USGS), wildfires (FIRMS), GPS interference, headlines, market quotes, any World Bank series for any country, cross-country rankings, trade, energy, sanctions, military, resources, chokepoints, ports and UNHCR. It writes a request line (`[DATA:series|Germany,France|GDP growth]`). The browser runs the query against the same free services the panels use and returns the result, with an id (R1, R2…), for the model to cite. A single question can take up to three rounds of requests. Statistics and forecasts are computed locally, never by the model. The forecast tool reuses the Predictions panel's AR(2) and reports its out-of-sample backtest against a naive baseline, so a forecast that doesn't beat "no change" is labelled as such.

Charts follow the same rule. The model writes `[CHART:R2]` to place a chart, and the panel draws it from that result's data, so the model can't supply or change a plotted value. Every answer shows an **investigation trail** listing each query, its source, success or failure, and the exact text the model received. Clicking a reference such as (R2) in the answer opens that evidence.

**Not measured:** whether the tool-using analyst is more accurate, better grounded or more useful than the single-shot version. The offline eval harness replays only the system context, so it can't yet score answers whose evidence arrived as tool results (see [`research/FINDINGS.md`](research/FINDINGS.md)).

## Research notes

- **Controls:** real data only, nothing fabricated; numbers are computed locally and the model explains them; evidence is kept separate from inference; free sources only ([`CLAUDE.md`](CLAUDE.md), [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md)).
- **Found along the way:** a World Bank query silently dropped most countries (42 of 245 for internet use); the trend heuristic flagged steady countries as "falling", first through a 3-vs-7-day scaling error and then, after that fix, through a 10-day prior window still scaled as 7 days (found by the backtest work, fixed Oct 2026); with ACLED down, the AI was told "Total events: 16" (the hand-entered baseline) and "Airborne flights tracked: 0"; the default free model answers with tool-call markup only and never writes a briefing; the World Bank renamed its fragile-states aggregate from `FCS` to `FCV`, so "Fragility, Conflict, and Violence situations" ranked 5th among "countries" on military spending (found by the analyst's first live tool run, fixed 2026-10-16). Details: [`research/FINDINGS.md`](research/FINDINGS.md).
- **Apparatus:** every AI run is logged with its exact context and can be exported, there's an offline eval harness (number fidelity, NOT MEASURED violations), a daily recorder, and a backtest of the trend flag ([`research/`](research/README.md)).
- **Country Lookup** (new workspace): one country's full World Bank record since 1960 by category, ECB/Eurostat/BIS series for Europe, and a single-country analysis (trend tests, cycle, Okun, Phillips, debt dynamics, anomalies), each with method, n and caveats.
- **Found while building it:** trend-free pre-whitening, a common fix for autocorrelation in Mann–Kendall trend tests, made false positives *worse* on short annual series (simulated, ρ = 0.6, n = 15: 29% vs 24% uncorrected, nominal 5%). An effective-sample-size correction with a bias-corrected autocorrelation holds it near 9%, at the cost of power. The calibration is pinned in tests.
- **Not yet done:** the trend flag has not been backtested on real data, because the ACLED account was locked when the code was ready. The eval covers one recorded state and two free models, with a pattern-based scorer.
- Not a decision tool: correlation is not causation, and many series are years old for some countries.

## Run it

```bash
npm install
cp .env.example .env   # only VITE_MAPBOX_TOKEN is required; every other key is optional
npm run dev            # Vite + the small /api functions that keep secrets out of the bundle
npm test               # ~1,100 tests, fully offline
```

Keys that only the owner can register (EIA, GitHub Actions secrets for the research recorder) are tracked in [`TODO.md`](TODO.md).

Stack: Vite, React 18, TypeScript (strict), Mapbox GL v3, plain SVG charts. No database; state lives in the browser. A few serverless functions in `api/` keep API keys off the client and forward requests (ACLED, OpenSky, Finnhub, EIA, Guardian, NYT, GPSJAM, RSS, OpenRouter). Architecture and conventions are in [`ARCHITECTURE.md`](ARCHITECTURE.md).
