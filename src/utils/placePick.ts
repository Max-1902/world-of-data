import type { SelectedPlace } from '../types'
import { distanceKm } from './geo'

/** Below this zoom a click means "the country" — a city can't be targeted on a continent-wide view. */
export const PLACE_MIN_ZOOM = 6
/** A click this close to a place's centre counts as that place even when the geocoder gave no bounding box. */
const NEAR_CENTRE_KM = 12

interface GeocodeFeature {
  text?: string
  center?: [number, number]
  bbox?: [number, number, number, number]
  context?: { id?: string; text?: string }[]
}

/**
 * Picks the city a map click landed in from a Mapbox reverse-geocoding response (`types=place`), or null.
 * The API returns the nearest places however far away they are, so a hit only counts when the click is inside
 * the place's bounding box or close to its centre — a click in open countryside stays a country click.
 */
export function pickClickedPlace(json: unknown, click: { lng: number; lat: number }): SelectedPlace | null {
  const features = (json as { features?: GeocodeFeature[] } | null)?.features
  if (!Array.isArray(features)) return null
  for (const f of features) {
    if (!f || typeof f !== 'object') continue
    const name = typeof f.text === 'string' ? f.text.trim() : ''
    const center = f.center
    if (!name || !Array.isArray(center) || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) continue
    const [lng, lat] = center
    const b = f.bbox
    const inBox = Array.isArray(b) && click.lng >= b[0] && click.lng <= b[2] && click.lat >= b[1] && click.lat <= b[3]
    if (!inBox && distanceKm(click, { lat, lng }) > NEAR_CENTRE_KM) continue
    const ctx = (prefix: string) => f.context?.find(c => c.id?.startsWith(prefix))?.text
    const country = ctx('country')
    if (!country) continue
    return { name, region: ctx('region'), country, lat, lng }
  }
  return null
}
