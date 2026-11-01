# World of Data — desktop app

The same app as the website, packaged with Electron for macOS, Windows and Linux. Nothing is hosted: the
page and the `api/` proxies run inside the app, behind a private `app://` scheme (no local port is opened).

## Run it from the repo

```bash
npm run desktop
```

This builds `dist-desktop/` and starts the app. Run from the repo, it reads your keys from the repo's `.env`,
so there is nothing to enter. Keys saved in the key window take over from `.env` from then on.

## Build installers

```bash
npm run desktop:dist      # → release/  (.dmg on macOS, .exe on Windows, .AppImage on Linux)
```

Each OS builds its own installer. The `Desktop installers` GitHub Actions workflow builds all three on a
version tag (`git tag v0.2.0 && git push --tags`) or by hand from the Actions tab, and puts them in a draft
release.

Installers never contain API keys: the web part is built with no `.env` and no `VITE_` variables. On first
launch the app opens its key window. **Import from .env…** fills it from an existing `.env` file; otherwise
paste the keys. Only the Mapbox token is required. Keys are stored in the app's data folder, encrypted with
the system keychain (macOS Keychain, Windows DPAPI, the Linux secret service where available). Open the
window again from the menu (**API Keys…**, Cmd/Ctrl+Shift+K) or **Settings → API keys → Edit keys**.

## First launch of an unsigned build

The installers are not signed with a paid developer certificate.

- **macOS:** the first open is blocked. Go to System Settings → Privacy & Security → **Open Anyway**.
- **Windows:** SmartScreen shows "Windows protected your PC". Click **More info → Run anyway**.

## Layout

| File | Role |
| --- | --- |
| `main.ts` | Electron main process: windows, menu, `app://` scheme, key storage |
| `apiBridge.ts` | Runs the `api/*.ts` handlers for `/api/*` requests (same routing as `vite.api-dev.ts`) |
| `keys.ts` | The key list (mirrors `.env.example`) and `.env` parsing |
| `preload.ts` | Gives the page its browser-side keys (`src/runtimeEnv.ts`); server keys never reach the page |
| `keys-preload.ts`, `keys-window/` | The key window, the only page that can read or save keys |
| `../scripts/build-desktop.mjs` | Builds `dist-desktop/` (web build without `.env`, esbuild bundle of the main process) |
| `../electron-builder.yml` | Installer settings |

A new handler in `api/` needs a line in `ROUTES` (`apiBridge.ts`); `apiBridge.test.ts` fails until it has one.
A new key in `.env.example` needs a `KEY_FIELDS` entry; `keys.test.ts` checks the two match.
