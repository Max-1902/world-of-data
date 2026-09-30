import { vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface MockRes {
  res: VercelResponse
  statusCode: () => number | undefined
  body: () => unknown
  headers: () => Record<string, string>
  ended: () => boolean
}

/** Chainable stand-in for VercelResponse that records what the handler did. */
export function mockRes(): MockRes {
  let status: number | undefined
  let body: unknown
  let ended = false
  const headers: Record<string, string> = {}
  const res: Record<string, unknown> = {}
  res.status = vi.fn((c: number) => { status = c; return res })
  res.json = vi.fn((b: unknown) => { body = b; ended = true; return res })
  res.send = vi.fn((b: unknown) => { body = b; ended = true; return res })
  res.end = vi.fn(() => { ended = true; return res })
  res.setHeader = vi.fn((k: string, v: string) => { headers[k.toLowerCase()] = v; return res })
  return { res: res as unknown as VercelResponse, statusCode: () => status, body: () => body, headers: () => headers, ended: () => ended }
}

export function mockReq(o: { method?: string; query?: Record<string, string | string[]>; url?: string; headers?: Record<string, string> } = {}): VercelRequest {
  return { method: 'GET', query: {}, headers: {}, url: '/', ...o } as unknown as VercelRequest
}

/** Mock the upstream call the handler makes; returns the spy so tests can inspect the outgoing request. */
export function mockUpstream(body: string | object = {}, init: ResponseInit = {}) {
  const fn = vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' }, ...init,
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}
