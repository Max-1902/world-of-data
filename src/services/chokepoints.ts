/**
 * Strategic maritime chokepoints — straits and canals that concentrate global
 * shipping. Every number shown for a chokepoint is cited and dated:
 *
 *  - Vessel transits & top cargo industries: IMF PortWatch, averaged over one
 *    calendar year of daily AIS-derived counts. Generated, not hand-typed —
 *    see scripts/build-chokepoints.mjs → src/data/chokepoints-portwatch.json.
 *  - Oil flows: U.S. EIA, "World Oil Transit Chokepoints" (last updated
 *    2026-03-03), Table 1, full-year 2024 (Panama: fiscal year Oct–Sep).
 *
 * Hand-entered here: names, label positions, `controlledBy`, the `risks` list
 * (editorial, qualitative) and the `zone` outlines, which are simplified
 * rectangles for display, not surveyed boundaries. See DATA_PROVENANCE.md.
 */
import portwatch from '../data/chokepoints-portwatch.json'

export const EIA_CHOKEPOINTS_SOURCE = {
  name: 'U.S. EIA — World Oil Transit Chokepoints, Table 1',
  url: 'https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints',
  year: 2024,
  /** World maritime oil trade in the same table and year, million b/d. */
  worldMaritimeOilMbd: 79.7,
} as const

export interface ChokepointTransits {
  avgDaily: number
  avgDailyTankers: number
  avgDailyCapacityDwt: number
  topIndustries: string[]
  year: number
  source: string
  url: string
  /** Set when PortWatch's measurement line covers only part of the chokepoint. */
  scope?: string
}

export interface Chokepoint {
  id: string
  name: string
  lat: number
  lng: number
  controlledBy: string
  /** Editorial, qualitative risk factors — not a measured quantity. */
  risks: string[]
  /** Only facts with a stated source. */
  notes?: string
  /** EIA oil flow, million barrels/day, year in EIA_CHOKEPOINTS_SOURCE. */
  oilFlowMbd?: number
  transits?: ChokepointTransits
  // Simplified display outline for the strait/canal zone
  zone: [number, number][]     // [lng, lat] ring
}

type PortWatchRow = (typeof portwatch.chokepoints)[keyof typeof portwatch.chokepoints]

function transits(portwatchId: keyof typeof portwatch.chokepoints, scope?: string): ChokepointTransits {
  const r: PortWatchRow = portwatch.chokepoints[portwatchId]
  return {
    avgDaily: r.avgDailyTransits,
    avgDailyTankers: r.avgDailyTankers,
    avgDailyCapacityDwt: r.avgDailyCapacityDwt,
    topIndustries: r.topIndustries,
    year: portwatch.year,
    source: 'IMF PortWatch',
    url: portwatch.url,
    scope,
  }
}

/** Share of world maritime oil trade, %, from the same EIA table. */
export function oilSharePct(c: Chokepoint): number | null {
  return c.oilFlowMbd == null ? null : Math.round((c.oilFlowMbd / EIA_CHOKEPOINTS_SOURCE.worldMaritimeOilMbd) * 1000) / 10
}

export const CHOKEPOINTS: Chokepoint[] = [
  {
    id: 'suez', name: 'Suez Canal',
    lat: 30.58, lng: 32.34,
    controlledBy: 'Egypt (Suez Canal Authority)',
    risks: ['Red Sea shipping attacks', 'Vessel grounding', 'Geopolitical closure'],
    notes: 'EIA oil figure includes the parallel SUMED pipeline. EIA reports flows fell from 8.8 million b/d (2023) to 4.8 million b/d (2024) as ships rerouted around the Cape after Red Sea attacks.',
    oilFlowMbd: 4.8,
    transits: transits('chokepoint1'),
    zone: [[32.28,30.10],[32.40,30.10],[32.58,30.85],[32.58,31.28],[32.32,31.28],[32.32,30.85],[32.28,30.10]],
  },
  {
    id: 'hormuz', name: 'Strait of Hormuz',
    lat: 26.56, lng: 56.25,
    controlledBy: 'Iran / Oman (shared)',
    risks: ['Closure threats', 'Mine warfare', 'Drone/missile attacks', 'Naval confrontation'],
    oilFlowMbd: 20.7,
    transits: transits('chokepoint6'),
    zone: [[55.80,26.20],[56.70,26.20],[56.70,26.90],[55.80,26.90],[55.80,26.20]],
  },
  {
    id: 'malacca', name: 'Strait of Malacca',
    lat: 2.50, lng: 101.20,
    controlledBy: 'Malaysia / Indonesia / Singapore',
    risks: ['Piracy', 'Congestion', 'Geopolitical tension'],
    notes: 'Largest chokepoint by oil volume in the EIA table.',
    oilFlowMbd: 22.5,
    transits: transits('chokepoint5'),
    zone: [[99.50,1.20],[100.20,1.20],[104.20,1.40],[104.20,1.60],[100.20,3.80],[99.50,3.80],[99.50,1.20]],
  },
  {
    id: 'panama', name: 'Panama Canal',
    lat: 9.08, lng: -79.68,
    controlledBy: 'Panama (Panama Canal Authority)',
    risks: ['Drought / low water levels', 'Lock maintenance', 'Queue congestion'],
    notes: 'About 50 miles long (EIA). EIA oil figure is for the canal fiscal year (Oct–Sep).',
    oilFlowMbd: 2.0,
    transits: transits('chokepoint2'),
    zone: [[-79.95,8.85],[-79.50,8.85],[-79.50,9.40],[-79.95,9.40],[-79.95,8.85]],
  },
  {
    id: 'bosphorus', name: 'Turkish Straits (Bosphorus)',
    lat: 41.12, lng: 29.05,
    controlledBy: 'Turkey',
    risks: ['Montreux Convention restrictions', 'Congestion', 'Collision risk'],
    notes: 'Bosphorus (17 nautical miles) + Dardanelles (37 nautical miles); less than half a nautical mile wide at the narrowest point (EIA). EIA oil figure is measured at the Dardanelles.',
    oilFlowMbd: 3.6,
    transits: transits('chokepoint3', 'Bosphorus'),
    zone: [[28.95,41.00],[29.15,41.00],[29.15,41.25],[28.95,41.25],[28.95,41.00]],
  },
  {
    id: 'babel-mandeb', name: 'Bab el-Mandeb',
    lat: 12.58, lng: 43.33,
    controlledBy: 'Yemen / Djibouti / Eritrea',
    risks: ['Red Sea shipping attacks', 'Piracy (Somalia)', 'Maritime terrorism'],
    notes: 'Links the Red Sea to the Gulf of Aden. EIA reports oil flows fell from 9.3 million b/d (2023) to 4.1 million b/d (2024).',
    oilFlowMbd: 4.1,
    transits: transits('chokepoint4'),
    zone: [[43.00,12.30],[43.65,12.30],[43.65,12.85],[43.00,12.85],[43.00,12.30]],
  },
  {
    id: 'cape-good-hope', name: 'Cape of Good Hope',
    lat: -34.35, lng: 18.47,
    controlledBy: 'South Africa',
    risks: ['Extreme weather', 'Long transit time'],
    notes: 'Main alternative to the Suez route. EIA reports oil flows rose from 6.2 million b/d (2023) to 9.3 million b/d (2024).',
    oilFlowMbd: 9.3,
    transits: transits('chokepoint7'),
    zone: [[17.50,-34.80],[19.50,-34.80],[19.50,-33.90],[17.50,-33.90],[17.50,-34.80]],
  },
  {
    id: 'lombok', name: 'Lombok Strait',
    lat: -8.47, lng: 115.70,
    controlledBy: 'Indonesia',
    risks: ['Strong currents', 'Limited infrastructure'],
    transits: transits('chokepoint15'),
    zone: [[115.40,-8.80],[116.00,-8.80],[116.00,-8.15],[115.40,-8.15],[115.40,-8.80]],
  },
  {
    id: 'gibraltar', name: 'Strait of Gibraltar',
    lat: 35.95, lng: -5.60,
    controlledBy: 'Spain / Morocco / UK (Gibraltar)',
    risks: ['Congestion', 'Collision risk (narrow channel)'],
    notes: 'Only sea link between the Mediterranean and the Atlantic.',
    transits: transits('chokepoint8'),
    zone: [[-5.90,35.85],[-5.30,35.85],[-5.30,36.15],[-5.90,36.15],[-5.90,35.85]],
  },
  {
    id: 'magellan', name: 'Strait of Magellan',
    lat: -52.90, lng: -70.50,
    controlledBy: 'Chile',
    risks: ['Extreme weather', 'Strong currents', 'Limited navigational aids'],
    notes: 'Atlantic–Pacific passage at the southern tip of South America; an alternative to the Panama Canal (EIA).',
    transits: transits('chokepoint21'),
    zone: [[-71.50,-53.20],[-68.50,-53.20],[-68.50,-52.30],[-71.50,-52.30],[-71.50,-53.20]],
  },
  {
    id: 'denmark', name: 'Danish Straits',
    lat: 55.70, lng: 11.00,
    controlledBy: 'Denmark / Sweden',
    risks: ['Shallow draft restrictions', 'Ice (winter)', 'Subsea infrastructure sabotage'],
    notes: 'Øresund + Great Belt + Little Belt; Baltic Sea access. The EIA oil figure covers all three (excluding the Kiel Canal); the PortWatch transit count covers the Øresund only.',
    oilFlowMbd: 4.9,
    transits: transits('chokepoint10', 'Øresund only'),
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
