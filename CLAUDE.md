# Working agreement for AI agents in this repo

This file exists so any agent (Claude or otherwise) picks up context fast and doesn't repeat mistakes already made and corrected in this repo's history.

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

- Full visual redesign from a dark terminal/HUD theme to a light SaaS theme (`src/index.css` design tokens, sidebar+map+right-rail shell). See `ARCHITECTURE.md`.
- The AI Analyst panel was explicitly called out as the project's most important feature ("a smart dashboard I can use to foresee future events") and was upgraded from a plain ask-and-answer chatbot into one with a proactive, rule-based Watchlist (`src/utils/trajectory.ts`) that surfaces rising/falling regional trends automatically, with the LLM's own answers grounded in those same computed numbers. Do not regress this back to prompt-only chat without discussing it first — it was a deliberate response to direct feedback that the panel wasn't living up to the project's stated purpose.
- The AI panel also has a distinct visual identity (dark indigo/navy gradient surface, `.ai-*` classes in `index.css`) deliberately different from the rest of the now-light UI — this was a specific request ("futuristic, a system that knows everything"), not an oversight to be reskinned into matching the rest of the app. It must **not** claim or imply access to this repo's source code — it reasons over live dashboard data only.

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
- The original "vibe coded" dark-terminal aesthetic (`#0a0a0a` background, neon green `#00ff88` accent, tiny monospace-everywhere labels) — explicitly replaced for looking unpolished/non-professional. Don't reintroduce it as a "fix" without being asked.

## Conventions to follow when extending this repo

- New data source → new file in `services/`, new hook in `hooks/`, new entry in `src/panels/registry.tsx`. Don't bypass the registry with ad-hoc panel wiring.
- New map layer → follow the existing `addSource`/`addLayer` pairing pattern in `MapView.tsx`, gate visibility behind a new `PanelState` boolean (`src/types/index.ts`), wire the toggle through `SettingsModal`'s `LAYER_IDS` list.
- Styling: use the CSS custom properties defined in `src/index.css` (`--surface`, `--text1/2/3`, `--accent`, `--red/amber/green` + `-soft` tints, `--r-sm/md/lg/pill`, `--shadow-sm/md/lg`) rather than hardcoding hex values, so the whole app stays reskinnable from one place.
- Run `npx tsc --noEmit` before considering any change done — this repo has no test suite; strict typechecking is the primary safety net.
