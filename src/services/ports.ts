/**
 * Global Ports — major commercial / naval ports with top traded industry.
 * Based on IMF PortWatch, World Shipping Council, UNCTAD data.
 */

export type PortType = 'container' | 'bulk' | 'oil' | 'lng' | 'naval' | 'fishing' | 'mixed'

export interface Port {
  id: string
  name: string
  country: string
  lat: number
  lng: number
  type: PortType
  topIndustry: string
  annualTEU?: number      // container throughput (twenty-foot equivalent units) in thousands
  notes?: string
}

export const PORT_TYPE_COLORS: Record<PortType, string> = {
  container: '#00ccff',
  bulk:      '#ffaa00',
  oil:       '#ff4400',
  lng:       '#44ff88',
  naval:     '#ff2266',
  fishing:   '#88aaff',
  mixed:     '#cccccc',
}

export const PORT_TYPE_LABELS: Record<PortType, string> = {
  container: 'Container',
  bulk:      'Bulk Cargo',
  oil:       'Oil Terminal',
  lng:       'LNG Terminal',
  naval:     'Naval Port',
  fishing:   'Fishing Port',
  mixed:     'Mixed',
}

export const PORTS: Port[] = [
  // ── CHINA ────────────────────────────────────────────────────────────────
  { id: 'cn-shanghai',     name: 'Shanghai',          country: 'China', lat: 31.23, lng: 121.47, type: 'container', topIndustry: 'Electronics & Machinery', annualTEU: 49000 },
  { id: 'cn-ningbo',       name: 'Ningbo-Zhoushan',   country: 'China', lat: 29.87, lng: 121.55, type: 'container', topIndustry: 'Chemicals & Raw Materials', annualTEU: 35300 },
  { id: 'cn-shenzhen',     name: 'Shenzhen',          country: 'China', lat: 22.48, lng: 114.07, type: 'container', topIndustry: 'Consumer Electronics', annualTEU: 30000 },
  { id: 'cn-guangzhou',    name: 'Guangzhou',         country: 'China', lat: 23.06, lng: 113.33, type: 'container', topIndustry: 'Textiles & Plastics', annualTEU: 24600 },
  { id: 'cn-qingdao',      name: 'Qingdao',           country: 'China', lat: 36.07, lng: 120.31, type: 'container', topIndustry: 'Crude Oil & Iron Ore', annualTEU: 25000 },
  { id: 'cn-tianjin',      name: 'Tianjin',           country: 'China', lat: 38.99, lng: 117.73, type: 'container', topIndustry: 'Steel & Automobiles', annualTEU: 21000 },
  { id: 'cn-dalian',       name: 'Dalian',            country: 'China', lat: 38.92, lng: 121.64, type: 'bulk',      topIndustry: 'Iron Ore & Petroleum' },
  { id: 'cn-xiamen',       name: 'Xiamen',            country: 'China', lat: 24.48, lng: 118.07, type: 'container', topIndustry: 'Machinery & Stone', annualTEU: 12000 },
  { id: 'cn-tangshan',     name: 'Tangshan',          country: 'China', lat: 39.22, lng: 118.89, type: 'bulk',      topIndustry: 'Coal & Iron Ore' },

  // ── SINGAPORE ────────────────────────────────────────────────────────────
  { id: 'sg-singapore',    name: 'Singapore',         country: 'Singapore', lat: 1.26, lng: 103.84, type: 'container', topIndustry: 'Refined Petroleum & Electronics', annualTEU: 39000 },
  { id: 'sg-jurong',       name: 'Jurong Port',       country: 'Singapore', lat: 1.30, lng: 103.72, type: 'bulk',      topIndustry: 'Cement & Steel' },

  // ── SOUTH KOREA ──────────────────────────────────────────────────────────
  { id: 'kr-busan',        name: 'Busan',             country: 'South Korea', lat: 35.10, lng: 129.07, type: 'container', topIndustry: 'Automobiles & Semiconductors', annualTEU: 22000 },
  { id: 'kr-incheon',      name: 'Incheon',           country: 'South Korea', lat: 37.45, lng: 126.60, type: 'container', topIndustry: 'Steel & Chemicals', annualTEU: 3300 },
  { id: 'kr-ulsan',        name: 'Ulsan',             country: 'South Korea', lat: 35.50, lng: 129.38, type: 'oil',       topIndustry: 'Crude Oil & Petrochemicals' },

  // ── JAPAN ────────────────────────────────────────────────────────────────
  { id: 'jp-tokyo',        name: 'Tokyo',             country: 'Japan', lat: 35.62, lng: 139.77, type: 'container', topIndustry: 'Automobiles & Electronics', annualTEU: 4500 },
  { id: 'jp-yokohama',     name: 'Yokohama',          country: 'Japan', lat: 35.44, lng: 139.65, type: 'container', topIndustry: 'Automobiles & Machinery', annualTEU: 2900 },
  { id: 'jp-nagoya',       name: 'Nagoya',            country: 'Japan', lat: 35.08, lng: 136.88, type: 'container', topIndustry: 'Automobiles (Toyota)', annualTEU: 2700 },
  { id: 'jp-kobe',         name: 'Kobe',              country: 'Japan', lat: 34.67, lng: 135.20, type: 'container', topIndustry: 'Machinery & Rubber', annualTEU: 2900 },
  { id: 'jp-osaka',        name: 'Osaka',             country: 'Japan', lat: 34.63, lng: 135.43, type: 'container', topIndustry: 'Chemicals & Textiles', annualTEU: 2400 },
  { id: 'jp-chiba',        name: 'Chiba',             country: 'Japan', lat: 35.56, lng: 140.08, type: 'oil',       topIndustry: 'Crude Oil & LNG' },

  // ── TAIWAN ───────────────────────────────────────────────────────────────
  { id: 'tw-kaohsiung',    name: 'Kaohsiung',         country: 'Taiwan', lat: 22.62, lng: 120.27, type: 'container', topIndustry: 'Semiconductors & Petrochemicals', annualTEU: 9900 },
  { id: 'tw-taipei',       name: 'Taipei (Keelung)',  country: 'Taiwan', lat: 25.15, lng: 121.74, type: 'container', topIndustry: 'Electronics', annualTEU: 1500 },

  // ── HONG KONG ────────────────────────────────────────────────────────────
  { id: 'hk-hongkong',     name: 'Hong Kong',         country: 'Hong Kong', lat: 22.30, lng: 114.17, type: 'container', topIndustry: 'Textiles & Electronics', annualTEU: 16200 },

  // ── MALAYSIA ─────────────────────────────────────────────────────────────
  { id: 'my-portklang',    name: 'Port Klang',        country: 'Malaysia', lat: 3.00, lng: 101.39, type: 'container', topIndustry: 'Palm Oil & Electronics', annualTEU: 14400 },
  { id: 'my-tanjung',      name: 'Tanjung Pelepas',   country: 'Malaysia', lat: 1.36, lng: 103.55, type: 'container', topIndustry: 'Rubber & Electronics', annualTEU: 11200 },

  // ── VIETNAM ──────────────────────────────────────────────────────────────
  { id: 'vn-hochiminh',    name: 'Ho Chi Minh City',  country: 'Vietnam', lat: 10.77, lng: 106.71, type: 'container', topIndustry: 'Textiles & Footwear', annualTEU: 8700 },
  { id: 'vn-haiphong',     name: 'Hai Phong',         country: 'Vietnam', lat: 20.85, lng: 106.68, type: 'container', topIndustry: 'Electronics & Garments', annualTEU: 6500 },

  // ── THAILAND ─────────────────────────────────────────────────────────────
  { id: 'th-laemchabang',  name: 'Laem Chabang',      country: 'Thailand', lat: 13.08, lng: 100.88, type: 'container', topIndustry: 'Automobiles & Electronics', annualTEU: 8900 },
  { id: 'th-bangkok',      name: 'Bangkok',           country: 'Thailand', lat: 13.69, lng: 100.58, type: 'container', topIndustry: 'Rice & Rubber', annualTEU: 1500 },

  // ── INDONESIA ────────────────────────────────────────────────────────────
  { id: 'id-tanjungpriok', name: 'Tanjung Priok',     country: 'Indonesia', lat: -6.10, lng: 106.87, type: 'container', topIndustry: 'Palm Oil & Textiles', annualTEU: 8000 },
  { id: 'id-surabaya',     name: 'Tanjung Perak',     country: 'Indonesia', lat: -7.20, lng: 112.73, type: 'container', topIndustry: 'Coffee & Plywood', annualTEU: 3500 },

  // ── PHILIPPINES ──────────────────────────────────────────────────────────
  { id: 'ph-manila',       name: 'Manila',            country: 'Philippines', lat: 14.58, lng: 120.97, type: 'container', topIndustry: 'Electronics & Coconut Products', annualTEU: 5600 },

  // ── INDIA ────────────────────────────────────────────────────────────────
  { id: 'in-nhavasheva',   name: 'Nhava Sheva (JNPT)', country: 'India', lat: 18.95, lng: 72.95, type: 'container', topIndustry: 'Pharmaceuticals & Machinery', annualTEU: 5500 },
  { id: 'in-mundra',       name: 'Mundra',            country: 'India', lat: 22.74, lng: 69.72, type: 'container', topIndustry: 'Chemicals & Textiles', annualTEU: 7000 },
  { id: 'in-chennai',      name: 'Chennai',           country: 'India', lat: 13.10, lng: 80.30, type: 'container', topIndustry: 'Automobiles & Leather', annualTEU: 1700 },
  { id: 'in-visakhapatnam',name: 'Visakhapatnam',     country: 'India', lat: 17.69, lng: 83.29, type: 'bulk',      topIndustry: 'Iron Ore & Steel' },
  { id: 'in-kandla',       name: 'Kandla (Deendayal)', country: 'India', lat: 23.03, lng: 70.22, type: 'bulk',     topIndustry: 'Crude Oil & Edible Oil' },

  // ── SRI LANKA ────────────────────────────────────────────────────────────
  { id: 'lk-colombo',      name: 'Colombo',           country: 'Sri Lanka', lat: 6.94, lng: 79.85, type: 'container', topIndustry: 'Tea & Garments', annualTEU: 7200 },

  // ── PAKISTAN ──────────────────────────────────────────────────────────────
  { id: 'pk-karachi',      name: 'Karachi',           country: 'Pakistan', lat: 24.85, lng: 67.00, type: 'container', topIndustry: 'Textiles & Rice', annualTEU: 2200 },
  { id: 'pk-gwadar',       name: 'Gwadar',            country: 'Pakistan', lat: 25.12, lng: 62.33, type: 'mixed',     topIndustry: 'Fish & Transit Cargo', notes: 'China-Pakistan corridor' },

  // ── UAE ──────────────────────────────────────────────────────────────────
  { id: 'ae-jebel',        name: 'Jebel Ali',         country: 'UAE', lat: 25.01, lng: 55.06, type: 'container', topIndustry: 'Re-exports & Gold', annualTEU: 14500 },
  { id: 'ae-fujairah',     name: 'Fujairah',          country: 'UAE', lat: 25.12, lng: 56.35, type: 'oil',       topIndustry: 'Crude Oil & Bunker Fuel' },
  { id: 'ae-khor',         name: 'Khor Fakkan',       country: 'UAE', lat: 25.35, lng: 56.36, type: 'container', topIndustry: 'General Cargo', annualTEU: 4000 },

  // ── SAUDI ARABIA ─────────────────────────────────────────────────────────
  { id: 'sa-jeddah',       name: 'Jeddah Islamic',    country: 'Saudi Arabia', lat: 21.48, lng: 39.17, type: 'container', topIndustry: 'Foodstuffs & Vehicles', annualTEU: 4700 },
  { id: 'sa-dammam',       name: 'King Abdulaziz (Dammam)', country: 'Saudi Arabia', lat: 26.48, lng: 50.21, type: 'container', topIndustry: 'Petrochemicals & Steel', annualTEU: 1800 },
  { id: 'sa-ras',          name: 'Ras Tanura',        country: 'Saudi Arabia', lat: 26.64, lng: 50.16, type: 'oil',       topIndustry: 'Crude Oil (largest oil port)' },
  { id: 'sa-yanbu',        name: 'Yanbu',             country: 'Saudi Arabia', lat: 24.09, lng: 38.06, type: 'oil',       topIndustry: 'Refined Petroleum' },

  // ── OMAN ─────────────────────────────────────────────────────────────────
  { id: 'om-salalah',      name: 'Salalah',           country: 'Oman', lat: 16.94, lng: 54.00, type: 'container', topIndustry: 'Transhipment Hub', annualTEU: 4100 },
  { id: 'om-sohar',        name: 'Sohar',             country: 'Oman', lat: 24.36, lng: 56.73, type: 'mixed',     topIndustry: 'Methanol & Aluminum' },

  // ── QATAR ────────────────────────────────────────────────────────────────
  { id: 'qa-hamad',        name: 'Hamad Port',        country: 'Qatar', lat: 25.01, lng: 51.60, type: 'container', topIndustry: 'LNG & Construction Materials', annualTEU: 2400 },
  { id: 'qa-raslaffan',    name: 'Ras Laffan',        country: 'Qatar', lat: 25.91, lng: 51.56, type: 'lng',       topIndustry: 'LNG (world largest)' },

  // ── KUWAIT ───────────────────────────────────────────────────────────────
  { id: 'kw-shuwaikh',     name: 'Shuwaikh',          country: 'Kuwait', lat: 29.35, lng: 47.93, type: 'mixed',    topIndustry: 'Crude Oil & Vehicles' },

  // ── IRAQ ─────────────────────────────────────────────────────────────────
  { id: 'iq-basra',        name: 'Basra Oil Terminal', country: 'Iraq', lat: 29.69, lng: 48.81, type: 'oil',       topIndustry: 'Crude Oil' },

  // ── IRAN ─────────────────────────────────────────────────────────────────
  { id: 'ir-bandar',       name: 'Bandar Abbas',      country: 'Iran', lat: 27.19, lng: 56.27, type: 'container', topIndustry: 'Iron Ore & Petrochemicals', annualTEU: 2900 },
  { id: 'ir-kharg',        name: 'Kharg Island',      country: 'Iran', lat: 29.23, lng: 50.32, type: 'oil',       topIndustry: 'Crude Oil' },

  // ── EGYPT ────────────────────────────────────────────────────────────────
  { id: 'eg-said',         name: 'Port Said',         country: 'Egypt', lat: 31.26, lng: 32.31, type: 'container', topIndustry: 'Suez Canal Transit & Transhipment', annualTEU: 3800 },
  { id: 'eg-alexandria',   name: 'Alexandria',        country: 'Egypt', lat: 31.19, lng: 29.88, type: 'mixed',     topIndustry: 'Grain & Cotton' },
  { id: 'eg-ainsukhna',    name: 'Ain Sukhna',        country: 'Egypt', lat: 29.60, lng: 32.34, type: 'oil',       topIndustry: 'Crude Oil & LNG' },

  // ── TURKEY ───────────────────────────────────────────────────────────────
  { id: 'tr-ambarli',      name: 'Ambarli',           country: 'Turkey', lat: 40.97, lng: 28.69, type: 'container', topIndustry: 'Textiles & Vehicles', annualTEU: 3200 },
  { id: 'tr-mersin',       name: 'Mersin',            country: 'Turkey', lat: 36.80, lng: 34.63, type: 'container', topIndustry: 'Citrus & Chrome Ore', annualTEU: 2100 },
  { id: 'tr-izmir',        name: 'Izmir (Alsancak)',  country: 'Turkey', lat: 38.44, lng: 27.14, type: 'container', topIndustry: 'Tobacco & Figs', annualTEU: 800 },
  { id: 'tr-ceyhan',       name: 'Ceyhan',            country: 'Turkey', lat: 36.88, lng: 35.87, type: 'oil',       topIndustry: 'Crude Oil (BTC pipeline)' },

  // ── GREECE ───────────────────────────────────────────────────────────────
  { id: 'gr-piraeus',      name: 'Piraeus',           country: 'Greece', lat: 37.94, lng: 23.64, type: 'container', topIndustry: 'Transhipment & Foodstuffs', annualTEU: 5400 },

  // ── ITALY ────────────────────────────────────────────────────────────────
  { id: 'it-genoa',        name: 'Genoa',             country: 'Italy', lat: 44.41, lng: 8.92, type: 'container', topIndustry: 'Machinery & Chemicals', annualTEU: 2600 },
  { id: 'it-gioia',        name: 'Gioia Tauro',       country: 'Italy', lat: 38.43, lng: 15.89, type: 'container', topIndustry: 'Transhipment Hub', annualTEU: 3100 },
  { id: 'it-trieste',      name: 'Trieste',           country: 'Italy', lat: 45.65, lng: 13.76, type: 'oil',       topIndustry: 'Crude Oil (TAL pipeline)' },

  // ── SPAIN ────────────────────────────────────────────────────────────────
  { id: 'es-valencia',     name: 'Valencia',          country: 'Spain', lat: 39.45, lng: -0.32, type: 'container', topIndustry: 'Automobiles & Ceramics', annualTEU: 5600 },
  { id: 'es-algeciras',    name: 'Algeciras',         country: 'Spain', lat: 36.13, lng: -5.44, type: 'container', topIndustry: 'Transhipment & Fuel', annualTEU: 5100 },
  { id: 'es-barcelona',    name: 'Barcelona',         country: 'Spain', lat: 41.35, lng: 2.17, type: 'container', topIndustry: 'Chemicals & Vehicles', annualTEU: 3500 },

  // ── PORTUGAL ─────────────────────────────────────────────────────────────
  { id: 'pt-sines',        name: 'Sines',             country: 'Portugal', lat: 37.95, lng: -8.87, type: 'container', topIndustry: 'Oil & Petrochemicals', annualTEU: 1800 },

  // ── FRANCE ───────────────────────────────────────────────────────────────
  { id: 'fr-marseille',    name: 'Marseille-Fos',     country: 'France', lat: 43.33, lng: 5.05, type: 'container', topIndustry: 'Crude Oil & Chemicals', annualTEU: 1500 },
  { id: 'fr-lehavre',      name: 'Le Havre',          country: 'France', lat: 49.48, lng: 0.11, type: 'container', topIndustry: 'Crude Oil & Grain', annualTEU: 3000 },

  // ── NETHERLANDS ──────────────────────────────────────────────────────────
  { id: 'nl-rotterdam',    name: 'Rotterdam',         country: 'Netherlands', lat: 51.90, lng: 4.50, type: 'container', topIndustry: 'Crude Oil & Chemicals', annualTEU: 15300 },
  { id: 'nl-amsterdam',    name: 'Amsterdam',         country: 'Netherlands', lat: 52.40, lng: 4.78, type: 'bulk',      topIndustry: 'Coal & Cocoa' },

  // ── BELGIUM ──────────────────────────────────────────────────────────────
  { id: 'be-antwerp',      name: 'Antwerp-Bruges',    country: 'Belgium', lat: 51.27, lng: 4.40, type: 'container', topIndustry: 'Chemicals & Vehicles', annualTEU: 13500 },
  { id: 'be-zeebrugge',    name: 'Zeebrugge',         country: 'Belgium', lat: 51.33, lng: 3.20, type: 'lng',       topIndustry: 'LNG & Vehicles' },

  // ── GERMANY ──────────────────────────────────────────────────────────────
  { id: 'de-hamburg',      name: 'Hamburg',           country: 'Germany', lat: 53.53, lng: 9.97, type: 'container', topIndustry: 'Machinery & Automobiles', annualTEU: 8700 },
  { id: 'de-bremerhaven',  name: 'Bremerhaven',       country: 'Germany', lat: 53.55, lng: 8.57, type: 'container', topIndustry: 'Automobiles & Food', annualTEU: 4800 },
  { id: 'de-wilhelmshaven',name: 'Wilhelmshaven',     country: 'Germany', lat: 53.52, lng: 8.14, type: 'oil',       topIndustry: 'Crude Oil & LNG' },

  // ── UNITED KINGDOM ───────────────────────────────────────────────────────
  { id: 'gb-felixstowe',   name: 'Felixstowe',        country: 'UK', lat: 51.96, lng: 1.30, type: 'container', topIndustry: 'Consumer Goods & Electronics', annualTEU: 3700 },
  { id: 'gb-southampton',  name: 'Southampton',       country: 'UK', lat: 50.89, lng: -1.40, type: 'container', topIndustry: 'Vehicles & Fruit', annualTEU: 1800 },
  { id: 'gb-london',       name: 'London Gateway',    country: 'UK', lat: 51.50, lng: 0.47, type: 'container', topIndustry: 'General Cargo', annualTEU: 1900 },
  { id: 'gb-milford',      name: 'Milford Haven',     country: 'UK', lat: 51.70, lng: -5.05, type: 'oil',       topIndustry: 'Crude Oil & LNG' },

  // ── SCANDINAVIA ──────────────────────────────────────────────────────────
  { id: 'se-gothenburg',   name: 'Gothenburg',        country: 'Sweden', lat: 57.69, lng: 11.94, type: 'container', topIndustry: 'Vehicles & Paper', annualTEU: 800 },
  { id: 'dk-copenhagen',   name: 'Copenhagen-Malmö',  country: 'Denmark', lat: 55.69, lng: 12.60, type: 'container', topIndustry: 'Pharmaceuticals & Food' },
  { id: 'no-bergen',       name: 'Bergen',            country: 'Norway', lat: 60.40, lng: 5.32, type: 'oil',       topIndustry: 'North Sea Oil & Fish' },
  { id: 'fi-helsinki',     name: 'Helsinki',          country: 'Finland', lat: 60.15, lng: 24.96, type: 'container', topIndustry: 'Timber & Machinery' },

  // ── BALTIC ───────────────────────────────────────────────────────────────
  { id: 'pl-gdansk',       name: 'Gdansk (DCT)',      country: 'Poland', lat: 54.40, lng: 18.67, type: 'container', topIndustry: 'Coal & Machinery', annualTEU: 2100 },
  { id: 'lt-klaipeda',     name: 'Klaipeda',          country: 'Lithuania', lat: 55.72, lng: 21.12, type: 'mixed',    topIndustry: 'Fertilizers & LNG' },
  { id: 'lv-riga',         name: 'Riga',              country: 'Latvia', lat: 57.00, lng: 24.10, type: 'bulk',      topIndustry: 'Timber & Coal' },
  { id: 'ee-tallinn',      name: 'Tallinn',           country: 'Estonia', lat: 59.45, lng: 24.77, type: 'mixed',    topIndustry: 'Oil Shale & Transit' },

  // ── RUSSIA ───────────────────────────────────────────────────────────────
  { id: 'ru-stpetersburg', name: 'St. Petersburg',    country: 'Russia', lat: 59.90, lng: 30.25, type: 'container', topIndustry: 'Machinery & Vehicles', annualTEU: 2100 },
  { id: 'ru-novorossiysk', name: 'Novorossiysk',      country: 'Russia', lat: 44.72, lng: 37.78, type: 'oil',       topIndustry: 'Crude Oil & Grain' },
  { id: 'ru-vladivostok',  name: 'Vladivostok',       country: 'Russia', lat: 43.11, lng: 131.88, type: 'container', topIndustry: 'Coal & Vehicles' },
  { id: 'ru-primorsk',     name: 'Primorsk',          country: 'Russia', lat: 60.35, lng: 28.63, type: 'oil',       topIndustry: 'Crude Oil (Baltic pipeline)' },
  { id: 'ru-ustluga',      name: 'Ust-Luga',          country: 'Russia', lat: 59.68, lng: 28.40, type: 'mixed',     topIndustry: 'Coal & LNG' },

  // ── UNITED STATES ────────────────────────────────────────────────────────
  { id: 'us-losangeles',   name: 'Los Angeles',       country: 'USA', lat: 33.74, lng: -118.27, type: 'container', topIndustry: 'Consumer Goods & Electronics', annualTEU: 9900 },
  { id: 'us-longbeach',    name: 'Long Beach',        country: 'USA', lat: 33.75, lng: -118.19, type: 'container', topIndustry: 'Electronics & Furniture', annualTEU: 9100 },
  { id: 'us-newyork',      name: 'New York / New Jersey', country: 'USA', lat: 40.66, lng: -74.05, type: 'container', topIndustry: 'Consumer Goods & Beverages', annualTEU: 9500 },
  { id: 'us-savannah',     name: 'Savannah',          country: 'USA', lat: 32.08, lng: -81.09, type: 'container', topIndustry: 'Poultry & Forestry Products', annualTEU: 5800 },
  { id: 'us-houston',      name: 'Houston',           country: 'USA', lat: 29.73, lng: -95.27, type: 'oil',       topIndustry: 'Crude Oil & Petrochemicals', annualTEU: 4200 },
  { id: 'us-neworleans',   name: 'South Louisiana',   country: 'USA', lat: 29.93, lng: -90.03, type: 'bulk',      topIndustry: 'Grain & Petroleum' },
  { id: 'us-norfolk',      name: 'Norfolk',           country: 'USA', lat: 36.85, lng: -76.33, type: 'container', topIndustry: 'Coal & Tobacco', annualTEU: 3400 },
  { id: 'us-charleston',   name: 'Charleston',        country: 'USA', lat: 32.78, lng: -79.93, type: 'container', topIndustry: 'Vehicles & Tires', annualTEU: 2800 },
  { id: 'us-seattle',      name: 'Seattle-Tacoma',    country: 'USA', lat: 47.27, lng: -122.35, type: 'container', topIndustry: 'Agricultural & Boeing', annualTEU: 3400 },
  { id: 'us-corpuschristi',name: 'Corpus Christi',    country: 'USA', lat: 27.80, lng: -97.40, type: 'oil',       topIndustry: 'Crude Oil Exports' },

  // ── CANADA ───────────────────────────────────────────────────────────────
  { id: 'ca-vancouver',    name: 'Vancouver',         country: 'Canada', lat: 49.29, lng: -123.11, type: 'container', topIndustry: 'Grain & Lumber', annualTEU: 3600 },
  { id: 'ca-montreal',     name: 'Montreal',          country: 'Canada', lat: 45.55, lng: -73.52, type: 'container', topIndustry: 'Grain & Iron Ore', annualTEU: 1800 },
  { id: 'ca-princerobert', name: 'Prince Rupert',     country: 'Canada', lat: 54.32, lng: -130.33, type: 'container', topIndustry: 'Coal & Grain', annualTEU: 1400 },

  // ── MEXICO ───────────────────────────────────────────────────────────────
  { id: 'mx-manzanillo',   name: 'Manzanillo',        country: 'Mexico', lat: 19.05, lng: -104.32, type: 'container', topIndustry: 'Vehicles & Electronics', annualTEU: 3400 },
  { id: 'mx-lazaro',       name: 'Lázaro Cárdenas',   country: 'Mexico', lat: 17.93, lng: -102.18, type: 'container', topIndustry: 'Iron Ore & Steel', annualTEU: 1500 },
  { id: 'mx-veracruz',     name: 'Veracruz',          country: 'Mexico', lat: 19.20, lng: -96.13, type: 'container', topIndustry: 'Vehicles & Grain' },

  // ── PANAMA ───────────────────────────────────────────────────────────────
  { id: 'pa-colon',        name: 'Colón (Atlantic)',   country: 'Panama', lat: 9.36, lng: -79.90, type: 'container', topIndustry: 'Canal Transhipment', annualTEU: 4600 },
  { id: 'pa-balboa',       name: 'Balboa (Pacific)',   country: 'Panama', lat: 8.95, lng: -79.57, type: 'container', topIndustry: 'Canal Transhipment', annualTEU: 3200 },

  // ── COLOMBIA ─────────────────────────────────────────────────────────────
  { id: 'co-cartagena',    name: 'Cartagena',         country: 'Colombia', lat: 10.39, lng: -75.51, type: 'container', topIndustry: 'Coffee & Chemicals', annualTEU: 3200 },
  { id: 'co-buenaventura', name: 'Buenaventura',      country: 'Colombia', lat: 3.88, lng: -77.04, type: 'container', topIndustry: 'Coffee & Sugar' },

  // ── BRAZIL ───────────────────────────────────────────────────────────────
  { id: 'br-santos',       name: 'Santos',            country: 'Brazil', lat: -23.96, lng: -46.31, type: 'container', topIndustry: 'Soybeans & Sugar', annualTEU: 4700 },
  { id: 'br-paranagua',    name: 'Paranaguá',         country: 'Brazil', lat: -25.52, lng: -48.51, type: 'bulk',      topIndustry: 'Soybeans & Grain' },
  { id: 'br-itaqui',       name: 'Itaqui',            country: 'Brazil', lat: -2.57, lng: -44.36, type: 'bulk',      topIndustry: 'Iron Ore & Soybeans' },
  { id: 'br-riodejaneiro', name: 'Rio de Janeiro',    country: 'Brazil', lat: -22.88, lng: -43.17, type: 'oil',       topIndustry: 'Crude Oil & Steel' },

  // ── ARGENTINA ────────────────────────────────────────────────────────────
  { id: 'ar-buenosaires',  name: 'Buenos Aires',      country: 'Argentina', lat: -34.60, lng: -58.37, type: 'container', topIndustry: 'Grain & Beef', annualTEU: 1700 },
  { id: 'ar-rosario',      name: 'Rosario',           country: 'Argentina', lat: -32.95, lng: -60.65, type: 'bulk',      topIndustry: 'Soybeans & Corn' },

  // ── CHILE ────────────────────────────────────────────────────────────────
  { id: 'cl-sanantonio',   name: 'San Antonio',       country: 'Chile', lat: -33.59, lng: -71.62, type: 'container', topIndustry: 'Copper & Fruit', annualTEU: 1800 },
  { id: 'cl-valparaiso',   name: 'Valparaíso',        country: 'Chile', lat: -33.04, lng: -71.63, type: 'container', topIndustry: 'Copper & Wine' },

  // ── PERU ─────────────────────────────────────────────────────────────────
  { id: 'pe-callao',       name: 'Callao',            country: 'Peru', lat: -12.05, lng: -77.14, type: 'container', topIndustry: 'Copper & Fishmeal', annualTEU: 2700 },

  // ── SOUTH AFRICA ─────────────────────────────────────────────────────────
  { id: 'za-durban',       name: 'Durban',            country: 'South Africa', lat: -29.87, lng: 31.02, type: 'container', topIndustry: 'Vehicles & Chemicals', annualTEU: 2800 },
  { id: 'za-capetown',     name: 'Cape Town',         country: 'South Africa', lat: -33.90, lng: 18.44, type: 'container', topIndustry: 'Fruit & Wine', annualTEU: 900 },
  { id: 'za-richards',     name: 'Richards Bay',      country: 'South Africa', lat: -28.80, lng: 32.08, type: 'bulk',      topIndustry: 'Coal & Aluminum' },

  // ── NIGERIA ──────────────────────────────────────────────────────────────
  { id: 'ng-lagos',        name: 'Lagos (Apapa/Tincan)', country: 'Nigeria', lat: 6.44, lng: 3.39, type: 'container', topIndustry: 'Oil & Consumer Goods', annualTEU: 1600 },
  { id: 'ng-bonny',        name: 'Bonny Island',      country: 'Nigeria', lat: 4.43, lng: 7.17, type: 'lng',       topIndustry: 'LNG Exports' },

  // ── KENYA ────────────────────��───────────────────────────────────────────
  { id: 'ke-mombasa',      name: 'Mombasa',           country: 'Kenya', lat: -4.04, lng: 39.67, type: 'container', topIndustry: 'Tea & Coffee', annualTEU: 1400 },

  // ── DJIBOUTI ─────────────────────────────────────────────────────────────
  { id: 'dj-doraleh',      name: 'Doraleh',           country: 'Djibouti', lat: 11.60, lng: 43.08, type: 'container', topIndustry: 'Ethiopian Transit', annualTEU: 1000 },

  // ── MOROCCO ──────────────────────────────────────────────────────────────
  { id: 'ma-tangier',      name: 'Tanger Med',        country: 'Morocco', lat: 35.89, lng: -5.50, type: 'container', topIndustry: 'Vehicles & Electronics', annualTEU: 7200 },

  // ── AUSTRALIA ────────────────────────────────────────────────────────────
  { id: 'au-melbourne',    name: 'Melbourne',         country: 'Australia', lat: -37.82, lng: 144.92, type: 'container', topIndustry: 'Dairy & Vehicles', annualTEU: 2900 },
  { id: 'au-sydney',       name: 'Sydney (Botany)',   country: 'Australia', lat: -33.96, lng: 151.20, type: 'container', topIndustry: 'Consumer Goods & Meat', annualTEU: 2600 },
  { id: 'au-brisbane',     name: 'Brisbane',          country: 'Australia', lat: -27.37, lng: 153.17, type: 'container', topIndustry: 'Coal & Grain', annualTEU: 1200 },
  { id: 'au-porthedland',  name: 'Port Hedland',      country: 'Australia', lat: -20.31, lng: 118.57, type: 'bulk',      topIndustry: 'Iron Ore (BHP/Fortescue)' },
  { id: 'au-dampier',      name: 'Dampier',           country: 'Australia', lat: -20.66, lng: 116.71, type: 'bulk',      topIndustry: 'Iron Ore (Rio Tinto)' },
  { id: 'au-gladstone',    name: 'Gladstone',         country: 'Australia', lat: -23.85, lng: 151.27, type: 'lng',       topIndustry: 'LNG & Aluminum' },
  { id: 'au-fremantle',    name: 'Fremantle',         country: 'Australia', lat: -32.05, lng: 115.75, type: 'container', topIndustry: 'Grain & Livestock' },

  // ── NEW ZEALAND ──────────────────────────────────────────────────────────
  { id: 'nz-auckland',     name: 'Auckland',          country: 'New Zealand', lat: -36.84, lng: 174.78, type: 'container', topIndustry: 'Dairy & Timber' },
  { id: 'nz-tauranga',     name: 'Tauranga',          country: 'New Zealand', lat: -37.66, lng: 176.17, type: 'bulk',      topIndustry: 'Kiwifruit & Logs' },

  // ── EAST AFRICA ──────────────────────────────────────────────────────────
  { id: 'tz-darsalaam',    name: 'Dar es Salaam',     country: 'Tanzania', lat: -6.83, lng: 39.29, type: 'container', topIndustry: 'Cashews & Transit' },
  { id: 'mz-maputo',       name: 'Maputo',            country: 'Mozambique', lat: -25.97, lng: 32.57, type: 'bulk',      topIndustry: 'Coal & Aluminum' },
  { id: 'mg-toamasina',    name: 'Toamasina',         country: 'Madagascar', lat: -18.15, lng: 49.42, type: 'mixed',     topIndustry: 'Vanilla & Nickel' },

  // ── WEST AFRICA ──────────────────────────────────────────────────────────
  { id: 'gh-tema',         name: 'Tema',              country: 'Ghana', lat: 5.63, lng: -0.01, type: 'container', topIndustry: 'Cocoa & Gold' },
  { id: 'ci-abidjan',      name: 'Abidjan',           country: 'Ivory Coast', lat: 5.25, lng: -3.97, type: 'container', topIndustry: 'Cocoa & Rubber' },
  { id: 'sn-dakar',        name: 'Dakar',             country: 'Senegal', lat: 14.69, lng: -17.43, type: 'mixed',     topIndustry: 'Phosphates & Fish' },

  // ── NORTH AFRICA ─────────────────────────────────────────────────────────
  { id: 'dz-algiers',      name: 'Algiers',           country: 'Algeria', lat: 36.78, lng: 3.06, type: 'mixed',     topIndustry: 'LNG & Crude Oil' },
  { id: 'ly-essider',      name: 'Es Sider',          country: 'Libya', lat: 30.62, lng: 18.35, type: 'oil',       topIndustry: 'Crude Oil' },
  { id: 'tn-rades',        name: 'Radès',             country: 'Tunisia', lat: 36.77, lng: 10.28, type: 'container', topIndustry: 'Textiles & Olive Oil' },

  // ── CARIBBEAN ────────────────────────────────────────────────────────────
  { id: 'jm-kingston',     name: 'Kingston',          country: 'Jamaica', lat: 17.97, lng: -76.84, type: 'container', topIndustry: 'Bauxite & Transhipment', annualTEU: 1800 },
  { id: 'do-caucedo',      name: 'Caucedo',           country: 'Dominican Republic', lat: 18.43, lng: -69.63, type: 'container', topIndustry: 'Tobacco & Textiles' },
  { id: 'tt-pointlisas',   name: 'Point Lisas',       country: 'Trinidad & Tobago', lat: 10.41, lng: -61.48, type: 'lng',       topIndustry: 'LNG & Ammonia' },

  // ── MEDITERRANEAN ────────────────────────────────────────────────────────
  { id: 'mt-marsaxlokk',   name: 'Marsaxlokk',       country: 'Malta', lat: 35.84, lng: 14.54, type: 'container', topIndustry: 'Transhipment Hub', annualTEU: 3100 },
  { id: 'cy-limassol',     name: 'Limassol',          country: 'Cyprus', lat: 34.66, lng: 33.02, type: 'container', topIndustry: 'Potatoes & Cement' },
  { id: 'il-haifa',        name: 'Haifa',             country: 'Israel', lat: 32.82, lng: 35.00, type: 'container', topIndustry: 'Chemicals & Grains', annualTEU: 1500 },
  { id: 'il-ashdod',       name: 'Ashdod',            country: 'Israel', lat: 31.83, lng: 34.63, type: 'container', topIndustry: 'Potash & Electronics' },
  { id: 'lb-beirut',       name: 'Beirut',            country: 'Lebanon', lat: 33.90, lng: 35.52, type: 'container', topIndustry: 'Foodstuffs & Vehicles' },

  // ── BLACK SEA ────────────────────────────────────────────────────────────
  { id: 'ro-constanta',    name: 'Constanța',         country: 'Romania', lat: 44.17, lng: 28.66, type: 'container', topIndustry: 'Grain & Steel', annualTEU: 700 },
  { id: 'bg-varna',        name: 'Varna',             country: 'Bulgaria', lat: 43.19, lng: 27.92, type: 'bulk',      topIndustry: 'Grain & Chemicals' },
  { id: 'ua-odesa',        name: 'Odesa',             country: 'Ukraine', lat: 46.49, lng: 30.74, type: 'bulk',      topIndustry: 'Grain & Sunflower Oil' },
  { id: 'ge-batumi',       name: 'Batumi',            country: 'Georgia', lat: 41.64, lng: 41.64, type: 'oil',       topIndustry: 'Crude Oil (BTC pipeline)' },

  // ── HORN OF AFRICA / RED SEA ─────────────────────────────────────────────
  { id: 'er-assab',        name: 'Assab',             country: 'Eritrea', lat: 13.01, lng: 42.74, type: 'mixed',    topIndustry: 'Salt & Transit' },
  { id: 'so-berbera',      name: 'Berbera',           country: 'Somaliland', lat: 10.44, lng: 45.04, type: 'mixed',  topIndustry: 'Livestock & Transit', notes: 'DP World concession' },
  { id: 'ye-aden',         name: 'Aden',              country: 'Yemen', lat: 12.79, lng: 45.01, type: 'container', topIndustry: 'Fuel & Transhipment' },

  // ── SOUTHEAST ASIA (additional) ──────────────────────────────────────────
  { id: 'mm-yangon',       name: 'Yangon',            country: 'Myanmar', lat: 16.85, lng: 96.17, type: 'mixed',    topIndustry: 'Garments & Rice' },
  { id: 'bd-chittagong',   name: 'Chittagong',        country: 'Bangladesh', lat: 22.33, lng: 91.80, type: 'container', topIndustry: 'Garments & Jute', annualTEU: 3200 },
  { id: 'kh-sihanoukville',name: 'Sihanoukville',     country: 'Cambodia', lat: 10.63, lng: 103.50, type: 'container', topIndustry: 'Garments & Rice' },
]
