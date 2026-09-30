// ── US webcam directory (used by the webcam panel and the map's cameras layer) ─
export type WebcamSource = 'skyline' | 'earthcam'

export interface WebcamEntry {
  id: string
  label: string
  state: string
  source: WebcamSource
  url: string
  lat: number
  lng: number
}

export const US_WEBCAMS: WebcamEntry[] = [
  // ── SkylineWebcams ──
  { id: 'sw-times-square',   label: 'Times Square',          state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/times-square.html', lat: 40.7580, lng: -73.9855 },
  { id: 'sw-empire-state',   label: 'Empire State Building', state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/empire-state-building.html', lat: 40.7484, lng: -73.9857 },
  { id: 'sw-nyc-skyline',    label: 'NYC Skyline',           state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/new-york-skyline.html', lat: 40.7128, lng: -74.0060 },
  { id: 'sw-nyc-46th',       label: 'NYC — 46th Street',     state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/nyc-46th-street.html', lat: 40.7580, lng: -73.9855 },
  { id: 'sw-broadway',       label: 'Broadway Billboards',   state: 'NY', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/new-york-city.html', lat: 40.7590, lng: -73.9845 },
  { id: 'sw-las-vegas',      label: 'Las Vegas Strip',       state: 'NV', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/nevada/las-vegas/las-vegas.html', lat: 36.1147, lng: -115.1729 },
  { id: 'sw-the-strat',      label: 'The Strat, Las Vegas',  state: 'NV', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/nevada/las-vegas/the-strat.html', lat: 36.1474, lng: -115.1558 },
  { id: 'sw-laguna',         label: 'Laguna Beach',          state: 'CA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/california/laguna-beach/laguna-beach.html', lat: 33.5427, lng: -117.7854 },
  { id: 'sw-santa-barbara',  label: 'Santa Barbara',         state: 'CA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/california/santa-barbara/santa-barbara.html', lat: 34.4208, lng: -119.6982 },
  { id: 'sw-encinitas',      label: 'Encinitas',             state: 'CA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/california/encinitas/encinitas-california.html', lat: 33.0370, lng: -117.2920 },
  { id: 'sw-miami',          label: 'Miami',                 state: 'FL', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/florida/miami/miami.html', lat: 25.7907, lng: -80.1300 },
  { id: 'sw-venetian',       label: 'Venetian Marina',       state: 'FL', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/florida/miami/venetian-marina-biscayne-bay.html', lat: 25.7909, lng: -80.1615 },
  { id: 'sw-fort-myers',     label: 'Fort Myers Beach',      state: 'FL', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/florida/fort-myers-beach/fort-myers-beach.html', lat: 26.4529, lng: -81.9500 },
  { id: 'sw-boston',         label: 'Boston Common',         state: 'MA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/massachusetts/boston/boston.html', lat: 42.3554, lng: -71.0655 },
  { id: 'sw-philly',         label: 'Rittenhouse Square',    state: 'PA', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/pennsylvania/philadelphia/rittenhouse-square-park.html', lat: 39.9496, lng: -75.1719 },
  { id: 'sw-atlantic-city',  label: 'Atlantic City Boardwalk',state:'NJ', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-jersey/atlantic-city/atlantic-city-boardwalk.html', lat: 39.3643, lng: -74.4229 },
  { id: 'sw-ocean-city',     label: 'Ocean City Boardwalk',  state: 'NJ', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-jersey/ocean-city/boardwalk.html', lat: 39.2776, lng: -74.5746 },
  { id: 'sw-gatlinburg',     label: 'Gatlinburg',            state: 'TN', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/tennessee/gatlinburg/tennessee-gatlinburg.html', lat: 35.7143, lng: -83.5102 },
  { id: 'sw-smoky-mtns',     label: 'Great Smoky Mountains', state: 'TN', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/tennessee/pigeon-forge/great-smoky-mountains.html', lat: 35.7325, lng: -83.5486 },
  { id: 'sw-kahului',        label: 'Kahului, Maui',         state: 'HI', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/hawaii/maui/kahului.html', lat: 20.8893, lng: -156.4729 },
  { id: 'sw-newport-or',     label: 'Yaquina Bay, Newport',  state: 'OR', source: 'skyline',  url: 'https://www.skylinewebcams.com/en/webcam/united-states/oregon/newport/yaquina-bay-newport-oregon-coast.html', lat: 44.6183, lng: -124.0512 },
  // ── EarthCam ──
  { id: 'ec-times-square',   label: 'Times Square South 4K', state: 'NY', source: 'earthcam', url: 'https://www.earthcam.com/usa/newyork/timessquare/', lat: 40.7566, lng: -73.9862 },
  { id: 'ec-vegas-strip',    label: 'Las Vegas Strip',       state: 'NV', source: 'earthcam', url: 'https://www.earthcam.com/usa/nevada/lasvegas/?cam=lasvegas', lat: 36.1162, lng: -115.1745 },
  { id: 'ec-miami-south',    label: 'Miami South Beach',     state: 'FL', source: 'earthcam', url: 'https://www.earthcam.com/usa/florida/miamibeach/?cam=miamibeach', lat: 25.7826, lng: -80.1310 },
  { id: 'ec-key-west',       label: 'Key West Sunset Pier',  state: 'FL', source: 'earthcam', url: 'https://www.earthcam.com/usa/florida/keywest/?cam=sunsetpier', lat: 24.5551, lng: -81.8081 },
  { id: 'ec-new-orleans',    label: 'Bourbon Street',        state: 'LA', source: 'earthcam', url: 'https://www.earthcam.com/usa/louisiana/neworleans/bourbonstreet/?cam=catsmeow', lat: 29.9584, lng: -90.0644 },
  { id: 'ec-chicago',        label: 'Chicago Navy Pier',     state: 'IL', source: 'earthcam', url: 'https://www.earthcam.com/usa/illinois/chicago/navypier/?cam=navypier', lat: 41.8917, lng: -87.6086 },
  { id: 'ec-niagara',        label: 'Niagara Falls',         state: 'NY', source: 'earthcam', url: 'https://www.earthcam.com/usa/newyork/niagarafalls/?cam=niagarafalls', lat: 43.0962, lng: -79.0377 },
  { id: 'ec-nashville',      label: 'Nashville Broadway',    state: 'TN', source: 'earthcam', url: 'https://www.earthcam.com/usa/tennessee/nashville/?cam=nashville', lat: 36.1612, lng: -86.7775 },
  { id: 'ec-santa-monica',   label: 'Santa Monica Pier',     state: 'CA', source: 'earthcam', url: 'https://www.earthcam.com/usa/california/santamonica/?cam=samo', lat: 34.0094, lng: -118.4973 },
  { id: 'ec-daytona',        label: 'Daytona Beach',         state: 'FL', source: 'earthcam', url: 'https://www.earthcam.com/usa/florida/daytonabeach/?cam=daytonabeach', lat: 29.2108, lng: -81.0228 },
]

/** Register US webcams into the global camera layer so the map's CAMERAS toggle shows them too. */
export function registerUSWebcams() {
  return US_WEBCAMS.map(w => ({
    id: w.id, name: w.label, city: '', country: 'United States',
    lat: w.lat, lng: w.lng, url: w.url, source: w.source,
  }))
}
