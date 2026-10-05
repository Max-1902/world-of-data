import { describe, it, expect } from 'vitest'
import { extractPlaceCandidates } from './placeExtract'

const names = (t: string) => extractPlaceCandidates(t).map(c => c.name)

describe('extractPlaceCandidates', () => {
  it('puts places introduced by a preposition first', () => {
    const c = extractPlaceCandidates('Explosion heard in Kharkiv as Russia warns Kyiv')
    expect(c[0]).toEqual({ name: 'Kharkiv', kind: 'prep' })
    expect(names('Explosion heard in Kharkiv as Russia warns Kyiv')).toEqual(expect.arrayContaining(['Russia', 'Kyiv']))
  })
  it('tries the whole run, then its words', () => {
    expect(names('Strike near Gaza City').slice(0, 2)).toEqual(['Gaza City', 'Gaza'])
  })
  it('skips sentence-start words, days, months and titles', () => {
    const n = names('Breaking: President Monday in March')
    expect(n).not.toContain('Breaking')
    expect(n).not.toContain('President')
    expect(n).not.toContain('Monday')
    expect(n).not.toContain('March')
  })
  it('expands country abbreviations', () => {
    expect(names('Tariffs hit US exports')).toContain('United States')
  })
  it('returns nothing for lowercase text and caps the list', () => {
    expect(names('nothing capitalised here')).toEqual([])
    expect(extractPlaceCandidates('Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa').length).toBeLessThanOrEqual(6)
  })
})
