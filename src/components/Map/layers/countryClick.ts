import mapboxgl from 'mapbox-gl'
import { PLACE_MIN_ZOOM, pickClickedPlace } from '../../../utils/placePick'
import { MAPBOX_TOKEN as TOKEN } from '../token'
import type { LayerCtx } from './types'

export function installCountryClick(map: mapboxgl.Map, ctx: LayerCtx): void {
  const { onCountryClickRef, onPlaceClickRef } = ctx
  // ── Country click — reverse geocode any click on the map ─────────
  let featureClickedFlag = false
  let featureClickTimer: ReturnType<typeof setTimeout> | null = null
  map.on('click', (e) => {
    if (featureClickTimer) clearTimeout(featureClickTimer)
    featureClickTimer = setTimeout(() => {
      if (featureClickedFlag) {
        featureClickedFlag = false
        return
      }
      if (!onCountryClickRef.current) return
      // Reverse geocode — works for every click on land. Zoomed in far enough, a city wins over its country.
      const { lng, lat } = e.lngLat
      const geocode = (types: string, limit = 1) =>
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=${types}&limit=${limit}&access_token=${TOKEN}`)
          .then(r => r.json())
      const wantPlace = !!onPlaceClickRef.current && map.getZoom() >= PLACE_MIN_ZOOM
      Promise.all([
        geocode('country'),
        wantPlace ? geocode('place', 3).catch(() => null) : Promise.resolve(null),
      ])
        .then(([countryJson, placeJson]) => {
          const place = placeJson ? pickClickedPlace(placeJson, { lng, lat }) : null
          if (place && onPlaceClickRef.current) { onPlaceClickRef.current(place); return }
          const countryName = countryJson.features?.[0]?.text || countryJson.features?.[0]?.place_name
          if (countryName && onCountryClickRef.current) {
            onCountryClickRef.current(countryName)
          }
        })
        .catch(() => {})
    }, 150)
  })
  ;(map as any).__markFeatureClick = () => { featureClickedFlag = true }
}
