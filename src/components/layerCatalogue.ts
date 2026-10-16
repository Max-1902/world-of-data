import type { MapViewMode, PanelState } from '../types'

/** Every toggleable map layer, as listed in Settings → Layers and the command palette. */
export const LAYER_IDS: { id: keyof PanelState; label: string; desc: string }[] = [
  { id: 'flights', label: 'FLIGHTS', desc: 'ADS-B aircraft positions' },
  { id: 'crises', label: 'CRISES', desc: 'ACLED conflict events' },
  { id: 'news', label: 'NEWS', desc: 'GDELT article markers' },
  { id: 'stocks', label: 'MARKETS', desc: 'Financial hub markers' },
  { id: 'wildfires', label: 'WILDFIRES', desc: 'NASA FIRMS hotspots' },
  { id: 'military', label: 'MILITARY', desc: 'Known military bases' },
  { id: 'militaryPersonnel', label: 'FORCE SIZE', desc: 'Armed forces personnel by country (World Bank)' },
  { id: 'nuclear', label: 'NUCLEAR', desc: 'Nuclear facilities' },
  { id: 'sanctions', label: 'SANCTIONS', desc: 'Sanctioned countries' },
  { id: 'cameras', label: 'CAMERAS', desc: 'Live webcam feeds' },
  { id: 'infrastructure', label: 'INFRA', desc: 'Energy infrastructure' },
  { id: 'airspace', label: 'AIRSPACE', desc: 'Low-traffic heuristic over FIR boxes (not NOTAMs)' },
  { id: 'humanitarian', label: 'HUMANITARIAN', desc: 'UNHCR displacement data' },
  { id: 'vessels', label: 'VESSELS', desc: 'AIS ship tracking' },
  { id: 'oil', label: 'OIL', desc: 'Oil reserves and production' },
  { id: 'gas', label: 'GAS', desc: 'Gas reserves and production' },
  { id: 'ports', label: 'PORTS', desc: 'Global commercial & naval ports' },
  { id: 'pipelines', label: 'PIPELINES', desc: 'Oil & gas pipelines (OpenStreetMap)' },
  { id: 'chokepoints', label: 'CHOKEPOINTS', desc: 'Strategic maritime chokepoints' },
  { id: 'supplychain', label: 'SUPPLY CHAIN', desc: 'Semiconductor fabs, rare earth, lithium, cobalt' },
  { id: 'shippingDensity', label: 'SHIPPING', desc: 'Global shipping-lane density, 2004–05 (NOAA/NCEAS/ICOADS via Resource Watch)' },
  { id: 'gpsjam', label: 'GPS JAM', desc: 'Interference (daily, ADS-B)' },
  { id: 'countryAnalytics', label: 'COUNTRY DATA', desc: 'Countries shaded by the indicators compared in Country Analytics (World Bank)' },
  { id: 'analyticsHex', label: 'HAZARD HEX', desc: 'Wildfire detections or earthquakes binned into 3D hexagons (Hazard Analytics panel)' },
  { id: 'outages', label: 'OUTAGES', desc: 'Internet outages by region / network (IODA, live)' },
  { id: 'disasters', label: 'DISASTERS', desc: 'GDACS Orange/Red disaster alerts — quakes, cyclones, floods, volcanoes, droughts, wildfires' },
  { id: 'resources', label: 'RESOURCES', desc: 'Critical mineral producers' },
  { id: 'infraIndicators', label: 'INFRA ACCESS', desc: 'Electricity, internet, water/sanitation access by country (World Bank)' },
  { id: 'tradeStats', label: 'TRADE', desc: 'Trade partners & balance' },
  { id: 'datacenters', label: 'DATA CENTERS', desc: 'Data center facilities worldwide (OpenStreetMap)' },
]

/** Basemap styles, as listed in Settings → Display and the command palette. */
export const VIEW_MODES: { id: MapViewMode; label: string }[] = [
  { id: 'earth', label: 'Globe' },
  { id: 'dark', label: 'Dark' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'standard', label: 'Standard' },
  { id: 'city3d', label: '3D City' },
  { id: 'nightvision', label: 'Night Vision' },
  { id: 'bw', label: 'Black & White' },
  { id: 'infrared', label: 'Infrared' },
  { id: 'snow', label: 'Snow' },
  { id: 'thermal', label: 'Thermal' },
]
