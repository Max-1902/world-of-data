import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { MapHandle, MapViewProps } from '../types'

/** Picked-city marker */
export function usePlaceMarker({ mapRef, mapReady }: MapHandle, { selectedPlace }: Pick<MapViewProps, 'selectedPlace'>) {
  const placeMarkerRef = useRef<mapboxgl.Marker | null>(null)
  // ── Picked-city marker ───────────────────────────────────────────────────
  useEffect(() => {
    placeMarkerRef.current?.remove()
    placeMarkerRef.current = null
    const map = mapRef.current
    if (!map || !selectedPlace) return
    const el = document.createElement('div')
    el.className = 'place-pin'
    el.setAttribute('aria-label', `Selected place: ${selectedPlace.name}`)
    placeMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([selectedPlace.lng, selectedPlace.lat]).addTo(map)
    return () => { placeMarkerRef.current?.remove(); placeMarkerRef.current = null }
  }, [selectedPlace, mapReady])
}
