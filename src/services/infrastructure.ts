/**
 * Critical Civil & Energy Infrastructure
 * Dams, oil/gas pipelines, LNG terminals, power grid hubs, power plants
 * (coal/gas/wind/solar — nuclear plants live in services/military.ts),
 * major hospitals, police/security HQs, and telecom hubs.
 *
 * Curated major/flagship facilities only (not exhaustive) — same approach
 * as the rest of this file: enough coverage per major country to be useful
 * without shipping a 100k-row global facility database.
 *
 * Sources: GRanD database, EIA, IEA, Global Energy Monitor (coal/wind/solar
 * plant trackers), national health-ministry facility lists, public OSINT.
 */

export type InfraType =
  | 'dam' | 'pipeline' | 'lng' | 'refinery' | 'grid'
  | 'power_coal' | 'power_gas' | 'power_wind' | 'power_solar'
  | 'hospital' | 'police' | 'telecom'

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


export const INFRA_COLORS: Record<InfraType, string> = {
  dam:         '#00aaff',
  pipeline:    '#ff8800',
  lng:         '#ffdd00',
  refinery:    '#ff4400',
  grid:        '#00ff88',
  power_coal:  '#6b7280',
  power_gas:   '#f97316',
  power_wind:  '#22d3ee',
  power_solar: '#facc15',
  hospital:    '#ef4444',
  police:      '#3b82f6',
  telecom:     '#a855f7',
}

export const INFRA_LABELS: Record<InfraType, string> = {
  dam:         'DAM',
  pipeline:    'PIPELINE',
  lng:         'LNG',
  refinery:    'REFINERY',
  grid:        'GRID HUB',
  power_coal:  'COAL PLANT',
  power_gas:   'GAS PLANT',
  power_wind:  'WIND FARM',
  power_solar: 'SOLAR PLANT',
  hospital:    'HOSPITAL',
  police:      'POLICE HQ',
  telecom:     'TELECOM HUB',
}

export const INFRA_ICONS: Record<InfraType, string> = {
  dam:         '◢',
  pipeline:    '⬡',
  lng:         '◇',
  refinery:    '▣',
  grid:        '↯',
  power_coal:  '●',
  power_gas:   '✱',
  power_wind:  '≈',
  power_solar: '☼',
  hospital:    '✚',
  police:      '◍',
  telecom:     '⌁',
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

// Combined flat list for map rendering (static, curated entries)
export const ALL_INFRA_POINTS: InfraPoint[] = [
  ...MAJOR_DAMS,
  ...LNG_TERMINALS,
  ...MAJOR_REFINERIES,
]

// ── Power Plants (live) ──────────────────────────────────────────────────────
// World Resources Institute Global Power Plant Database — ~35,000 real,
// geolocated power plants across 167 countries (coal/gas/oil/wind/solar/
// hydro/nuclear/etc), CC-BY-4.0. Fetched and cached in-memory; no API key.
// https://github.com/wri/global-power-plant-database
const GPPD_URL = 'https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv'

export interface PowerPlantRow {
  country:    string  // ISO3
  countryLong: string // full English name
  name:       string
  capacityMw: number
  lat:        number
  lng:        number
  fuel:       string  // primary_fuel, e.g. "Coal", "Gas", "Wind", "Solar", "Hydro", "Nuclear"
}

const FUEL_TO_INFRA_TYPE: Record<string, InfraType | undefined> = {
  coal:  'power_coal',
  gas:   'power_gas',
  wind:  'power_wind',
  solar: 'power_solar',
}

let gppdRows: PowerPlantRow[] | null = null
let gppdPromise: Promise<PowerPlantRow[]> | null = null

// Minimal CSV line parser handling quoted fields (plant/owner names can contain commas)
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQuotes = false
      else cur += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
  }
  out.push(cur)
  return out
}

async function fetchGppd(): Promise<PowerPlantRow[]> {
  if (gppdRows) return gppdRows
  if (gppdPromise) return gppdPromise
  gppdPromise = (async () => {
    const res = await fetch(GPPD_URL, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`GPPD HTTP ${res.status}`)
    const text = await res.text()
    const lines = text.split('\n')
    const header = parseCsvLine(lines[0])
    const idx = {
      country:     header.indexOf('country'),
      countryLong: header.indexOf('country_long'),
      name:        header.indexOf('name'),
      capacity:    header.indexOf('capacity_mw'),
      lat:         header.indexOf('latitude'),
      lng:         header.indexOf('longitude'),
      fuel:        header.indexOf('primary_fuel'),
    }
    const rows: PowerPlantRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue
      const cols = parseCsvLine(line)
      const lat = parseFloat(cols[idx.lat])
      const lng = parseFloat(cols[idx.lng])
      const capacityMw = parseFloat(cols[idx.capacity])
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(capacityMw)) continue
      rows.push({
        country:     cols[idx.country],
        countryLong: cols[idx.countryLong],
        name:        cols[idx.name],
        capacityMw,
        lat, lng,
        fuel:        cols[idx.fuel],
      })
    }
    gppdRows = rows
    return rows
  })()
  // Clear a rejected download so a later call can retry instead of re-throwing forever.
  gppdPromise.catch(() => { gppdPromise = null })
  return gppdPromise
}

/**
 * Fetch the top-N power plants (by capacity) for coal/gas/wind/solar worldwide,
 * for the global map layer. Keeps the map layer to a manageable point count
 * instead of rendering all ~35,000 real plants at once.
 */
export async function fetchTopPowerPlants(perFuelLimit = 60): Promise<InfraPoint[]> {
  const rows = await fetchGppd()
  const byFuel = new Map<string, PowerPlantRow[]>()
  for (const r of rows) {
    const type = FUEL_TO_INFRA_TYPE[r.fuel.toLowerCase()]
    if (!type) continue
    const list = byFuel.get(type) ?? []
    list.push(r)
    byFuel.set(type, list)
  }
  const out: InfraPoint[] = []
  for (const [type, list] of byFuel) {
    list.sort((a, b) => b.capacityMw - a.capacityMw)
    for (const r of list.slice(0, perFuelLimit)) {
      out.push({
        id:       `gppd-${type}-${r.name}-${r.lat}-${r.lng}`,
        name:     r.name,
        type:     type as InfraType,
        country:  r.countryLong,
        lat:      r.lat,
        lng:      r.lng,
        capacity: `${Math.round(r.capacityMw).toLocaleString()} MW`,
        status:   'operational',
        notes:    'Source: WRI Global Power Plant Database',
      })
    }
  }
  return out
}

/** Fetch all power plants (any fuel) for a specific country — used by CountryDrawer. */
export async function fetchPowerPlantsForCountry(countryName: string): Promise<InfraPoint[]> {
  const rows = await fetchGppd()
  const lc = countryName.toLowerCase()
  const matches = rows.filter(r => {
    const rc = r.countryLong.toLowerCase()
    return rc.includes(lc) || lc.includes(rc)
  })
  matches.sort((a, b) => b.capacityMw - a.capacityMw)
  return matches.slice(0, 30).map(r => {
    const type = FUEL_TO_INFRA_TYPE[r.fuel.toLowerCase()]
    return {
      id:       `gppd-${r.name}-${r.lat}-${r.lng}`,
      name:     r.name,
      type:     (type ?? 'grid') as InfraType,
      country:  r.countryLong,
      lat:      r.lat,
      lng:      r.lng,
      capacity: `${Math.round(r.capacityMw).toLocaleString()} MW`,
      status:   'operational',
      notes:    `${r.fuel} — Source: WRI Global Power Plant Database`,
    }
  })
}
