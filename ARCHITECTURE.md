# Architecture

## Shape

No application server and no database. This is a Vite-built React SPA that talks directly to public APIs from the browser. The exceptions are a handful of thin serverless functions in `api/` (Vercel-style; `vite.api-dev.ts` serves the same files in `npm run dev`): they exist only to inject server-side secrets (OpenSky/ACLED OAuth, Finnhub, NYT, OpenRouter keys) or to get around a missing CORS header (RSS, GPSJam), and hold no state. Everything else is fetched straight from the browser. There is no persistence layer beyond `localStorage` (panel layout, view mode, AI chat history) — every panel is a live view over whatever the last poll returned.

```
src/
  App.tsx                       # root composition + top-level state (view mode, panel layout, selected country)
  components/
    Map/MapView.tsx             # Mapbox GL composition root — see Map/layers, Map/overlays below
    Sidebar.tsx                 # left nav — one entry per panel group (INTEL/GEO/MIL/FIN/AI)
    TopBar.tsx                  # live counters, view switcher, search
    NewsTicker.tsx               # scrolling headline strip
    CountryDrawer.tsx            # click-a-country intel aggregation (crises, bases, trade, econ, refugees...)
    OutlookCard.tsx              # bottom-left card: regional outlook, or the brief for a picked country (CountryBrief)
                                 #   or picked city (PlaceBrief: local news + everything tracked within ~50-200 km)
    SettingsModal.tsx            # layers / data sources / API key status / display prefs
    PanelDock/
      PanelDock.tsx               # right-hand panel stack — resizable, drag-to-reorder
      ObserveTray.tsx             # bottom tray for panels popped out of the dock (up to 6)
      FloatingPanel.tsx           # legacy single floating panel (pre-registry)
    charts/                       # SVG chart primitives (TimeSeries, Bars, Magnitude, Heatmap, Scatter, Rank, CorrMatrix, ChartFrame)
    panels/                       # panel implementations, grouped by theme (NewsPanels, SecurityPanels,
                                  #   MarketPanels, EconomyPanels, CountryBrowserPanels, RankingPanels, AIAnalystPanel, HumanitarianPanel, ...)
    PanelHost.tsx                 # per-panel ErrorBoundary + Suspense (panels are lazy-loaded)
    Map/MapView.tsx               # composition root (~220 lines): owns the map + refs, calls addAllLayers() once and each layer's use*() hook
    Map/layers/<name>.ts          # one module per map layer: add<Name>Layers(map, ctx) = sources/layers/handlers (once, on style load),
                                  #   use<Name>Data(handle, props) = visibility + data updates; layers/index.ts fixes draw order
    Map/overlays/                 # on-map React chrome: FlightFilter, OverlayMenu, legends, Reticle, DeepStatePanel
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

`group` is the workspace (`overview | markets | analysis | country | security | geo | news`). `GROUP_ORDER` sets the order of workspaces in the left `Sidebar`, and `SIDEBAR_SECTIONS` sets the headings that group them: Start, Economy & forecasting, Context, Sources. `section` names a banner from `GROUP_SECTIONS[group]`. The dock shows panels section by section, each section under a numbered banner with a header and a one-line explanation, ordered from the most immediate or aggregated view to the detail behind it. `src/panels/registry.test.ts` checks that every panel's section exists and that no section is empty. Adding a panel means adding one entry here — `PanelDock`, `ObserveTray`, and `SettingsModal`'s layer list all read from this registry, so nothing else needs to change. Panels receive a shared `PanelProps` bag (`crises`, `flights`, `panelState`, `onToggleLayer`, `onGeoSearch`, `onCountryClick`, ...) and destructure only what they use.

## Data flow: service → hook → panel

Every live data source follows the same three-layer shape:

1. **`services/*.ts`** — a fetch/parse client for one provider. No React, no state. Example: `services/opensky.ts` handles OpenSky's OAuth2 token exchange and state-vector parsing.
2. **`hooks/use*.ts`** — owns the polling interval and exposes `{ data, loading, error }`. Example: `useFlights` polls OpenSky every 15s.
3. **Panel component** (`components/panels/*.tsx`) or **map layer** (`MapView.tsx`) — renders the hook's output.

Refresh rates are chosen per-provider to stay under free-tier rate limits, not for UX reasons: flights 15s (OpenSky's polite ceiling), crises 5min, markets 60s, wildfires/earthquakes 5-10min, news on-demand.

`useCrises` also seeds a hardcoded `BASELINE` array of major ongoing conflicts (Ukraine, Gaza, Sudan, etc.), each stamped with **today's date** so they always render when ACLED is unconfigured, rate-limited or down (GDELT was dropped — see the note in `services/crises.ts`). Their coordinates are region centres, not event locations, and the date is the load date, not an event date; `useCrises` therefore also reports `liveCount` so the UI can tell when nothing live is loaded. This matters for anything doing time-series analysis over `crises` — see the Watchlist note below.

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

## The "Watchlist" — rule-based forecasting (`src/utils/trajectory.ts`)

The AI Analyst panel doesn't just answer prompts — `computeTrajectories()` is a pure function (no network calls) that buckets each country's crisis events into a "last 3 days" vs "3–10 days prior" window using each event's real `date` field, scores both by severity, and ranks countries by the delta of the last 72h against the prior week's pace (prior score × 3/7 — the windows differ in length, so raw sums would read steady activity as falling). This produces a "rising / falling / flat" trend per region, shown automatically on panel load with no prompt required. The same computed numbers are appended to the LLM's system prompt (`buildDashboardContext` in `services/openrouter.ts`) so the model's own analysis is grounded in a real, local computation rather than a static snapshot.

**Load-bearing detail:** this function explicitly filters out `BASELINE` crisis entries (`source === 'Baseline'` / `id` starting with `baseline-`) before scoring. Baseline entries are stamped with today's date on every load, so including them would make every long-running conflict misread as "rising, no prior activity" on every single render — a bug caught during implementation, not a hypothetical.

## Country Analytics (`CountryAnalyticsPanel`, `services/countryIndicators.ts`, `services/countryAnalytics.ts`)

`countryIndicators.ts` holds the catalogue of 50 indicators from three sources (World Bank, Our World in Data via `owid.ts`, Ember via `powerGeneration.ts`; each with label, short label, group, source, axis scale and formatter — ids are plain World Bank codes, `owid:<slug>` or `ember:<measure>`), the presets, and `fetchIndicatorAll(id)`, which dispatches by id prefix to pure adapters (`parseWorldBank`, `owidToRows`, `emberToRows`) so every source resolves to the same `CountryValue` keyed by ISO-3166 alpha-3. For World Bank, one request returns every country's most recent non-empty value (`mrnev=1`; see the README for why not `MRV=1`), parsed by the pure `parseWorldBank` (drops aggregates/nulls/pre-2010 values, shortens formal names), cached for an hour, de-duplicated and retried once on throttling or timeouts. `countryAnalytics.ts` is a small observable store (same shape as `services/history.ts`, read through `useSyncExternalStore` in `hooks/useCountryAnalytics.ts`) holding the selected X/Y pair, the map mode and one slice per indicator; `loadMany` caps concurrency at four.

All the maths is pure and tested in `utils/countryStats.ts`: scales and tick generation, Spearman (average ranks for ties), Fisher-z intervals, OLS in axis space, standardised residuals, histograms, the pairwise-complete correlation matrix and the map colour assignment. The hook derives the pair analysis with `useMemo`, so the panel and the map layer share one computation. The `countryAnalytics` layer is the same country-boundaries fill pattern as `militaryPersonnel` / `infraIndicators`, but the colours come from `countryColors()` as a `match` expression keyed by `iso_3166_1_alpha_3`, and other country panels reuse it through `OnMapButton` (`selectForMap(indicatorId)` points the shared selection at an indicator), and `MapView` reads the store itself so `App` doesn't re-render when data arrives.

**Investigation tools.** Beyond the context block, the analyst can request data itself. `services/aiTools.ts` is a registry of about 25 tools. Each one wraps an existing service or dataset (ACLED events already loaded, IODA, GDACS, USGS, FIRMS, GPSJAM, news, Finnhub, World Bank series and rankings, trade, Ember, Factbook, sanctions, military, resources, chokepoints, ports, UNHCR, EIA) and returns compact text plus optional chart data. `services/aiAgent.ts` runs the loop. A model turn containing `[DATA:tool|args]` lines has those queries run (at most 6 per round, 3 rounds), the results go back as one `TOOL RESULTS` user message with ids R1…, and the next turn either asks for more or answers. The protocol is plain text, not provider function-calling, so free and paid models behave alike and the proxy's fixed request shape is unchanged. `buildSystemPrompt(context, { tools })` adds the protocol only when tools are passed. In the answer, `[CHART:Rn]` is replaced by a chart drawn from that result's own data (`components/panels/aiAnalyst/`). The model never supplies plotted values. Every turn shows the investigation trail: each query, its source, and the exact text the model received.

The AI analyst reads this too: `AIAnalystPanel` calls `summarizeForAI()` (in `utils/countryStats.ts`) on the comparison currently open and passes it to `buildDashboardContext()` as a `COUNTRY ANALYTICS` block — computed locally, labelled as not model-generated, so data questions can be answered from the numbers instead of from the model's memory.

## Hazard Analytics (`AnalyticsPanel`, `services/analyticsData.ts`)

The panel analyses data the app already loads — the USGS earthquake feed and NASA FIRMS fire detections — by calling the existing `fetchEarthquakes` / `fetchWildfires`. `analyticsData` is a small observable store with one slice per feed (`idle | loading | ready | empty | error`), a 10-minute TTL, in-flight de-duplication and keep-old-data-on-failed-refresh. It is memory-only because the fire feed is ~100k rows. Each slice also holds its H3 cells, built once per load, so the panel and the map layer share both the fetch and the aggregation.

Everything downstream is pure and tested: `utils/dataAnalytics.ts` and `utils/hexbin.ts` (weighted H3 aggregation; `h3-js` is imported lazily like in `services/gpsjam.ts`). The `analyticsHex` layer follows the GPS-jam pattern in `MapView` (source + `fill-extrusion` layer gated by a `PanelState` boolean). Fires and quakes use different H3 resolutions (`HEX_RES`) because their point counts differ by three orders of magnitude.

`computeTrajectories` has an optional `now` argument (default unchanged) and compares the last 72h with the prior week's pace (prior score × 3/7) rather than raw 3-day vs 7-day sums, which used to make steady activity read as falling.

## State ownership

`App.tsx` is the single owner of cross-cutting state: `viewMode`, `panelState` (21 layer toggles, persisted to `localStorage`), `activeGroup` (which sidebar group is open), `selectedCountry` (drives `CountryDrawer`), and the observe-tray pop-out set. Everything else is local to its own hook or component. There is no global store (Redux/Zustand/Context) — prop drilling through `App.tsx` → `PanelDock`/`MapView` is deliberate and has stayed manageable at this size; revisit if panel count or prop surface grows significantly.


## Local history, alerts and source health

None of these need a backend; all state lives in the browser.

- **Snapshot history** (`services/history.ts`, `hooks/useHistory.ts`). While the app is open it records, at most every 30 min, the global threat score, per-country risk scores (same severity weights as the Risk Matrix, top 40) and the flight count into IndexedDB, keeping 30 days. Feeds the sparklines in Risk Matrix / Threat Level and the "since your last visit" list in `OutlookCard`. There is no backfill: gaps are real gaps, and `flights` is stored as `null` (not 0) when the layer was off. "Last seen" is a localStorage timestamp, stamped on tab hide / pagehide / every 5 min.
- **Source health** (`services/sourceHealth.ts`, `components/SourceHealth.tsx`). Nearly every service swallows errors and returns `[]`, so a hook can't tell "empty" from "down". `installFetchObserver` wraps `fetch` once and attributes each request to a named source by URL (`SOURCE_RULES`). Add a rule there when you add a service — otherwise it won't show up in the TopBar health popover. The summary is also appended to the AI Analyst's context so it can say when a feed is unreliable. The wrapper only records source id, ok/fail and timestamps; it never alters requests or responses.
- **Watchlist alerts** (`services/watchlist.ts`, `hooks/useWatchlist.ts`, Watchlist panel, `AlertToasts`). The user stars countries; `evaluateWatch` (pure) raises an alert for each *new* live high/critical event in a watched country and when its trajectory flips to "rising". Seen event ids persist, so events that arrived while the app was closed alert on the next visit. The first evaluation with live data only records what exists (no flood), and baseline entries never alert. Browser notifications are opt-in, requested only from a click.
- **GDACS** (`services/gdacs.ts`, Disaster Alerts panel): free, keyless, CORS-enabled Orange/Red alerts from the EU JRC / UN OCHA.

## Code splitting

`panels/registry.tsx` wraps every panel in `React.lazy`, so each panel file (and the datasets it imports) is fetched on first display; `PanelHost` provides the Suspense boundary. Keep shared, non-component helpers out of panel files (e.g. `utils/risk.ts`, `services/usWebcams.ts`) — `CountryDrawer` and `MapView` import those, and importing from a panel file would pull panel code back into the main bundle. `MapView`'s component body is still one large function; extract further only with the visual e2e test covering the layer you touch.
