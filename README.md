# Macroeconomic Forecasting System

A monitoring and analysis system for macroeconomic, political and industrial data — trade, sanctions, debt dynamics, conflict, hazards — on a 3D globe, with forecasts of GDP growth, inflation and unemployment whose model was chosen by an out-of-sample backtest on every World Bank economy: AR(2) for GDP growth, which beats a naive baseline on average but not the IMF, and "no change" for inflation and unemployment, where no model tested beat it.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![React](https://img.shields.io/badge/React-18-61dafb) ![Mapbox](https://img.shields.io/badge/Mapbox_GL-v3-000000) ![Vite](https://img.shields.io/badge/Vite-6-646cff)

![Satellite globe in the Economy workspace with live exchange tags (TSX, NASDAQ, LSE, XETRA) and the Markets panel's regional equity ETF quotes](docs/screenshots/markets-globe.jpg)

## Forecasts

Computed in the browser, each with the backtest that decides whether it is shown. Statistical projections, not AI output.

![Next week's US natural-gas storage change: reported changes against the model's forecasts made a week earlier, with its 80% range, the forecast and the backtest verdict](docs/screenshots/gas-storage-forecast.jpg)

**Gas storage, next week.** The five-year seasonal norm plus a share of last week's departure from it, refit every week on earlier data only. Over 561 out-of-sample weekly forecasts (2016–2026) its average miss was 29.3 Bcf against 30.9 Bcf for the seasonal norm (Diebold–Mariano with a 52-week HAC correction, p = 0.004), it beat the norm in both 2016–2020 and 2021–2026, and its 80% range held 81.4% of outcomes. A 5% gain, shown as one: weather is left out, and market consensus estimates are not compared.

![Predictions panel, United States: AR(2) backtest error 1.44 pp against 1.78 pp for "no change" over 50 one-year-ahead folds, with the Diebold–Mariano verdict that the difference is not significant](docs/screenshots/predictions-backtest.jpg)

**GDP, inflation and unemployment for 217 economies.** The headline model for each series was picked by a rolling-origin backtest across every World Bank economy: AR(2) for GDP growth (8% below "no change" one year ahead on average; the IMF still beats it in 142 of 185 economies), "no change" for inflation and unemployment, where no model tested beat it. Intervals were calibrated on forecasts made before 2010, and the label shows what they held since. Each card also backtests the model on the selected country and says when it doesn't win: for the US, AR(2)'s one-year error was 1.44 pp against 1.78 pp for "no change", not a significant difference (p = 0.09).

| | |
|---|---|
| ![Predictions panel for the United States: real GDP growth since 2000 with a three-year AR(2) forecast, its interval and the naive baseline](docs/screenshots/predictions-gdp.jpg) | ![EIA weekly commercial crude and motor gasoline stocks over the last year against their five-year average and range](docs/screenshots/energy-inventories.jpg) |
| **The forecast card**: history, the AR(2) path, the naive baseline and an interval labelled with the coverage it actually achieved | **Energy inventories**: EIA weekly crude, gasoline, distillate, SPR and gas stocks against the same week's five-year average and range, the data the gas forecast is built on |

## How it works

```mermaid
flowchart LR
  UI["Browser: panels, 3D globe, local statistics (forecasts, backtests, correlations)"]
  AG["Analyst loop, in the browser"]
  FREE["Keyless sources: World Bank, Our World in Data, USGS, GDACS, ..."]
  PX["/api functions: keys stay server-side"]
  KEYED["Finnhub, EIA, NYT, ACLED, OpenSky, FIRMS, Cloudflare Radar, RSS"]
  LLM["OpenRouter: language model"]
  UI -->|"direct, no key"| FREE
  UI --> PX --> KEYED
  AG -->|"tools: the same fetches the panels use"| UI
  AG -->|"/api/openrouter"| LLM
```

The analyst never computes or plots a number itself:

```mermaid
flowchart LR
  Q["Question"] --> M["Model writes DATA requests"]
  M --> T["Browser runs each tool against the same services the panels use"]
  T --> R["Results R1, R2, ... with their source"]
  R -->|"up to 4 rounds"| M
  R --> A["Answer cites R ids; CHART:R2 is drawn by the panel from R2's data"]
```

## An AI analyst that shows its evidence

The analyst (any OpenRouter model, free by default) answers by requesting the dashboard's own data, not from memory. Asked:

> *Which economies have inflation rising fastest relative to GDP growth, and what does the forecast say for Germany? Show the chart.*

| | |
|---|---|
| ![The investigation trail: six datasets queried, R1 inflation highest 15 and R2 GDP growth lowest 15 from the World Bank, with R2 expanded into a bar chart and the raw text the model received](docs/screenshots/ai-analyst-trail.jpg) | ![The answer: the R1 inflation chart, then a table of four economies on both lists with their inflation, growth and the gap between them, the gap labelled as the model's own arithmetic](docs/screenshots/ai-analyst-answer.jpg) |
| **The investigation trail**: every query the model made, with an id (R1, R2…) and its source. R2's chart is drawn by the panel from the World Bank rows; the model only chose where to place it | **The answer** cites R1 and R2 in its table, tags the gap column as its own arithmetic (*inference*), and flags that South Sudan's growth figure is from 2015, so it can't be compared with 2024 inflation |

One question, one run: an illustration, not a benchmark. It also shows a limit: the question asked where inflation is *rising*, and the model answered with current levels (highest inflation, lowest growth), not changes.

### It can investigate on its own

Since 2026-10-16 the analyst does more than read the summary it is given. It can query every dataset the dashboard holds: live conflict events, internet outages (IODA alerts, plus Cloudflare Radar's verified outages with their stated cause), disaster alerts (GDACS), earthquakes (USGS), wildfires (FIRMS), GPS interference, headlines, market quotes, any World Bank series for any country, cross-country rankings, trade, energy, sanctions, military, resources, chokepoints, ports and UNHCR. It writes a request line (`[DATA:series|Germany,France|GDP growth]`). The browser runs the query against the same free services the panels use and returns the result, with an id (R1, R2…), for the model to cite. A single question can take up to four rounds of requests. Statistics and forecasts are computed locally, never by the model. The forecast tool uses the Predictions panel's model choice (`utils/forecastPolicy.ts`) and reports AR(2)'s out-of-sample backtest against a naive baseline on that country, so a forecast that doesn't beat "no change" is labelled as such.

Charts follow the same rule. The model writes `[CHART:R2]` to place a chart, and the panel draws it from that result's data, so the model can't supply or change a plotted value. Every answer shows an **investigation trail** listing each query, its source, success or failure, and the exact text the model received. Clicking a reference such as (R2) in the answer opens that evidence.

**Not measured:** whether the tool-using analyst is more accurate, better grounded or more useful than the single-shot version.

## 30 overlays in 5 categories

![Europe, North Africa and the Middle East with the infrastructure overlays on: energy sites, pipelines, ports and chokepoints from Gibraltar and the Bosphorus to Suez, Bab el-Mandeb and Hormuz](docs/screenshots/infrastructure-europe.jpg)

| Category | Overlays |
|---|---|
| **Live tracking** | flights (OpenSky), vessels (AIS), webcams |
| **Events & hazards** | crises, news, wildfires (NASA FIRMS), disaster alerts (GDACS), humanitarian, GPS jamming, internet outages, hazard hexagons |
| **Security & defence** | military sites, force size, nuclear, sanctions, airspace (low-traffic heuristic, not NOTAMs) |
| **Economy** | markets, trade, resources, oil, gas, supply chain, country data |
| **Infrastructure** | energy sites, infrastructure access, data centres, pipelines, ports, chokepoints, shipping density |

Panels add what isn't a map layer, e.g. weekly energy inventories (EIA). Curated layers (military sites, energy sites, sanctions…) are hand-entered from named sources and not all re-verified; [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md) says which.

Split view: the satellite map beside the embedded DeepState Ukraine battlefield monitor, with a live news feed in the dock.

![The Americas shaded red and blue by how much electricity each country generates compared with what its GDP per capita predicts, with the Power Output ranking in the dock](docs/screenshots/power-output-vs-trend.jpg)

Infrastructure workspace, Power Output shown on the map in *Vs trend* mode: each country is shaded by the electricity it generates against what its GDP per capita predicts (red above, blue below), and the dock ranks countries by electricity generated (Ember via Our World in Data).

## Analytics

Pick any two of **50 country indicators** (World Bank, Our World in Data, Ember) and get the trend, Spearman correlation with a 95% interval, the biggest outliers, and a globe shaded by the result. Charts have a table view; all maths is unit-tested.

| | |
|---|---|
| ![Globe coloured red and blue by how far each country's life expectancy is above or below the trend predicted by GDP per capita, with the scatter in the dock](docs/screenshots/country-analytics-map.jpg) | ![Globe turned to Asia, every country shaded by GDP in US dollars from the Economy panel, with the panel's country list in the dock](docs/screenshots/economy-gdp-map.jpg) |
| **Wealth vs health**, 214 countries, ρ = 0.86. Map in *Vs trend* mode: red lives longer than income predicts, blue shorter | **Economy data on the map**: the Economy panel's *Show on map* shades 214 countries by GDP (US$); *Vs trend* switches to the residual view |

![Spearman rank correlation matrix of twelve country indicators, blue negative and red positive, with the value printed in each cell](docs/screenshots/correlation-matrix.jpg)

**What moves together**: a 12×12 Spearman matrix over the countries each pair has in common; click a cell to plot that pair. GDP per capita goes with life expectancy (ρ = 0.86), internet use (0.83) and energy use (0.86), and against resource rents (−0.52).

Also: ~120,000 NASA FIRMS wildfire detections binned into 3D hexagons in the browser, plus earthquakes with a Gutenberg–Richter fit.

## Country Lookup

One country's full World Bank record since 1960 by category, ECB/Eurostat/BIS series for Europe, and a single-country analysis (trend tests, cycle, Okun, Phillips, debt dynamics, anomalies), each with method, n and caveats.

![Germany in Country Lookup: Okun's law scatter with its fitted line, the inflation history with a detected regime shift in 1984, and the method and caveats under each](docs/screenshots/country-lookup-okun.jpg)

Germany: each extra 1% of real growth went with unemployment falling about 0.16 pp (95% CI −0.26 to −0.05, R² 0.30, n = 25). Average inflation shifted in 1984, from 3.9% to 2.0% (Quandt–Andrews sup-F test), and the Phillips curve shows no reliable trade-off (p = 0.95).

Not a decision tool: correlation is not causation, and many series are years old for some countries.

## Run it

```bash
npm install
cp .env.example .env   # only VITE_MAPBOX_TOKEN is required; every other key is optional
npm run dev            # Vite + the small /api functions that keep secrets out of the bundle
npm test               # about 1,700 tests, fully offline
```

![Terminal: the full test suite passing offline, 1716 tests in 114 files in under 10 seconds](docs/screenshots/tests-offline.jpg)

The suite is hermetic: any network call a test doesn't mock fails, so it runs offline and in CI with no keys.

Keys that only the owner can register (EIA) are tracked in [`TODO.md`](TODO.md).

Stack: Vite, React 18, TypeScript (strict), Mapbox GL v3, plain SVG charts. No database; state lives in the browser. A few serverless functions in `api/` keep API keys off the client and forward requests (ACLED, OpenSky, Finnhub, EIA, NYT, GPSJAM, RSS, OpenRouter). Architecture and conventions are in [`ARCHITECTURE.md`](ARCHITECTURE.md).
