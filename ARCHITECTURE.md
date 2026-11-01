# Architecture

## Shape

World of Data is a Vite-built React single-page app with no application server and no database. The browser fetches public APIs directly. The exceptions are a few thin serverless functions in `api/`, which hold no state and exist only to:

- inject a server-side key (OpenSky and ACLED OAuth, Finnhub, EIA, NYT, Cloudflare Radar, OpenRouter), or
- add a CORS header a source doesn't send (RSS, GPSJam, IMF DataMapper, NASA FIRMS).

`vite.api-dev.ts` serves the same files during `npm run dev`, reading keys from `.env`. Persistence is browser-only: `localStorage` (layout, theme, saved countries, forecast log, chat history) and IndexedDB (snapshot history).

```
src/
  main.tsx                  # entry: applies the saved theme before first paint, mounts App
  App.tsx                   # composition root and cross-cutting state (see "State ownership")
  index.css                 # design tokens (dark and light sets) and all component styles
  components/
    Sidebar.tsx             # left navigation (see "Navigation")
    TopBar.tsx              # search, source health, theme toggle, reload, saved, settings
    HomeDashboard.tsx       # the Outlook page; sections live in components/home/
    home/                   # WorldOutlook (IMF world economy), ForecastHome (one economy), OutlookNav, HomeTier
    forecast/SinceBlock.tsx # "what changed" since the last recorded forecast
    countryPage/            # a country's page: Economy, Forecasts, Trade & exposure, Risk, Infrastructure, Live, News
    CountryDrawer.tsx       # per-country sections, reused by the country page's context tabs
    countryDrawer/          # its data hook and section parts
    OutlookCard.tsx         # map card: regional activity, or the brief for a picked country or place
    PanelDock/              # the workspace's panel stack, section by section
    WindowManager/          # floating panel windows, named screen layouts, taskbar, panel library
    PanelHost.tsx           # per-panel error boundary, Suspense and sources footer
    DataLabels.tsx          # shared evidence tags, source lines, status labels and metrics
    charts/                 # SVG chart primitives (time series, bars, scatter, matrix, ...)
    panels/                 # panel implementations, one file per theme or panel, lazy-loaded
    Map/
      MapView.tsx           # Mapbox GL composition root
      layers/<name>.ts      # one module per map layer
      overlays/             # on-map React chrome: layer menu, legends, colour control, loading overlay
  panels/registry.tsx       # every panel: id, workspace, section, map behaviour, sources, render
  hooks/                    # one hook per live source: polling and typed state
  services/                 # one client per source: fetch and parse, no React
  utils/                    # pure logic: statistics, forecasts, backtests, exposure, formatting
  data/                     # committed snapshots built by scripts/ (trade profiles, ports, UCDP, ...)
  types/index.ts            # shared domain types (PanelState, CrisisEvent, ...)
api/                        # serverless proxies (see above)
scripts/                    # build-*.mjs regenerate the snapshots in src/data and public/data
tests/                      # serverless-function tests and repo policy checks
```

## Navigation

The sidebar is organised by purpose: **Outlook**, **Forecasts**, **Drivers**, **Countries**, **Map**, **Explore** (Indicators, Analysis, Datasets) and **Saved**. Below it, a **More** list holds Risk monitor, Security & defence, Infrastructure & hazards, and News. Each entry opens a workspace on a chosen panel. `navSection()` in `Sidebar.tsx` maps the current workspace and focused panel to the entry that is lit. On phones the sidebar becomes a labelled drawer.

## Outlook (`HomeDashboard.tsx`, `components/home/`)

The Outlook page tells one story, top to bottom, with a pinned section bar (`OutlookNav`):

1. **The world economy** (`WorldOutlook`): the IMF's own World Economic Outlook aggregates for world real GDP growth and consumer prices, plus advanced, emerging, euro area and emerging Asia groups. Direction words and the 2000–2019 average are computed from the IMF's series. Everything is labelled as the IMF's projections, not this app's forecast.
2. **One economy** (`ForecastHome`): this app's GDP-growth forecast for a chosen country (shared with the Predictions panel through `utils/focusCountry.ts`, default Germany). It answers what we expect, what changed, what it rests on, and what could change it.
3. **Around the forecast**: co-movement across countries (association, not forecast evidence) and the G20 on the IMF's projections.
4. **Context**: the map coloured by an indicator, and world trends.

`utils/homeForecast.ts` calls the same `headlineForecast`, `backtestForecast` and interval policy as the Predictions panel, and `makeRecord` (`utils/forecastRecord.ts`) builds the record both write to the forecast log. The two can't disagree or report phantom changes to each other.

## Panel registry

Every panel is one entry in `src/panels/registry.tsx`:

```ts
{ id: 'predictions', title: 'Predictions', group: 'analysis', section: 'forecasts', map: 'none',
  sources: ['worldbank', 'imfweo'], render: p => <PredictionsPanel {...p} /> }
```

- **`group`** is the workspace (`overview | markets | analysis | country | security | geo | news`).
- **`section`** names a banner from `GROUP_SECTIONS[group]`. The dock shows panels section by section, from the most aggregated view to the detail behind it.
- **`map`** is either the layers the panel draws (which gives its header the standard "Show on map" toggle), `'inline'` or `'none'`.
- **`sources`** lists live feeds by `SOURCE_RULES` id, or static datasets with their as-of date. The frame turns them into the standard sources footer.

`PanelDock`, the floating windows, the panel library and the command palette all read from the registry, so adding a panel needs no other wiring. `registry.test.ts` checks that every section exists, that no section is empty, and that every live source id is real. Panels receive a shared `PanelProps` bag and destructure what they use.

## Data flow: service → hook → panel

1. **`services/*.ts`**: a fetch-and-parse client for one provider. No React, no state. Services return `[]` or `null` on failure rather than throw, unless documented otherwise.
2. **`hooks/use*.ts`**: owns the polling interval and exposes typed state.
3. **A panel or map layer** renders the hook's output.

Refresh rates are set to stay under each provider's free-tier limits, not for UX: flights 15 s, markets 60 s, wildfires and earthquakes 5–10 min, conflict events 5 min, news on demand.

## Forecasts

- **Model choice** (`utils/forecastPolicy.ts`): a rolling-origin backtest across every World Bank economy picked AR(2) for GDP growth and "no change" for inflation and unemployment. Intervals were calibrated on forecasts made before 2010, and labels state the coverage achieved since. Each card also backtests on the selected country and says when the model doesn't win.
- **IMF benchmark** (`services/imfWeo.ts` via `api/imf-weo.ts`): the WEO figures for the same years, with the edition attached to every figure. Only years from the edition's own year on are called projections. A level gap of 0.3 pp or more against the World Bank is flagged as not directly comparable.
- **What changed** (`services/forecastLog.ts`, `utils/forecastRecord.ts`): a record per country and series, written once the IMF request settles. `explainChange()` states new or revised data (observed), a model switch and how the forecast moved (statistical), and a new IMF edition (observed).
- **Track record**: `scoreRecords()` scores a recorded forecast once its year has a World Bank figure, with the IMF's figure from the same record beside it. Nothing is backfilled. The record is per device and informal, and the card says so.
- **GDP nowcast** (`utils/nowcast.ts`, `services/eurostatNowcast.ts`): this quarter's growth for EU members from industrial production already published. The rule was committed before any real data was scored (commit `5802e09`). The bridge model is shown only where it beat "same as last quarter" in both 2005–2014 and 2015 on. Its 80% range is split-conformal from its own past errors.
- **Gas storage** (`utils/gasStorage.ts`): next week's US storage change from the five-year seasonal norm plus a share of last week's departure, refit weekly on earlier data only.
- **Drivers** (`data/predictorBacktest.ts`, `scripts/backtest-predictors.ts`): candidate indicators added to AR(2) and scored out of sample against a pass bar fixed in advance. Protocol and results are in `docs/`.

## Shock exposure (`utils/exposure.ts`)

Pick a shock and see which economies it reaches, through which link, and how much as a share of their GDP. Pure and offline; it only combines data the app already holds.

- **Demand** ("X buys less") and **supply** ("supply from X is cut"): X's share of each reporter's goods exports or imports (UN Comtrade top partners, `trade-profiles.json`) times those flows as % of GDP.
- **Oil chokepoint**: the chokepoint's oil flow (EIA) is stated, then an explicit assumption that a disruption moves the world oil price. Countries are ranked by net mineral-fuel trade as % of GDP. Comtrade doesn't say whose cargo uses which route, so this ranking is the same for every oil chokepoint, and the panel says so.

Every result is a path of steps, each tagged observed (with source and year) or assumption. A partner outside a reporter's listed top-N is only known to be below the smallest listed share, so it becomes a range, never a guessed value.

**Scenario step (statistical).** A demand shock with an assumed size also gets each economy's implied change in GDP growth. The lost sales become a fall in real export growth, times the economy's export-to-GDP-growth sensitivity (`utils/sensitivity.ts`: least squares, 1991 on, at least 15 years, 95% interval). An effect whose range crosses zero is called not distinguishable from none. It is an association, not a cause, and is labelled that way.

## Evidence kinds and shared labels

Every claim is one of three kinds (`utils/evidence.ts`):

- **observed**: figures as the source reports them;
- **statistical**: estimated by a stated method, with uncertainty, not a cause;
- **assumption**: set by the user or a scenario.

`components/DataLabels.tsx` holds the shared `EvidenceTag`, `SourceLine`, `StatusLabel`, `Metric`, `MetricRow` and `RankRow`. Dated years are flagged with `utils/freshness.ts`. Map popups, which are HTML strings, use the same wording. New views should use these rather than styling their own source, status or evidence text.

## Map (`components/Map/`)

One Mapbox GL instance with 28 independently toggled layers, each gated by a boolean in `PanelState` (`src/types/index.ts`). `App.tsx` owns the toggles; the map only reflects them.

`MapView.tsx` is a composition root. Each layer is one module in `Map/layers/` with two halves:

- `add<Name>Layers(map, ctx)` registers sources, layers and handlers once when the style loads;
- `use<Name>Data(handle, props)` shows or hides the layer and pushes data as props change.

`layers/index.ts` calls the `add*` functions in a fixed order, which is the draw order. Hooks wait on `layersReadyRef`, which flips only after every source exists.

**Colouring countries.** The `countryAnalytics` layer is the only one that colours whole countries. It is driven from one place, the "Colour countries by" control (`Map/overlays/CountryColorControl.tsx`), plus Cmd+K, top-bar search and panels' "On the map" buttons, all through `selectForMap(id)`. The catalogue (`services/countryIndicators.ts`) holds 50 indicators from the World Bank, Our World in Data and Ember. `coverage()` reports how many countries have a value and the spread of reporting years. Values three or more years older than the typical year are faded, and economies with no value are drawn grey.

**Pipelines** come from OpenStreetMap in two tiers: a committed world snapshot of trunk lines (`public/data/pipelines-trunk.geojson`, rebuilt by `scripts/build-pipelines.mjs`) and, from zoom 9, live 0.5° cells. Don't raise the cell size or lower the minimum zoom without re-measuring; dense areas run to tens of MB.

**View modes.** `city3d` tilts the camera and shows real building extrusions. The filter modes (night vision, infrared, ...) are CSS filters on the canvas (`Map/viewModes.ts`), not separate styles.

## AI analyst (`components/panels/AIAnalystPanel.tsx`, `services/openrouter.ts`, `services/aiAgent.ts`, `services/aiTools.ts`)

- **Grounding.** `buildDashboardContext` assembles locally computed blocks: the Watchlist, source health, the open country comparison, and the IMF world economy. Each is labelled as computed, not model-generated, and an unavailable block says NOT AVAILABLE rather than leaving the model to fill in numbers.
- **Tools.** `aiTools.ts` registers 27 tools, each wrapping an existing service or dataset. A model turn containing `[DATA:tool|args]` lines has those queries run, at most 6 per round and 4 rounds per question. Results go back as `TOOL RESULTS` with ids R1, R2, …. The protocol is plain text rather than provider function calling, so free and paid models behave alike.
- **Charts.** `[CHART:Rn]` is replaced by a chart drawn from that result's own data, so the model never supplies a plotted value. Every answer shows its investigation trail.
- **Limits.** The analyst doesn't drive the map, open pages or toggle layers. It reasons over live dashboard data only.
- **Models.** Any OpenRouter model via `api/openrouter`. The default is a `:free` model, enforced by `tests/policy.test.ts`.
- **Benchmark.** `services/analystBench.ts` and `scripts/bench-analyst.run.ts` run twelve questions on demand and score them offline for known failure classes.

### Watchlist (`utils/trajectory.ts`)

A pure, rule-based monitor shown in the analyst panel without a prompt. It buckets each country's dated conflict events into the last 72 hours against the prior week's pace (prior score × 3/7, because the windows differ in length).

Each country's 72-hour count is compared with its own history: 7–28 days, negative binomial when its days vary more than Poisson. It is flagged `unusual` below p = 0.01. This is a statistical flag, not a validated forecast.

Three details are load-bearing:

- `BASELINE` crisis entries, which are stamped with today's date, are filtered out before scoring. Otherwise every long-running conflict would read as "rising".
- A capped feed (`capped`) is a sample, not a total, so no own-normal is computed and no alert fires.
- Only conflict events move the score; flights and news never do.

When ACLED has no current events, regional activity falls back to the monthly UCDP Candidate Events snapshot (`src/data/ucdp-candidate.json`, rebuilt by `scripts/build-ucdp.mjs`).

## Local history, alerts and source health

- **Snapshot history** (`services/history.ts`): while the app is open it records, at most every 30 minutes, risk scores and counts into IndexedDB for 30 days. Gaps are real gaps; there is no backfill.
- **Source health** (`services/sourceHealth.ts`): most services swallow errors, so `installFetchObserver` wraps `fetch` once and attributes each request to a source by URL (`SOURCE_RULES`). Add a rule when you add a service, or it won't appear in the top bar. The observer never alters requests or responses.
- **Saved countries and alerts** (`services/watchlist.ts`): starred countries raise an alert for each new high or critical live event and when activity becomes unusually high. The first evaluation only records what exists, so there is no flood. Browser notifications are opt-in.

## Theme

`index.css` defines every colour as a token on `:root` (dark, the default) and a light set under `:root[data-theme="light"]`. `main.tsx` applies the saved theme before first paint, and the top bar's sun/moon button toggles it (`hooks/useTheme.ts`). Map layer colours and popup HTML use literal hex values, because Mapbox expressions can't read CSS variables. Charts read the active theme where a colour must change (e.g. the zero point of diverging ramps).

## State ownership

`App.tsx` owns cross-cutting state: the view mode, `panelState` (the layer toggles, persisted), the active workspace, the selected country and the floating-window layout. Everything else is local to its hook or component, or to a small observable store read through `useSyncExternalStore` (`services/countryAnalytics.ts`, `services/analyticsData.ts`, `services/history.ts`). There is no global store; prop drilling through `App.tsx` has stayed manageable at this size.

## Code splitting

`panels/registry.tsx` wraps every panel in `React.lazy`, so each panel file and the datasets it imports load on first display. Keep shared helpers out of panel files: `CountryDrawer` and `MapView` import them, and importing from a panel file would pull panel code into the main bundle.
