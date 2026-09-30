# Architecture

## Shape

No backend. This is a Vite-served React SPA that talks directly to public APIs from the browser. Where a provider doesn't send CORS headers or requires a server-side OAuth exchange (OpenSky, ACLED, GDELT, Guardian, AISStream's WebSocket), Vite's dev proxy (`vite.config.ts`) routes around it. There is no persistence layer beyond `localStorage` (panel layout, view mode, AI chat history) — every panel is a live view over whatever the last poll returned.

```
src/
  App.tsx                       # root composition + top-level state (view mode, panel layout, selected country)
  components/
    Map/MapView.tsx             # Mapbox GL instance, every GeoJSON source/layer, all 10 view modes
    Sidebar.tsx                 # left nav — one entry per panel group (INTEL/GEO/MIL/FIN/AI)
    TopBar.tsx                  # live counters, DEFCON-style threat badge, view switcher, search
    NewsTicker.tsx               # scrolling headline strip
    CountryDrawer.tsx            # click-a-country intel aggregation (crises, bases, trade, econ, refugees...)
    SettingsModal.tsx            # layers / data sources / API key status / display prefs
    PanelDock/
      PanelDock.tsx               # right-hand panel stack — resizable, drag-to-reorder
      ObserveTray.tsx             # bottom tray for panels popped out of the dock (up to 6)
      FloatingPanel.tsx           # legacy single floating panel (pre-registry)
    panels/
      PanelContent.tsx            # every panel's implementation lives here (~25 components)
  panels/
    registry.tsx                  # single source of truth: id → group → title → render fn
    types.ts                       # PanelDef / PanelProps / PanelGroup contract
  hooks/                          # one hook per live data source — owns polling + exposes typed state
  services/                      # one API client per data source — fetch/parse only, no React
  utils/
    trajectory.ts                 # rule-based trend scoring (crisis escalation/de-escalation)
    flightType.ts                  # ICAO24 hex-range + callsign heuristics (military/civil/cargo)
    reloadBus.ts                   # global "reload all data" event bus
  types/index.ts                  # shared domain types (Flight, CrisisEvent, PanelState, ...)
```

## The panel registry pattern

Every panel in the right-hand dock is one entry in `src/panels/registry.tsx`:

```ts
{ id: 'crisiswatch', title: 'Crisis Monitor', group: 'intel', dotColor: 'orange',
  desc: 'ICG conflict tracking — 70+ states', render: () => <CrisisWatchPanel /> }
```

`group` is one of `intel | geo | mil | fin | ai`, driving the left `Sidebar` nav. Adding a panel means adding one entry here — `PanelDock`, `ObserveTray`, and `SettingsModal`'s layer list all read from this registry, so nothing else needs to change. Panels receive a shared `PanelProps` bag (`crises`, `flights`, `panelState`, `onToggleLayer`, `onGeoSearch`, `onCountryClick`, ...) and destructure only what they use.

## Data flow: service → hook → panel

Every live data source follows the same three-layer shape:

1. **`services/*.ts`** — a fetch/parse client for one provider. No React, no state. Example: `services/opensky.ts` handles OpenSky's OAuth2 token exchange and state-vector parsing.
2. **`hooks/use*.ts`** — owns the polling interval and exposes `{ data, loading, error }`. Example: `useFlights` polls OpenSky every 15s.
3. **Panel component** (`PanelContent.tsx`) or **map layer** (`MapView.tsx`) — renders the hook's output.

Refresh rates are chosen per-provider to stay under free-tier rate limits, not for UX reasons: flights 15s (OpenSky's polite ceiling), crises 5min, markets 60s, wildfires/earthquakes 5-10min, news on-demand.

`useCrises` also seeds a hardcoded `BASELINE` array of major ongoing conflicts (Ukraine, Gaza, Sudan, etc.), each stamped with **today's date** so they always render even if ACLED/GDELT are rate-limited or down. This matters for anything doing time-series analysis over `crises` — see the Watchlist note below.

## Map layer system (`MapView.tsx`)

One Mapbox GL instance, ~20 independently toggleable `addSource`/`addLayer` pairs (flights, vessels, crises, military, nuclear, pipelines, ports, chokepoints, supply chain, shipping density, humanitarian, GPS jamming, etc.), each gated by a boolean in `PanelState` (`src/types/index.ts`). `App.tsx` owns `panelState` and passes `showX` booleans down; `MapView` adds/removes layer visibility, it never owns the toggle state itself.

Ten view modes (`earth/standard/dark/satellite/city3d/nightvision/bw/infrared/snow/thermal`) are implemented two ways: `city3d` tilts the camera and shows a real `fill-extrusion` buildings layer; the rest (`nightvision/bw/infrared/snow/thermal`) are CSS `filter()` overlays on the canvas element (`src/index.css`), not different Mapbox styles — cheap to add, no extra tile requests.

A known race condition worth knowing about: flight data can arrive before the map's `load` event fires. The fix already in place is a `flightDataRef` that buffers pending data and flushes it inside `map.on('load')`.

## Oil & gas pipelines (`services/pipelines.ts`)

Real route geometry from OpenStreetMap (ODbL), in two tiers, because neither alone works:

- **World view:** `public/data/pipelines-trunk.geojson`, a committed snapshot of every OSM `route=pipeline` relation tagged `substance=oil|gas` (~200 long-distance lines). Regenerate with `node scripts/build-pipelines.mjs`. It's a snapshot because a world-wide Overpass query 504s on the public instances. The script retries and falls back between mirrors, and only writes the file when the whole run succeeds.
- **Detail view:** from zoom 9, individual pipeline ways are fetched live in 0.5° cells (`fetchPipelineCell`), cached per cell, capped per viewport, 3 requests at a time. Dense areas are huge (a 4°×4° tile over Texas was ~25 MB), so don't raise the cell size or lower the min zoom without re-measuring.

The older hand-typed waypoint lists (`GAS_PIPELINES`, `PIPELINE_ROUTES`) were removed: they were approximate and drew straight lines across terrain, which the no-approximated-data rule in `CLAUDE.md` forbids. Only the `pipelines` toggle drives these layers; the `infrastructure` toggle no longer writes to the `pipelines` source. Attribution to OpenStreetMap contributors is shown in the popup and Settings → data sources.

## The "Watchlist" — rule-based forecasting (`src/utils/trajectory.ts`)

The AI Analyst panel doesn't just answer prompts — `computeTrajectories()` is a pure function (no network calls) that buckets each country's crisis events into a "last 3 days" vs "4–10 days prior" window using each event's real `date` field, scores both by severity, and ranks countries by the delta. This produces a "rising / falling / flat" trend per region, shown automatically on panel load with no prompt required. The same computed numbers are appended to the LLM's system prompt (`buildDashboardContext` in `services/openrouter.ts`) so the model's own analysis is grounded in a real, local computation rather than a static snapshot.

**Load-bearing detail:** this function explicitly filters out `BASELINE` crisis entries (`source === 'Baseline'` / `id` starting with `baseline-`) before scoring. Baseline entries are stamped with today's date on every load, so including them would make every long-running conflict misread as "rising, no prior activity" on every single render — a bug caught during implementation, not a hypothetical.

## State ownership

`App.tsx` is the single owner of cross-cutting state: `viewMode`, `panelState` (21 layer toggles, persisted to `localStorage`), `activeGroup` (which sidebar group is open), `selectedCountry` (drives `CountryDrawer`), and the observe-tray pop-out set. Everything else is local to its own hook or component. There is no global store (Redux/Zustand/Context) — prop drilling through `App.tsx` → `PanelDock`/`MapView` is deliberate and has stayed manageable at this size; revisit if panel count or prop surface grows significantly.
