import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installLocalStorage } from '../test/helpers'
import type { ForecastRecord } from '../utils/forecastRecord'

const rec = (issued: string, last = 0.5, key = 'DE|g'): ForecastRecord => ({
  key, issued, model: 'ar', tail: [{ year: 2024, value: last }], points: [{ year: 2025, value: 1, lo: 0, hi: 2 }],
})
const load = async () => { vi.resetModules(); return import('./forecastLog') }

describe('forecastLog', () => {
  beforeEach(() => { installLocalStorage() })

  it('records the first view, then keeps one record while the inputs stay the same', async () => {
    const { remember, recordsFor } = await load()
    expect(remember(rec('2026-10-27'))).toEqual({ previous: null, since: '2026-10-27' })
    expect(remember(rec('2026-11-02'))).toEqual({ previous: null, since: '2026-10-27' })
    expect(recordsFor('DE|g')).toHaveLength(1)
  })
  it('adds a record when the inputs change and reports the earlier one as what changed', async () => {
    const { remember, recordsFor } = await load()
    remember(rec('2026-10-27'))
    const r = remember(rec('2027-05-01', 0.9))
    expect(r.previous?.issued).toBe('2026-10-27')
    expect(r.since).toBe('2027-05-01')
    // revisiting with the new inputs still compares against the last *different* record
    expect(remember(rec('2027-05-09', 0.9)).previous?.issued).toBe('2026-10-27')
    expect(recordsFor('DE|g')).toHaveLength(2)
  })
  it('keeps at most 12 records per series', async () => {
    const { remember, recordsFor } = await load()
    for (let i = 0; i < 15; i++) remember(rec(`2026-10-${String(i + 1).padStart(2, '0')}`, i))
    expect(recordsFor('DE|g')).toHaveLength(12)
    expect(recordsFor('DE|g')[0].issued).toBe('2026-10-04')
  })
  it('works without storage: corrupt data reads as empty and a failed write is not an error', async () => {
    localStorage.setItem('ws-forecast-log', '{not json')
    const { recordsFor } = await load()
    expect(recordsFor('DE|g')).toEqual([])
    installLocalStorage({ throwOnSet: true })
    const { remember } = await load()
    expect(() => remember(rec('2026-10-27'))).not.toThrow()
  })
})
