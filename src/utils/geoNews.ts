import type { NewsArticle } from '../types'
import type { KeyEvent, KeyEventCategory } from './keyEvents'
import type { GeoPlace, GeoPrecision } from '../services/geocode'
import { extractPlaceCandidates } from './placeExtract'

export interface GeoNewsItem {
  article: NewsArticle
  category: KeyEventCategory
}

/** One map pin: every important story we could place at the same location. */
export interface GeoNewsPin {
  id: string
  lat: number
  lng: number
  place: string
  country: string
  precision: GeoPrecision
  items: GeoNewsItem[]
}

const PRECISION_RANK: Record<GeoPrecision, number> = { city: 3, region: 2, capital: 1, country: 1 }
export type Geocoder = (name: string) => Promise<GeoPlace | null>

/**
 * Finds where a story happened. The headline decides: among its candidates the most specific resolvable place wins
 * (city over region over a country's capital); a "in/near X" candidate beats a bare name at equal precision. The description is
 * consulted only when the headline names no place at all, since it mentions incidental locations.
 */
export async function locateArticle(article: NewsArticle, geocode: Geocoder): Promise<GeoPlace | null> {
  for (const text of [article.title ?? '', article.description ?? '']) {
    const candidates = extractPlaceCandidates(text)
    const places = await Promise.all(candidates.map(c => geocode(c.name)))
    let best: { place: GeoPlace; score: number } | null = null
    candidates.forEach((c, i) => {
      const place = places[i]
      if (!place) return
      const score = PRECISION_RANK[place.precision] * 2 + (c.kind === 'prep' ? 1 : 0)
      if (!best || score > best.score) best = { place, score }
    })
    if (best) return (best as { place: GeoPlace }).place
  }
  return null
}

/** Groups located stories into pins, one per place, newest story first. */
export function buildPins(located: { event: KeyEvent; place: GeoPlace }[]): GeoNewsPin[] {
  const pins = new Map<string, GeoNewsPin>()
  for (const { event, place } of located) {
    const key = `${place.lat.toFixed(2)},${place.lng.toFixed(2)}`
    let pin = pins.get(key)
    if (!pin) {
      pin = { id: key, lat: place.lat, lng: place.lng, place: place.name, country: place.country, precision: place.precision, items: [] }
      pins.set(key, pin)
    }
    pin.items.push({ article: event.article, category: event.category })
  }
  const ts = (i: GeoNewsItem) => Date.parse(i.article.publishedAt) || 0
  for (const pin of pins.values()) pin.items.sort((a, b) => ts(b) - ts(a))
  return [...pins.values()].sort((a, b) => ts(b.items[0]) - ts(a.items[0]))
}
