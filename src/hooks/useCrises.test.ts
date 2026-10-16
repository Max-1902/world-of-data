import { describe, it, expect } from 'vitest'
import { BASELINE, mergeWithBaseline } from './useCrises'
import type { CrisisEvent } from '../types'

const ev = (id: string, type: CrisisEvent['type'], lat: number, lng: number, country = 'X'): CrisisEvent => ({
  id, title: id, type, severity: 'critical', latitude: lat, longitude: lng, country, date: '2026-10-14', description: '', source: 'ACLED',
})

describe('mergeWithBaseline', () => {
  it.each(BASELINE.map(b => [b.id, b] as const))('never drops a live event in favour of the hand-entered marker %s', (_id, b) => {
    const live = ev(`live-${b.id}`, b.type, b.latitude + 0.1, b.longitude + 0.1, b.country)
    const merged = mergeWithBaseline([live])
    expect(merged).toContainEqual(live)
    expect(merged.some(m => m.id === b.id)).toBe(false) // the marker yields to real data
  })

  it('regression: ACLED battles in Khartoum, Goma and Gaza were replaced by one marker dated today', () => {
    const live = [ev('khartoum', 'war', 15.6, 32.53, 'Sudan'), ev('goma', 'war', -1.68, 29.22, 'Democratic Republic of Congo'), ev('gaza', 'war', 31.52, 34.45, 'Palestine')]
    const merged = mergeWithBaseline(live)
    for (const e of live) expect(merged).toContainEqual(e)
  })

  it('keeps markers where there is no live event of their type nearby', () => {
    expect(mergeWithBaseline([])).toEqual(BASELINE)
    const far = ev('far', 'war', -60, -150)
    expect(mergeWithBaseline([far])).toEqual([...BASELINE, far])
  })

  it('a live event of a different type does not hide a marker', () => {
    const b = BASELINE[0]
    const protest = ev('p', 'protest', b.latitude, b.longitude)
    expect(mergeWithBaseline([protest]).some(m => m.id === b.id)).toBe(true)
  })
})
