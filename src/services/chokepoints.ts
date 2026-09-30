/**
 * Strategic supply chain chokepoints — maritime straits, canals, and passages
 * that carry disproportionate shares of global trade.
 */

export interface Chokepoint {
  id: string
  name: string
  lat: number
  lng: number
  dailyTransits: number        // approx vessels/day
  pctWorldTrade: number        // % of global seaborne trade
  pctOilTrade?: number         // % of global oil trade
  keyGoods: string[]
  risks: string[]
  controlledBy: string
  notes?: string
  // Polygon outline for the strait/canal zone (simplified)
  zone: [number, number][]     // [lng, lat] ring
}

export const CHOKEPOINTS: Chokepoint[] = [
  {
    id: 'suez', name: 'Suez Canal',
    lat: 30.58, lng: 32.34,
    dailyTransits: 52, pctWorldTrade: 12, pctOilTrade: 9,
    keyGoods: ['Crude oil', 'LNG', 'Container goods', 'Grain'],
    risks: ['Houthi attacks', 'Vessel grounding', 'Geopolitical closure'],
    controlledBy: 'Egypt (Suez Canal Authority)',
    notes: '193 km canal; ~$10B annual revenue. Houthi Red Sea attacks caused major rerouting in 2024.',
    zone: [[32.28,30.10],[32.40,30.10],[32.58,30.85],[32.58,31.28],[32.32,31.28],[32.32,30.85],[32.28,30.10]],
  },
  {
    id: 'hormuz', name: 'Strait of Hormuz',
    lat: 26.56, lng: 56.25,
    dailyTransits: 80, pctWorldTrade: 8, pctOilTrade: 21,
    keyGoods: ['Crude oil', 'LNG', 'Refined petroleum'],
    risks: ['Iran closure threat', 'Mine warfare', 'Drone/missile attacks', 'IRGC naval confrontation'],
    controlledBy: 'Iran / Oman (shared)',
    notes: '21 km wide at narrowest. ~21 million bbl/day oil transits. Critical for Saudi, UAE, Qatar, Iraq, Kuwait exports.',
    zone: [[55.80,26.20],[56.70,26.20],[56.70,26.90],[55.80,26.90],[55.80,26.20]],
  },
  {
    id: 'malacca', name: 'Strait of Malacca',
    lat: 2.50, lng: 101.20,
    dailyTransits: 94, pctWorldTrade: 25, pctOilTrade: 16,
    keyGoods: ['Crude oil', 'LNG', 'Electronics', 'Container goods'],
    risks: ['Piracy', 'Congestion', 'Geopolitical tension (China/US)'],
    controlledBy: 'Malaysia / Indonesia / Singapore',
    notes: '900 km, narrows to 2.8 km at Phillips Channel. Critical for China/Japan/Korea oil imports.',
    zone: [[99.50,1.20],[100.20,1.20],[104.20,1.40],[104.20,1.60],[100.20,3.80],[99.50,3.80],[99.50,1.20]],
  },
  {
    id: 'panama', name: 'Panama Canal',
    lat: 9.08, lng: -79.68,
    dailyTransits: 36, pctWorldTrade: 5, pctOilTrade: 3,
    keyGoods: ['Container goods', 'Grain', 'LNG', 'Vehicles'],
    risks: ['Drought / low water levels', 'Lock maintenance', 'Queue congestion'],
    controlledBy: 'Panama (Panama Canal Authority)',
    notes: '82 km canal. 2023-24 drought cut daily transits from 36 to 22. $4.3B annual revenue.',
    zone: [[-79.95,8.85],[-79.50,8.85],[-79.50,9.40],[-79.95,9.40],[-79.95,8.85]],
  },
  {
    id: 'bosphorus', name: 'Turkish Straits (Bosphorus)',
    lat: 41.12, lng: 29.05,
    dailyTransits: 120, pctWorldTrade: 3, pctOilTrade: 3,
    keyGoods: ['Crude oil', 'Grain', 'Coal', 'Steel'],
    risks: ['Montreux Convention restrictions', 'Congestion', 'Collision risk'],
    controlledBy: 'Turkey',
    notes: 'Bosphorus + Dardanelles. 700m wide at narrowest. Black Sea grain/oil exit. Montreux regulates warship passage.',
    zone: [[28.95,41.00],[29.15,41.00],[29.15,41.25],[28.95,41.25],[28.95,41.00]],
  },
  {
    id: 'giuk', name: 'GIUK Gap',
    lat: 63.00, lng: -15.00,
    dailyTransits: 30, pctWorldTrade: 2,
    keyGoods: ['Military logistics', 'LNG', 'Subsea cables'],
    risks: ['Russian submarine activity', 'NATO ASW operations', 'Subsea cable sabotage'],
    controlledBy: 'NATO (Greenland / Iceland / UK)',
    notes: 'Greenland-Iceland-UK passage. Key NATO chokepoint for Russian Northern Fleet. Hosts critical transatlantic subsea cables.',
    zone: [[-25.00,60.00],[-5.00,60.00],[-5.00,66.00],[-25.00,66.00],[-25.00,60.00]],
  },
  {
    id: 'babel-mandeb', name: 'Bab el-Mandeb',
    lat: 12.58, lng: 43.33,
    dailyTransits: 45, pctWorldTrade: 7, pctOilTrade: 9,
    keyGoods: ['Crude oil', 'LNG', 'Container goods'],
    risks: ['Houthi attacks', 'Piracy (Somalia)', 'Maritime terrorism'],
    controlledBy: 'Yemen / Djibouti / Eritrea',
    notes: '26 km wide. Links Red Sea to Gulf of Aden. Houthi campaign 2023-24 severely disrupted traffic.',
    zone: [[43.00,12.30],[43.65,12.30],[43.65,12.85],[43.00,12.85],[43.00,12.30]],
  },
  {
    id: 'cape-good-hope', name: 'Cape of Good Hope',
    lat: -34.35, lng: 18.47,
    dailyTransits: 40, pctWorldTrade: 9,
    keyGoods: ['Crude oil', 'Iron ore', 'Coal', 'LNG'],
    risks: ['Extreme weather', 'Long transit time', 'Piracy (Gulf of Guinea)'],
    controlledBy: 'South Africa',
    notes: 'Alternative to Suez. Traffic surged 2024 due to Houthi Red Sea disruption. Adds 10-14 days vs Suez.',
    zone: [[17.50,-34.80],[19.50,-34.80],[19.50,-33.90],[17.50,-33.90],[17.50,-34.80]],
  },
  {
    id: 'lombok', name: 'Lombok Strait',
    lat: -8.47, lng: 115.70,
    dailyTransits: 20, pctWorldTrade: 3,
    keyGoods: ['Crude oil', 'Coal', 'Iron ore'],
    risks: ['Strong currents', 'Limited infrastructure'],
    controlledBy: 'Indonesia',
    notes: 'Alternative to Malacca for supertankers (deeper draft). Key for Australia-NE Asia coal/LNG routes.',
    zone: [[115.40,-8.80],[116.00,-8.80],[116.00,-8.15],[115.40,-8.15],[115.40,-8.80]],
  },
  {
    id: 'gibraltar', name: 'Strait of Gibraltar',
    lat: 35.95, lng: -5.60,
    dailyTransits: 100, pctWorldTrade: 10,
    keyGoods: ['Crude oil', 'Container goods', 'LNG', 'Refined petroleum'],
    risks: ['Congestion', 'Migrant crossing incidents', 'Collision risk (narrow channel)'],
    controlledBy: 'Spain / Morocco / UK (Gibraltar)',
    notes: '14 km wide at narrowest. Only sea link between Mediterranean and Atlantic; gateway for all Suez-Europe traffic continuing to Atlantic ports.',
    zone: [[-5.90,35.85],[-5.30,35.85],[-5.30,36.15],[-5.90,36.15],[-5.90,35.85]],
  },
  {
    id: 'magellan', name: 'Strait of Magellan',
    lat: -52.90, lng: -70.50,
    dailyTransits: 8, pctWorldTrade: 1,
    keyGoods: ['Bulk commodities', 'LNG', 'Fishing vessels'],
    risks: ['Extreme weather', 'Strong currents', 'Limited navigational aids'],
    controlledBy: 'Chile',
    notes: '570 km passage between Atlantic and Pacific at South America\'s tip. Alternative to Drake Passage / Cape Horn for vessels too large for Panama Canal locks (pre-expansion) or avoiding Panama congestion/drought.',
    zone: [[-71.50,-53.20],[-68.50,-53.20],[-68.50,-52.30],[-71.50,-52.30],[-71.50,-53.20]],
  },
  {
    id: 'denmark', name: 'Danish Straits',
    lat: 55.70, lng: 11.00,
    dailyTransits: 65, pctWorldTrade: 2,
    keyGoods: ['Crude oil', 'Gas', 'Grain', 'Manufactured goods'],
    risks: ['Shallow draft restrictions', 'Ice (winter)', 'Nord Stream sabotage zone'],
    controlledBy: 'Denmark / Sweden',
    notes: 'Øresund + Great Belt + Little Belt. Baltic Sea access. Russian energy exports exit point.',
    zone: [[10.00,55.20],[12.50,55.20],[12.50,56.10],[10.00,56.10],[10.00,55.20]],
  },
]

/**
 * Chokepoints that get a ringed label on the shipping-density overlay — the same
 * seven the NOAA "Shipping Routes with Labels" visualization calls out
 * (https://sos.noaa.gov/datasets/shipping-routes-with-labels-one-year/).
 * Coordinates come from CHOKEPOINTS above.
 */
export const SHIPPING_LANE_LABEL_IDS = [
  'suez', 'babel-mandeb', 'gibraltar', 'cape-good-hope', 'malacca', 'magellan', 'panama',
] as const

export const CHOKEPOINT_COLORS = {
  zone: '#ff4466',
  zoneBorder: '#ff2244',
  label: '#ffffff',
}
