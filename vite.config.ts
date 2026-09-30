import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { apiDevPlugin } from './vite.api-dev'

// Local dev: `npm run dev` serves the /api/*.ts functions itself via apiDevPlugin
// (vite.api-dev.ts), reading server-only keys from .env — no Vercel CLI needed.
// `vercel dev` still works too; it intercepts /api/* before it reaches Vite.
export default defineConfig({
  plugins: [react(), apiDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // NASA FIRMS active fire data (no CORS headers on their CDN, no key required)
      '/api/firms': {
        target: 'https://firms.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/firms/, ''),
      },
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
