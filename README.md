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
- **Conflict Analytics** — 75 days of ACLED events turned into charts (daily trend, country × day heatmap, biggest movers), a walk-forward backtest of the "rising" flag, and a 3D hexagon layer that draws the same results on the globe (see [Analytics](#analytics-from-tens-of-thousands-of-events-to-one-picture))
- **AI Analyst** — an LLM-backed panel (via OpenRouter) that answers situational questions and can drive the map (fly-to, layer toggles) from natural language

All panels live in a single extensible **panel registry** (`src/panels/registry.tsx`) grouped into INTEL / GEO / MIL / FIN / AI — adding a new data source is one entry, and the dock, pop-out tray, and settings pick it up automatically.

## Analytics: from tens of thousands of events to one picture

The **Conflict Analytics** panel (Analysis workspace) takes a 75-day ACLED window (paged, capped at 10 requests per load, slim field list) and answers four questions. Every chart has a Chart / Table switch, hover and keyboard readouts, and click-through to the map.

| View | What it shows | Method |
|---|---|---|
| Global activity by day | Severity-weighted score per day with a 7-day mean | `dailySeries`, zero-filled so quiet days are real zeros |
| Where activity is concentrated | Top-12 countries × 45 days heatmap | square-root colour scale so one extreme day doesn't wash out the rest; click a row to fly there |
| Biggest movers | Diverging bars: last 3 days vs the prior 7, per-day rates | `rateMovers` |
| Does the "rising" flag predict anything? | Hit rate of the Watchlist rule vs. any active country, with 95% Wilson intervals, plus hit rate by velocity score | walk-forward backtest (`backtestTrajectory`) |

**On the map**, *Show on map* bins the same events into H3 hexagons (res 3, ~60 km) and extrudes them by activity, coloured either by latest-7-day intensity (sequential blue) or by change vs the prior 7 days (blue ↔ red diverging around a neutral midpoint). Click a hexagon for its numbers; *Tilt map* shows the heights.

**How the backtest stays honest**
- It replays the live rule (`computeTrajectories`, which now accepts an `as of` time) on every past day using only events dated on or before that day. A test appends future events and asserts earlier days don't change (no look-ahead).
- A "hit" means the next 7 days average a higher daily score than the trailing 10 days. The baseline is the same test over *every* active country, so the result is a lift over chance, not a bare accuracy figure.
- It reports whatever it finds. The plain-language verdict is generated from the numbers (`describeBacktest`) and only claims a lift when |z| > 1.96; otherwise it says the flag isn't shown to add value. Velocity bins with fewer than 20 samples are drawn as "too few", not as rates.
- Limits, stated in the panel: only event counts are replayed (no historical flight or news data exists), daily samples overlap so intervals are optimistic, and ACLED publishes with a lag so the newest days are undercounted (the window is anchored on the newest event day, not on today).

**Scale.** Timing on *synthetic* uniformly random global points (Node, dev laptop, not ACLED data): 50,000 events bin into 8,221 H3 cells in ~70 ms, and the full backtest over 50,000 events runs in ~125 ms, so the analysis runs in the browser with no backend. Real ACLED volume per window depends on your account's access.

Chart colours are validated with a colour-vision-deficiency check against the app's dark surface (`--series-1/2` and the ramps in `src/utils/vizPalette.ts`); direction is never carried by colour alone (arrows and signs on movers, a table view on every chart).

**A bug the analytics exposed, now fixed.** The trajectory rule used to compare a 3-day *sum* with a 7-day *sum*, so a perfectly steady country read as "falling" (about −57%) in the Outlook card, Watchlist and AI Analyst context. `computeTrajectories` now compares the last 72h with the pace the prior week implies (its score × 3/7), keeping `delta` in "points per 72h" so the flat band and boosts are unchanged. The backtest replays this corrected rule.

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
