import { describe, it, expect } from 'vitest'
import { explainChange, sameInputs, scoreRecords, type ForecastRecord } from './forecastRecord'

const rec = (o: Partial<ForecastRecord> = {}): ForecastRecord => ({
  key: 'DE|g', issued: '2026-10-27', model: 'ar',
  tail: [{ year: 2023, value: 0.1 }, { year: 2024, value: -0.3 }],
  points: [{ year: 2025, value: 0.5, lo: -2, hi: 3 }, { year: 2026, value: 1, lo: -3, hi: 5 }],
  imf: { vintage: 'World Economic Outlook (April 2026)', points: [{ year: 2025, value: 0.2 }] },
  ...o,
})

describe('sameInputs', () => {
  it('ignores float noise below display precision, but not a real revision', () => {
    expect(sameInputs(rec(), rec({ tail: [{ year: 2023, value: 0.1 + 1e-9 }, { year: 2024, value: -0.3 }] }))).toBe(true)
    expect(sameInputs(rec(), rec({ tail: [{ year: 2023, value: 0.4 }, { year: 2024, value: -0.3 }] }))).toBe(false)
  })
  it('treats a missing IMF figure as no new edition, but two different editions as new', () => {
    expect(sameInputs(rec(), rec({ imf: undefined }))).toBe(true)
    expect(sameInputs(rec(), rec({ imf: { vintage: 'World Economic Outlook (October 2026)', points: [] } }))).toBe(false)
  })
})

describe('explainChange', () => {
  it('lists new data and revisions as observed, and the forecast move as statistical with its reason', () => {
    const now = rec({
      issued: '2027-05-01',
      tail: [{ year: 2023, value: 0.1 }, { year: 2024, value: -0.5 }, { year: 2025, value: 0.9 }],
      points: [{ year: 2026, value: 1.4, lo: -2, hi: 4 }, { year: 2027, value: 1.5, lo: -3, hi: 5 }],
      imf: { vintage: 'World Economic Outlook (October 2026)', points: [{ year: 2025, value: 0.4 }] },
    })
    const c = explainChange(rec(), now, '%')
    expect(c[0]).toEqual({ kind: 'observed', text: 'New data: 2025 0.9%.' })
    expect(c[1]).toEqual({ kind: 'observed', text: 'Revised by the World Bank: 2024 −0.3 → −0.5%.' })
    expect(c[2].kind).toBe('statistical')
    expect(c[2].text).toBe('Our forecast: 2026 1.0 → 1.4% because of the data changes above.')
    expect(c[3].text).toContain('New IMF edition: World Economic Outlook (April 2026) → World Economic Outlook (October 2026); 2025 0.2 → 0.4%')
  })
  it('says a forecast is unchanged rather than inventing a move, and notes a model switch', () => {
    const c = explainChange(rec(), rec({ model: 'naive' }), '%')
    expect(c.map(x => x.text)).toEqual(['Headline model changed from AR(2) to "no change".', 'Our forecast: 2025 unchanged at 0.5%, 2026 unchanged at 1.0%.'])
  })
})

describe('scoreRecords', () => {
  it('scores only years that now have a figure, once per year and data cutoff, newest record first', () => {
    const a = rec({ issued: '2026-10-27' })
    const dup = rec({ issued: '2026-11-03' })   // same cutoff (2024): must not score 2025 twice
    const b = rec({ issued: '2027-05-01', tail: [{ year: 2025, value: 0.9 }], points: [{ year: 2026, value: 1.2, lo: 0, hi: 2 }], imf: undefined })
    const s = scoreRecords([b, dup, a], [{ x: 2025, y: 0.9 }, { x: 2026, y: 2.5 }])
    expect(s.map(r => [r.issued, r.year, r.horizon, r.inside])).toEqual([
      ['2027-05-01', 2026, 1, false],
      ['2026-10-27', 2025, 1, true],
      ['2026-10-27', 2026, 2, true],
    ])
    expect(s[1].imf).toEqual({ value: 0.2, vintage: 'World Economic Outlook (April 2026)' })
  })
  it('scores nothing before any forecast year has happened', () => {
    expect(scoreRecords([rec()], [{ x: 2024, y: -0.3 }])).toEqual([])
  })
})
