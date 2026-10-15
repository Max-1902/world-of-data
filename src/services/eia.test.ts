import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse } from '../test/helpers'

async function load() {
  vi.resetModules()
  return import('./eia')
}

const rows = (r: unknown[]) => ({ response: { data: r } })

describe('parseEia', () => {
  it('reads period/value rows, accepts numeric strings, sorts by date and keeps the unit', async () => {
    const { parseEia } = await load()
    const out = parseEia(rows([
      { period: '2026-10-02', value: '424134', units: 'MBBL' },
      { period: '2026-09-25', value: 426000, units: 'MBBL' },
    ]))!
    expect(out.points.map(p => [p.period, p.value])).toEqual([['2026-09-25', 426000], ['2026-10-02', 424134]])
    expect(out.unit).toBe('MBBL')
  })

  it('drops malformed rows instead of turning them into zeros', async () => {
    const { parseEia } = await load()
    const out = parseEia(rows([
      { period: '2026-10-02', value: null }, { period: '2026-10-02', value: '' }, { period: 'last week', value: 5 },
      { value: 7 }, null, 'x', { period: '2026-09-25', value: 'n/a' }, { period: '2026-09-18', value: 3 },
    ]))!
    expect(out.points.map(p => p.value)).toEqual([3])
  })

  it('returns null when there is no data array', async () => {
    const { parseEia } = await load()
    expect(parseEia({})).toBeNull()
    expect(parseEia(null)).toBeNull()
    expect(parseEia({ response: { data: 'nope' } })).toBeNull()
  })
})

describe('fetchEiaSeries', () => {
  beforeEach(() => { vi.useRealTimers() })

  it('returns the weekly points through the /api/eia proxy', async () => {
    const f = mockFetch(() => jsonResponse(rows([{ period: '2026-10-02', value: 3500, units: 'BCF' }])))
    const { fetchEiaSeries } = await load()
    const r = await fetchEiaSeries('NG.NW2_EPG0_SWO_R48_BCF.W')
    expect(r).toMatchObject({ status: 'ok', unit: 'BCF' })
    expect(String(f.mock.calls[0][0])).toBe('/api/eia?series=NG.NW2_EPG0_SWO_R48_BCF.W')
  })

  it('distinguishes "not configured" from an error', async () => {
    mockFetch(() => jsonResponse({ error: { code: 'not_configured', message: 'x' } }, { status: 503 }))
    const { fetchEiaSeries } = await load()
    expect(await fetchEiaSeries('PET.WCESTUS1.W')).toEqual({ status: 'not_configured' })
  })

  it('reports HTTP errors with the status and EIA message', async () => {
    mockFetch(() => jsonResponse({ error: 'Series not found' }, { status: 404 }))
    const { fetchEiaSeries } = await load()
    const r = await fetchEiaSeries('PET.WCESTUS1.W')
    expect(r.status).toBe('error')
    expect(r.status === 'error' && r.message).toMatch(/HTTP 404: Series not found/)
  })

  it('reports an empty or unexpected payload as an error, not as data', async () => {
    mockFetch(() => jsonResponse(rows([])))
    const { fetchEiaSeries } = await load()
    expect((await fetchEiaSeries('PET.WCESTUS1.W')).status).toBe('error')
    mockFetch(() => jsonResponse({ unexpected: true }))
    expect((await fetchEiaSeries('PET.WGTSTUS1.W')).status).toBe('error')
  })

  it('reports network failure, and retries after an error instead of caching it', async () => {
    mockFetch(() => { throw new TypeError('Failed to fetch') })
    const { fetchEiaSeries } = await load()
    const r = await fetchEiaSeries('PET.WCESTUS1.W')
    expect(r.status === 'error' && r.message).toMatch(/Could not reach EIA/)
    const f = mockFetch(() => jsonResponse(rows([{ period: '2026-10-02', value: 1 }])))
    expect((await fetchEiaSeries('PET.WCESTUS1.W')).status).toBe('ok')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('caches a successful series for an hour', async () => {
    vi.useFakeTimers()
    const f = mockFetch(() => jsonResponse(rows([{ period: '2026-10-02', value: 1 }])))
    const { fetchEiaSeries } = await load()
    await fetchEiaSeries('PET.WDISTUS1.W')
    await fetchEiaSeries('PET.WDISTUS1.W')
    expect(f).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60 * 60 * 1000 + 1)
    await fetchEiaSeries('PET.WDISTUS1.W')
    expect(f).toHaveBeenCalledTimes(2)
  })
})
