import { describe, it, expect, vi } from 'vitest'
import { jsonResponse, mockFetch } from '../test/helpers'

const stat = (periods: string[], values: number[], updated = '2026-10-27T11:00:00+0100') => ({
  updated, value: Object.fromEntries(values.map((v, i) => [String(i), v])),
  dimension: { time: { category: { index: Object.fromEntries(periods.map((p, i) => [p, i])) } } },
})
const load = async () => { vi.resetModules(); return import('./eurostatNowcast') }

describe('fetchNowcastData', () => {
  it('reads GDP and industrial production for one economy, with Eurostat\'s update stamps, and caches them', async () => {
    const fn = mockFetch(url => url.includes('namq_10_gdp') ? jsonResponse(stat(['2026-Q1', '2026-Q2'], [0.4, 0.3])) : jsonResponse(stat(['2026-07', '2026-08'], [90.3, 90.7])))
    const { fetchNowcastData } = await load()
    const d = await fetchNowcastData('DE')
    expect([...d.gdp]).toEqual([['2026-Q1', 0.4], ['2026-Q2', 0.3]])
    expect(d.ip.get('2026-08')).toBe(90.7)
    expect(d.updated.gdp).toContain('2026-10-27')
    for (const [u] of fn.mock.calls) expect(String(u)).toMatch(/geo=DE&/)
    await fetchNowcastData('DE')
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('rejects on HTTP errors and unexpected payloads, and retries on the next call', async () => {
    mockFetch(() => jsonResponse({}, { status: 503 }))
    let m = await load()
    await expect(m.fetchNowcastData('FR')).rejects.toThrow('Eurostat HTTP 503')
    mockFetch(() => jsonResponse({ error: { label: 'bad' } }))
    m = await load()
    await expect(m.fetchNowcastData('FR')).rejects.toThrow('Unexpected Eurostat response shape')
  })
  it('lists the 27 EU members with Eurostat codes (Greece is EL)', async () => {
    const { NOWCAST_ECONOMIES } = await load()
    expect(NOWCAST_ECONOMIES).toHaveLength(27)
    expect(NOWCAST_ECONOMIES.find(e => e.name === 'Greece')?.geo).toBe('EL')
  })
})
