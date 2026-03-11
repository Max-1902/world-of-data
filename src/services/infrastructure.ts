/**
 * Critical Energy & Water Infrastructure
 * Dams, oil/gas pipelines, LNG terminals, power grid hubs
 *
 * Sources: GRanD database, EIA, IEA, public infrastructure data
 */

export type InfraType = 'dam' | 'pipeline' | 'lng' | 'refinery' | 'grid'

export interface InfraPoint {
  id:       string
  name:     string
  type:     InfraType
  country:  string
  lat:      number
  lng:      number
  capacity?: string  // MW for dam/power, MTpa for LNG, bbl/day for refinery
  river?:   string   // for dams
  notes?:   string
  status:   'operational' | 'under_construction' | 'decommissioned'
}

export interface PipelineRoute {
  id:      string
  name:    string
  type:    'oil' | 'gas' | 'multi'
  country: string   // primary country
  from:    string
  to:      string
  coords:  [number, number][]  // [lng, lat] pairs for the line
  capacity?: string
  status:  'operational' | 'under_construction' | 'suspended'
  notes?:  string
}

export const INFRA_COLORS: Record<InfraType, string> = {
  dam:      '#00aaff',
  pipeline: '#ff8800',
  lng:      '#ffdd00',
  refinery: '#ff4400',
  grid:     '#00ff88',
}

export const INFRA_LABELS: Record<InfraType, string> = {
  dam:      'DAM',
  pipeline: 'PIPELINE',
  lng:      'LNG',
  refinery: 'REFINERY',
  grid:     'GRID HUB',
}

export const INFRA_ICONS: Record<InfraType, string> = {
  dam:      '🏔',
  pipeline: '⬡',
  lng:      '🔷',
  refinery: '🏭',
  grid:     '⚡',
}

// ── Major Dams ──────────────────────────────────────────────────────────────
export const MAJOR_DAMS: InfraPoint[] = [
  // Asia
  { id: 'three-gorges',  name: 'Three Gorges Dam',       type: 'dam', country: 'China',        lat: 30.8231,  lng: 111.0042, capacity: '22,500 MW',  river: 'Yangtze',   status: 'operational', notes: 'World\'s largest hydroelectric facility' },
  { id: 'baihetan',      name: 'Baihetan Dam',            type: 'dam', country: 'China',        lat: 27.2167,  lng: 102.8833, capacity: '16,000 MW',  river: 'Jinsha',    status: 'operational' },
  { id: 'xiluodu',       name: 'Xiluodu Dam',             type: 'dam', country: 'China',        lat: 28.2333,  lng: 103.6333, capacity: '13,860 MW',  river: 'Jinsha',    status: 'operational' },
  { id: 'nuozhadu',      name: 'Nuozhadu Dam',            type: 'dam', country: 'China',        lat: 23.4667,  lng: 99.6000,  capacity: '5,850 MW',   river: 'Lancang',   status: 'operational' },
  { id: 'tarbela',       name: 'Tarbela Dam',             type: 'dam', country: 'Pakistan',     lat: 33.9880,  lng: 72.7680,  capacity: '4,888 MW',   river: 'Indus',     status: 'operational', notes: 'World\'s largest earth-filled dam' },
  { id: 'bhakra',        name: 'Bhakra Dam',              type: 'dam', country: 'India',        lat: 31.4113,  lng: 76.4325,  capacity: '1,325 MW',   river: 'Sutlej',    status: 'operational' },
  { id: 'sardar-sarovar',name: 'Sardar Sarovar Dam',      type: 'dam', country: 'India',        lat: 21.8311,  lng: 73.7493,  capacity: '1,450 MW',   river: 'Narmada',   status: 'operational' },
  { id: 'hoabinh',       name: 'Hoa Binh Dam',            type: 'dam', country: 'Vietnam',      lat: 20.8167,  lng: 105.3333, capacity: '1,920 MW',   river: 'Da',        status: 'operational' },
  { id: 'nam-theun2',    name: 'Nam Theun 2 Dam',         type: 'dam', country: 'Laos',         lat: 18.0333,  lng: 104.5667, capacity: '1,070 MW',   river: 'Nam Theun', status: 'operational' },
  // Middle East
  { id: 'ataturk',       name: 'Atatürk Dam',             type: 'dam', country: 'Turkey',       lat: 37.4847,  lng: 38.3189,  capacity: '2,400 MW',   river: 'Euphrates', status: 'operational', notes: 'Largest dam in Turkey; geopolitical flashpoint' },
  { id: 'aswan',         name: 'Aswan High Dam',          type: 'dam', country: 'Egypt',        lat: 23.9700,  lng: 32.8780,  capacity: '2,100 MW',   river: 'Nile',      status: 'operational', notes: 'Controls Nile flow; strategic regional asset' },
  { id: 'gerd',          name: 'Grand Ethiopian Renaissance Dam', type: 'dam', country: 'Ethiopia', lat: 11.2150, lng: 35.0942, capacity: '6,450 MW', river: 'Blue Nile', status: 'operational', notes: 'Africa\'s largest dam; geopolitical dispute with Egypt' },
  // Africa
  { id: 'kariba',        name: 'Kariba Dam',              type: 'dam', country: 'Zambia/Zimbabwe', lat: -16.5190, lng: 28.7700, capacity: '1,626 MW', river: 'Zambezi',   status: 'operational' },
  { id: 'cahora-bassa',  name: 'Cahora Bassa Dam',        type: 'dam', country: 'Mozambique',   lat: -15.5833, lng: 32.7000,  capacity: '2,075 MW',   river: 'Zambezi',   status: 'operational' },
  { id: 'akosombo',      name: 'Akosombo Dam',            type: 'dam', country: 'Ghana',        lat: 6.2989,   lng: 0.0597,   capacity: '1,020 MW',   river: 'Volta',     status: 'operational' },
  { id: 'inga3',         name: 'Grand Inga Dam (planned)',type: 'dam', country: 'DR Congo',     lat: -5.5000,  lng: 13.7000,  capacity: '40,000 MW',  river: 'Congo',     status: 'under_construction', notes: 'Potential world\'s largest dam' },
  // South America
  { id: 'itaipu',        name: 'Itaipu Dam',              type: 'dam', country: 'Brazil/Paraguay', lat: -25.4082, lng: -54.5887, capacity: '14,000 MW', river: 'Paraná',   status: 'operational', notes: 'World\'s 2nd largest hydroelectric plant' },
  { id: 'belo-monte',    name: 'Belo Monte Dam',          type: 'dam', country: 'Brazil',       lat: -3.2500,  lng: -51.9167, capacity: '11,233 MW',  river: 'Xingu',     status: 'operational' },
  { id: 'tucurui',       name: 'Tucuruí Dam',             type: 'dam', country: 'Brazil',       lat: -3.8333,  lng: -49.6833, capacity: '8,370 MW',   river: 'Tocantins', status: 'operational' },
  { id: 'guri',          name: 'Guri Dam',                type: 'dam', country: 'Venezuela',    lat: 7.7597,   lng: -62.9894, capacity: '10,200 MW',  river: 'Caroní',    status: 'operational' },
  // North America
  { id: 'hoover',        name: 'Hoover Dam',              type: 'dam', country: 'United States', lat: 36.0156,  lng: -114.7378, capacity: '2,080 MW', river: 'Colorado',  status: 'operational', notes: 'Lake Mead — critical Western US water supply' },
  { id: 'glen-canyon',   name: 'Glen Canyon Dam',         type: 'dam', country: 'United States', lat: 36.9388,  lng: -111.4843, capacity: '1,296 MW', river: 'Colorado',  status: 'operational' },
  { id: 'grand-coulee',  name: 'Grand Coulee Dam',        type: 'dam', country: 'United States', lat: 47.9614,  lng: -118.9812, capacity: '6,809 MW', river: 'Columbia',  status: 'operational', notes: 'Largest US power plant' },
  { id: 'robert-bourassa', name: 'Robert-Bourassa Dam',   type: 'dam', country: 'Canada',       lat: 53.7500,  lng: -77.0833, capacity: '5,616 MW',   river: 'La Grande', status: 'operational' },
  // Europe
  { id: 'sayano',        name: 'Sayano-Shushenskaya Dam', type: 'dam', country: 'Russia',       lat: 52.8319,  lng: 91.3667,  capacity: '6,400 MW',   river: 'Yenisei',   status: 'operational' },
  { id: 'bratsk',        name: 'Bratsk Dam',              type: 'dam', country: 'Russia',       lat: 56.2500,  lng: 101.8333, capacity: '4,515 MW',   river: 'Angara',    status: 'operational' },
  { id: 'krasnoarsk',    name: 'Krasnoyarsk Dam',         type: 'dam', country: 'Russia',       lat: 55.9958,  lng: 92.2694,  capacity: '6,000 MW',   river: 'Yenisei',   status: 'operational' },
  { id: 'kakhovka',      name: 'Kakhovka Dam (destroyed)',type: 'dam', country: 'Ukraine',      lat: 47.2608,  lng: 33.3772,  capacity: '351 MW',     river: 'Dnipro',    status: 'decommissioned', notes: 'Destroyed June 2023 during Russia-Ukraine war' },
]

// ── LNG Export / Import Terminals ──────────────────────────────────────────
export const LNG_TERMINALS: InfraPoint[] = [
  // USA
  { id: 'sabine-pass',   name: 'Sabine Pass LNG',         type: 'lng', country: 'United States', lat: 29.7286,  lng: -93.8758, capacity: '30 MTpa',  status: 'operational', notes: 'Largest US LNG export terminal' },
  { id: 'freeport',      name: 'Freeport LNG',            type: 'lng', country: 'United States', lat: 28.9369,  lng: -95.3555, capacity: '15 MTpa',  status: 'operational' },
  { id: 'corpus-christi',name: 'Corpus Christi LNG',      type: 'lng', country: 'United States', lat: 27.7742,  lng: -97.5031, capacity: '15 MTpa',  status: 'operational' },
  { id: 'calcasieu',     name: 'Calcasieu Pass LNG',      type: 'lng', country: 'United States', lat: 29.8117,  lng: -93.3100, capacity: '10 MTpa',  status: 'operational' },
  // Australia
  { id: 'gorgon',        name: 'Gorgon LNG',              type: 'lng', country: 'Australia',     lat: -20.4500, lng: 114.4000, capacity: '15.6 MTpa',status: 'operational' },
  { id: 'wheatstone',    name: 'Wheatstone LNG',          type: 'lng', country: 'Australia',     lat: -21.6300, lng: 114.9100, capacity: '8.9 MTpa', status: 'operational' },
  { id: 'north-west-shelf', name: 'North West Shelf LNG', type: 'lng', country: 'Australia',     lat: -20.3000, lng: 116.7500, capacity: '16.9 MTpa',status: 'operational' },
  // Qatar
  { id: 'ras-laffan',    name: 'Ras Laffan LNG',          type: 'lng', country: 'Qatar',         lat: 25.9667,  lng: 51.5667,  capacity: '77 MTpa',  status: 'operational', notes: 'World\'s largest LNG complex' },
  // Russia
  { id: 'sakhalin2',     name: 'Sakhalin-2 LNG',          type: 'lng', country: 'Russia',        lat: 52.0000,  lng: 143.0000, capacity: '9.6 MTpa', status: 'operational' },
  { id: 'yamal-lng',     name: 'Yamal LNG',               type: 'lng', country: 'Russia',        lat: 71.2800,  lng: 68.8300,  capacity: '17.4 MTpa',status: 'operational' },
  { id: 'arctic-lng2',   name: 'Arctic LNG-2',            type: 'lng', country: 'Russia',        lat: 71.3333,  lng: 82.5000,  capacity: '19.8 MTpa',status: 'under_construction', notes: 'Sanctioned by Western countries' },
  // Malaysia
  { id: 'mlng',          name: 'Malaysia LNG (MLNG)',      type: 'lng', country: 'Malaysia',      lat: 5.0300,   lng: 118.0000, capacity: '29.3 MTpa',status: 'operational' },
  // Indonesia
  { id: 'bontang',       name: 'Bontang LNG',             type: 'lng', country: 'Indonesia',     lat: 0.1333,   lng: 117.5000, capacity: '22.8 MTpa',status: 'operational' },
  // Algeria
  { id: 'arzew',         name: 'Arzew LNG',               type: 'lng', country: 'Algeria',       lat: 35.8667,  lng: -0.3167,  capacity: '12.2 MTpa',status: 'operational' },
  // Nigeria
  { id: 'nlng',          name: 'Nigeria LNG (NLNG)',       type: 'lng', country: 'Nigeria',       lat: 4.5000,   lng: 7.1667,   capacity: '22 MTpa',  status: 'operational' },
  // Norway
  { id: 'hammerfest',    name: 'Hammerfest LNG',          type: 'lng', country: 'Norway',        lat: 70.6831,  lng: 23.6839,  capacity: '4.3 MTpa', status: 'operational' },
]

// ── Strategic Oil Refineries ────────────────────────────────────────────────
export const MAJOR_REFINERIES: InfraPoint[] = [
  { id: 'jamnagar',      name: 'Jamnagar Refinery',        type: 'refinery', country: 'India',         lat: 22.4707,  lng: 70.0577,  capacity: '1.24M bbl/day', status: 'operational', notes: 'World\'s largest single-location refinery' },
  { id: 'paraguana',     name: 'Paraguaná Refinery',       type: 'refinery', country: 'Venezuela',     lat: 11.7500,  lng: -70.2333, capacity: '940K bbl/day',  status: 'operational' },
  { id: 'sk-energy',     name: 'SK Energy Ulsan',          type: 'refinery', country: 'South Korea',   lat: 35.5500,  lng: 129.3667, capacity: '840K bbl/day',  status: 'operational' },
  { id: 'port-arthur',   name: 'Port Arthur Refinery',     type: 'refinery', country: 'United States', lat: 29.9244,  lng: -93.9397, capacity: '607K bbl/day',  status: 'operational' },
  { id: 'galveston',     name: 'Galveston Bay Refinery',   type: 'refinery', country: 'United States', lat: 29.6494,  lng: -95.0036, capacity: '585K bbl/day',  status: 'operational' },
  { id: 'ruwais',        name: 'Ruwais Refinery',          type: 'refinery', country: 'UAE',           lat: 24.1167,  lng: 52.7000,  capacity: '817K bbl/day',  status: 'operational' },
  { id: 'ras-tanura',    name: 'Ras Tanura Refinery',      type: 'refinery', country: 'Saudi Arabia',  lat: 26.6500,  lng: 50.1667,  capacity: '550K bbl/day',  status: 'operational' },
  { id: 'abadan',        name: 'Abadan Refinery',          type: 'refinery', country: 'Iran',          lat: 30.3500,  lng: 48.2833,  capacity: '400K bbl/day',  status: 'operational' },
  { id: 'antwerp',       name: 'Total Antwerp Refinery',   type: 'refinery', country: 'Belgium',       lat: 51.3000,  lng: 4.2500,   capacity: '360K bbl/day',  status: 'operational' },
  { id: 'rotterdam',     name: 'Shell Pernis Rotterdam',   type: 'refinery', country: 'Netherlands',   lat: 51.8833,  lng: 4.3333,   capacity: '415K bbl/day',  status: 'operational', notes: 'Europe\'s largest refinery' },
  { id: 'omsk',          name: 'Omsk Refinery',            type: 'refinery', country: 'Russia',        lat: 54.9333,  lng: 73.4000,  capacity: '500K bbl/day',  status: 'operational' },
  { id: 'sinopec-zhenhai',name: 'Zhenhai Refinery',        type: 'refinery', country: 'China',         lat: 29.9667,  lng: 121.7167, capacity: '460K bbl/day',  status: 'operational' },
]

// ── Major Pipeline Routes (simplified as polylines) ─────────────────────────
export const PIPELINE_ROUTES: PipelineRoute[] = [
  {
    id: 'nordstream', name: 'Nord Stream (sabotaged)',
    type: 'gas', country: 'Russia/Germany', from: 'Vyborg, Russia', to: 'Lubmin, Germany',
    status: 'suspended', notes: 'Sabotaged Sep 2022 — geopolitically significant',
    coords: [
      [28.7, 60.7], [22.0, 57.5], [14.5, 54.5], [13.8, 54.1],
    ],
  },
  {
    id: 'turkstream', name: 'TurkStream',
    type: 'gas', country: 'Russia/Turkey', from: 'Anapa, Russia', to: 'İstanbul, Turkey',
    status: 'operational', capacity: '31.5 bcm/yr',
    coords: [
      [37.4, 44.9], [35.0, 42.5], [32.0, 41.5], [28.8, 41.0],
    ],
  },
  {
    id: 'tapline', name: 'Trans-Arabian Pipeline',
    type: 'oil', country: 'Saudi Arabia', from: 'Dhahran', to: 'Sidon, Lebanon',
    status: 'suspended', notes: 'Historic pipeline — mostly decommissioned',
    coords: [
      [50.1, 26.4], [44.2, 32.0], [39.1, 32.3], [35.4, 33.5],
    ],
  },
  {
    id: 'baku-tbilisi-ceyhan', name: 'BTC Pipeline',
    type: 'oil', country: 'Azerbaijan/Georgia/Turkey', from: 'Baku', to: 'Ceyhan',
    status: 'operational', capacity: '1.2M bbl/day',
    coords: [
      [49.8, 40.4], [45.0, 41.7], [41.7, 41.7], [38.5, 39.8], [36.1, 36.8],
    ],
  },
  {
    id: 'keystone-xl', name: 'Keystone Pipeline',
    type: 'oil', country: 'United States/Canada', from: 'Hardisty, Alberta', to: 'Port Arthur, TX',
    status: 'operational', capacity: '890K bbl/day',
    coords: [
      [-111.3, 52.7], [-100.0, 48.0], [-98.0, 42.0], [-96.0, 37.0], [-94.0, 30.0],
    ],
  },
  {
    id: 'east-africa', name: 'East Africa Crude Oil Pipeline',
    type: 'oil', country: 'Uganda/Tanzania', from: 'Hoima, Uganda', to: 'Tanga, Tanzania',
    status: 'under_construction', capacity: '216K bbl/day', notes: 'World\'s longest heated pipeline',
    coords: [
      [31.4, 1.4], [33.0, -1.5], [35.8, -4.0], [39.1, -5.1],
    ],
  },
  {
    id: 'cpec-pipeline', name: 'China-Pakistan Pipeline (CPEC)',
    type: 'multi', country: 'Pakistan/China', from: 'Gwadar', to: 'Kashgar',
    status: 'under_construction',
    coords: [
      [62.3, 25.1], [66.5, 28.0], [68.4, 31.5], [69.5, 34.0], [72.0, 36.5], [75.9, 37.2],
    ],
  },
  {
    id: 'igat', name: 'Iran Gas Trunkline (IGAT)',
    type: 'gas', country: 'Iran', from: 'Assaluyeh', to: 'Tehran',
    status: 'operational', notes: 'Main Iranian gas transmission backbone',
    coords: [
      [52.7, 27.5], [51.0, 30.5], [50.8, 32.5], [51.4, 35.7],
    ],
  },
  {
    id: 'yamal-europe', name: 'Yamal-Europe Pipeline',
    type: 'gas', country: 'Russia/Poland/Germany', from: 'Yamal, Russia', to: 'Frankfurt (Oder)',
    status: 'suspended', capacity: '33 bcm/yr',
    coords: [
      [68.8, 71.3], [60.0, 60.0], [55.0, 55.0], [30.0, 52.5], [24.0, 52.2], [14.7, 52.4],
    ],
  },
  {
    id: 'trans-adriatic', name: 'Trans Adriatic Pipeline (TAP)',
    type: 'gas', country: 'Greece/Albania/Italy', from: 'Turkish border', to: 'Brindisi, Italy',
    status: 'operational', capacity: '10 bcm/yr',
    coords: [
      [26.3, 41.4], [23.0, 41.0], [20.5, 40.7], [18.5, 40.6], [17.9, 40.6],
    ],
  },
]

// Combined flat list for map rendering
export const ALL_INFRA_POINTS: InfraPoint[] = [
  ...MAJOR_DAMS,
  ...LNG_TERMINALS,
  ...MAJOR_REFINERIES,
]
