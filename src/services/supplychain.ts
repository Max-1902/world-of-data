/**
 * Critical supply chain infrastructure — semiconductor fabs, rare earth mines,
 * lithium/cobalt deposits, and key manufacturing clusters.
 */

export type FacilityType = 'fab' | 'rare_earth' | 'lithium' | 'cobalt' | 'refinery' | 'assembly'

export interface SupplyChainFacility {
  id: string
  name: string
  type: FacilityType
  lat: number
  lng: number
  operator: string
  country: string
  product: string
  globalShare?: number   // % of global production
  notes?: string
}

export const FACILITY_TYPE_COLORS: Record<FacilityType, string> = {
  fab:        '#00ccff',
  rare_earth: '#ff8800',
  lithium:    '#44ff88',
  cobalt:     '#aa44ff',
  refinery:   '#ffcc00',
  assembly:   '#ff4488',
}

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  fab:        'Semiconductor Fab',
  rare_earth: 'Rare Earth Mine',
  lithium:    'Lithium Deposit',
  cobalt:     'Cobalt Mine',
  refinery:   'Processing/Refinery',
  assembly:   'Assembly/Packaging',
}

export const SUPPLY_CHAIN_FACILITIES: SupplyChainFacility[] = [
  // ── Semiconductor Fabs ────────────────────────────────────────────────────
  { id: 'tsmc-3',   name: 'TSMC Fab 18', type: 'fab', lat: 23.12, lng: 120.27, operator: 'TSMC', country: 'Taiwan', product: '3nm / 5nm chips', globalShare: 54, notes: 'World\'s most advanced logic fab. 54% global foundry market share.' },
  { id: 'tsmc-5a',  name: 'TSMC Fab 15', type: 'fab', lat: 24.78, lng: 121.00, operator: 'TSMC', country: 'Taiwan', product: '7nm / 16nm chips', notes: 'Major production facility, Hsinchu Science Park.' },
  { id: 'tsmc-az',  name: 'TSMC Arizona', type: 'fab', lat: 33.67, lng: -112.01, operator: 'TSMC', country: 'USA', product: '4nm chips', notes: '$40B investment. First US advanced node fab. Production from 2025.' },
  { id: 'samsung-pyeongtaek', name: 'Samsung Pyeongtaek', type: 'fab', lat: 36.99, lng: 127.11, operator: 'Samsung', country: 'South Korea', product: '3nm GAA / DRAM', globalShare: 17, notes: 'World\'s largest semiconductor complex. $230B total investment.' },
  { id: 'samsung-taylor', name: 'Samsung Taylor', type: 'fab', lat: 30.57, lng: -97.41, operator: 'Samsung', country: 'USA', product: '5nm chips', notes: '$17B investment, Texas.' },
  { id: 'intel-d1x', name: 'Intel D1X', type: 'fab', lat: 45.54, lng: -122.96, operator: 'Intel', country: 'USA', product: 'Intel 4 / Intel 3', notes: 'Hillsboro, OR. Intel\'s most advanced US fab.' },
  { id: 'intel-ohio', name: 'Intel Ohio', type: 'fab', lat: 40.08, lng: -82.67, operator: 'Intel', country: 'USA', product: 'Intel 18A', notes: '$20B mega-site. Production expected 2025-2026.' },
  { id: 'intel-magdeburg', name: 'Intel Magdeburg', type: 'fab', lat: 52.13, lng: 11.64, operator: 'Intel', country: 'Germany', product: 'Ångström-era chips', notes: '€30B EU Chips Act investment. Under construction.' },
  { id: 'sk-icheon', name: 'SK Hynix Icheon', type: 'fab', lat: 37.27, lng: 127.44, operator: 'SK Hynix', country: 'South Korea', product: 'HBM / DRAM', globalShare: 28, notes: '28% global DRAM share. HBM3E leader for AI chips.' },
  { id: 'micron-hiroshima', name: 'Micron Hiroshima', type: 'fab', lat: 34.40, lng: 132.45, operator: 'Micron', country: 'Japan', product: 'DRAM (1-beta)', notes: 'Most advanced DRAM node. Japanese government subsidy.' },
  { id: 'globalfoundries-malta', name: 'GlobalFoundries Malta', type: 'fab', lat: 42.98, lng: -73.86, operator: 'GlobalFoundries', country: 'USA', product: '12nm / 14nm', notes: 'Largest US-owned foundry. Defense/auto chips.' },
  { id: 'smic-shanghai', name: 'SMIC Shanghai', type: 'fab', lat: 31.12, lng: 121.60, operator: 'SMIC', country: 'China', product: '7nm (N+2)', globalShare: 6, notes: 'China\'s most advanced fab. US export controls limit EUV access.' },
  { id: 'rapidus-chitose', name: 'Rapidus Chitose', type: 'fab', lat: 42.79, lng: 141.66, operator: 'Rapidus', country: 'Japan', product: '2nm (planned)', notes: 'IBM partnership. Japan\'s attempt to re-enter leading-edge. 2027 target.' },

  // ── ASML (lithography monopoly) ───────────────────────────────────────────
  { id: 'asml-veldhoven', name: 'ASML Veldhoven', type: 'fab', lat: 51.41, lng: 5.46, operator: 'ASML', country: 'Netherlands', product: 'EUV lithography systems', globalShare: 100, notes: 'Only EUV manufacturer globally. Single point of failure for advanced chips.' },

  // ── Rare Earth Mines ──────────────────────────────────────────────────────
  { id: 're-bayan-obo', name: 'Bayan Obo Mine', type: 'rare_earth', lat: 41.80, lng: 109.97, operator: 'Baotou Steel', country: 'China', product: 'Neodymium, Cerium, Lanthanum', globalShare: 45, notes: 'World\'s largest rare earth deposit. Inner Mongolia.' },
  { id: 're-sichuan', name: 'Sichuan RE Mines', type: 'rare_earth', lat: 29.50, lng: 102.50, operator: 'Various (state)', country: 'China', product: 'Heavy rare earths', notes: 'Ion-adsorption clays. Key source of heavy REEs (Dy, Tb).' },
  { id: 're-mount-weld', name: 'Mount Weld', type: 'rare_earth', lat: -28.77, lng: 122.55, operator: 'Lynas', country: 'Australia', product: 'Neodymium, Praseodymium', globalShare: 7, notes: 'Richest known RE deposit. Processed in Malaysia (Kuantan).' },
  { id: 're-mountain-pass', name: 'Mountain Pass', type: 'rare_earth', lat: 35.48, lng: -115.53, operator: 'MP Materials', country: 'USA', product: 'Cerium, Lanthanum, NdPr', globalShare: 12, notes: 'Only active US rare earth mine. Concentrate still sent to China for processing.' },
  { id: 're-lynas-kuantan', name: 'Lynas LAMP', type: 'refinery', lat: 3.97, lng: 103.42, operator: 'Lynas', country: 'Malaysia', product: 'NdPr oxide, La, Ce', notes: 'Only major RE processing outside China. Political controversy.' },
  { id: 're-nechalacho', name: 'Nechalacho', type: 'rare_earth', lat: 62.15, lng: -112.57, operator: 'Vital Metals', country: 'Canada', product: 'Bastnäsite concentrate', notes: 'Canada\'s first RE mine. Small-scale production since 2021.' },

  // ── Lithium Triangle ──────────────────────────────────────────────────────
  { id: 'li-atacama', name: 'Salar de Atacama', type: 'lithium', lat: -23.50, lng: -68.20, operator: 'SQM / Albemarle', country: 'Chile', product: 'Lithium carbonate', globalShare: 26, notes: 'Highest concentration lithium brine. Chile has 36% of global reserves.' },
  { id: 'li-uyuni', name: 'Salar de Uyuni', type: 'lithium', lat: -20.13, lng: -67.49, operator: 'YLB (state)', country: 'Bolivia', product: 'Lithium (undeveloped)', notes: 'World\'s largest lithium resource (~21M tonnes). Largely undeveloped due to altitude/politics.' },
  { id: 'li-hombre-muerto', name: 'Salar del Hombre Muerto', type: 'lithium', lat: -25.35, lng: -67.08, operator: 'Livent / Galaxy', country: 'Argentina', product: 'Lithium carbonate', globalShare: 6, notes: 'Part of Argentina\'s "lithium triangle" push.' },
  { id: 'li-greenbushes', name: 'Greenbushes', type: 'lithium', lat: -33.85, lng: 116.06, operator: 'Talison (Tianqi/Albemarle)', country: 'Australia', product: 'Spodumene concentrate', globalShare: 30, notes: 'World\'s largest hard-rock lithium mine. 46% owned by Tianqi (China).' },
  { id: 'li-ganfeng-xinyu', name: 'Ganfeng Xinyu', type: 'refinery', lat: 27.80, lng: 114.93, operator: 'Ganfeng Lithium', country: 'China', product: 'Battery-grade lithium hydroxide', notes: 'China processes 65% of global lithium.' },
  { id: 'li-thacker-pass', name: 'Thacker Pass', type: 'lithium', lat: 41.34, lng: -117.35, operator: 'Lithium Americas', country: 'USA', product: 'Lithium (clay)', notes: 'Largest known US lithium deposit. Controversial permitting. GM $650M investment.' },

  // ── Cobalt Belt ───────────────────────────────────────────────────────────
  { id: 'co-kolwezi', name: 'Kolwezi', type: 'cobalt', lat: -10.72, lng: 25.47, operator: 'Glencore / CMOC', country: 'DRC', product: 'Cobalt / Copper', globalShare: 45, notes: 'DRC produces 73% of global cobalt. Artisanal mining + child labor concerns.' },
  { id: 'co-tenke', name: 'Tenke Fungurume', type: 'cobalt', lat: -10.60, lng: 26.13, operator: 'CMOC (China Moly)', country: 'DRC', product: 'Cobalt / Copper', globalShare: 15, notes: 'Chinese-owned since 2016. Second largest cobalt mine globally.' },
  { id: 'co-mutanda', name: 'Mutanda Mine', type: 'cobalt', lat: -10.80, lng: 25.75, operator: 'Glencore', country: 'DRC', product: 'Cobalt / Copper', notes: 'Was world\'s largest cobalt mine. Care & maintenance 2019-2023.' },
  { id: 'co-huayou', name: 'Huayou Cobalt Refinery', type: 'refinery', lat: 28.95, lng: 120.08, operator: 'Huayou Cobalt', country: 'China', product: 'Battery-grade cobalt', notes: 'China refines 80% of global cobalt. Key EV battery supply chain node.' },

  // ── Key Assembly / Packaging ──────────────────────────────────────────────
  { id: 'asm-shenzhen', name: 'Shenzhen Electronics Hub', type: 'assembly', lat: 22.54, lng: 114.06, operator: 'Foxconn / BYD / Huawei', country: 'China', product: 'Electronics assembly', notes: 'World\'s largest electronics manufacturing cluster. 90% of global electronics.' },
  { id: 'asm-zhengzhou', name: 'Foxconn Zhengzhou', type: 'assembly', lat: 34.75, lng: 113.65, operator: 'Foxconn', country: 'China', product: 'iPhone assembly', globalShare: 50, notes: 'Produces ~50% of all iPhones. 200,000+ workers.' },
  { id: 'asm-penang', name: 'Penang Semiconductor', type: 'assembly', lat: 5.35, lng: 100.47, operator: 'Intel / Broadcom / AMD', country: 'Malaysia', product: 'Chip packaging & testing', globalShare: 13, notes: 'Malaysia = 13% global OSAT. Intel\'s largest offshore test facility.' },
  { id: 'asm-batam', name: 'Batam Electronics', type: 'assembly', lat: 1.05, lng: 104.03, operator: 'Various', country: 'Indonesia', product: 'Electronics / PCB assembly', notes: 'Growing alternative to Chinese assembly. Singapore-adjacent.' },

  // ── Nickel (battery supply chain) ─────────────────────────────────────────
  { id: 'ni-sulawesi', name: 'Morowali IMIP', type: 'refinery', lat: -2.25, lng: 121.65, operator: 'Tsingshan / CATL', country: 'Indonesia', product: 'Battery-grade nickel', globalShare: 35, notes: 'Indonesia = 50%+ global nickel. Chinese-built smelter complex. Controversial deforestation.' },
]
