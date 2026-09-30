// Dev-only Vite plugin: serves the /api/*.ts Vercel functions from plain `npm run dev`,
// so flights (OpenSky), conflict data (ACLED), market data, news keys and the AI Analyst
// work locally without the Vercel CLI, a Vercel login, or `vercel dev`.
//
// It understands the two handler shapes used in api/:
//   - Node style:  export default (req: VercelRequest, res: VercelResponse)
//   - Edge style:  export default (req: Request) => Response   (config.runtime === 'edge')
// and the file routing we use: api/x.ts, api/x/y.ts and api/x/[...path].ts catch-alls.
// Anything under /api that has no matching file falls through to Vite's own proxy (server.proxy).
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'

interface Resolved { file: string; params: Record<string, string | string[]> }

function isFile(p: string) { try { return fs.statSync(p).isFile() } catch { return false } }
function isDir(p: string) { try { return fs.statSync(p).isDirectory() } catch { return false } }

/** api/a.ts → api/a/b.ts → api/a/[...path].ts, most specific first. */
export function resolveApiRoute(segments: string[], dir: string): Resolved | null {
  if (segments.length === 0) return null
  const [head, ...rest] = segments
  if (rest.length === 0 && isFile(path.join(dir, `${head}.ts`))) {
    return { file: path.join(dir, `${head}.ts`), params: {} }
  }
  const sub = path.join(dir, head)
  if (rest.length > 0 && isDir(sub)) {
    const hit = resolveApiRoute(rest, sub)
    if (hit) return hit
  }
  const catchAll = path.join(dir, '[...path].ts')
  if (isFile(catchAll)) return { file: catchAll, params: { path: segments } }
  return null
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function parseBody(raw: Buffer, contentType: string): unknown {
  if (raw.length === 0) return undefined
  const text = raw.toString('utf8')
  if (contentType.includes('application/json')) { try { return JSON.parse(text) } catch { return text } }
  if (contentType.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text))
  return text
}

export function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev',
    apply: 'serve',
    configureServer(server) {
      // Mirror Vercel: server-only keys (no VITE_ prefix) are visible to handlers as process.env.
      const env = loadEnv(server.config.mode, server.config.root, '')
      for (const [k, v] of Object.entries(env)) {
        if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v
      }
      const apiDir = path.join(server.config.root, 'api')

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()
        const segments = url.pathname.slice('/api/'.length).split('/').filter(Boolean).map(decodeURIComponent)
        const route = resolveApiRoute(segments, apiDir)
        if (!route) return next()

        try {
          const mod = await server.ssrLoadModule(route.file)
          const handler = mod.default as (...a: unknown[]) => unknown
          const raw = await readBody(req)
          const isEdge = (mod.config as { runtime?: string } | undefined)?.runtime === 'edge'

          if (isEdge) {
            const headers = new Headers()
            for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
            const method = req.method ?? 'GET'
            const webReq = new Request(url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(raw) })
            const webRes = await handler(webReq) as Response
            res.statusCode = webRes.status
            webRes.headers.forEach((v, k) => res.setHeader(k, v))
            if (!webRes.body) return res.end()
            const reader = webRes.body.getReader()
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              res.write(value)
            }
            return res.end()
          }

          const query: Record<string, string | string[]> = {}
          url.searchParams.forEach((v, k) => { query[k] = k in query ? [...[query[k]].flat(), v] : v })
          Object.assign(query, route.params)
          const vreq = Object.assign(req, { query, body: parseBody(raw, String(req.headers['content-type'] ?? '')) })
          const vres = res as ServerResponse & { status?: unknown; json?: unknown; send?: unknown }
          vres.status = (code: number) => { res.statusCode = code; return vres }
          vres.json = (obj: unknown) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return vres }
          vres.send = (data: unknown) => { res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); return vres }
          await handler(vreq, vres)
          if (!res.writableEnded) res.end()
        } catch (err) {
          server.config.logger.error(`[api-dev] ${url.pathname}: ${err instanceof Error ? err.message : String(err)}`)
          if (!res.headersSent) res.statusCode = 500
          if (!res.writableEnded) res.end(JSON.stringify({ error: 'api-dev handler failed' }))
        }
      })
    },
  }
}
