import { describe, it, expect } from 'vitest'
import { mentionsCountry, sameCountry, pickCountryHeadlines, linkedCrisisEvents } from './countryBrief'
import type { CrisisEvent, NewsArticle } from '../types'

const NOW = Date.parse('2026-10-04T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString()
const art = (title: string, h: number, extra: Partial<NewsArticle> = {}): NewsArticle =>
  ({ id: title, title, description: '', url: 'https://x', source: 'S', publishedAt: hoursAgo(h), ...extra })
const crisis = (id: string, country: string, severity: CrisisEvent['severity'], h = 5, source = 'ACLED'): CrisisEvent =>
  ({ id, title: id, type: 'conflict', severity, latitude: 1, longitude: 1, country, date: hoursAgo(h), description: '', source })

describe('mentionsCountry', () => {
  it('matches whole words only', () => {
    expect(mentionsCountry('Troops enter Niger overnight', 'Niger')).toBe(true)
    expect(mentionsCountry('Nigeria votes on Sunday', 'Niger')).toBe(false)
    expect(mentionsCountry('Oman, Qatar talk', 'Oman')).toBe(true)
    expect(mentionsCountry('Romance novels', 'Oman')).toBe(false)
  })
  it('ignores blank/very short names and survives regex characters', () => {
    expect(mentionsCountry('anything', '')).toBe(false)
    expect(mentionsCountry('anything', 'UK')).toBe(false)
    expect(() => mentionsCountry('x', 'St. Kitts (and) Nevis [x]')).not.toThrow()
  })
})

describe('sameCountry', () => {
  it('matches equal names and containing names', () => {
    expect(sameCountry('Germany', 'germany')).toBe(true)
    expect(sameCountry('Democratic Republic of the Congo', 'Congo')).toBe(true)
  })
  it('does not match blanks or unrelated short names', () => {
    expect(sameCountry('', 'Chad')).toBe(false)
    expect(sameCountry('Mali', 'Somalia')).toBe(false)
  })
})

describe('pickCountryHeadlines', () => {
  it('ranks fresh high-impact stories above fresh routine ones above stale ones', () => {
    const out = pickCountryHeadlines('Peru', [
      art('Peru fashion week opens', 3),
      art('Peru president impeached by congress', 30),
      art('Peru war of words over old dispute', 200),
    ], [], 5, NOW)
    expect(out.map(h => h.article.title)).toEqual([
      'Peru president impeached by congress',
      'Peru fashion week opens',
      'Peru war of words over old dispute',
    ])
    expect(out[0].category).toBe('political')
    expect(out[1].category).toBeNull()
  })

  it('pushes sports results below real news', () => {
    const out = pickCountryHeadlines('Peru', [
      art('USA 4-1 Peru: match recap and highlights', 1),
      art('Peru copper output falls as protests block mines', 20),
    ], [], 5, NOW)
    expect(out[0].article.title).toContain('copper')
  })

  it('merges global headlines only when they name the country, and de-duplicates across lists', () => {
    const out = pickCountryHeadlines('Chad', [art('Chad floods displace thousands', 4)], [
      art('Chad floods displace thousands', 4, { source: 'Other outlet' }),
      art('Markets rally on rate cut', 2),
      art('Chad junta delays vote', 6, { description: '' }),
    ], 5, NOW)
    expect(out.map(h => h.article.title).sort()).toEqual(['Chad floods displace thousands', 'Chad junta delays vote'])
  })

  it('respects the limit, drops future-dated items, and tolerates unparseable dates', () => {
    const items = Array.from({ length: 8 }, (_, i) => art(`Kenya story number ${i}`, i + 1))
    const out = pickCountryHeadlines('Kenya', [...items, art('Kenya from the future', -48), art('Kenya undated', 0, { publishedAt: 'garbage' })], [], 5, NOW)
    expect(out).toHaveLength(5)
    expect(out.some(h => h.article.title.includes('future'))).toBe(false)
  })

  it('returns [] when there is nothing', () => {
    expect(pickCountryHeadlines('Peru', [], [], 5, NOW)).toEqual([])
  })
})

describe('linkedCrisisEvents', () => {
  it('returns the worst then newest events, with the full count, skipping baseline markers', () => {
    const { total, top } = linkedCrisisEvents([
      crisis('a', 'Sudan', 'medium', 2),
      crisis('b', 'Sudan', 'critical', 50),
      crisis('c', 'Sudan', 'critical', 10),
      crisis('baseline-sudan', 'Sudan', 'critical', 1, 'Baseline'),
      crisis('d', 'Chad', 'critical', 1),
    ], 'Sudan', 2)
    expect(total).toBe(3)
    expect(top.map(c => c.id)).toEqual(['c', 'b'])
  })
  it('is empty for a country with nothing tracked', () => {
    expect(linkedCrisisEvents([crisis('a', 'Sudan', 'low')], 'Iceland')).toEqual({ total: 0, top: [] })
  })
})
