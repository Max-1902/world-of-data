import { describe, it, expect } from 'vitest'
import { buildPins, locateArticle, type Geocoder } from './geoNews'
import type { NewsArticle } from '../types'
import type { GeoPlace } from '../services/geocode'

const art = (title: string, publishedAt = '2026-10-04T10:00:00Z', description = ''): NewsArticle =>
  ({ id: title, title, description, url: `https://x.test/${encodeURIComponent(title)}`, source: 'T', publishedAt })
const P = (name: string, precision: GeoPlace['precision'], lat = 1, lng = 1): GeoPlace => ({ name, lat, lng, country: '', precision })
const gc = (table: Record<string, GeoPlace>): Geocoder => async n => table[n] ?? null

describe('locateArticle', () => {
  it('prefers the most specific place in the headline', async () => {
    const g = gc({ Russia: P('Russia', 'country'), Kyiv: P('Kyiv', 'city') })
    expect((await locateArticle(art('Russia strikes Kyiv overnight'), g))?.name).toBe('Kyiv')
  })
  it('uses the description only when the headline has no place', async () => {
    const g = gc({ Gaza: P('Gaza', 'region') })
    expect((await locateArticle(art('Talks collapse', undefined, 'Fighting in Gaza continued'), g))?.name).toBe('Gaza')
    const g2 = gc({ Kyiv: P('Kyiv', 'city'), Gaza: P('Gaza', 'region') })
    expect((await locateArticle(art('Kyiv hit', undefined, 'Fighting in Gaza'), g2))?.name).toBe('Kyiv')
  })
  it('returns null when nothing resolves', async () => {
    expect(await locateArticle(art('Markets rally'), gc({}))).toBeNull()
  })
})

describe('buildPins', () => {
  it('groups stories at the same place, newest first', () => {
    const k = P('Kyiv', 'city', 50.45, 30.52)
    const ev = (t: string, at: string) => ({ event: { category: 'other' as const, article: art(t, at) }, place: k })
    const pins = buildPins([ev('old', '2026-10-03T00:00:00Z'), ev('new', '2026-10-04T00:00:00Z'),
      { event: { category: 'political', article: art('other', '2026-10-02T00:00:00Z') }, place: P('Rome', 'city', 41.9, 12.5) }])
    expect(pins).toHaveLength(2)
    expect(pins[0].items.map(i => i.article.title)).toEqual(['new', 'old'])
  })
})
