# Mundus Datorum

*Latin for "world of data".* A live world-monitoring dashboard: dozens of free data sources on one 3D globe, a statistics layer on top, and an AI analyst that can read the results. It is a research case around two questions: **what does data become when you visualise it, and what happens when an LLM is wired into a system that can evaluate all of it?**

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![React](https://img.shields.io/badge/React-18-61dafb) ![Mapbox](https://img.shields.io/badge/Mapbox_GL-v3-000000) ![Vite](https://img.shields.io/badge/Vite-6-646cff)

![Mundus Datorum on Ukraine: satellite globe with the country brief, country panel with military and nuclear sites, and the AI analyst's answer on the economic impact of the war](docs/screenshots/main.jpg)

## 29 overlays in 5 categories

![Satellite view of Europe with many overlays switched on at once, the Germany country brief open at bottom left and the Economy workspace with Germany's trade profile on the right](docs/screenshots/overlays-europe.jpg)

| Category | Overlays |
|---|---|
| **Live tracking** | flights (OpenSky), vessels (AIS), webcams |
| **Events & hazards** | crises, news, wildfires (NASA FIRMS), humanitarian, GPS jamming, internet outages, hazard hexagons |
| **Security & defence** | military sites, force size, nuclear, sanctions, airspace |
| **Economy** | markets, trade, resources, oil, gas, supply chain, country data |
| **Infrastructure** | energy sites, data centres, pipelines, ports, chokepoints, shipping density |

## Analytics

Pick any two of **50 country indicators** (World Bank, Our World in Data, Ember) and get the trend, Spearman correlation with a 95% interval, the biggest outliers, and a globe shaded by the result. Charts have a table view; all maths is unit-tested.

| | |
|---|---|
| ![Globe coloured red and blue by how far each country's life expectancy is above or below the trend predicted by GDP per capita, with the scatter in the dock](docs/screenshots/trend-map.jpg) | ![Population against armed forces personnel on log axes, with North Korea, Eritrea and Israel labelled above the trend](docs/screenshots/army-size.jpg) |
| **Wealth vs health**, 214 countries, ρ = 0.86. Map in *Vs trend* mode: red lives longer than income predicts, blue shorter | **Army size**, 165 countries, ρ = 0.79. North Korea, Eritrea and Israel sit furthest above the trend |
| ![Correlation matrix of twelve indicators, blue negative and red positive, values printed in each cell](docs/screenshots/correlation-matrix.jpg) | ![About 120,000 wildfire detections binned into extruded hexagons over Africa](docs/screenshots/hazard-hex.jpg) |
| **What moves together**: 12×12 Spearman matrix; click a cell to plot that pair | **Big data in the browser**: ~120,000 NASA FIRMS detections binned into 3D hexagons client-side. Also earthquakes, with a Gutenberg–Richter fit |

## An AI that reads the analytics

The analyst (any OpenRouter model, free by default) gets the comparison currently on screen as computed numbers, not as text to recall. I asked **Claude Sonnet 5.5** a data question:

> *Which countries spend far more on defence than their wealth predicts, and what explains the top two?*

| | |
|---|---|
| ![Scatter of military spending against GDP per capita with Ukraine as an extreme outlier](docs/screenshots/defence-analytics.jpg) | ![Claude's answer quoting the analytics numbers, with its own explanations labelled as such](docs/screenshots/ai-claude-panel.jpg) |
| **The data**: ρ = 0.16, wealth predicts almost nothing. Ukraine is +10.7 σ above the trend | **The answer**: every figure matches the panel (Ukraine 34.5% vs 2.2% expected, Israel 8.8% vs 2.5%, Algeria 8.0%…). It says the wealth link is negligible and labels its explanations "my context, not from the panel" |

It also drove the map (flew to Ukraine, switched layers on). One question, one run per model: an illustration, not a benchmark.

## Research notes

- **Controls:** real data only, nothing fabricated; numbers are computed locally and the model explains them; evidence is kept separate from inference; free sources only ([`CLAUDE.md`](CLAUDE.md), [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md)).
- **Found along the way:** a World Bank query silently dropped most countries (42 of 245 for internet use); the system's own trend heuristic flagged steady countries as "falling" until a different plot exposed it; zero-filled rows look like data until a log axis refuses them.
- **Not yet done:** the AI has not been systematically evaluated; its context does not mark a switched-off layer as "not measured" (a small free model read "0 flights" as "no aircraft"); the ACLED login is failing, so the crisis layer shows only a hand-kept baseline and the threat index reads NO LIVE FEED; the "rising" flag is an unvalidated heuristic.
- Not a decision tool: correlation is not causation, and many series are years old for some countries.

## Run it

```bash
npm install
cp .env.example .env   # only VITE_MAPBOX_TOKEN is required; every other key is optional
npm run dev            # Vite + the small /api functions that keep secrets out of the bundle
npm test               # ~900 tests, fully offline
```

Stack: Vite, React 18, TypeScript (strict), Mapbox GL v3, plain SVG charts. No server or database; state lives in the browser. Architecture and conventions are in [`ARCHITECTURE.md`](ARCHITECTURE.md).
