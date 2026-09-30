# WORLDVIEW

A real-time global situational awareness platform — a single-page command-center dashboard that fuses live flight tracking, maritime AIS data, geopolitical crisis feeds, market data, and OSINT sources onto one interactive 3D globe.

Built as a personal engineering project to explore high-density real-time UI design, multi-source data fusion, and working within the constraints of free-tier public APIs.

![stack](https://img.shields.io/badge/TypeScript-strict-3178c6) ![stack](https://img.shields.io/badge/React-18-61dafb) ![stack](https://img.shields.io/badge/Mapbox_GL-v3-000000) ![stack](https://img.shields.io/badge/Vite-6-646cff)

## What it does

WORLDVIEW renders a live Mapbox GL globe with ten selectable view modes (satellite, night vision, thermal, 3D buildings, infrared, etc.) and overlays it with continuously polled data:

- **Flights** — live ICAO24 aircraft tracking via OpenSky, with type detection (military/civil/cargo) from hex ranges and callsign patterns
- **Vessels** — real-time AIS ship tracking over a WebSocket feed (AISStream)
- **Crises & conflict** — ACLED conflict events and ICG crisis-watch data, scored into a composite DEFCON-style threat index
- **Wildfires** — NASA FIRMS active fire detections
- **Markets** — indices, commodities, energy, tech, healthcare, and defense-sector tickers (Finnhub)
- **Trade & supply chain** — chokepoints, shipping routes, pipelines, ports, and World Bank country economic indicators
- **News & OSINT** — aggregated reporting from Guardian, NYT, and NewsAPI, plus a keyword/coordinate search
- **AI Analyst** — an LLM-backed panel (via OpenRouter) that answers situational questions and can drive the map (fly-to, layer toggles) from natural language

All panels live in a single extensible **panel registry** (`src/panels/registry.tsx`) grouped into INTEL / GEO / MIL / FIN / AI — adding a new data source is one entry, and the dock, pop-out tray, and settings pick it up automatically.

## Why this exists

Most dashboards either pick one data source and go deep, or fake it with static data. The interesting engineering problem here was: how far can you push a real-time, multi-source dashboard using only free-tier APIs, without the UI collapsing into a mess of ad-hoc fetch calls? The answer is a small set of patterns reused everywhere — typed hooks per data source, a shared panel contract, and careful refresh-rate budgeting to stay under rate limits.

## Tech stack

- **Vite + React 18 + TypeScript** (strict)
- **Mapbox GL JS v3** — 3D globe, custom GeoJSON layers, fill-extrusion buildings
- **Tailwind CSS** — utility styling for the surrounding chrome
- **date-fns**, **axios**, **lucide-react**

No backend — the app talks directly to public APIs from the browser, using Vite's dev proxy (and a deploy-time equivalent) to route around CORS where needed (OpenSky OAuth, NASA FIRMS, AISStream WebSocket, OpenRouter).

## Architecture

```
src/
  App.tsx                    # root composition: TopBar + MapView + panel dock
  components/
    Map/MapView.tsx          # Mapbox globe, all GeoJSON layers, view-mode logic
    TopBar.tsx                # live counters, threat index, view switcher, search
    PanelDock/                # draggable/collapsible dock + pop-out observe tray
    panels/PanelContent.tsx  # panel implementations
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
npm run dev            # runs `vercel dev` — serves Vite + the /api/* serverless functions together
```

Requires Node 18+. Open the printed local URL (defaults to `localhost:3000`). The first `vercel dev` run may ask you to link the directory to a Vercel project (or run without deploying) — either is fine for local dev.

If you only need the map/panels and don't need the server-proxied sources (market data, news via Guardian/NYT, AI Analyst, conflict data, flight tracking), `npm run dev:vite-only` runs plain Vite without the `/api` functions.

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

## Refresh budgeting

Every polled source runs at a rate chosen to respect its provider's free-tier limits: flights every 15s (OpenSky's polite ceiling), crises every 5 minutes, market data every 60s, news on-demand. This is deliberate — the app is designed to run indefinitely without hitting a 429.

## Status

Actively developed. Current focus: trade/supply-chain overlays (chokepoints, shipping lanes, pipelines, ports) and World Bank country economic profiles.

## Security notes

- `.env` is gitignored and never committed. Only `.env.example` (placeholders) is tracked.
- If you're running Claude (or any agent) against this repo inside GitHub Codespaces/Actions and it needs real API keys at runtime, use the platform's own secrets store (`Settings → Secrets and variables → Codespaces`) rather than committing `.env` — see `CLAUDE.md` for the exact commands.

## Further reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data flow, panel registry pattern, map layer system
- [`CLAUDE.md`](./CLAUDE.md) — working agreement for AI agents contributing to this repo
