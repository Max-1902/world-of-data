import type { MutableRefObject, RefObject } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { Flight, CrisisEvent, Stock, MapViewMode } from '../../types'
import type { FirePoint } from '../../services/wildfires'
import type { Earthquake } from '../../services/earthquakes'
import type { Vessel } from '../../services/aisstream'
import type { OutageEvent } from '../../services/outages'
import type { DisasterAlert } from '../../services/gdacs'
import type { GPSJamData } from '../../services/gpsjam'
import type { GeoNewsPin } from '../../utils/geoNews'
import type { MilitaryPersonnelEntry } from '../../services/militaryPersonnel'
import type { CountryInfraEntry } from '../../services/infraIndicators'
import type { CountryAnalyticsView } from './layers/types'

export interface MapViewProps {
  viewMode:      MapViewMode
  flights:       Flight[]
  crises:        CrisisEvent[]
  newsPins:      GeoNewsPin[]
  stocks:        Stock[]
  earthquakes:   Earthquake[]
  showFlights:   boolean
  showCrises:    boolean
  showNews:      boolean
  showStocks:    boolean
  deepstateMode: boolean
  /** Closes the DeepState split panel (shown in its header). */
  onCloseDeepstate?: () => void
  /** Toggles the DeepState split panel from the overlay menu. */
  onToggleDeepstate?: () => void
  onFlightClick: (f: Flight) => void
  onCrisisClick: (c: CrisisEvent) => void
  fires:         FirePoint[]
  showWildfires: boolean
  showMilitary:  boolean
  showNuclear:   boolean
  showSanctions:     boolean
  showCameras:        boolean
  showInfrastructure: boolean
  showDatacenters:    boolean
  showAirspace:       boolean
  showHumanitarian:   boolean
  vessels:            Vessel[]
  showVessels:        boolean
  showOil:            boolean
  showGas:            boolean
  showGPSJam:         boolean
  gpsJam:             GPSJamData | null
  showPorts:          boolean
  showPipelines:      boolean
  showChokepoints:    boolean
  showSupplyChain:    boolean
  showShippingDensity: boolean
  outages:            OutageEvent[]
  showOutages:        boolean
  disasterAlerts:     DisasterAlert[]
  showDisasters:      boolean
  showResources:      boolean
  showTradeStats:     boolean
  showMilitaryPersonnel: boolean
  showInfraIndicators: boolean
  showAnalyticsHex: boolean
  showCountryAnalytics: boolean
  flyToQuery?:        string
  geoFlyTo?:          string
  onCountryClick?:    (country: string) => void
  /** a click on a city (zoomed in enough to target one); otherwise the click is reported via onCountryClick */
  onPlaceClick?:      (place: import('../../types').SelectedPlace) => void
  selectedCountry?:   string | null
  selectedPlace?:     import('../../types').SelectedPlace | null
  reticleColor?:      string
  panelState?:        import('../../types').PanelState
  onToggleLayer?:     (id: keyof import('../../types').PanelState) => void
  onClearLayers?:     () => void
}

/**
 * What every layer hook gets from `MapView`: the map instance and the refs that outlive a render.
 * `layersReadyRef`/`mapReady` flip once the style has loaded and all sources exist, so hooks must wait on them.
 */
export interface MapHandle {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  containerRef: RefObject<HTMLDivElement>
  layersReadyRef: MutableRefObject<boolean>
  mapReady: boolean
  flightDataRef: MutableRefObject<Flight[]>
  popupRef: MutableRefObject<mapboxgl.Popup | null>
  markersRef: MutableRefObject<mapboxgl.Marker[]>
  militaryPersonnelRef: MutableRefObject<MilitaryPersonnelEntry[]>
  infraIndicatorsRef: MutableRefObject<CountryInfraEntry[]>
  countryAnalyticsRef: MutableRefObject<CountryAnalyticsView | null>
}
