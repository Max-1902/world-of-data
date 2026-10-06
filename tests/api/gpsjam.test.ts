import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler, { parseCsv, percentBad, utcDay, resetCache } from '../../api/gpsjam'
import { mockReq, mockRes } from './helpers'

const HEADER = 'hex,count_good_aircraft,count_bad_aircraft'
const CELL_A = '8400527ffffffff'
const CELL_B = '840058bffffffff'
const CELL_C = '8400e17ffffffff'

describe('percentBad', () => {
  it("uses GPSJAM's formula, damping a single bad aircraft to zero", () => {
    expect(percentBad(9, 1)).toBe(0)
    expect(percentBad(8, 3)).toBeCloseTo(100 * 2 / 11)
    expect(percentBad(0, 0)).toBe(0)
  })
})

describe('parseCsv', () => {
  it('keeps only cells at or above 2% degraded and skips the header, junk and invalid rows', () => {
    const cells = parseCsv([
      HEADER,
      `${CELL_A},50,0`,            // clean
      `${CELL_B},90,11`,           // 100*10/101 ≈ 9.9% → kept (elevated)
      `${CELL_C},0,5`,             // 80% → kept
      '8400527ffffffff,1,1',       // single bad aircraft: 0% → dropped
      'not-a-cell,5,5',            // invalid H3 index
      `${CELL_A},x,5`,             // non-numeric
      `${CELL_A},-1,5`,            // negative
      '',
    ].join('\n'))
    expect(cells).toEqual([
      { h: CELL_B, good: 90, bad: 11 },
      { h: CELL_C, good: 0, bad: 5 },
    ])
  })
})

describe('utcDay', () => {
  it('formats the UTC day N days back', () => {
    const now = Date.UTC(2026, 9, 6, 0, 30)
    expect(utcDay(1, now)).toBe('2026-10-05')
    expect(utcDay(2, now)).toBe('2026-10-04')
  })
})

describe('GET /api/gpsjam', () => {
  beforeEach(() => { resetCache(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.UTC(2026, 9, 6, 0, 30)) })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  const csv = `${HEADER}\n${CELL_C},0,5\n${CELL_A},50,0\n`

  it('falls back to the newest published day (404 for yesterday) and returns only affected cells', async () => {
    const fn = vi.fn(async (url: string) => url.includes('2026-10-05')
      ? new Response('nope', { status: 404 })
      : new Response(csv, { status: 200 }))
    vi.stubGlobal('fetch', fn)
    const r = mockRes()
    await handler(mockReq(), r.res)
    expect(r.statusCode()).toBe(200)
    expect(r.body()).toEqual({ date: '2026-10-04', cells: [{ h: CELL_C, good: 0, bad: 5 }] })
    expect(fn.mock.calls.map(c => c[0])).toEqual([
      'https://gpsjam.org/data/2026-10-05-h3_4.csv',
      'https://gpsjam.org/data/2026-10-04-h3_4.csv',
    ])
    expect(r.headers()['cache-control']).toContain('s-maxage=3600')
  })

  it('only ever requests the fixed gpsjam.org file shape — client input cannot steer the upstream URL', async () => {
    const fn = vi.fn(async () => new Response(csv, { status: 200 }))
    vi.stubGlobal('fetch', fn)
    await handler(mockReq({ query: { date: '../../etc/passwd', url: 'https://evil.example' } }), mockRes().res)
    for (const [url] of fn.mock.calls as unknown as [string][]) expect(url).toMatch(/^https:\/\/gpsjam\.org\/data\/\d{4}-\d{2}-\d{2}-h3_4\.csv$/)
  })

  it('serves repeat requests from memory instead of hitting upstream again', async () => {
    const fn = vi.fn(async () => new Response(csv, { status: 200 }))
    vi.stubGlobal('fetch', fn)
    await handler(mockReq(), mockRes().res)
    await handler(mockReq(), mockRes().res)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('502s when no recent day is published, on upstream errors, and on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    let r = mockRes(); await handler(mockReq(), r.res)
    expect(r.statusCode()).toBe(502)

    resetCache()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    r = mockRes(); await handler(mockReq(), r.res)
    expect(r.statusCode()).toBe(502)

    resetCache()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom') }))
    r = mockRes(); await handler(mockReq(), r.res)
    expect(r.statusCode()).toBe(502)
    expect(JSON.stringify(r.body())).toContain('boom')
  })

  it('rejects non-GET methods', async () => {
    const r = mockRes(); await handler(mockReq({ method: 'POST' }), r.res)
    expect(r.statusCode()).toBe(405)
  })
})
