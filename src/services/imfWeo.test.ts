import { describe, it, expect, vi } from 'vitest'
import { jsonResponse, mockFetch } from '../test/helpers'

const PAYLOAD = { indicator: 'NGDP_RPCH', label: 'Real GDP growth', unit: '%', vintage: 'World Economic Outlook (October 2026)', lastModified: '2026-10-08', values: { DEU: { '2025': 0.2, '2026': 1.3, '2027': 1.4 } } }
const load = async () => { vi.resetModules(); return import('./imfWeo') }

describe('fetchWeo', () => {
  it('reads one indicator through the proxy and caches it', async () => {
    const fn = mockFetch(() => jsonResponse(PAYLOAD))
    const { fetchWeo } = await load()
    expect((await fetchWeo('NGDP_RPCH'))?.vintage).toContain('October 2026')
    await fetchWeo('NGDP_RPCH')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(String(fn.mock.calls[0][0])).toBe('/api/imf-weo?indicator=NGDP_RPCH')
  })
  it('notes the edition and how many economies it covers', async () => {
    mockFetch(() => jsonResponse(PAYLOAD))
    const { fetchWeo } = await load()
    await fetchWeo('NGDP_RPCH')
    const { healthTracker } = await import('./sourceHealth')
    expect(healthTracker.getNotes().get('imfweo')).toEqual({ asOf: 'World Economic Outlook (October 2026)', coverage: '1 economies' })
  })
  it('returns null on HTTP errors, malformed payloads and network failure', async () => {
    mockFetch(() => jsonResponse({ error: 'x' }, { status: 502 }))
    expect(await (await load()).fetchWeo('LUR')).toBeNull()
    mockFetch(() => jsonResponse({ values: 'nope' }))
    expect(await (await load()).fetchWeo('LUR')).toBeNull()
    mockFetch(() => { throw new TypeError('fetch failed') })
    expect(await (await load()).fetchWeo('LUR')).toBeNull()
  })
})

describe('weoPoints / vintageYear', () => {
  it('marks years from the edition year on as projections and skips missing years', async () => {
    const { weoPoints, vintageYear } = await load()
    expect(vintageYear('World Economic Outlook (October 2026)')).toBe(2026)
    expect(vintageYear('World Economic Outlook (edition not stated)')).toBeNull()
    expect(weoPoints(PAYLOAD as never, 'DEU', [2025, 2026, 2028])).toEqual([
      { year: 2025, value: 0.2, projection: false },
      { year: 2026, value: 1.3, projection: true },
    ])
    expect(weoPoints(PAYLOAD as never, 'FRA', [2026])).toEqual([])
  })
})
