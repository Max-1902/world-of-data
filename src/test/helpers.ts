import { vi } from 'vitest'

/** Build a JSON `Response` for use with a mocked `fetch`. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

export function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init })
}

/** Replace global fetch with a mock. No test can reach the real network through it. */
export function mockFetch(impl?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!impl) throw new Error(`Unexpected fetch: ${String(input)}`)
    return impl(String(input), init)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

/** In-memory localStorage stand-in (Node has none). */
export function installLocalStorage(opts: { throwOnSet?: boolean } = {}) {
  const store = new Map<string, string>()
  const storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new Error('QuotaExceededError')
      store.set(k, String(v))
    },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
  vi.stubGlobal('localStorage', storage)
  return { storage, store }
}

/** Stream an SSE-style body in caller-chosen chunks (to test chunk-boundary handling). */
export function streamResponse(chunks: string[], init: ResponseInit = {}): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
  return new Response(body, { status: 200, ...init })
}

/** Silence expected console noise from services that log on failure paths. */
export function quietConsole() {
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, m).mockImplementation(() => {})
  }
}
