// Runs the api/*.ts handlers inside the desktop app, behind its app:// scheme, so the page's /api/*
// requests work with no server, no open port and the user's own keys (desktop/keys.ts). The same
// handler files serve `npm run dev` (vite.api-dev.ts); this is the Request → Response version of
// that adapter, with the routes listed statically so esbuild can bundle them.
//
// It understands the two handler shapes used in api/:
//   - Node style:  export default (req: VercelRequest, res: VercelResponse)
//   - Edge style:  export default (req: Request) => Response   (config.runtime === 'edge')
import * as acledToken from '../api/acled-token'
import * as cloudflareRadar from '../api/cloudflare-radar'
import * as eia from '../api/eia'
import * as gpsjam from '../api/gpsjam'
import * as imfWeo from '../api/imf-weo'
import * as nyt from '../api/nyt'
import * as openskyToken from '../api/opensky-token'
import * as rss from '../api/rss'
import * as openrouterAllowed from '../api/openrouter/allowed'
import * as openrouterModels from '../api/openrouter/models'
import * as openrouterChat from '../api/openrouter/chat/completions'
import * as acled from '../api/acled/[...path]'
import * as finnhub from '../api/finnhub/[...path]'
import * as firms from '../api/firms/[...path]'
import * as opensky from '../api/opensky/[...path]'

type Handler = (...args: never[]) => unknown
interface ApiModule { default: Handler; config?: { runtime?: string } }

/** File path under api/ (no extension) → module. tests check this against the files on disk. */
export const ROUTES: Record<string, ApiModule> = {
  'acled-token': acledToken,
  'cloudflare-radar': cloudflareRadar,
  'eia': eia,
  'gpsjam': gpsjam,
  'imf-weo': imfWeo,
  'nyt': nyt,
  'opensky-token': openskyToken,
  'rss': rss,
  'openrouter/allowed': openrouterAllowed,
  'openrouter/models': openrouterModels,
  'openrouter/chat/completions': openrouterChat,
  'acled/[...path]': acled,
  'finnhub/[...path]': finnhub,
  'firms/[...path]': firms,
  'opensky/[...path]': opensky,
} as unknown as Record<string, ApiModule>

/** Keyless upstreams that `npm run dev` reaches through Vite's server.proxy (vite.config.ts). */
const PASSTHROUGH: Record<string, string> = {
  hexdb: 'https://hexdb.io',
  planespotters: 'https://api.planespotters.net',
  gdelt: 'https://api.gdeltproject.org/api',
}

/** Same precedence as vite.api-dev.ts: api/a/b.ts, then the nearest [...path] catch-all. */
export function resolveRoute(segments: string[]): { mod: ApiModule; params: Record<string, string[]> } | null {
  if (segments.length === 0) return null
  const exact = ROUTES[segments.join('/')]
  if (exact) return { mod: exact, params: {} }
  for (let i = segments.length - 1; i >= 0; i--) {
    const mod = ROUTES[[...segments.slice(0, i), '[...path]'].join('/')]
    if (mod) return { mod, params: { path: segments.slice(i) } }
  }
  return null
}

function parseBody(text: string, contentType: string): unknown {
  if (!text) return undefined
  if (contentType.includes('application/json')) { try { return JSON.parse(text) } catch { return text } }
  if (contentType.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text))
  return text
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function runNodeHandler(handler: Handler, req: Request, url: URL, params: Record<string, string[]>): Promise<Response> {
  const query: Record<string, string | string[]> = {}
  url.searchParams.forEach((v, k) => { query[k] = k in query ? [...[query[k]].flat(), v] : v })
  Object.assign(query, params)
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => { headers[k] = v })
  const text = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text()
  const vreq = { method: req.method, url: url.pathname + url.search, headers, query, body: parseBody(text, headers['content-type'] ?? '') }

  let statusCode = 200
  let ended = false
  const outHeaders = new Headers()
  const chunks: Uint8Array[] = []
  const push = (data: unknown) => {
    if (data === undefined || data === null) return
    chunks.push(data instanceof Uint8Array ? data : new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data)))
  }
  const vres = {
    get statusCode() { return statusCode },
    set statusCode(c: number) { statusCode = c },
    get headersSent() { return ended },
    get writableEnded() { return ended },
    status(c: number) { statusCode = c; return vres },
    setHeader(k: string, v: string | number | string[]) { outHeaders.set(k, Array.isArray(v) ? v.join(', ') : String(v)); return vres },
    getHeader(k: string) { return outHeaders.get(k) ?? undefined },
    write(data: unknown) { push(data); return true },
    end(data?: unknown) { push(data); ended = true; return vres },
    send(data: unknown) { return vres.end(data) },
    json(obj: unknown) { outHeaders.set('Content-Type', 'application/json'); return vres.end(JSON.stringify(obj)) },
  }
  await (handler as (a: unknown, b: unknown) => unknown)(vreq, vres)

  const size = chunks.reduce((n, c) => n + c.length, 0)
  const body = new Uint8Array(size)
  let at = 0
  for (const c of chunks) { body.set(c, at); at += c.length }
  const noBody = statusCode === 204 || statusCode === 304 || req.method === 'HEAD'
  return new Response(noBody ? null : body, { status: statusCode, headers: outHeaders })
}

/** Answers one /api/* request from the page. Never throws: failures come back as JSON errors. */
export async function handleApi(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const segments = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean).map(decodeURIComponent)
  try {
    const upstream = PASSTHROUGH[segments[0]]
    if (upstream) {
      if (req.method !== 'GET') return json(405, { error: 'GET only' })
      const res = await fetch(`${upstream}/${segments.slice(1).map(encodeURIComponent).join('/')}${url.search}`)
      return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/octet-stream' } })
    }
    const route = resolveRoute(segments)
    if (!route) return json(404, { error: 'No such API route' })
    if (route.mod.config?.runtime === 'edge') return await (route.mod.default as (r: Request) => Promise<Response>)(req)
    return await runNodeHandler(route.mod.default, req, url, route.params)
  } catch (err) {
    console.error(`[api] ${url.pathname}: ${err instanceof Error ? err.message : String(err)}`)
    return json(500, { error: 'api handler failed' })
  }
}
