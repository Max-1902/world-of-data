// Builds the desktop app into dist-desktop/: the web app (web/), the Electron main process and
// preloads (bundled by esbuild, api/ handlers included) and the key window.
//
// The web build reads no .env and no VITE_ variables from the shell, so an installer never carries
// the builder's own keys: desktop users enter theirs in the key window (desktop/keys.ts).
import { build as viteBuild } from 'vite'
import { build as esbuild } from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const OUT = 'dist-desktop'

for (const k of Object.keys(process.env)) if (k.startsWith('VITE_')) delete process.env[k]
const emptyEnvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wod-no-env-'))

fs.rmSync(OUT, { recursive: true, force: true })
await viteBuild({ envDir: emptyEnvDir, logLevel: 'warn', build: { outDir: `${OUT}/web`, emptyOutDir: true } })
fs.rmSync(emptyEnvDir, { recursive: true, force: true })

await esbuild({
  entryPoints: { main: 'desktop/main.ts', preload: 'desktop/preload.ts', 'keys-preload': 'desktop/keys-preload.ts' },
  outdir: OUT,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  logLevel: 'warning',
})

fs.cpSync('desktop/keys-window', `${OUT}/keys-window`, { recursive: true })
console.log(`desktop build → ${OUT}/`)
