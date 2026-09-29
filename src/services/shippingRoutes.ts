/**
 * Major global shipping route corridors — the arteries of world trade.
 * Each route includes waypoints, annual cargo volume, and key commodities.
 *
 * Waypoints trace real sea lanes (straits, TSS approaches, canal centrelines)
 * and have been checked so no segment crosses land at Natural Earth 1:10m
 * resolution. Longitudes east of the antimeridian are written as >180 (e.g.
 * 190 = -170) so Mapbox draws the Pacific crossing the short way instead of
 * wrapping the line back across the whole globe.
 */

export interface ShippingRoute {
  id: string
  name: string
  annualTonnageMt: number      // million tonnes/year
  keyGoods: string[]
  color: string
  path: [number, number][]     // [lng, lat] waypoints
}

export const SHIPPING_ROUTES: ShippingRoute[] = [
  // ── Asia → Europe (via Suez) ──────────────────────────────────────────────
  {
    id: 'asia-europe-suez', name: 'Asia–Europe (Suez)',
    annualTonnageMt: 1200,
    keyGoods: ['Container goods', 'Electronics', 'Textiles', 'Oil'],
    color: '#00aaff',
    path: [
      [103.85, 1.20],     // Singapore Strait
      [103.50, 1.20],
      [103.10, 1.22],
      [102.60, 1.75],     // Strait of Malacca
      [101.60, 2.45],
      [100.70, 3.20],
      [99.60, 4.30],
      [98.60, 5.40],
      [97.00, 6.10],
      [94.60, 6.40],      // Great Channel
      [88.00, 5.60],
      [80.60, 5.60],      // South of Sri Lanka
      [73.20, 9.10],      // Nine Degree Channel
      [60.00, 12.60],     // Arabian Sea
      [54.00, 13.20],     // North of Socotra
      [50.00, 13.00],     // Gulf of Aden
      [45.50, 12.30],
      [43.35, 12.50],     // Bab el-Mandeb
      [42.90, 13.30],
      [42.30, 14.30],     // Red Sea
      [41.20, 15.80],
      [40.00, 17.50],
      [38.80, 19.50],
      [37.80, 21.50],
      [37.00, 23.50],
      [35.80, 25.60],
      [34.50, 27.20],
      [33.95, 27.65],     // Strait of Gubal
      [33.30, 28.40],     // Gulf of Suez
      [32.60, 29.60],
      [32.56, 29.93],     // Suez
      [32.55, 30.05],     // Suez Canal
      [32.52, 30.17],     // Little Bitter Lake
      [32.40, 30.32],     // Great Bitter Lake
      [32.35, 30.43],     // Suez Canal
      [32.29, 30.57],     // Ismailia
      [32.31, 30.75],     // Suez Canal
      [32.32, 30.86],     // El Qantara
      [32.31, 31.25],     // Port Said
      [32.36, 31.45],     // Suez Canal
      [28.00, 33.30],     // Eastern Mediterranean
      [24.00, 34.30],     // South of Crete
      [19.00, 35.50],
      [15.40, 36.20],     // Malta Channel
      [12.20, 37.15],     // Strait of Sicily
      [10.00, 37.60],
      [8.90, 37.80],      // North of La Galite
      [7.00, 37.40],
      [3.00, 37.20],      // Off Algiers
      [-1.00, 36.30],
      [-4.50, 36.00],     // Alboran Sea
      [-5.60, 35.95],     // Strait of Gibraltar
      [-7.00, 36.00],     // Gulf of Cádiz
      [-9.40, 36.70],     // Cape St Vincent
      [-10.00, 38.40],
      [-10.00, 39.40],    // Off Portugal
      [-9.90, 43.10],     // Cape Finisterre
      [-5.80, 48.60],     // Ushant
      [-3.00, 49.80],     // English Channel
      [-1.00, 50.10],
      [0.80, 50.60],
      [1.45, 51.00],      // Dover Strait
      [2.30, 51.35],
      [3.20, 51.75],
      [3.95, 52.00],      // Rotterdam
    ],
  },
  // ── Asia → Europe (Cape of Good Hope) ─────────────────────────────────────
  {
    id: 'asia-europe-cape', name: 'Asia–Europe (Cape)',
    annualTonnageMt: 400,
    keyGoods: ['Crude oil', 'Bulk commodities', 'Container (diverted)'],
    color: '#ff8844',
    path: [
      [103.85, 1.20],     // Singapore Strait
      [103.50, 1.20],
      [103.10, 1.22],
      [102.60, 1.75],     // Strait of Malacca
      [101.60, 2.45],
      [100.70, 3.20],
      [99.60, 4.30],
      [98.60, 5.40],
      [97.00, 6.10],
      [94.60, 6.40],      // Great Channel
      [85.00, 0.00],      // Indian Ocean
      [70.00, -15.00],
      [55.00, -24.00],
      [45.00, -28.00],    // South of Madagascar
      [33.00, -33.50],
      [25.00, -35.30],
      [20.00, -35.40],    // Cape Agulhas
      [18.20, -34.60],    // Cape of Good Hope
      [15.00, -30.00],
      [5.00, -15.00],     // South Atlantic
      [-12.00, -2.00],
      [-20.00, 8.00],
      [-19.50, 15.50],    // Off Cape Verde
      [-19.00, 28.00],    // West of Canaries
      [-10.20, 37.00],
      [-10.00, 39.40],    // Off Portugal
      [-9.90, 43.10],     // Cape Finisterre
      [-5.80, 48.60],     // Ushant
      [-3.00, 49.80],     // English Channel
      [-1.00, 50.10],
      [0.80, 50.60],
      [1.45, 51.00],      // Dover Strait
      [2.30, 51.35],
      [3.20, 51.75],
      [3.95, 52.00],      // Rotterdam
    ],
  },
  // ── Transpacific (Asia → North America West Coast) ────────────────────────
  {
    id: 'transpacific', name: 'Transpacific',
    annualTonnageMt: 900,
    keyGoods: ['Electronics', 'Furniture', 'Machinery', 'Vehicles', 'Toys'],
    color: '#44ff88',
    path: [
      [122.30, 31.00],    // Shanghai
      [125.00, 31.50],
      [130.80, 30.75],    // Ōsumi Strait
      [135.00, 32.90],
      [138.00, 33.20],
      [139.90, 32.80],    // South of Hachijō
      [150.00, 37.50],    // North Pacific
      [160.00, 41.50],
      [170.00, 44.50],
      [180.00, 46.30],    // Date line
      [190.00, 47.00],
      [200.00, 46.50],
      [210.00, 45.00],
      [220.00, 42.50],
      [228.00, 39.00],
      [234.00, 36.00],
      [238.70, 34.45],    // Point Conception
      [239.40, 34.33],    // Santa Barbara Channel
      [240.30, 34.20],
      [240.95, 33.95],
      [241.40, 33.62],
      [241.78, 33.70],    // Los Angeles / Long Beach
    ],
  },
  // ── Transatlantic ─────────────────────────────────────────────────────────
  {
    id: 'transatlantic', name: 'Transatlantic',
    annualTonnageMt: 600,
    keyGoods: ['Vehicles', 'Machinery', 'Chemicals', 'Pharmaceuticals'],
    color: '#aa88ff',
    path: [
      [3.95, 52.00],      // Rotterdam
      [3.20, 51.75],
      [2.30, 51.35],
      [1.45, 51.00],      // Dover Strait
      [0.80, 50.60],
      [-5.80, 49.40],     // Off Lizard
      [-15.00, 49.50],
      [-30.00, 48.50],
      [-45.00, 44.00],
      [-55.00, 42.50],    // South of Grand Banks
      [-65.00, 41.00],
      [-70.50, 40.40],
      [-73.85, 40.45],    // New York / New Jersey
    ],
  },
  // ── Persian Gulf → East Asia ──────────────────────────────────────────────
  {
    id: 'gulf-asia', name: 'Persian Gulf–East Asia',
    annualTonnageMt: 1100,
    keyGoods: ['Crude oil', 'LNG', 'Refined petroleum'],
    color: '#ff4466',
    path: [
      [50.60, 26.90],     // Ras Tanura
      [52.00, 27.00],     // Persian Gulf
      [54.00, 26.20],
      [55.20, 26.05],
      [56.00, 26.35],
      [56.45, 26.55],     // Strait of Hormuz
      [56.80, 26.20],
      [57.30, 25.40],     // Gulf of Oman
      [59.00, 23.90],
      [60.20, 22.40],     // Ras al Hadd
      [73.20, 9.10],      // Nine Degree Channel
      [77.00, 6.50],
      [80.60, 5.60],      // South of Sri Lanka
      [88.00, 5.60],
      [94.60, 6.40],      // Great Channel
      [97.00, 6.10],
      [98.60, 5.40],
      [99.60, 4.30],
      [100.70, 3.20],
      [101.60, 2.45],
      [102.60, 1.75],     // Strait of Malacca
      [103.10, 1.22],
      [103.50, 1.20],
      [103.85, 1.20],     // Singapore Strait
      [104.40, 1.35],     // Singapore Strait (east)
      [105.20, 3.00],     // South China Sea
      [108.80, 8.50],
      [110.30, 12.00],
      [110.60, 15.50],    // West of Paracels
      [112.50, 19.30],    // East of Hainan
      [114.50, 21.80],    // Off Hong Kong
      [117.50, 23.20],
      [120.30, 25.30],    // Taiwan Strait
      [122.50, 28.00],    // East China Sea
      [123.00, 30.20],
      [122.30, 31.00],    // Shanghai
      [125.00, 31.80],
      [127.50, 33.10],    // South of Jeju
      [129.05, 35.00],    // Busan
      [128.80, 34.40],    // Korea Strait
      [128.30, 33.20],    // West of Gotō
      [128.40, 32.30],
      [129.40, 31.40],
      [130.80, 30.75],    // Ōsumi Strait
      [135.00, 32.90],    // Off Shikoku
      [138.20, 33.90],
      [139.20, 34.35],
      [139.75, 35.05],    // Uraga Channel
      [139.76, 35.25],    // Tokyo Bay
    ],
  },
  // ── South America → East Asia ─────────────────────────────────────────────
  {
    id: 'south-america-asia', name: 'South America–East Asia',
    annualTonnageMt: 350,
    keyGoods: ['Iron ore', 'Soybeans', 'Copper', 'Lithium'],
    color: '#ffcc00',
    path: [
      [-43.15, -23.10],   // Rio de Janeiro / Santos
      [-40.00, -24.50],
      [-20.00, -30.00],   // South Atlantic
      [0.00, -34.00],
      [15.00, -36.00],
      [20.00, -36.50],    // South of Cape Agulhas
      [30.00, -35.00],
      [45.00, -30.00],
      [60.00, -25.00],    // Indian Ocean
      [100.00, -12.50],
      [115.80, -9.10],    // Lombok Strait
      [115.80, -8.20],
      [117.00, -6.00],
      [118.00, -4.00],    // Makassar Strait
      [118.80, 0.00],
      [120.00, 2.50],     // Celebes Sea
      [126.00, 4.80],
      [128.00, 9.00],     // Philippine Sea
      [126.50, 15.00],
      [125.00, 18.00],
      [122.60, 23.60],    // East of Taiwan
      [122.80, 26.00],
      [123.00, 29.00],
      [122.30, 31.00],    // Shanghai
    ],
  },
  // ── US Gulf → Europe ──────────────────────────────────────────────────────
  {
    id: 'usgulf-europe', name: 'US Gulf–Europe',
    annualTonnageMt: 250,
    keyGoods: ['LNG', 'Crude oil', 'Grain', 'Chemicals'],
    color: '#88ddff',
    path: [
      [-89.40, 28.80],    // Mississippi Delta
      [-86.00, 25.30],    // Gulf of Mexico
      [-83.50, 24.00],
      [-81.00, 24.20],    // Florida Straits
      [-80.00, 25.20],
      [-79.80, 26.00],
      [-79.60, 27.50],
      [-78.00, 30.50],
      [-65.00, 36.00],
      [-45.00, 42.00],    // Mid-Atlantic
      [-25.00, 46.50],
      [-10.00, 48.80],
      [-5.80, 49.40],     // Off Lizard
      [-3.00, 49.80],     // English Channel
      [-1.00, 50.10],
      [0.80, 50.60],
      [1.45, 51.00],      // Dover Strait
      [2.30, 51.35],
      [3.20, 51.75],
      [3.95, 52.00],      // Rotterdam
    ],
  },
  // ── Australia → East Asia ─────────────────────────────────────────────────
  {
    id: 'australia-asia', name: 'Australia–East Asia',
    annualTonnageMt: 800,
    keyGoods: ['Iron ore', 'Coal', 'LNG', 'Wheat'],
    color: '#ff88aa',
    path: [
      [118.60, -20.20],   // Port Hedland
      [117.00, -17.50],
      [115.80, -9.10],    // Lombok Strait
      [115.80, -8.20],
      [114.80, -7.30],    // Bali Sea
      [114.00, -6.20],
      [112.00, -5.00],    // Java Sea
      [109.30, -2.40],    // Karimata Strait
      [109.10, -1.40],
      [108.50, -0.50],
      [107.40, 3.00],
      [108.40, 8.30],     // South China Sea
      [110.30, 12.00],
      [110.60, 15.50],    // West of Paracels
      [112.50, 19.30],    // East of Hainan
      [114.50, 21.80],    // Off Hong Kong
      [117.50, 23.20],
      [120.30, 25.30],    // Taiwan Strait
      [122.50, 28.00],    // East China Sea
      [123.00, 30.20],
      [122.30, 31.00],    // Shanghai
      [125.00, 31.80],
      [127.50, 33.10],    // South of Jeju
      [129.05, 35.00],    // Busan
      [128.80, 34.40],    // Korea Strait
      [128.30, 33.20],    // West of Gotō
      [128.40, 32.30],
      [129.40, 31.40],
      [130.80, 30.75],    // Ōsumi Strait
      [135.00, 32.90],    // Off Shikoku
      [138.20, 33.90],
      [139.20, 34.35],
      [139.75, 35.05],    // Uraga Channel
      [139.76, 35.25],    // Tokyo Bay
    ],
  },
]
