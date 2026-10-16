import { describe, it, expect } from 'vitest'
import { matchCountry } from './parts'

describe('matchCountry', () => {
  it('does not treat a short label as a prefix of another country', () => {
    // Regression: "ukraine".includes("uk") listed UK bases and reactors under Ukraine.
    expect(matchCountry('UK', 'ukraine')).toBe(false)
    expect(matchCountry('US', 'russia')).toBe(false)
    expect(matchCountry('Niger', 'nigeria')).toBe(false)
    expect(matchCountry('Mali', 'somalia')).toBe(false)
    expect(matchCountry('Sudan', 'south sudan')).toBe(false)
  })

  it('matches dataset abbreviations to full map names', () => {
    expect(matchCountry('UK', 'united kingdom')).toBe(true)
    expect(matchCountry('US', 'united states of america')).toBe(true)
    expect(matchCountry('S.Korea', 'south korea')).toBe(true)
    expect(matchCountry('UAE', 'united arab emirates')).toBe(true)
    expect(matchCountry('Ukraine', 'ukraine')).toBe(true)
  })

  it('matches either side of a shared label', () => {
    expect(matchCountry('Zambia/Zimbabwe', 'zimbabwe')).toBe(true)
    expect(matchCountry('Zambia/Zimbabwe', 'zambia')).toBe(true)
    expect(matchCountry('Zambia/Zimbabwe', 'malawi')).toBe(false)
  })

  it('falls back to whole-word names when a label has no ISO code', () => {
    expect(matchCountry('Guam', 'guam')).toBe(true)
    expect(matchCountry('Guam', 'germany')).toBe(false)
  })
})
