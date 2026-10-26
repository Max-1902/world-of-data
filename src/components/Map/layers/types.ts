import type { MutableRefObject } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { Flight, SelectedPlace } from '../../../types'
import type { Residual } from '../../../utils/countryStats'

export interface CountryAnalyticsView {
  mode: 'value' | 'trend'
  yRows: Map<string, { name: string; value: number; year: string }>   // keyed by ISO-3166 alpha-3
  points: Map<string, Residual>
  xShort: string; yShort: string
  xFormat: (v: number) => string; yFormat: (v: number) => string
  /** source(s) of what is shaded */
  source: string
  /** the typical reporting year, and the countries whose values are much older than it */
  typicalYear: number | null
  stale: ReadonlySet<string>
}

/**
 * What the layer modules share with `MapView`: refs (read lazily, so they always see the latest
 * value) and callbacks. Each `add*Layers(map, ctx)` registers its sources, layers and click/hover
 * handlers once, when the style has loaded; the per-layer `use*` hooks update them afterwards.
 */
export interface LayerCtx {
  popupRef: MutableRefObject<mapboxgl.Popup | null>
  flightDataRef: MutableRefObject<Flight[]>
  countryAnalyticsRef: MutableRefObject<CountryAnalyticsView | null>
  onFlightClick: (f: Flight) => void
  onCountryClickRef: MutableRefObject<((country: string) => void) | undefined>
  onPlaceClickRef: MutableRefObject<((place: SelectedPlace) => void) | undefined>
}
