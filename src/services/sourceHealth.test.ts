import { describe, it, expect, vi } from 'vitest'
import {
  sourceForUrl, statusOf, createHealthTracker, installFetchObserver, healthSummary, SOURCE_RULES,
} from './sourceHealth'

describe('sourceForUrl', () => {
  it.each([
    ['/api/acled/read?x=1', 'acled'],
    ['https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson', 'usgs'],
    ['https://overpass.openstreetmap.fr/api/interpreter', 'osm'],
    ['/api/rss?url=https%3A%2F%2Fexample.com', 'rss'],
    ['/api/openrouter/chat', 'ai'],
  ])('%s -> %s', (url, id) => {
    expect(sourceForUrl(url)?.id).toBe(id)
  })
  it('ignores unknown URLs and has unique ids', () => {
    expect(sourceForUrl('https://example.com/x')).toBeNull()
    const ids = SOURCE_RULES.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('statusOf', () => {
  it('classifies recent outcomes', () => {
    expect(statusOf([true, true])).toBe('ok')
    expect(statusOf([false, false])).toBe('down')
    expect(statusOf([true, false])).toBe('degraded')
  })
})

describe('createHealthTracker', () => {
  const rule = { id: 'a', label: 'A' }
  it('records outcomes, timestamps and errors, and recovers after successes push failures out of the window', () => {
    let t = 100
    const tr = createHealthTracker(() => t)
    tr.record(rule, false, 'HTTP 500')
    expect(tr.getAll()[0]).toMatchObject({ status: 'down', lastFail: 100, lastError: 'HTTP 500', lastOk: null })
    t = 200
    for (let i = 0; i < 10; i++) tr.record(rule, true)
    expect(tr.getAll()[0]).toMatchObject({ status: 'ok', lastOk: 200, okCount: 10, attempts: 10 })
  })
  it('sorts unhealthy sources first and gives subscribers a new array each change', () => {
    const tr = createHealthTracker()
    const l = vi.fn()
    tr.subscribe(l)
    tr.record({ id: 'z', label: 'Zed' }, true)
    tr.record({ id: 'b', label: 'Bee' }, false)
    const all = tr.getAll()
    expect(all.map(s => s.id)).toEqual(['b', 'z'])
    tr.record({ id: 'z', label: 'Zed' }, true)
    expect(tr.getAll()).not.toBe(all)
    expect(l).toHaveBeenCalledTimes(3)
  })
})

describe('installFetchObserver', () => {
  function setup(impl: typeof fetch) {
    const target = { fetch: impl }
    const tracker = createHealthTracker()
    const uninstall = installFetchObserver(tracker, target)
    return { target, tracker, uninstall }
  }

  it('records ok and HTTP failures for known sources and passes the response through untouched', async () => {
    const res = new Response('x', { status: 503 })
    const { target, tracker } = setup(vi.fn(async () => res) as unknown as typeof fetch)
    expect(await target.fetch('/api/acled/read')).toBe(res)
    expect(tracker.getAll()[0]).toMatchObject({ id: 'acled', status: 'down', lastError: 'HTTP 503' })
  })

  it('records network errors and rethrows them', async () => {
    const { target, tracker } = setup(vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch)
    await expect(target.fetch('https://earthquake.usgs.gov/x')).rejects.toThrow('Failed to fetch')
    expect(tracker.getAll()[0]).toMatchObject({ id: 'usgs', status: 'down', lastError: 'Failed to fetch' })
  })

  it('ignores caller aborts but counts timeouts', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    let err: Error = abort
    const { target, tracker } = setup(vi.fn(async () => { throw err }) as unknown as typeof fetch)
    await expect(target.fetch('/api/rss?u=1')).rejects.toBe(abort)
    expect(tracker.getAll()).toHaveLength(0)
    err = timeout
    await expect(target.fetch('/api/rss?u=1')).rejects.toBe(timeout)
    expect(tracker.getAll()[0]).toMatchObject({ id: 'rss', status: 'down' })
  })

  it('does not record unknown URLs, and uninstall restores the original fetch', async () => {
    const orig = vi.fn(async () => new Response('ok')) as unknown as typeof fetch
    const { target, tracker, uninstall } = setup(orig)
    await target.fetch('https://example.com/')
    expect(tracker.getAll()).toHaveLength(0)
    uninstall()
    expect(target.fetch).toBe(orig)
  })

  it('accepts URL and Request inputs', async () => {
    const { target, tracker } = setup(vi.fn(async () => new Response('ok')) as unknown as typeof fetch)
    await target.fetch(new URL('https://api.worldbank.org/v2/x'))
    await target.fetch(new Request('https://api.unhcr.org/x'))
    expect(tracker.getAll().map(s => s.id).sort()).toEqual(['unhcr', 'worldbank'])
  })
})

describe('healthSummary', () => {
  it('lists only unhealthy sources, and is empty when nothing was observed', () => {
    const tr = createHealthTracker()
    expect(healthSummary(tr.getAll())).toBe('')
    tr.record({ id: 'a', label: 'A' }, true)
    expect(healthSummary(tr.getAll())).toContain('responding normally')
    tr.record({ id: 'b', label: 'B' }, false, 'HTTP 429')
    expect(healthSummary(tr.getAll())).toBe('  • B: DOWN (HTTP 429)')
  })
})
