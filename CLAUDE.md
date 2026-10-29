# Working agreement for AI agents in this repo

This file exists so any agent (Claude or otherwise) picks up context fast and doesn't repeat mistakes already made and corrected in this repo's history.

## Honesty about what the app shows

- **Never overstate.** Do not present AI output, forecasts or correlations as validated; say what was and wasn't measured.
- Numbers are computed locally and the model explains them; keep evidence separate from inference. Don't let the model state numbers it wasn't given.
- Don't describe the project as a "personal engineering project" or "side project" in docs.

## Secrets — non-negotiable

- **Never commit `.env` or hardcode real API keys/passwords anywhere in source, even to a private repo, even "temporarily."** Git history is effectively permanent once pushed — reverting a later commit does not remove it from history, and a private repo can become public, get forked, or have its access change. This was asked for explicitly during development and refused; the refusal stands as project policy, not a one-off judgment call.
- If an agent running inside a GitHub dev environment (Codespaces, Actions) needs real keys to execute/test the app, use that platform's own secrets store (repo `Settings → Secrets and variables → Codespaces`), which injects them as env vars at runtime without touching git. Do not propose committing `.env` as a workaround.
- `.env.example` (placeholders only) is the correct and only key-related file to commit.

## No fake data — non-negotiable

- **Never fabricate, guess, or approximate data points presented as fact** — coordinates, capacities, names, dates, counts, statuses, etc. This applies to every dataset in `src/services/` (infrastructure, military, resources, trade, sanctions, etc.) and to any new one added.
- Every static entry must be traceable to a real, identifiable source (named database, agency report, operator disclosure) — not invented to "fill out" a list or make a category look complete. If verifiable data isn't available for a facility/entry, leave it out rather than inventing a plausible-looking one.
- When only a live API can give real coverage for a category (e.g. exhaustive hospital/police/cell-tower listings), prefer wiring an actual API over hand-writing a long static list from memory — a curated static list is only acceptable when each entry is a real, known major facility (the pattern already used for dams/refineries/LNG terminals), not a filled-in approximation.
- If asked to add a data category and real sourced data isn't readily available, say so and ask rather than silently generating placeholder-but-realistic-looking entries — approximated data is worse than missing data here because the UI presents it as fact.

## No cost-accumulating data sources — non-negotiable

- **Every data source wired into this app must be free with no billing account attached**, full stop — no paid tiers, no metered/pay-as-you-go APIs, no services that require a credit card on file even if there's a free quota. This app must never be able to run up a bill from normal use or from an agent testing it.
- Prefer sources that are free and keyless (no signup at all) — e.g. World Bank Open Data, WRI's Global Power Plant Database (static CC-BY file), OSM Overpass API. When a key is genuinely required (Guardian, NYT, Finnhub, ACLED, Mapbox), it must be on that provider's free tier with no paid upgrade path wired in, and the key goes in `.env` per the Secrets section above — never assume the user wants a paid plan.
- **One explicit exception — the AI Analyst model picker.** The user knowingly authorised paid chat models (Claude, ChatGPT, etc.) via their own OpenRouter key in `.env` (`OPENROUTER_KEY`). The picker lists the full OpenRouter catalogue (`/api/openrouter/models`, keyless/public), but the **default model must stay a `:free` one** (`DEFAULT_MODEL`, enforced by `tests/policy.test.ts`) so nothing bills until the user picks a paid model. This exception covers the chat model choice only — it does not open the door to paid data sources.
- Before adding a new external data source, confirm it's free/keyless (or free-tier-with-key) and say so explicitly when introducing it, so the user isn't surprised by a service that could later bill them.

## Always commit and push when done — non-negotiable

- **At the end of any task that changes files, commit and push, without waiting to be asked.** This is a standing instruction, not a one-off — it overrides the general default of only committing when explicitly requested.
- Stage only the files you actually changed for the task at hand (`git add <specific files>`, not `git add -A`/`git add .`) — see the Multi-session hazard section below for why a broad add is dangerous in this repo specifically.
- Still apply normal judgment: don't commit secrets (see Secrets section), and if `git status` shows unrelated in-progress changes from a sibling session, leave those unstaged and only commit/push your own files.
- Push to `main` directly unless the user says otherwise — this repo has no branch-protection workflow in place that requires PRs.

## Multi-session hazard

This repo has been worked on by multiple concurrent Claude Code sessions pointed at the same working directory at once. There is no isolation between sessions sharing one folder — a write from one session is immediately visible to (and overwritable by) every other. Symptoms seen in practice: a finished redesign silently reverting because a sibling session wrote over the same files; orphaned dead files appearing (e.g. an unused `LeftPanel.tsx` from an abandoned parallel attempt) that nothing imports.

Before assuming your own edits are broken or reverted, check `git status`/`git diff` against what you expect — it's more likely a sibling session touched the same file than that the build actually failed. If you find files changed outside your own edits, read them before overwriting; don't assume they're wrong.

## What's been built here (context for future work)

- Full visual redesign from the original neon-green terminal/HUD look to a professional dark theme (`src/index.css` design tokens: deep blue-black surfaces `--bg #080e13` / `--surface #0d161d`, muted gold `--accent`, sidebar+map+right-rail shell). An intermediate light SaaS theme was tried and later replaced; the tokens in `index.css` are the source of truth for the current look. See `ARCHITECTURE.md`.
- The AI Analyst panel was explicitly called out as the project's most important feature ("a smart dashboard I can use to foresee future events") and was upgraded from a plain ask-and-answer chatbot into one with a proactive, rule-based Watchlist (`src/utils/trajectory.ts`) that surfaces rising/falling regional trends automatically, with the LLM's own answers grounded in those same computed numbers. Do not regress this back to prompt-only chat without discussing it first — it was a deliberate response to direct feedback that the panel wasn't living up to the project's stated purpose.
- The AI panel also has a distinct visual identity (dark indigo/navy gradient surface, `.ai-*` classes in `index.css`) deliberately a step apart from the rest of the UI (more saturated, more glow) — this was a specific request ("futuristic, a system that knows everything"), not an oversight to be reskinned into matching the rest of the app. It must **not** claim or imply access to this repo's source code — it reasons over live dashboard data only.

## Preferences observed from actual project feedback

**Liked / keep doing:**
- Reusing existing patterns instead of inventing new ones — e.g. the trajectory engine extends `computeCountryRisk`'s severity-weighting rather than introducing a second scoring system.
- Grounding AI-generated content in real, locally-computed numbers rather than letting the model free-associate — the Watchlist computes deltas first, then the LLM explains them.
- Keeping changes scoped to what was asked — visual redesign work explicitly avoided touching data logic, hooks, services, or map layer/source definitions; only styling.
- Flagging problems directly and clearly instead of silently working around them or complying with a risky request just because it was repeated (see Secrets section above).

**Disliked / avoid:**
- Claiming a background task/agent is "done" or "complete" before its actual completion signal has arrived. This happened repeatedly during a multi-agent redesign session and was a real, called-out failure — always verify status before reporting it, and if unsure, say so rather than asserting.
- Vague or generic AI panel behavior that doesn't feel purpose-built — the panel is meant to feel like it's actually reasoning over the dashboard's live data, not just producing generic chatbot text.
- Cosmetic-only fixes when the actual complaint was functional. When told the AI panel "hasn't been redesigned," the real issue was that it had no proactive/forecasting behavior at all (chat-on-request only) — a visual pass alone would not have addressed it.
- The original "vibe coded" terminal aesthetic (`#0a0a0a` background, neon green `#00ff88` accent, tiny monospace-everywhere labels) — explicitly replaced for looking unpolished/non-professional. The current UI is also dark, but with the refined palette in `index.css`; don't reintroduce the neon-green look as a "fix" without being asked. (Some leftover `#00ff88` literals remain in map overlays — see the styling convention below.)

## Conventions to follow when extending this repo

- New data source → new file in `services/`, new hook in `hooks/`, new entry in `src/panels/registry.tsx` (with a `section` from that workspace's `GROUP_SECTIONS`; add a new banner there only if no existing one fits, a `map` decision — the layers that draw its data, which gives the panel header the standard "Show on map" toggle, or `'inline'`/`'none'` — and its `sources`: live feeds by `SOURCE_RULES` id or cited static datasets with their as-of date, which the frame turns into the standard sources footer), and a matching rule in `SOURCE_RULES` (`services/sourceHealth.ts`) so its health shows in the TopBar. Don't bypass the registry with ad-hoc panel wiring. Panels live in `src/components/panels/` (one file per theme or panel) and are lazy-loaded; don't import a panel file from `MapView`/`CountryDrawer`.
- New map layer → add one file `src/components/Map/layers/<name>.ts` with an `add<Name>Layers(map, ctx)` function (sources, layers, click/hover handlers — runs once when the style loads) and a `use<Name>Data(handle, props)` hook (visibility + data updates), export both from `layers/index.ts`, and register them in `addAllLayers` (call order is draw order) and in `MapView.tsx`. Gate visibility behind a new `PanelState` boolean (`src/types/index.ts`), add it to `OVERLAY_ITEMS` in `Map/overlays/OverlayMenu.tsx`, and wire the toggle through the `LAYER_IDS` list (`src/components/layerCatalogue.ts`, shown in `SettingsModal` and the command palette). Don't grow `MapView.tsx` itself — it is a composition root.
- Styling: use the CSS custom properties defined in `src/index.css` (`--surface`, `--text1/2/3`, `--accent`, `--red/amber/green` + `-soft` tints, `--r-sm/md/lg/pill`, `--shadow-sm/md/lg`) rather than hardcoding hex values, so the whole app stays reskinnable from one place. Map-layer colours (`src/components/Map/layers/*`) and popup HTML use literal hex values because Mapbox style expressions can't read CSS variables; keep those colours next to the layer that uses them.
- Colour meaning: `--accent` (cyan) is the interface only — selection, links, focus — never a data value. `--red` = worse / higher risk, `--green` = better / lower risk, `--amber` = caution or unchanged. Never rely on colour alone: pair it with a word, arrow, shape or value, and don't colour a bare "rising"/"falling" (it can be good or bad). Map ramps carry numbers on their legend, matching the scale actually drawn.
- Icons: one family, Lucide, size 14 / stroke 1.8 in menus. Don't use text glyphs (`▦`, `✈`, …) as icons — they render differently per OS.
- Run `npm run typecheck` **and** `npm test` before considering any change done. Typecheck covers `src/` (browser/Vite types), `api/` (Node/Vercel serverless types) and `tests/` — three different `tsconfig`s. `npm test` (Vitest) runs fully offline in ~2s.

## Testing conventions

- Tests sit next to the code (`foo.ts` → `foo.test.ts`). Serverless-function tests live in `tests/api/` — **never** put test or helper files under `api/`, because Vercel deploys every file there as a function (`tests/policy.test.ts` enforces this).
- The suite is hermetic: `src/test/setup.ts` makes any unmocked `fetch` throw. Use `mockFetch` / `jsonResponse` / `installLocalStorage` from `src/test/helpers.ts`; never point a test at a live API. Services cache at module level, so reload them per test with `vi.resetModules()` + dynamic `import()`. Use fake timers (`vi.useFakeTimers()`) rather than real waits.
- Component tests are `*.test.tsx` next to the component, start with `// @vitest-environment jsdom` (everything else runs in node) and use `@testing-library/react`. `src/test/setup.ts` unmounts after each test. Mock a panel's service module with `vi.mock`, not `fetch`. Map layer modules are covered by `Map/layers/layers.test.ts`, which runs `addAllLayers` against a recording fake map (unique ids, sources before layers, handlers on real layers, draw order) — extend it when you add a layer.
- New static dataset → add it to `src/services/datasets.test.ts` (valid lat/lng, no `(0,0)` placeholders, unique ids, known enum values). That check can't prove an entry is *true* — the sourcing rule above still applies.
- New service/hook → cover the success path, malformed/partial payloads, HTTP errors and network failure (services here return `[]`/`null` rather than throw unless documented otherwise).
- `it.fails(...)` marks a **known, documented bug**; none exist right now. When you find one you can't fix immediately, document it with `it.fails` plus a `KNOWN BUG` comment, and delete the `.fails` when it's fixed. Don't add new `.fails` to hide flaky tests.
- New key-bearing endpoint in `api/` → add a proxy test asserting the server key is injected, cannot be overridden by the client query, and is never echoed back; add its env var to `.env.example`.
