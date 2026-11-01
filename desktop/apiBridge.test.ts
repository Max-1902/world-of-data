import { describe, it, expect, vi } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { ROUTES, handleApi, resolveRoute } from './apiBridge'
import { jsonResponse, mockFetch, quietConsole } from '../src/test/helpers'

const API_DIR = path.resolve(__dirname, '../api')
const ORIGIN = 'app://world-of-data'

function apiFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return apiFiles(full, `${prefix}${name}/`)
    return name.endsWith('.ts') ? [`${prefix}${name.slice(0, -3)}`] : []
  })
}

describe('desktop API bridge routes', () => {
  it('lists every handler under api/, so the desktop app has the same endpoints as dev', () => {
    expect(Object.keys(ROUTES).sort()).toEqual(apiFiles(API_DIR).sort())
  })

  it('prefers an exact file, then the nearest catch-all (same as vite.api-dev.ts)', () => {
    expect(resolveRoute(['eia'])?.mod).toBe(ROUTES.eia)
    expect(resolveRoute(['openrouter', 'chat', 'completions'])?.mod).toBe(ROUTES['openrouter/chat/completions'])
    expect(resolveRoute(['acled', 'read', 'x'])).toEqual({ mod: ROUTES['acled/[...path]'], params: { path: ['read', 'x'] } })
    expect(resolveRoute(['nope'])).toBeNull()
    expect(resolveRoute([])).toBeNull()
  })
})

describe('handleApi', () => {
  it('runs a Node-style handler with the query and returns its status, headers and body', async () => {
    vi.stubEnv('EIA_API_KEY', 'SECRET')
    const fetchMock = mockFetch(() => jsonResponse({ echo: 'api_key=SECRET', series: [] }))
    const res = await handleApi(new Request(`${ORIGIN}/api/eia?series=PET.WCESTUS1.W`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const text = await res.text()
    expect(text).not.toContain('SECRET')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v2/seriesid/PET.WCESTUS1.W')
  })

  it("passes a handler's own error status through", async () => {
    vi.stubEnv('EIA_API_KEY', '')
    const res = await handleApi(new Request(`${ORIGIN}/api/eia?series=PET.WCESTUS1.W`))
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: { code: 'not_configured' } })
  })

  it('gives catch-all handlers the remaining segments and the original query string', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ data: [] }))
    const res = await handleApi(new Request(`${ORIGIN}/api/acled/read?limit=5`, { headers: { authorization: 'Bearer T' } }))
    expect(res.status).toBe(200)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://acleddata.com/api/acled/read?limit=5')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer T')
  })

  it('hands edge-style handlers the Request itself', async () => {
    vi.stubEnv('OPENROUTER_ALLOWED_MODELS', '')
    const res = await handleApi(new Request(`${ORIGIN}/api/openrouter/allowed`))
    expect(res.status).toBe(200)
  })

  it('answers an unknown route with a JSON 404 and no upstream call', async () => {
    const fetchMock = mockFetch()
    const res = await handleApi(new Request(`${ORIGIN}/api/does-not-exist`))
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("forwards the keyless dev proxies (hexdb, planespotters, gdelt) to their upstreams", async () => {
    const fetchMock = mockFetch(() => jsonResponse({ ok: true }))
    await handleApi(new Request(`${ORIGIN}/api/gdelt/v2/doc/doc?query=x`))
    await handleApi(new Request(`${ORIGIN}/api/hexdb/api/v1/aircraft/abc`))
    expect(fetchMock.mock.calls.map(c => String(c[0]))).toEqual([
      'https://api.gdeltproject.org/api/v2/doc/doc?query=x',
      'https://hexdb.io/api/v1/aircraft/abc',
    ])
    expect((await handleApi(new Request(`${ORIGIN}/api/gdelt/x`, { method: 'POST' }))).status).toBe(405)
  })

  it('turns a thrown handler or network failure into a JSON 500 instead of throwing', async () => {
    quietConsole()
    mockFetch(() => { throw new TypeError('network down') })
    const res = await handleApi(new Request(`${ORIGIN}/api/acled/read`))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'api handler failed' })
  })
})
