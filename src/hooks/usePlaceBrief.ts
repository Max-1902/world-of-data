import { useEffect, useState } from 'react'
import { fetchPlaceHeadlines } from '../services/news'
import { fetchCivilFacilitiesAround, type CivilFacility } from '../services/civilFacilities'
import { fetchPowerPlantsNear, type InfraPoint } from '../services/infrastructure'
import { distanceKm } from '../utils/geo'
import { RADIUS_KM } from '../utils/nearby'
import type { NewsArticle, SelectedPlace } from '../types'

/** Hospitals, police and telecom are dense in a city; a tight radius keeps the list about the city itself. */
const CIVIL_RADIUS_M = 15_000

export interface PlaceBriefData {
  headlines: NewsArticle[]
  /** nearest first */
  civil: CivilFacility[]
  /** biggest first */
  powerPlants: InfraPoint[]
  /** true until every lookup has settled (each one fails soft to []) */
  loading: boolean
}

const EMPTY: PlaceBriefData = { headlines: [], civil: [], powerPlants: [], loading: false }

/** Live lookups for one picked city: local news, OSM facilities around it, WRI power plants around it. */
export function usePlaceBrief(place: SelectedPlace | null): PlaceBriefData {
  const [data, setData] = useState<PlaceBriefData>(EMPTY)
  const key = place ? `${place.name}|${place.region ?? ''}|${place.lat}|${place.lng}` : ''

  useEffect(() => {
    if (!place) { setData(EMPTY); return }
    let cancelled = false
    let pending = 3
    setData({ ...EMPTY, loading: true })
    const settle = () => { if (--pending === 0 && !cancelled) setData(d => ({ ...d, loading: false })) }
    const apply = <K extends 'headlines' | 'civil' | 'powerPlants'>(k: K) => (value: PlaceBriefData[K]) => {
      if (!cancelled) setData(d => ({ ...d, [k]: value }))
    }
    const centre = { lat: place.lat, lng: place.lng }

    fetchPlaceHeadlines(place.name, place.region).then(apply('headlines')).catch(() => {}).finally(settle)
    fetchCivilFacilitiesAround(place.lat, place.lng, CIVIL_RADIUS_M)
      .then(list => apply('civil')([...list].sort((a, b) => distanceKm(centre, a) - distanceKm(centre, b))))
      .catch(() => {}).finally(settle)
    fetchPowerPlantsNear(place.lat, place.lng, RADIUS_KM.assets).then(apply('powerPlants')).catch(() => {}).finally(settle)
    return () => { cancelled = true }
    // `key` stands in for the place object, which is a new reference on every click
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return data
}
