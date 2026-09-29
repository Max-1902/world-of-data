import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // NASA FIRMS active fire data (no CORS headers on their CDN)
      '/api/firms': {
        target: 'https://firms.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/firms/, ''),
      },
      // OpenSky OAuth2 token — browser can't POST to auth.opensky-network.org directly
      '/api/opensky-token': {
        target: 'https://auth.opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensky-token/, '/auth/realms/opensky-network/protocol/openid-connect/token'),
      },
      // OpenSky REST API — proxy to avoid any CORS edge cases
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensky/, '/api'),
      },
      // EmailRep.io — email reputation lookup (free, 10 req/day without key)
      '/api/emailrep': {
        target: 'https://emailrep.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/emailrep/, ''),
      },
      // OpenRouter AI — proxied to avoid CORS
      '/api/openrouter': {
        target: 'https://openrouter.ai/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
      },
      // AISStream WebSocket — browser CORS not supported, must proxy
      '/api/aisstream': {
        target: 'wss://stream.aisstream.io',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/aisstream/, '/v0/stream'),
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
      // The Guardian Content API — no CORS headers
      '/api/guardian': {
        target: 'https://content.guardianapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/guardian/, ''),
      },
      // ACLED — OAuth token + read API, neither sends CORS headers
      '/api/acled-token': {
        target: 'https://acleddata.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/acled-token/, '/oauth/token'),
      },
      '/api/acled': {
        target: 'https://acleddata.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/acled/, '/api/acled'),
      },
      // GDELT — no CORS headers on either the doc or geo endpoints
      '/api/gdelt': {
        target: 'https://api.gdeltproject.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gdelt/, '/api'),
      },
    },
  },
})
