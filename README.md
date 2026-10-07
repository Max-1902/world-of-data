# Meridian

A real-time global situational awareness platform — a single-page command-center dashboard that fuses live flight tracking, maritime AIS data, geopolitical crisis feeds, market data, and OSINT sources onto one interactive 3D globe.

Built as a personal engineering project to explore high-density real-time UI design, multi-source data fusion, and working within the constraints of free-tier public APIs.

![stack](https://img.shields.io/badge/TypeScript-strict-3178c6) ![stack](https://img.shields.io/badge/React-18-61dafb) ![stack](https://img.shields.io/badge/Mapbox_GL-v3-000000) ![stack](https://img.shields.io/badge/Vite-6-646cff)

## What it does

Meridian renders a live Mapbox GL globe with ten selectable view modes (satellite, night vision, thermal, 3D buildings, infrared, etc.) and overlays it with continuously polled data:

- **Flights** — live ICAO24 aircraft tracking via OpenSky, with type detection (military/civil/cargo) from hex ranges and callsign patterns
- **Vessels** — real-time AIS ship tracking over a WebSocket feed (AISStream)
- **Crises & conflict** — ACLED conflict events and ICG crisis-watch data, scored into a composite DEFCON-style threat index
- **Wildfires** — NASA FIRMS active fire detections
- **Markets** — indices, commodities, energy, tech, healthcare, and defense-sector tickers (Finnhub)
- **Trade & supply chain** — chokepoints, shipping density, pipelines, ports, and World Bank country economic indicators
- **News & OSINT** — aggregated reporting from Guardian, NYT, and NewsAPI, plus a keyword/coordinate search
- **Data Analytics** — the earthquake and wildfire feeds the app already loads, analysed in the browser: hourly trends, a Gutenberg–Richter magnitude law fit, region × day heatmaps, depth and fire-power distributions, and a 3D hexagon layer that draws ~100k fire detections on the globe (see [Analytics](#analytics-from-100000-detections-to-one-picture))
- **AI Analyst** — an LLM-backed panel (via OpenRouter) that answers situational questions and can drive the map (fly-to, layer toggles) from natural language

All panels live in a single extensible **panel registry** (`src/panels/registry.tsx`) grouped into INTEL / GEO / MIL / FIN / AI — adding a new data source is one entry, and the dock, pop-out tray, and settings pick it up automatically.

## Analytics: from 100,000 detections to one picture

The **Data Analytics** panel (Analysis workspace) works on the two high-volume feeds the app already uses — **USGS earthquakes** (M4.5+, last 7 days) and **NASA FIRMS VIIRS fire detections** (last 24 h). Both are free and keyless, and nothing new is fetched: it goes through the existing `services/earthquakes.ts` and `services/wildfires.ts`. Every chart has a Chart / Table switch and hover and keyboard readouts.

| Chart | What it shows | Method |
|---|---|---|
| Earthquakes per hour | 168 hourly counts with a trailing 24 h mean | `bucketCounts`, `trailingMean`; the average is null until a full window exists |
| Magnitude–frequency | Cumulative counts on a log axis with the fitted slope | Gutenberg–Richter: maximum-likelihood **b-value** (Aki–Utsu, bin-corrected) with the Shi & Bolt standard error; unit-tested against a sample drawn with b = 1 |
| Where quakes cluster | Top-10 regions × 7 days heatmap; click a row to fly there | region = USGS place text after the last comma, verbatim; square-root colour scale |
| How deep they are | Counts by depth class | shallow / intermediate / deep classes |
| Detections by UTC hour | 24 bars; peaks follow the satellite's overpass times | parsed from FIRMS `acq_time` |
| How intense the fires are | Log-spaced fire-radiative-power histogram | detections with no power reading are excluded and the chart says so |

**On the map**, *Show on map* bins either feed into H3 hexagons and extrudes them: wildfires at res 4 (~22 km) by summed fire radiative power, earthquakes at res 3 (~60 km) by count. A square-root scale keeps one huge cell from flattening the rest. Click a hexagon for its numbers, *Tilt map* shows the heights, and the legend switches between the two feeds.

**Scale.** On the run I checked (7 Oct 2026) the fire feed held 117,305 detections, which collapsed into 9,975 hexagons. Timing on *synthetic* uniformly random global points (Node, dev laptop — a worst case, since real fires cluster): 120,000 points bin into ~95,000 cells in about 0.55 s, and the summary statistics take ~30 ms, so it all runs client-side with no backend.

**No data, no chart.** If a feed returns nothing or fails, its section says so and offers a retry; nothing is estimated or filled in. Chart colours are validated for colour-vision deficiency against the app's dark surface (`--series-1/2` in `index.css`, ramp in `src/utils/vizPalette.ts`).

**A bug the analytics work exposed, now fixed.** The trajectory rule used to compare a 3-day *sum* with a 7-day *sum*, so a perfectly steady country read as "falling" (about −57%) in the Outlook card, Watchlist and AI Analyst context. `computeTrajectories` now compares the last 72h with the pace the prior week implies (its score × 3/7), keeping `delta` in "points per 72h" so the flat band and boosts are unchanged.

## Why this exists

Most dashboards either pick one data source and go deep, or fake it with static data. The interesting engineering problem here was: how far can you push a real-time, multi-source dashboard using only free-tier APIs, without the UI collapsing into a mess of ad-hoc fetch calls? The answer is a small set of patterns reused everywhere — typed hooks per data source, a shared panel contract, and careful refresh-rate budgeting to stay under rate limits.

## Tech stack

- **Vite + React 18 + TypeScript** (strict)
- **Mapbox GL JS v3** — 3D globe, custom GeoJSON layers, fill-extrusion buildings
- **Tailwind CSS** — utility styling for the surrounding chrome
- **date-fns**, **lucide-react**

No backend — the app talks directly to public APIs from the browser, using Vite's dev proxy (and a deploy-time equivalent) to route around CORS where needed (OpenSky OAuth, NASA FIRMS, AISStream WebSocket, OpenRouter).

## Architecture

```
src/
  App.tsx                    # root composition: TopBar + MapView + panel dock
  components/
    Map/MapView.tsx          # Mapbox globe, all GeoJSON layers (helpers in Map/flightLayer, vesselImages, viewModes)
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
| `ACLED_EMAIL` / `ACLED_PASSWORD` | [ACLED](https://acleddata.com) | conflict event data |
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

The suite is hermetic: `fetch` is stubbed to throw by default, so no test can touch a live API (or a paid one). It covers the pure logic (trajectory engine, flight/vessel classification), every service's parsing/caching/failure paths against mocked responses, integrity checks for the static datasets, the serverless key-injecting proxies (`tests/api/`), and repo policy checks (no committed secrets, server keys never in the client bundle). `npm run test:visual` is a separate Playwright screenshot check.

## Refresh budgeting

Every polled source runs at a rate chosen to respect its provider's free-tier limits: flights every 15s (OpenSky's polite ceiling), crises every 5 minutes, market data every 60s, news on-demand. This is deliberate — the app is designed to run indefinitely without hitting a 429.

## Status

Actively developed. Current focus: trade/supply-chain overlays (chokepoints, shipping density, pipelines, ports) and World Bank country economic profiles.

## Security notes

- `.env` is gitignored and never committed. Only `.env.example` (placeholders) is tracked.
- If you're running Claude (or any agent) against this repo inside GitHub Codespaces/Actions and it needs real API keys at runtime, use the platform's own secrets store (`Settings → Secrets and variables → Codespaces`) rather than committing `.env` — see `CLAUDE.md` for the exact commands.

## Further reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data flow, panel registry pattern, map layer system
- [`CLAUDE.md`](./CLAUDE.md) — working agreement for AI agents contributing to this repo
