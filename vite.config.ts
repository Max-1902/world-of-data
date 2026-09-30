import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Local dev: run `vercel dev` instead of `vite` directly so the /api/* serverless
// functions (which hold the real provider keys server-side) run alongside Vite.
// `vercel dev` reads the same .env file and proxies non-API requests to this
// Vite server automatically — see README "Running it locally".
export default defineConfig({
  plugins: [react()],
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
      // here — they require a real key injected server-side and are served by
      // the /api/*.ts serverless functions (run via `vercel dev`, not `vite`).
    },
  },
})
