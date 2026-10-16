import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { apiDevPlugin } from './vite.api-dev'

const STATIC_DATA = /\/src\/services\/(military|tradeStats|earthcam|ports|unhcr|oilgas|resources|sanctions|supplychain|usWebcams)\.ts$/

// Local dev: `npm run dev` serves the /api/*.ts functions itself via apiDevPlugin
// (vite.api-dev.ts), reading server-only keys from .env — no Vercel CLI needed.
// `vercel dev` still works too; it intercepts /api/* before it reaches Vite.
// mapbox-gl ships as one ~1.7 MB minified file that can't be split, so Vite's global size warning would fire on
// every build. Raise the global limit past it and keep the usual 500 kB budget for every other chunk here.
const CHUNK_BUDGET_KB = 500
const chunkBudget: Plugin = {
  name: 'chunk-budget',
  generateBundle(_opts, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk' || chunk.name === 'vendor-mapbox') continue
      const kb = Buffer.byteLength(chunk.code) / 1000
      if (kb > CHUNK_BUDGET_KB) this.warn(`${chunk.fileName} is ${kb.toFixed(0)} kB, over the ${CHUNK_BUDGET_KB} kB budget`)
    }
  },
}

export default defineConfig({
  plugins: [react(), apiDevPlugin(), chunkBudget],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        // Split what rarely changes away from app code, so a deploy only invalidates the app chunk. mapbox-gl is
        // the bulk of the bundle. The static datasets are large curated tables that change far less often than
        // the UI; they still load up front (map layers and the place brief read them synchronously), so this
        // improves caching and parallel download, not first-load bytes. Only modules with no runtime imports
        // belong in STATIC_DATA, so the data chunk never imports back into the app chunk.
        manualChunks: (id) => {
          if (id.includes('node_modules/mapbox-gl')) return 'vendor-mapbox'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (/node_modules\/(date-fns|lucide-react)\//.test(id)) return 'vendor-ui'
          if (STATIC_DATA.test(id)) return 'data-static'
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      // NASA FIRMS is served by api/firms/[...path].ts in dev and production alike (it used to be dev-only here).
      // EmailRep.io — email reputation lookup (free, 10 req/day without key)
      '/api/emailrep': {
        target: 'https://emailrep.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/emailrep/, ''),
      },
      // Aircraft database — hexdb.io (free, no auth)
      '/api/hexdb': {
        target: 'https://hexdb.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hexdb/, ''),
      },
      // Aircraft photos — Planespotters.net (free, no auth)
      '/api/planespotters': {
        target: 'https://api.planespotters.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/planespotters/, ''),
      },
      // GDELT — no CORS headers on either the doc or geo endpoints, no key required
      '/api/gdelt': {
        target: 'https://api.gdeltproject.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gdelt/, '/api'),
      },
      // opensky / acled / finnhub / guardian / nyt / openrouter are NOT proxied
      // here — they need a key injected server-side, so they're served by the
      // /api/*.ts functions (apiDevPlugin locally, Vercel in production).
    },
  },
})
