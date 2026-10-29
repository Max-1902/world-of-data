# Architecture

## Shape

No application server and no database. This is a Vite-built React SPA that talks directly to public APIs from the browser. The exceptions are a handful of thin serverless functions in `api/` (Vercel-style; `vite.api-dev.ts` serves the same files in `npm run dev`): they exist only to inject server-side secrets (OpenSky/ACLED OAuth, Finnhub, NYT, OpenRouter keys) or to get around a missing CORS header (RSS, GPSJam), and hold no state. Everything else is fetched straight from the browser. There is no persistence layer beyond `localStorage` (panel layout, view mode, AI chat history) — every panel is a live view over whatever the last poll returned.

```
src/
  App.tsx                       # root composition + top-level state (view mode, panel layout, selected country)
  components/
    Map/MapView.tsx             # Mapbox GL composition root — see Map/layers, Map/overlays below
    Sidebar.tsx                 # left nav — six entries (Outlook, Forecasts, Drivers, Countries, Explore, Saved) + a folded More
    TopBar.tsx                  # live counters, view switcher, search
    NewsTicker.tsx               # scrolling headline strip
    CountryDrawer.tsx            # click-a-country intel aggregation (crises, bases, trade, econ, refugees...)
    OutlookCard.tsx              # bottom-left card: regional outlook, or the brief for a picked country (CountryBrief)
                                 #   or picked city (PlaceBrief: local news + everything tracked within ~50-200 km)
    SettingsModal.tsx            # layers / data sources / API key status / display prefs
    PanelDock/
      PanelDock.tsx               # right-hand panel stack — resizable, drag-to-reorder
    Windows/                      # floating panel windows (multi-window terminal layout), up to 12:
      WindowLayer.tsx             #   renders the windows + snap preview + dock-drag drop target; WindowTaskbar under the map
      PanelWindow.tsx             #   one window: drag, 8-way resize, minimise/maximise, move to a separate browser window
      geometry.ts                 #   pure: edge/corner snapping, split-by-drop, magnetic edges, linked resize, tile layouts
      useWindowLayout.ts          #   window state + persistence (localStorage `ws-windows`)
      screens.ts, useScreens.ts   #   named layouts ("Crisis", "Markets", your own): taskbar tabs, Alt+1–9, Cmd+K;
                                  #   stored as workspace fractions (`ws-screens`) so they fit any monitor
      Taskbar.tsx                 #   bottom strip: screen tabs, save/manage screens, Panels, open windows + arrange
      PanelLibrary.tsx            #   every panel searchable by what it shows (P, top-bar search, Cmd+K)
      FloatingPanel.tsx           # legacy single floating panel (pre-registry)
    charts/                       # SVG chart primitives (TimeSeries, Bars, Magnitude, Heatmap, Scatter, Rank, CorrMatrix, ChartFrame)
    panels/                       # panel implementations, grouped by theme (NewsPanels, SecurityPanels,
                                  #   MarketPanels, EconomyPanels, CountryBrowserPanels, RankingPanels, AIAnalystPanel, HumanitarianPanel, ...)
    PanelHost.tsx                 # per-panel ErrorBoundary + Suspense (panels are lazy-loaded)
    Map/MapView.tsx               # composition root (~220 lines): owns the map + refs, calls addAllLayers() once and each layer's use*() hook
    Map/layers/<name>.ts          # one module per map layer: add<Name>Layers(map, ctx) = sources/layers/handlers (once, on style load),
                                  #   use<Name>Data(handle, props) = visibility + data updates; layers/index.ts fixes draw order
    Map/overlays/                 # on-map React chrome: OverlayMenu, legends, Reticle, DeepStatePanel
    Map/types.ts                  # MapViewProps + MapHandle (the map/refs every layer hook receives)
    Map/flightLayer.ts            # flight GeoJSON/popup/icon helpers (pure, no React)
    Map/vesselImages.ts           # vessel SDF icons; Map/viewModes.ts: CSS filter + overlay configs
  panels/
    registry.tsx                  # single source of truth: id → group → title → render fn
    types.ts                       # PanelDef / PanelProps / PanelGroup contract
  hooks/                          # one hook per live data source — owns polling + exposes typed state
  services/                      # one API client per data source — fetch/parse only, no React
  utils/
    trajectory.ts                 # rule-based trend scoring (crisis escalation/de-escalation)
    dataAnalytics.ts              # pure stats over the quake/fire feeds: bucketing, Gutenberg–Richter b-value, region matrix, FRP histogram
    countryStats.ts               # scales, Spearman/Pearson + Fisher CI, OLS trend, residual outliers, correlation matrix, map colouring
    hexbin.ts                     # weighted points → H3 cells (lazy h3-js) + draw scaling for the map layer
    vizPalette.ts                 # sequential / diverging ramps shared by charts and the map layer
    flightType.ts                  # ICAO24 hex-range + callsign heuristics (military/civil/cargo)
    reloadBus.ts                   # global "reload all data" event bus
  types/index.ts                  # shared domain types (Flight, CrisisEvent, PanelState, ...)
```

## The panel registry pattern

Every panel in the right-hand dock is one entry in `src/panels/registry.tsx`:

```ts
{ id: 'crisiswatch', title: 'Crisis Monitor', group: 'overview', section: 'events', dotColor: 'orange',
  desc: 'ICG conflict tracking — 70+ states', render: () => <CrisisWatchPanel /> }
```

`group` is the workspace (`overview | markets | analysis | country | security | geo | news`). `GROUP_ORDER` sets the order of workspaces. The left `Sidebar` is organised by purpose, not by workspace: six entries (Outlook, Forecasts, Drivers, Countries, Explore, Saved) each open a workspace on a chosen panel, and Risk monitor, Security, Infrastructure and News sit in a folded More. `navSection()` in `Sidebar.tsx` maps the current workspace and focused panel to the one entry that is lit. Topic presets live as tiles on the Outlook page, and the AI analyst is offered as an "Ask the AI analyst" button on the Forecasts and Shock-exposure dock banners (`PanelDock/AskAnalyst.tsx`) rather than as a navigation entry. `section` names a banner from `GROUP_SECTIONS[group]`. The dock shows panels section by section, each section under a numbered banner with a header and a one-line explanation, ordered from the most immediate or aggregated view to the detail behind it. `src/panels/registry.test.ts` checks that every panel's section exists and that no section is empty. Adding a panel means adding one entry here — `PanelDock`, the floating windows (`Windows/`), and `SettingsModal`'s layer list all read from this registry, so nothing else needs to change. Panels receive a shared `PanelProps` bag (`crises`, `flights`, `panelState`, `onToggleLayer`, `onGeoSearch`, `onCountryClick`, ...) and destructure only what they use.

## Data flow: service → hook → panel

Every live data source follows the same three-layer shape:

1. **`services/*.ts`** — a fetch/parse client for one provider. No React, no state. Example: `services/opensky.ts` handles OpenSky's OAuth2 token exchange and state-vector parsing.
2. **`hooks/use*.ts`** — owns the polling interval and exposes `{ data, loading, error }`. Example: `useFlights` polls OpenSky every 15s.
3. **Panel component** (`components/panels/*.tsx`) or **map layer** (`MapView.tsx`) — renders the hook's output.

Refresh rates are chosen per-provider to stay under free-tier rate limits, not for UX reasons: flights 15s (OpenSky's polite ceiling), crises 5min, markets 60s, wildfires/earthquakes 5-10min, news on-demand.

`useCrises` also seeds a hardcoded `BASELINE` array of major ongoing conflicts (Ukraine, Gaza, Sudan, etc.), each stamped with **today's date** so they always render when ACLED is unconfigured, rate-limited or down (GDELT was dropped — see the note in `services/crises.ts`). Their coordinates are region centres, not event locations, and the date is the load date, not an event date; `useCrises` therefore also reports `liveCount` so the UI can tell when nothing live is loaded. This matters for anything doing time-series analysis over `crises` — see the Watchlist note below.

## Country page (`components/countryPage/`)

Picking a country (map click, search, alert, shared link) opens its data as a page in the main area, over the map rather than as cards on it; "Show on map" swaps the page for a small chip that leads back. Tabs, economy first: **Economy** (World Bank figures with year and freshness flag), **Forecasts** (the IMF's WEO projections, tagged statistical, and the GDP nowcast for EU members, with links that open Predictions / GDP Nowcast on the same country through `utils/focusCountry.ts`), **Trade & exposure** (this country's own rows from the Shock Exposure engine, then the trade profile), **Risk & security**, **Infrastructure**, **Live activity** and **News**. The context tabs are the country drawer's own sections (`CountryDrawer` with `embedded` and `only`), so nothing is computed twice. Each tab carries its sources footer.

## Home (`HomeDashboard.tsx`, `components/home/ForecastHome.tsx`)

Home is forecast-first. `ForecastHome` answers four questions in order for one country (shared with the Predictions panel through `utils/focusCountry.ts`, default Germany): **what do we expect** (real GDP growth, next three years, with the interval and the coverage it actually held, and the IMF's figure beside it), **what changed** (`forecast/SinceBlock`, from `services/forecastLog.ts`), **what it rests on** (each line tagged observed or statistical; model inputs, never causes), and **what could change it** (the forecast sees only the country's own history; Shock exposure is linked but does not alter the number, and the forecast has no scenario analysis of its own yet). Below it, the G20 on the IMF's own projections, then the map, global context and the dataset topics as supporting material.

It is deliberately not a second forecasting implementation. `utils/homeForecast.ts` calls the same `headlineForecast`, `backtestForecast` and interval policy as the Predictions panel, and `makeRecord` (`utils/forecastRecord.ts`) builds the record both write to the forecast log, so the two cannot disagree or report phantom changes to each other. The flagship is GDP growth only; there is no global or quarterly forecast, and the Watchlist (short-term conflict activity) is not an economic outlook and does not appear here.

## Map layer system (`components/Map/`)

One Mapbox GL instance, ~25 independently toggleable layer groups (flights, vessels, crises, military, nuclear, pipelines, ports, chokepoints, supply chain, shipping density, humanitarian, GPS jamming, etc.), each gated by a boolean in `PanelState` (`src/types/index.ts`). `App.tsx` owns `panelState` and passes `showX` booleans down; the map adds/removes layer visibility, it never owns the toggle state itself.

`MapView.tsx` is only the composition root. Each layer is one module in `Map/layers/` with two halves: `add<Name>Layers(map, ctx)` registers its sources, layers and click/hover handlers once when the style loads (`ctx` carries the shared popup ref and the few refs/callbacks handlers need), and `use<Name>Data(handle, props)` is the hook that shows/hides the layer and pushes data into its source as props change. `layers/index.ts` calls the `add*` functions in a fixed order — **that order is the draw order** — and re-exports the hooks. Hooks all wait on `layersReadyRef`/`mapReady`, which flip only after every source exists.

Ten view modes (`earth/standard/dark/satellite/city3d/nightvision/bw/infrared/snow/thermal`) are implemented two ways: `city3d` tilts the camera and shows a real `fill-extrusion` buildings layer; the rest (`nightvision/bw/infrared/snow/thermal`) are CSS `filter()` overlays applied to the canvas element (`CANVAS_FILTERS` in `Map/viewModes.ts`, applied by `useViewMode`), not different Mapbox styles — cheap to add, no extra tile requests.

A known race condition worth knowing about: flight data can arrive before the map's `load` event fires. The fix already in place is a `flightDataRef` that buffers pending data; `addFlightLayers` flushes it once the source exists.

## Oil & gas pipelines (`services/pipelines.ts`)

Real route geometry from OpenStreetMap (ODbL), in two tiers, because neither alone works:

- **World view:** `public/data/pipelines-trunk.geojson`, a committed snapshot of every OSM `route=pipeline` relation tagged `substance=oil|gas` (~200 long-distance lines). Regenerate with `node scripts/build-pipelines.mjs`. It's a snapshot because a world-wide Overpass query 504s on the public instances. The script retries and falls back between mirrors, and only writes the file when the whole run succeeds.
- **Detail view:** from zoom 9, individual pipeline ways are fetched live in 0.5° cells (`fetchPipelineCell`), cached per cell, capped per viewport, 3 requests at a time. Dense areas are huge (a 4°×4° tile over Texas was ~25 MB), so don't raise the cell size or lower the min zoom without re-measuring.

The older hand-typed waypoint lists (`GAS_PIPELINES`, `PIPELINE_ROUTES`) were removed: they were approximate and drew straight lines across terrain, which the no-approximated-data rule in `CLAUDE.md` forbids. Only the `pipelines` toggle drives these layers; the `infrastructure` toggle no longer writes to the `pipelines` source. Attribution to OpenStreetMap contributors is shown in the popup and Settings → data sources.

## The "Watchlist" — rule-based activity monitor (`src/utils/trajectory.ts`)

The AI Analyst panel doesn't just answer prompts — `computeTrajectories()` is a pure function (no network calls) that buckets each country's crisis events into a "last 3 days" vs "3–10 days prior" window using each event's real `date` field, scores both by severity, and ranks countries by the delta of the last 72h against the prior week's pace (prior score × 3/7 — the windows differ in length, so raw sums would read steady activity as falling). This produces a "rising / falling / flat" trend per region, shown automatically on panel load with no prompt required. The same computed numbers are appended to the LLM's system prompt (`buildDashboardContext` in `services/openrouter.ts`) so the model's own analysis is grounded in a real, local computation rather than a static snapshot.

**Inputs: dated conflict events only.** The score reads ACLED events and nothing else. Air traffic and news coverage used to add +2 boosts each; they were removed (2026-10-19) because neither is a measured conflict signal. A headline naming the country is still attached as `newsHit` for the reader and never moves the score or the flag. Callers pass the live feed *before* the map's same-place thinning (`useCrises` → `feed`), because thinning lowers counts. When the poll hit its 500-row cap (`capped`), the rows are a sample of the window, not totals: no own-normal is computed, the entry is marked `sampled`, and `isFlaggedUp` is false, so no Watchlist alert fires on a truncated feed. Forecasts in the strict sense live only in the Predictions panel, on World Bank series (`utils/forecastPolicy.ts`).

**Measured against each country's own normal.** A raw delta always ranks the largest wars first (300 → 310 events outranks 0 → 4). So each country's 72h event *count* is also compared with what its own history predicts: daily counts over the days before the 72h window (up to `BASELINE_MAX_DAYS` = 28, at least `MIN_BASELINE_DAYS` = 7, read back only as far as the feed's oldest event, because a capped feed may stop short), a rate with half a pseudo-event so a silent history isn't rate 0, and the country's own day-to-day spread (negative binomial when its days vary more than Poisson, else Poisson). The resulting tail probability (`baseline.pHigh` / `pLow`) flags a country `unusual: 'high' | 'low'` below `UNUSUAL_P` = 0.01 (no percentage is shown: from 7–28 days of counts it is a rough flag, not a calibrated probability) — strict because every country is tested at once. With a known normal the list is ranked by how unusual (smallest `pHigh` first), and Watchlist alerts fire on "unusually high" instead of a plain rise (`isFlaggedUp`); without enough history everything falls back to the delta rule. This is a statistical flag, not a validated forecast: no backtest has measured whether flagged countries go on to escalate, and the three days of the window are treated as independent, which understates how rare a sustained surge is.

**Load-bearing detail:** this function explicitly filters out `BASELINE` crisis entries (`source === 'Baseline'` / `id` starting with `baseline-`) before scoring. Baseline entries are stamped with today's date on every load, so including them would make every long-running conflict misread as "rising, no prior activity" on every single render — a bug caught during implementation, not a hypothetical.

## Country Analytics (`CountryAnalyticsPanel`, `services/countryIndicators.ts`, `services/countryAnalytics.ts`)

`countryIndicators.ts` holds the catalogue of 50 indicators from three sources (World Bank, Our World in Data via `owid.ts`, Ember via `powerGeneration.ts`; each with label, short label, group, source, axis scale and formatter — ids are plain World Bank codes, `owid:<slug>` or `ember:<measure>`), the presets, and `fetchIndicatorAll(id)`, which dispatches by id prefix to pure adapters (`parseWorldBank`, `owidToRows`, `emberToRows`) so every source resolves to the same `CountryValue` keyed by ISO-3166 alpha-3. For World Bank, one request returns every country's most recent non-empty value (`mrnev=1`; see the README for why not `MRV=1`), parsed by the pure `parseWorldBank` (drops aggregates/nulls/pre-2010 values, shortens formal names), cached for an hour, de-duplicated and retried once on throttling or timeouts. `countryAnalytics.ts` is a small observable store (same shape as `services/history.ts`, read through `useSyncExternalStore` in `hooks/useCountryAnalytics.ts`) holding the selected X/Y pair, the map mode and one slice per indicator; `loadMany` caps concurrency at four.

All the maths is pure and tested in `utils/countryStats.ts`: scales and tick generation, Spearman (average ranks for ties), Fisher-z intervals, OLS in axis space, standardised residuals, histograms, the pairwise-complete correlation matrix and the map colour assignment. The hook derives the pair analysis with `useMemo`, so the panel and the map layer share one computation. The `countryAnalytics` layer is the **only** layer that colours whole countries (the separate force-size and infrastructure-access fills were folded into it, 2026-10-26; their data is in the catalogue). Its colours come from `countryColors()` as a `match` expression keyed by `iso_3166_1_alpha_3`. It is driven from one place on the map, the "Colour countries by" control (`Map/overlays/CountryColorControl.tsx`: searchable `IndicatorPicker` over the whole catalogue, value / vs-trend switch, legend), from Cmd+K and the top-bar search (`indicator:<id>` rows), and from other panels' `OnMapButton`; all of them call `selectForMap(indicatorId)`. `MapView` reads the store itself so `App` doesn't re-render when data arrives.

**Comparability is shown, not assumed.** Each country's value is its own latest year, so `coverage()` (`utils/countryStats.ts`) reports how many countries have a value, which World Bank economies don't, the spread of reporting years and the typical (median) year. Values `STALE_YEARS` (3) or more older than the typical year are drawn faded, economies with nothing to shade are drawn grey (`NO_DATA_FILL`) rather than left transparent, and the legend and click popup state the source, the year and whether a value is dated.

## Forecast benchmark, memory and track record (Predictions panel)

- **IMF benchmark.** Each Predictions card shows the IMF World Economic Outlook figures for the same years (`services/imfWeo.ts`, through `api/imf-weo.ts`, which exists only because the IMF DataMapper API sends no CORS headers; free and keyless, fixed host, three allowlisted indicators, six-hour memory cache). The edition ("World Economic Outlook (October 2026)") travels with every figure. The API does not mark which years are IMF estimates and which are projections per country, so only years from the edition's own year on are called projections. Where the IMF's figure for the latest data year differs from the World Bank's by 0.3 pp or more, the card says the levels are not directly comparable. The analyst's `forecast` tool adds the same line, or says it is not available.
- **What changed.** `services/forecastLog.ts` keeps, in this browser only (localStorage `ws-forecast-log`), a `ForecastRecord` per country × series whenever its inputs change: the last five data years, the headline model, the forecast and its interval, and the IMF figures with their edition. A record is written only once the IMF request has settled, and a missing IMF figure is never read as a new edition. `explainChange()` (`utils/forecastRecord.ts`, pure) states new and revised data (observed), a model switch and how our forecast moved (statistical), and a new IMF edition (observed).
- **Track record.** `scoreRecords()` scores every recorded forecast whose year now has a World Bank figure, once per year and data cutoff (so revisiting can't inflate it), with the IMF's figure from the same record beside it. Nothing is backfilled: it starts empty and only grows with forecasts recorded before their outcome existed. It is per-device and informal, and the card says so.

## GDP nowcast (`utils/nowcast.ts`, `services/eurostatNowcast.ts`, GDP Nowcast panel, analyst tool `nowcast`)

This quarter's real GDP growth for each EU member state before Eurostat publishes it, from the months of industrial production already out (Eurostat `namq_10_gdp` and `sts_inpr_m`; free, keyless, CORS-enabled). The rule was committed before any real data was scored (commit `5802e09`) and is written out at the top of `utils/nowcast.ts`: a bridge equation (GDP growth on quarterly IP growth, refit before each quarter) against "same as last quarter", a pseudo-real-time backtest from 2005 for 1, 2 and 3 months of IP known, pandemic quarters (2020–21) scored but never counted, and the model shown as the headline only if it beats the baseline in both 2005–2014 and 2015 on at the number of months the live nowcast has. On the first real run (2026-10-27, Q3 with July–August IP) it qualified in 16 of 27 economies; elsewhere the panel shows "same as last quarter" and says the model failed. The 80% range is split-conformal from the headline method's own past errors. Backtests use today's revised data, which flatters both methods; the panel says so.

## Shock exposure (`utils/exposure.ts`, Shock Exposure panel, analyst tool `exposure`)

The "connect the dots" engine: pick a shock and see which economies it reaches, through which link, and how much, as a share of their own GDP. Pure and offline; it only combines data the app already holds:

- **Demand** ("X buys less") and **supply** ("supply from X is cut"): X's share of each reporter's goods exports / imports (UN Comtrade top-6 partners, `trade-profiles.json`) × those exports / imports as % of GDP (Comtrade US$ totals ÷ World Bank `NY.GDP.MKTP.CD`).
- **Oil chokepoint**: the chokepoint's oil flow (EIA) is stated, then an explicit *assumption* that a disruption moves the world oil price; countries are ranked by net mineral-fuel trade (HS 27) as % of GDP, importers losing and exporters gaining. Comtrade does not say whose cargo uses which route, so this ranking is the same for every oil chokepoint, and the panel says so.

Every result is a path of `Step`s, each tagged `observed` (with source and year) or `assumption` (the shock itself, and an optional size the user types). A partner or product outside a reporter's top-N list is only known to be below the smallest listed share, so it becomes a range (`bounded`), never a guessed value; GDP and trade figures from different years are flagged. Results are first-order: goods only, gross flows (re-export hubs look more exposed), no rerouting or second-round effects; those caveats travel with every result. Only the 45 Comtrade-profile economies are covered.

**Scenario step (statistical).** A demand shock with an assumed size also gets each economy's implied change in GDP growth: the lost sales become a fall in real export growth (÷ exports of goods and services, World Bank `NE.EXP.GNFS.CD`; an *assumption* that prices hold), times the economy's export → GDP growth sensitivity (`utils/sensitivity.ts`: least squares of GDP growth on export volume growth, 1991 on, ≥ 15 years, 95% interval; specified before any result was seen). The range spans the interval and any bounded share, and an effect whose range crosses zero is called not distinguishable from none. It is labelled *statistical* and an association, not a cause: global swings move both series, so it is an upper-end guide. `services/exportSensitivity.ts` loads the two series in batches of 15 economies (one 45-economy request takes 12–14 s) and is shared with the analyst's `exposure` tool. Supply and oil shocks have no growth step.

The panel's "Show on map" hands exact (unbounded) values to the country-colouring layer through `showDerivedOnMap()` (`services/countryAnalytics.ts`): a `derived:` indicator id registered with its own label and source, stored as a ready slice, never fetched. The map card and popup then say "computed from reported figures" instead of "as reported". The analyst's `exposure` tool runs the same function and passes `summarizeExposure()` text, so its answers cite the computed path rather than recalled figures.

## Evidence kinds and shared data labels

Every claim is one of three kinds, labelled the same way everywhere (`utils/evidence.ts`): **observed** (figures as the source reports them), **statistical** (estimated by a stated method — an association with uncertainty, not a cause) and **assumption** (set by the user or a scenario). `components/DataLabels.tsx` holds the shared `EvidenceTag`, `SourceLine` and `StatusLabel` (`.dl-*` styles in `index.css`); map popups, which are HTML strings, use the same `EVIDENCE` wording. Every panel also gets a standard **sources footer** from its frame (`PanelHost` → `components/PanelSources.tsx`), built from the registry's required `sources` field: each live feed (a `SOURCE_RULES` id) with the time it last answered and a status line when the health tracker sees it failing, and each static dataset with its as-of date, or "date not recorded" where none is stored. `registry.test.ts` checks every live id exists and that only control panels have none. Headline figures use `Metric` (label, evidence kind, value and unit, range, as-of; `Kpi` renders through it), lines use `MetricRow` and ranked lists `RankRow`, both flagging dated years with `utils/freshness.ts`. New views should use these rather than styling their own source, status or evidence text, so countries and topics read the same way across panels. Raw indicator values are observed; the map's "vs trend" colouring is statistical.

**Investigation tools.** Beyond the context block, the analyst can request data itself. `services/aiTools.ts` is a registry of about 25 tools. Each one wraps an existing service or dataset (ACLED events already loaded, IODA, Cloudflare Radar, GDACS, USGS, FIRMS, GPSJAM, news, Finnhub, World Bank series and rankings, trade, Ember, Factbook, sanctions, military, resources, chokepoints, ports, UNHCR, EIA) and returns compact text plus optional chart data. `services/aiAgent.ts` runs the loop. A model turn containing `[DATA:tool|args]` lines has those queries run (at most 6 per round, 3 rounds), the results go back as one `TOOL RESULTS` user message with ids R1…, and the next turn either asks for more or answers. The protocol is plain text, not provider function-calling, so free and paid models behave alike and the proxy's fixed request shape is unchanged. `buildSystemPrompt(context, { tools })` adds the protocol only when tools are passed. In the answer, `[CHART:Rn]` is replaced by a chart drawn from that result's own data (`components/panels/aiAnalyst/`). The model never supplies plotted values. Every turn shows the investigation trail: each query, its source, and the exact text the model received.

The AI analyst reads this too: `AIAnalystPanel` calls `summarizeForAI()` (in `utils/countryStats.ts`) on the comparison currently open and passes it to `buildDashboardContext()` as a `COUNTRY ANALYTICS` block — computed locally, labelled as not model-generated, so data questions can be answered from the numbers instead of from the model's memory.

## Hazard Analytics (`AnalyticsPanel`, `services/analyticsData.ts`)

The panel analyses data the app already loads — the USGS earthquake feed and NASA FIRMS fire detections — by calling the existing `fetchEarthquakes` / `fetchWildfires`. `analyticsData` is a small observable store with one slice per feed (`idle | loading | ready | empty | error`), a 10-minute TTL, in-flight de-duplication and keep-old-data-on-failed-refresh. It is memory-only because the fire feed is ~100k rows. Each slice also holds its H3 cells, built once per load, so the panel and the map layer share both the fetch and the aggregation.

Everything downstream is pure and tested: `utils/dataAnalytics.ts` and `utils/hexbin.ts` (weighted H3 aggregation; `h3-js` is imported lazily like in `services/gpsjam.ts`). The `analyticsHex` layer follows the GPS-jam pattern in `MapView` (source + `fill-extrusion` layer gated by a `PanelState` boolean). Fires and quakes use different H3 resolutions (`HEX_RES`) because their point counts differ by three orders of magnitude.

`computeTrajectories` has an optional `now` argument (default unchanged) and compares the last 72h with the prior week's pace (prior score × 3/7) rather than raw 3-day vs 7-day sums, which used to make steady activity read as falling.

## State ownership

`App.tsx` is the single owner of cross-cutting state: `viewMode`, `panelState` (21 layer toggles, persisted to `localStorage`), `activeGroup` (which sidebar group is open), `selectedCountry` (drives `CountryDrawer`), and the floating-window layout (`useWindowLayout`: which panels are popped out of the dock, and where). Everything else is local to its own hook or component. There is no global store (Redux/Zustand/Context) — prop drilling through `App.tsx` → `PanelDock`/`MapView` is deliberate and has stayed manageable at this size; revisit if panel count or prop surface grows significantly.


## Local history, alerts and source health

None of these need a backend; all state lives in the browser.

- **Snapshot history** (`services/history.ts`, `hooks/useHistory.ts`). While the app is open it records, at most every 30 min, the global threat score, per-country risk scores (same severity weights as the Risk Matrix, top 40) and the flight count into IndexedDB, keeping 30 days. Feeds the sparklines in Risk Matrix / Threat Level and the "since your last visit" list in `OutlookCard`. There is no backfill: gaps are real gaps, and `flights` is stored as `null` (not 0) when the layer was off. "Last seen" is a localStorage timestamp, stamped on tab hide / pagehide / every 5 min.
- **Source health** (`services/sourceHealth.ts`, `components/SourceHealth.tsx`). Nearly every service swallows errors and returns `[]`, so a hook can't tell "empty" from "down". `installFetchObserver` wraps `fetch` once and attributes each request to a named source by URL (`SOURCE_RULES`). Add a rule there when you add a service — otherwise it won't show up in the TopBar health popover. The summary is also appended to the AI Analyst's context so it can say when a feed is unreliable. The wrapper only records source id, ok/fail and timestamps; it never alters requests or responses.
- **Watchlist alerts** (`services/watchlist.ts`, `hooks/useWatchlist.ts`, Watchlist panel, `AlertToasts`). The user stars countries; `evaluateWatch` (pure) raises an alert for each *new* live high/critical event in a watched country and when it becomes unusually high for that country (`isFlaggedUp`; a flip to "rising" when the feed is too short to know its normal). Seen event ids persist, so events that arrived while the app was closed alert on the next visit. The first evaluation with live data only records what exists (no flood), and baseline entries never alert. Browser notifications are opt-in, requested only from a click.
- **GDACS** (`services/gdacs.ts`, Disaster Alerts panel): free, keyless, CORS-enabled Orange/Red alerts from the EU JRC / UN OCHA.

## Code splitting

`panels/registry.tsx` wraps every panel in `React.lazy`, so each panel file (and the datasets it imports) is fetched on first display; `PanelHost` provides the Suspense boundary. Keep shared, non-component helpers out of panel files (e.g. `utils/risk.ts`, `services/usWebcams.ts`) — `CountryDrawer` and `MapView` import those, and importing from a panel file would pull panel code back into the main bundle. `MapView`'s component body is still one large function; extract further only with the visual e2e test covering the layer you touch.
