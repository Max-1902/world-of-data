/**
 * Critical supply-chain sites — semiconductor fabs and lithography, rare-earth,
 * lithium, cobalt and nickel operations, and electronics assembly.
 *
 * Curated, not exhaustive: each entry is a named, physically identifiable site
 * with a `source` (operator disclosure, Wikidata item or USGS report) and an
 * `asOf` date for when it was last checked. Coordinates were cross-checked in
 * 2026-10 against the cited Wikidata item or the site as mapped in
 * OpenStreetMap. Country-level production shares in `notes` come from USGS
 * Mineral Commodity Summaries 2026 (2025 estimates). No facility-level
 * "global share" is shown unless a source states one — none currently does.
 * See DATA_PROVENANCE.md.
 */

export type FacilityType = 'fab' | 'equipment' | 'rare_earth' | 'lithium' | 'cobalt' | 'refinery' | 'assembly'

export interface SupplyChainFacility {
  id: string
  name: string
  type: FacilityType
  lat: number
  lng: number
  operator: string
  country: string
  product: string
  /** % of global production — only when a source states it for this facility. */
  globalShare?: number
  notes?: string
  /** Where the entry (existence, operator, location, status) can be checked. */
  source: string
  /** When the entry was last checked against its source (YYYY-MM). */
  asOf: string
}

export const FACILITY_TYPE_COLORS: Record<FacilityType, string> = {
  fab:        '#00ccff',
  equipment:  '#66aaff',
  rare_earth: '#ff8800',
  lithium:    '#44ff88',
  cobalt:     '#aa44ff',
  refinery:   '#ffcc00',
  assembly:   '#ff4488',
}

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  fab:        'Semiconductor Fab',
  equipment:  'Chip-Making Equipment',
  rare_earth: 'Rare Earth Mine',
  lithium:    'Lithium Deposit',
  cobalt:     'Cobalt Mine',
  refinery:   'Processing/Refinery',
  assembly:   'Assembly/Packaging',
}

const USGS_MCS_2026 = 'USGS Mineral Commodity Summaries 2026 — https://pubs.usgs.gov/periodicals/mcs2026/'
const TSMC_FABS = 'https://www.tsmc.com/english/aboutTSMC/TSMC_Fabs'

export const SUPPLY_CHAIN_FACILITIES: SupplyChainFacility[] = [
  // ── Semiconductor fabs ────────────────────────────────────────────────────
  { id: 'tsmc-18', name: 'TSMC Fab 18', type: 'fab', lat: 23.116, lng: 120.262, operator: 'TSMC', country: 'Taiwan', product: '5nm / 3nm logic', notes: 'Southern Taiwan Science Park, Tainan. TSMC\'s GIGAFAB for 5nm and 3nm; 3nm volume production announced Dec 2022.', source: `TSMC fab list ${TSMC_FABS}; TSMC press release 2022-12-29 https://pr.tsmc.com/english/news/2986`, asOf: '2026-10' },
  { id: 'tsmc-15', name: 'TSMC Fab 15', type: 'fab', lat: 24.210, lng: 120.618, operator: 'TSMC', country: 'Taiwan', product: '12-inch logic wafers', notes: 'Central Taiwan Science Park, Taichung. Marker at the science park (Wikidata Q10876715).', source: `TSMC fab list ${TSMC_FABS}`, asOf: '2026-10' },
  { id: 'tsmc-az', name: 'TSMC Arizona (Fab 21)', type: 'fab', lat: 33.778, lng: -112.162, operator: 'TSMC', country: 'USA', product: '4nm logic', notes: 'North Phoenix. High-volume N4 production began Q4 2024.', source: `TSMC fab list ${TSMC_FABS}; Wikidata Q135913497`, asOf: '2026-10' },
  { id: 'samsung-pyeongtaek', name: 'Samsung Pyeongtaek Campus', type: 'fab', lat: 37.036, lng: 127.060, operator: 'Samsung Electronics', country: 'South Korea', product: 'Memory and foundry', source: 'Samsung Semiconductor locations https://semiconductor.samsung.com/about-us/locations/', asOf: '2026-10' },
  { id: 'samsung-taylor', name: 'Samsung Taylor Fab', type: 'fab', lat: 30.537, lng: -97.453, operator: 'Samsung Electronics', country: 'USA', product: 'Foundry (2nm planned)', notes: 'Under construction; operations reported as targeted for late 2026.', source: 'U.S. Dept. of Commerce CHIPS award to Samsung (2024); site as mapped in OpenStreetMap', asOf: '2026-10' },
  { id: 'intel-ronler', name: 'Intel Ronler Acres (D1X)', type: 'fab', lat: 45.546, lng: -122.912, operator: 'Intel', country: 'USA', product: 'Process development and logic', notes: 'Hillsboro, Oregon — Intel\'s main technology-development site.', source: 'Intel newsroom https://newsroom.intel.com/corporate/oregon-investments-fuel-us-silicon-innovation-leadership; site as mapped in OpenStreetMap', asOf: '2026-10' },
  { id: 'intel-ohio', name: 'Intel Ohio One', type: 'fab', lat: 40.117, lng: -82.711, operator: 'Intel', country: 'USA', product: 'Logic (planned)', notes: 'Licking County, Ohio. Under construction; in Feb 2025 Intel moved completion of the first fab to 2030, with operations by 2031.', source: 'Intel newsroom https://newsroom.intel.com/corporate/ohio-one-construction-timeline-update; site as mapped in OpenStreetMap', asOf: '2026-10' },
  { id: 'sk-icheon', name: 'SK hynix Icheon Campus', type: 'fab', lat: 37.250, lng: 127.482, operator: 'SK hynix', country: 'South Korea', product: 'DRAM', notes: 'SK hynix headquarters and main DRAM campus.', source: 'SK hynix https://www.skhynix.com/', asOf: '2026-10' },
  { id: 'micron-hiroshima', name: 'Micron Hiroshima', type: 'fab', lat: 34.387, lng: 132.683, operator: 'Micron', country: 'Japan', product: 'DRAM', notes: 'Yoshikawa industrial park, Higashihiroshima (former Elpida fab).', source: 'Micron Japan https://www.micron.com/about/locations; site as mapped in OpenStreetMap', asOf: '2026-10' },
  { id: 'gf-malta', name: 'GlobalFoundries Fab 8', type: 'fab', lat: 42.971, lng: -73.757, operator: 'GlobalFoundries', country: 'USA', product: 'Logic wafers', notes: 'Luther Forest Technology Campus, Malta, New York. GlobalFoundries\' headquarters since 2021, which it describes as its most advanced fab.', source: 'GlobalFoundries press release, Apr 2021 (HQ moves to Fab 8); Wikidata Q14706848', asOf: '2026-10' },
  { id: 'smic-shanghai', name: 'SMIC Shanghai (Zhangjiang)', type: 'fab', lat: 31.217, lng: 121.603, operator: 'SMIC', country: 'China', product: 'Logic wafers', notes: 'SMIC headquarters fab cluster, Zhangjiang, Pudong. SMIC was added to the US Entity List in Dec 2020.', source: 'SMIC https://www.smics.com/en/; site as mapped in OpenStreetMap', asOf: '2026-10' },
  { id: 'rapidus-chitose', name: 'Rapidus IIM-1', type: 'fab', lat: 42.787, lng: 141.707, operator: 'Rapidus', country: 'Japan', product: '2nm (pilot line)', notes: 'Chitose, Hokkaido. Pilot line running 2nm test wafers since 2025 (process developed with IBM); mass production targeted for 2027.', source: 'Rapidus https://www.rapidus.inc/en/', asOf: '2026-10' },

  // ── Lithography ───────────────────────────────────────────────────────────
  { id: 'asml-veldhoven', name: 'ASML Veldhoven', type: 'equipment', lat: 51.403, lng: 5.414, operator: 'ASML', country: 'Netherlands', product: 'EUV and DUV lithography systems', notes: 'ASML headquarters; ASML is the only supplier of EUV lithography systems.', source: 'ASML annual report https://investor.asml.com/annual-reports', asOf: '2026-10' },

  // ── Rare earths ───────────────────────────────────────────────────────────
  { id: 're-bayan-obo', name: 'Bayan Obo', type: 'rare_earth', lat: 41.768, lng: 109.966, operator: 'Baotou Steel / China Northern Rare Earth', country: 'China', product: 'Light rare earths (with iron ore)', notes: 'China produced about 69% of world rare-earth mine output in 2025 (USGS).', source: `Wikidata Q8895769; ${USGS_MCS_2026}`, asOf: '2026-10' },
  { id: 're-mount-weld', name: 'Mount Weld', type: 'rare_earth', lat: -28.860, lng: 122.548, operator: 'Lynas Rare Earths', country: 'Australia', product: 'Rare-earth concentrate (NdPr)', notes: 'Concentrate is processed at Lynas\'s plant in Kuantan, Malaysia.', source: 'Wikidata Q1950809; Lynas https://lynasrareearths.com/', asOf: '2026-10' },
  { id: 're-mountain-pass', name: 'Mountain Pass', type: 'rare_earth', lat: 35.479, lng: -115.533, operator: 'MP Materials', country: 'USA', product: 'Bastnaesite concentrate, NdPr', notes: 'The only US mine producing bastnaesite as a primary product in 2025 (USGS); US output was about 13% of world mine production.', source: `Wikidata Q4285560; ${USGS_MCS_2026}`, asOf: '2026-10' },
  { id: 're-lynas-kuantan', name: 'Lynas Advanced Materials Plant', type: 'refinery', lat: 3.970, lng: 103.430, operator: 'Lynas Rare Earths', country: 'Malaysia', product: 'Separated rare-earth oxides', notes: 'Gebeng, Kuantan. Processes Mount Weld concentrate.', source: 'Wikidata Q137942208; Lynas https://lynasrareearths.com/', asOf: '2026-10' },

  // ── Lithium ───────────────────────────────────────────────────────────────
  { id: 'li-atacama', name: 'Salar de Atacama', type: 'lithium', lat: -23.417, lng: -68.267, operator: 'SQM / Albemarle', country: 'Chile', product: 'Lithium brine (carbonate)', notes: 'Chile produced about 19% of world lithium in 2025 (USGS).', source: `Wikidata Q1142015; ${USGS_MCS_2026}`, asOf: '2026-10' },
  { id: 'li-uyuni', name: 'Salar de Uyuni', type: 'lithium', lat: -20.204, lng: -67.515, operator: 'YLB (state)', country: 'Bolivia', product: 'Lithium brine (largely undeveloped)', notes: 'USGS puts Bolivia\'s identified lithium resources at 23 million tons; it reports no Bolivian mine production.', source: `Wikidata Q76122; ${USGS_MCS_2026}`, asOf: '2026-10' },
  { id: 'li-hombre-muerto', name: 'Fénix (Salar del Hombre Muerto)', type: 'lithium', lat: -25.350, lng: -67.070, operator: 'Rio Tinto (ex-Arcadium Lithium)', country: 'Argentina', product: 'Lithium carbonate', notes: 'Rio Tinto completed its acquisition of Arcadium Lithium in March 2025.', source: 'Wikidata Q1367981; Rio Tinto 2025 annual report https://www.sec.gov/Archives/edgar/data/863064/000162828026009503/a2025annualreport-glossy.pdf', asOf: '2026-10' },
  { id: 'li-greenbushes', name: 'Greenbushes', type: 'lithium', lat: -33.866, lng: 116.065, operator: 'Talison Lithium (Tianqi/IGO JV 51%, Albemarle 49%)', country: 'Australia', product: 'Spodumene concentrate', notes: 'Australia produced about 32% of world lithium in 2025 (USGS).', source: `Wikidata Q16891876; IGO https://www.igo.com.au/; ${USGS_MCS_2026}`, asOf: '2026-10' },
  { id: 'li-thacker-pass', name: 'Thacker Pass', type: 'lithium', lat: 41.703, lng: -118.070, operator: 'Lithium Americas', country: 'USA', product: 'Lithium carbonate (under construction)', notes: 'Humboldt County, Nevada. Phase 1 mechanical completion targeted for 2027.', source: 'Wikidata Q137843953; Lithium Americas project updates (2025)', asOf: '2026-10' },

  // ── Cobalt (Central African Copperbelt) ───────────────────────────────────
  { id: 'co-kcc', name: 'Kamoto Copper Company (KCC)', type: 'cobalt', lat: -10.715, lng: 25.467, operator: 'Glencore (75%) / Gécamines', country: 'DRC', product: 'Copper / cobalt', notes: 'Kolwezi. Marker at Kolwezi town (Wikidata Q271404); KCC\'s pits lie around the town. The DRC produced about 74% of world cobalt in 2025 (USGS).', source: `Glencore https://www.glencore.com/; ${USGS_MCS_2026}`, asOf: '2026-10' },
  { id: 'co-tenke', name: 'Tenke Fungurume', type: 'cobalt', lat: -10.571, lng: 26.181, operator: 'CMOC (80%) / Gécamines', country: 'DRC', product: 'Copper / cobalt', source: 'Wikidata Q7699914; CMOC https://en.cmoc.com/', asOf: '2026-10' },
  { id: 'co-mutanda', name: 'Mutanda', type: 'cobalt', lat: -10.786, lng: 25.808, operator: 'Glencore', country: 'DRC', product: 'Copper / cobalt', notes: 'Placed on care and maintenance in 2019; restarted in 2022.', source: 'Wikidata Q6943664; Glencore https://www.glencore.com/', asOf: '2026-10' },

  // ── Nickel ────────────────────────────────────────────────────────────────
  { id: 'ni-morowali', name: 'Indonesia Morowali Industrial Park (IMIP)', type: 'refinery', lat: -2.830, lng: 122.160, operator: 'PT IMIP (Tsingshan joint venture)', country: 'Indonesia', product: 'Nickel pig iron, nickel matte, stainless steel', notes: 'Bahodopi, Central Sulawesi. Indonesia produced about 67% of world nickel in 2025 (USGS).', source: `Wikidata Q108673012; ${USGS_MCS_2026}`, asOf: '2026-10' },

  // ── Assembly / test ───────────────────────────────────────────────────────
  { id: 'asm-zhengzhou', name: 'Foxconn Zhengzhou Science Park', type: 'assembly', lat: 34.554, lng: 113.842, operator: 'Foxconn (Hon Hai)', country: 'China', product: 'Smartphone assembly', notes: 'Zhengzhou Airport Economy Zone.', source: 'Site as mapped in OpenStreetMap; Hon Hai annual report https://www.honhai.com/en-us/investor-relations', asOf: '2026-10' },
  { id: 'asm-penang', name: 'Intel Penang', type: 'assembly', lat: 5.327, lng: 100.304, operator: 'Intel', country: 'Malaysia', product: 'Chip assembly and test', notes: 'Bayan Lepas Free Industrial Zone. Intel\'s first production site outside the US (1972).', source: 'Intel https://www.intel.com/content/www/us/en/history/virtual-vault/articles/intel-penang.html; site as mapped in OpenStreetMap', asOf: '2026-10' },
]
