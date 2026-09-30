/*
 * Service worker: lets the app shell open offline and keeps the last good snapshot of
 * same-origin data (/api/*, /data/*) for when a feed is down.
 *
 * Deliberately narrow:
 *  - GET + same-origin only. Third-party feeds (USGS, OpenSky, …) are never cached here, and
 *    POSTs (the AI analyst) pass straight through.
 *  - Snapshots served because the network failed carry `x-served-from: sw-cache` and
 *    `x-cached-at`, so the UI can label them as stale rather than live.
 * Bump VERSION to drop every old cache on the next activation.
 */
const VERSION = 'wm-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const DATA = `${VERSION}-data`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.add('/')).catch(() => {}).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName, markStale) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res.ok) {
      const headers = new Headers(res.headers)
      headers.set('x-cached-at', new Date().toISOString())
      cache.put(request, new Response(await res.clone().blob(), { status: res.status, statusText: res.statusText, headers }))
    }
    return res
  } catch (err) {
    const hit = await cache.match(request)
    if (!hit) throw err
    if (!markStale) return hit
    const headers = new Headers(hit.headers)
    headers.set('x-served-from', 'sw-cache')
    return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers })
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Any route falls back to the cached shell when offline.
    event.respondWith(
      fetch(request).then((res) => {
        if (res.ok) caches.open(SHELL).then((c) => c.put('/', res.clone()))
        return res
      }).catch(() => caches.match('/', { cacheName: SHELL }).then((r) => r || Response.error())),
    )
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS)) // content-hashed, so immutable
  } else if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request, DATA, true))
  }
})
