# Mundus Datorum

*Latin for "world of data" (*mundus*, world; *datorum*, genitive plural of *datum*, "that which is given").*

A real-time global situational awareness platform — a single-page command-center dashboard that fuses live flight tracking, maritime AIS data, geopolitical crisis feeds, market data, and OSINT sources onto one interactive 3D globe.

Built as a personal engineering project to explore high-density real-time UI design, multi-source data fusion, and working within the constraints of free-tier public APIs.

![stack](https://img.shields.io/badge/TypeScript-strict-3178c6) ![stack](https://img.shields.io/badge/React-18-61dafb) ![stack](https://img.shields.io/badge/Mapbox_GL-v3-000000) ![stack](https://img.shields.io/badge/Vite-6-646cff)

## Screenshots

Captured from a local run against live feeds on 7 Oct 2026 (headless Chromium, 1600×950). Nothing is mocked or retouched — including the top bar, which reads **NO LIVE FEED** and a few "issues" because the ACLED conflict feed and some rate-limited sources were not available during the capture.

| | |
|---|---|
| ![Overview: the globe with live flights, vessels, crises, market chips and the Crisis Monitor panel](docs/screenshots/overview.jpg) | ![Layers: chokepoints, global shipping lanes, pipelines and ports switched on](docs/screenshots/layers.jpg) |
| **Overview** — live flights and vessels, crisis markers, exchange chips, Crisis Monitor and Watchlist in the dock | **Layers** — chokepoints, shipping density, pipelines (OSM) and ports |
| ![Country Analytics: every country shaded by life expectancy, with the GDP-vs-life-expectancy scatter and correlation stats in the dock](docs/screenshots/country-analytics.jpg) | ![Hazard Analytics: 121,146 wildfire detections binned into extruded H3 hexagons over Africa](docs/screenshots/hazard-hex.jpg) |
| **Country Analytics** — 214 countries shaded by one indicator; Spearman ρ, trend fit and outliers in the panel | **Hazard Analytics** — a day of NASA FIRMS detections binned into 3D hexagons client-side |

## What it does

Mundus Datorum renders a live Mapbox GL globe with ten selectable view modes (satellite, night vision, thermal, 3D buildings, infrared, etc.) and overlays it with continuously polled data:

- **Flights** — live ICAO24 aircraft tracking via OpenSky, with type detection (military/civil/cargo) from hex ranges and callsign patterns
- **Vessels** — real-time AIS ship tracking over a WebSocket feed (AISStream)
- **Crises & conflict** — ICG CrisisWatch reporting plus, when you supply ACLED credentials, live ACLED conflict events, scored into a composite DEFCON-style threat index. Without ACLED the map shows only a short hand-maintained list of major ongoing conflicts and the top bar says **NO LIVE FEED** instead of inventing a threat level
- **Wildfires** — NASA FIRMS active fire detections
- **Markets** — indices, commodities, energy, tech, healthcare, and defense-sector tickers (Finnhub)
- **Trade & supply chain** — chokepoints, shipping density, pipelines, ports, and World Bank country economic indicators
- **News & OSINT** — aggregated reporting from Guardian, NYT, and NewsAPI, plus a keyword/coordinate search
- **Country Analytics** — pick any two of 50 country indicators (GDP, trade, population, military spending, armed forces, conflict and terrorism deaths, energy mix, R&D, life expectancy, internet access… from the World Bank, Our World in Data and Ember) and get a scatter with a fitted trend, Spearman/Pearson correlation with confidence intervals, the countries furthest above and below the trend, rankings, distributions, a 10-indicator correlation matrix, and a globe shaded by the results (see [Analytics](#analytics-comparing-countries-and-crunching-100000-detections))
- **Hazard Analytics** — the earthquake and wildfire feeds analysed in the browser, with ~100k fire detections drawn as 3D hexagons
- **AI Analyst** — an LLM-backed panel (via OpenRouter) that answers situational questions and can drive the map (fly-to, layer toggles) from natural language

All panels live in a single extensible **panel registry** (`src/panels/registry.tsx`) grouped into INTEL / GEO / MIL / FIN / AI — adding a new data source is one entry, and the dock, pop-out tray, and settings pick it up automatically.

## Analytics: comparing countries and crunching 100,000 detections

### Country Analytics (Analysis workspace)

Compare any two of **50 indicators** across all countries, in seven groups: economy, trade & finance, population, military & conflict (spending % GDP, armed forces, deaths in armed conflicts, number of conflicts, terrorism deaths), energy & resources (energy use, electricity mix, primary and renewable energy, six resource-rent series), innovation (R&D spending, researchers, patents) and society & infrastructure. Sources, all free and keyless and already used elsewhere in the app: **World Bank Open Data** (37 series), **Our World in Data** (UCDP conflict data, R&D, energy, agriculture; 9 series) and **Ember** (electricity mix, via OWID; 4 series). Start from a preset (*Wealth & health*, *Defence burden*, *Army size*, *Oil & arms*, *Wealth & conflict*, *Digital divide*, *Brains*, *Openness*, *Energy appetite*, *Clean power*) or pick the axes yourself.

| View | Method |
|---|---|
| Scatter with trend | axes follow each indicator's scale (log for heavy-tailed positives such as GDP, population, troops; symmetric-log for signed ones such as inflation and FDI); least-squares fit in axis space, so a log axis gives a log-linear trend |
| Correlation | Spearman ρ (rank-based, robust to outliers and any monotonic shape) with a 95% Fisher-z interval, plus Pearson r on the plotted axes and the trend's R²; the verdict sentence and slope reading are generated from these numbers |
| Furthest from the trend | standardised residuals: the five countries most above and most below what the fit predicts, with actual vs expected |
| Highest / distribution | top-10 ranking and a histogram (log-spaced bins for log indicators) |
| What moves together | pairwise-complete Spearman matrix for ten indicators (needs ≥12 countries in common per cell); click a cell to plot that pair |

**Show on map from the other country panels too.** Military Personnel, Power Output, Global Trends (OWID) and Global Economy each have a *Show on map* button that points the Country Analytics layer at that panel's data, so the same globe, legend and click popup serve all of them.

**On the map**, *Show on map* shades every country by the Y indicator (colour clipped to the 2nd–98th percentile so a few giants don't wash out the rest) or, in *Vs trend* mode, by how far it sits above (red) or below (blue) the fitted trend. Click a country for its values, the trend's expectation and its distance from it.

**Data audit — what is and isn't used.** Used: every World Bank series the app already pulled in `worldbank.ts`, `militaryPersonnel.ts`, `infraIndicators.ts` and `resources.ts` (except the discontinued Ease-of-Business score), the OWID charts that are country-level (the by-region conflict-deaths chart returns no countries, so it is left out), and the Ember generation mix. Deliberately not used for statistics: the hand-curated lists (military installations, nuclear sites, ports, chokepoints, trade profiles, sanctions, data centres). Their entries are real, but the lists are not exhaustive, so counts per country would present curation gaps as findings. Live feeds with no country attribute (flights, vessels, quakes, fires) are covered by Hazard Analytics instead. Coverage varies by indicator and is shown as the number of countries on every chart (for example primary and renewable energy cover only the ~78 countries the Energy Institute reports on; OWID stores zeros for the rest, which the log axis correctly refuses to plot).

**Data handling worth knowing.** Countries are identified by ISO-3166 alpha-3, the code all three sources share and Mapbox's country boundaries expose. Each country's value is its most recent non-empty year since 2010, so years differ by country and indicator (shown on hover and in the map popup). The World Bank's `MRV=1` returns only the single latest *year*, which is empty for most countries on slow-reporting series (internet users: 42 countries instead of 245), so the client uses `mrnev=1` and discards anything older than 2010 itself because that parameter ignores the date range. Requests are cached for an hour, de-duplicated, limited to four at a time and retried once on throttling or timeouts. Formal World Bank names ("Iran, Islamic Rep.") are shortened so labels fit and place lookups work. Correlation is not causation, and military series are the World Bank's SIPRI/IISS-derived indicators, which many countries lack.

### Hazard Analytics

Works on the two high-volume feeds the app already uses — **USGS earthquakes** (M4.5+, 7 days) and **NASA FIRMS VIIRS fire detections** (24 h) — with hourly trends, a Gutenberg–Richter magnitude–frequency fit (maximum-likelihood b-value, Aki–Utsu with Shi & Bolt standard error), a region × day heatmap, depth classes, detections by UTC hour and a fire-power histogram. *Show on map* bins either feed into H3 hexagons and extrudes them (fires at res 4 by summed fire radiative power, earthquakes at res 3 by count).

**Scale.** On the run I checked (7 Oct 2026) the fire feed held 117,305 detections, which collapsed into 9,975 hexagons. Timing on *synthetic* uniformly random global points (Node, dev laptop — a worst case, since real fires cluster): 120,000 points bin into ~95,000 cells in about 0.55 s and the summary statistics take ~30 ms, so it all runs client-side.

**No data, no chart.** If a feed returns nothing or fails, its section says so and offers a retry; nothing is estimated or filled in. Every chart has a Chart / Table switch and hover and keyboard readouts, and chart colours are validated for colour-vision deficiency against the app's dark surface (`--series-1/2/3` in `index.css`, ramps in `src/utils/vizPalette.ts`).

**A bug the analytics work exposed, now fixed.** The trajectory rule used to compare a 3-day *sum* with a 7-day *sum*, so a perfectly steady country read as "falling" (about −57%) in the Outlook card, Watchlist and AI Analyst context. `computeTrajectories` now compares the last 72h with the pace the prior week implies (its score × 3/7), keeping `delta` in "points per 72h" so the flat band and boosts are unchanged.

## Why this exists

Most dashboards either pick one data source and go deep, or fake it with static data. The interesting engineering problem here was: how far can you push a real-time, multi-source dashboard using only free-tier APIs, without the UI collapsing into a mess of ad-hoc fetch calls? The answer is a small set of patterns reused everywhere — typed hooks per data source, a shared panel contract, and careful refresh-rate budgeting to stay under rate limits.

## Tech stack

- **Vite + React 18 + TypeScript** (strict)
- **Mapbox GL JS v3** — 3D globe, custom GeoJSON layers, fill-extrusion buildings
- **Tailwind CSS** — utility styling for the surrounding chrome
- **date-fns**, **lucide-react**

No application server or database. The browser talks directly to public APIs; a few small stateless serverless functions in `api/` (Vercel format, also served by `npm run dev`) exist only to keep secrets out of the bundle (OpenSky and ACLED OAuth, Finnhub, Guardian, NYT, OpenRouter) or to add a missing CORS header (RSS, GPSJam). State lives in `localStorage`/IndexedDB.

## Architecture

```
src/
  App.tsx                    # root composition: TopBar + MapView + panel dock
  components/
    Map/MapView.tsx          # Mapbox globe composition root (~220 lines)
    Map/layers/*.ts          # one module per map layer: add*Layers() setup + use*() data hook
    Map/overlays/*.tsx       # on-map chrome: flight filter, overlay menu, legends, reticle
    TopBar.tsx                # live counters, threat index, view switcher, search
    PanelDock/                # draggable/collapsible dock + pop-out observe tray
    panels/*.tsx              # panel implementations, code-split and lazy-loaded via the registry
  panels/
    registry.tsx              # single source of truth: panel → group → render fn
    types.ts                   # shared PanelProps contract
  hooks/                      # useFlights, useVessels, useCrises, useNews, useStocks, ...
  services/                   # one API client per data source
  types/                      # shared domain types
```

Each data source follows the same shape: a `services/*.ts` client, a `hooks/use*.ts` that owns polling/refresh and exposes typed state, and a panel that renders it. New sources plug into the registry without touching the dock, tray, or settings modal.

## Running it locally

```bash
npm install
cp .env.example .env   # fill in API keys — see below
npm run dev            # Vite + the /api/*.ts functions (dev plugin reads server-only keys from .env)
```

Requires Node 18+. Open the printed local URL (defaults to `localhost:3000`). `npm run dev` serves the `api/*.ts` functions itself via `vite.api-dev.ts`, so flights (OpenSky), conflict data (ACLED), markets, Guardian/NYT news and the AI Analyst all work locally with no Vercel account. `npx vercel dev` still works if you want to mimic production exactly (it intercepts `/api/*` before it reaches Vite; it may ask to link a Vercel project — running without deploying is fine).

### API keys

Only `VITE_MAPBOX_TOKEN` is required to run the app. Everything else is optional — panels for missing keys degrade gracefully (empty state) rather than crashing. All listed providers have free tiers.

Two kinds of keys, because of how they're used:

**Client-side** (`VITE_`-prefixed, bundled into the browser build — safe here because these either have no billing risk or are meant to be public):

| Key | Service | Powers |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | [Mapbox](https://console.mapbox.com) | the globe itself (**required**) — public by design, scope it to your domain from the Mapbox dashboard |
| `VITE_NEWSAPI_KEY` | [NewsAPI](https://newsapi.org) | general news search |
| `VITE_AISSTREAM_KEY` | [AISStream](https://aisstream.io) | live vessel tracking (WebSocket; read-only public AIS data) |

**Server-only** (no `VITE_` prefix — read only by the `api/*.ts` serverless functions, never shipped to the browser; set these in Vercel's project env vars for production, or in `.env` for local `vercel dev`):

| Key | Service | Powers |
|---|---|---|
| `OPENSKY_USER` / `OPENSKY_PASS` | [OpenSky Network](https://opensky-network.org) | live flight tracking |
| `ACLED_EMAIL` / `ACLED_PASSWORD` | [ACLED](https://acleddata.com) | live conflict events (optional; without it the threat index reads NO LIVE FEED) |
| `FINNHUB_KEY` | [Finnhub](https://finnhub.io) | market/sector panels |
| `GUARDIAN_KEY` / `NYT_KEY` | Guardian / NYT | news aggregation |
| `OPENROUTER_KEY` | [OpenRouter](https://openrouter.ai) | AI Analyst panel |

## Testing

```bash
npm test               # run the whole suite once (~2s, fully offline)
npm run test:watch     # re-run on change
npm run test:coverage  # v8 coverage report
npm run typecheck      # src/ + api/ + tests/
```

The suite is hermetic: `fetch` is stubbed to throw by default, so no test can touch a live API (or a paid one). It covers the pure logic (trajectory engine, flight/vessel classification), every service's parsing/caching/failure paths against mocked responses, integrity checks for the static datasets, component tests for the charts, panels and map overlays (jsdom + Testing Library), a recording-fake-map test for the map layer modules, the serverless key-injecting proxies (`tests/api/`), and repo policy checks (no committed secrets, server keys never in the client bundle). `npm run test:visual` is a separate Playwright screenshot check.

## Refresh budgeting

Every polled source runs at a rate chosen to respect its provider's free-tier limits: flights every 15s (OpenSky's polite ceiling), crises every 5 minutes, market data every 60s, news on-demand. This is deliberate — the app is designed to run indefinitely without hitting a 429.

## Status

Actively developed. Current focus: trade/supply-chain overlays (chokepoints, shipping density, pipelines, ports) and World Bank country economic profiles.

## Security notes

- `.env` is gitignored and never committed. Only `.env.example` (placeholders) is tracked.
- If you're running Claude (or any agent) against this repo inside GitHub Codespaces/Actions and it needs real API keys at runtime, use the platform's own secrets store (`Settings → Secrets and variables → Codespaces`) rather than committing `.env` — see `CLAUDE.md` for the exact commands.

## Further reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data flow, panel registry pattern, map layer system
- [`DATA_PROVENANCE.md`](./DATA_PROVENANCE.md) — which data is live, which is a snapshot, which is hand-curated, and what hasn't been independently verified
- [`CLAUDE.md`](./CLAUDE.md) — working agreement for AI agents contributing to this repo
