import { describe, it, expect, vi } from 'vitest'
import { jsonResponse, mockFetch } from '../test/helpers'

const load = async () => { vi.resetModules(); return import('./exportSensitivity') }
// World Bank rows: export growth swings, GDP growth = 1 + 0.4 × export growth, for every requested country
function rows(url: string) {
  const countries = decodeURIComponent(url.split('/country/')[1].split('/')[0]).split(';')
  const exp = url.includes('NE.EXP.GNFS.KD.ZG')
  return [{ page: 1 }, countries.flatMap(c => Array.from({ length: 25 }, (_, i) => {
    const e = Math.sin(i * 1.3) * 6 + (c.charCodeAt(0) % 3)
    return { country: { id: c, value: c }, indicator: { value: 'x' }, date: String(1995 + i), value: exp ? e : 1 + 0.4 * e }
  }))]
}

describe('loadSensitivities', () => {
  it('asks in batches of 15 countries, estimates every economy, and caches the result', async () => {
    const fn = mockFetch(url => jsonResponse(rows(url)))
    const { loadSensitivities } = await load()
    const m = await loadSensitivities()
    expect(m.size).toBe(45)
    expect(m.get('DE')!.slope).toBeCloseTo(0.4, 3)
    expect(fn).toHaveBeenCalledTimes(6)   // 3 batches × 2 series
    for (const [u] of fn.mock.calls) expect(decodeURIComponent(String(u)).split('/country/')[1].split('/')[0].split(';').length).toBeLessThanOrEqual(15)
    await loadSensitivities()
    expect(fn).toHaveBeenCalledTimes(6)
  })
  it('rejects on a failed request and retries on the next call', async () => {
    let fail = true
    mockFetch(url => fail ? jsonResponse({}, { status: 500 }) : jsonResponse(rows(url)))
    const { loadSensitivities } = await load()
    await expect(loadSensitivities()).rejects.toThrow('World Bank HTTP 500')
    fail = false
    expect((await loadSensitivities()).size).toBe(45)
  })
})
