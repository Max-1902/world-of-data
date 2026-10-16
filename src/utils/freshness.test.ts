import { describe, it, expect } from 'vitest'
import { freshness, MAX_AGE_YEARS, WAR_SINCE } from './freshness'

const NOW = new Date(Date.UTC(2026, 9, 15))

describe('freshness', () => {
  it('flags Ukraine\'s 2020 armed-forces figure as pre-war (regression: 298K shown beside an active-war badge)', () => {
    expect(freshness('2020', 'military', 'UA', NOW)).toMatchObject({ stale: true, label: 'pre-war figure (2020); war since 2022' })
  })

  it('treats a figure from the war\'s first year as pre-war too (IISS data are compiled the November before)', () => {
    expect(freshness(2022, 'military', 'RU', NOW)?.stale).toBe(true)
    expect(freshness(2023, 'military', 'RU', NOW)?.stale).toBe(false)
  })

  it.each(Object.entries(WAR_SINCE))('every figure from before the war in %s is flagged, however recent', (iso2, since) => {
    expect(freshness(since - 1, 'military', iso2, NOW)?.stale).toBe(true)
  })

  it.each(Object.entries(MAX_AGE_YEARS))('a %s value older than %i years is outdated; one at the limit is not', (kind, max) => {
    const k = kind as keyof typeof MAX_AGE_YEARS
    expect(freshness(2026 - max - 1, k, 'DE', NOW)).toMatchObject({ stale: true, label: `outdated: ${2026 - max - 1}` })
    expect(freshness(2026 - max, k, 'DE', NOW)).toMatchObject({ stale: false, label: null })
  })

  it('flags Syria\'s 2019 inflation (latest World Bank value as of 2026-10-15) as outdated', () => {
    expect(freshness('2019', 'macro', 'SY', NOW)?.label).toBe('outdated: 2019')
  })

  it('returns null for a missing year rather than guessing', () => {
    expect(freshness('', 'macro', 'DE', NOW)).toBeNull()
    expect(freshness('n/a', 'macro', 'DE', NOW)).toBeNull()
  })
})
