import type mapboxgl from 'mapbox-gl'
import type { LayerCtx } from './types'
import { addBaseLayers } from './base'
import { addFlightLayers } from './flights'
import { addWildfireLayers } from './wildfires'
import { addSanctionsLayers } from './sanctions'
import { addSelectedCountryLayer } from './selectedCountry'
import { addResourcesLayers } from './resources'
import { addTradeStatsLayers } from './tradeStats'
import { addCountryIndicatorLayers } from './countryIndicators'
import { addOutageLayers } from './outages'
import { addDisasterLayers } from './disasters'
import { addMilitaryLayers } from './military'
import { addPortLayers } from './ports'
import { addPipelineLayers } from './pipelines'
import { addNuclearLayers } from './nuclear'
import { addAirspaceLayers } from './airspace'
import { addInfrastructureLayers } from './infrastructure'
import { addDatacenterLayers } from './datacenters'
import { addHumanitarianLayers } from './humanitarian'
import { addVesselLayers } from './vessels'
import { addGpsJamLayers } from './gpsjam'
import { addCountryAnalyticsLayers } from './countryAnalytics'
import { addHazardHexLayers } from './hazardHex'
import { addOilGasLayers } from './oilgas'
import { addChokepointLayers } from './chokepoints'
import { addSupplyChainLayers } from './supplychain'
import { addShippingDensityLayers } from './shippingDensity'
import { installCountryClick } from './countryClick'

export type { LayerCtx, CountryAnalyticsView } from './types'

/**
 * Registers every source, layer and click handler on a freshly loaded map. Order is draw order:
 * layers added later paint on top of earlier ones, so don't reshuffle without checking the globe.
 */
export function addAllLayers(map: mapboxgl.Map, ctx: LayerCtx): void {
  addBaseLayers(map, ctx)
  addFlightLayers(map, ctx)
  addWildfireLayers(map, ctx)
  addSanctionsLayers(map, ctx)
  addSelectedCountryLayer(map, ctx)
  addResourcesLayers(map, ctx)
  addTradeStatsLayers(map, ctx)
  addCountryIndicatorLayers(map, ctx)
  addOutageLayers(map, ctx)
  addDisasterLayers(map, ctx)
  addMilitaryLayers(map, ctx)
  addPortLayers(map, ctx)
  addPipelineLayers(map, ctx)
  addNuclearLayers(map, ctx)
  addAirspaceLayers(map, ctx)
  addInfrastructureLayers(map, ctx)
  addDatacenterLayers(map, ctx)
  addHumanitarianLayers(map, ctx)
  addVesselLayers(map, ctx)
  addGpsJamLayers(map, ctx)
  addCountryAnalyticsLayers(map, ctx)
  addHazardHexLayers(map, ctx)
  addOilGasLayers(map, ctx)
  addChokepointLayers(map, ctx)
  addSupplyChainLayers(map, ctx)
  addShippingDensityLayers(map, ctx)
  installCountryClick(map, ctx)
}

export { useAirspaceData } from './airspace'
export { useCameraMarkers } from './cameras'
export { useChokepointData } from './chokepoints'
export { useCountryAnalyticsLayer } from './countryAnalytics'
export { useCountryIndicatorData } from './countryIndicators'
export { useDatacenterData } from './datacenters'
export { useDisasterData } from './disasters'
export { useFlightData } from './flights'
export { useGpsJamData } from './gpsjam'
export { useHazardHexLayer } from './hazardHex'
export { useHumanitarianData } from './humanitarian'
export { useInfrastructureData } from './infrastructure'
export { useCrisisMarkers } from './markers'
export { useNewsMarkers } from './markers'
export { useMarketMarkers } from './markers'
export { useMilitaryData } from './military'
export { useNuclearData } from './nuclear'
export { useOilGasData } from './oilgas'
export { useOutageData } from './outages'
export { usePipelineData } from './pipelines'
export { usePortData } from './ports'
export { useResourcesVisibility } from './resources'
export { useSanctionsVisibility } from './sanctions'
export { useSelectedCountryHighlight } from './selectedCountry'
export { usePlaceMarker } from './selectedPlace'
export { useShippingDensityVisibility } from './shippingDensity'
export { useSupplyChainData } from './supplychain'
export { useTradeStatsVisibility } from './tradeStats'
export { useVesselData } from './vessels'
export { useViewMode } from './viewMode'
export { useMapResize } from './viewport'
export { useWildfireData } from './wildfires'
