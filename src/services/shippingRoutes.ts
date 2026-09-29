/**
 * Major global shipping route corridors — the arteries of world trade.
 * Each route includes waypoints, annual cargo volume, and key commodities.
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
      [104.00, 1.30],    // Singapore
      [98.00, 5.00],     // Andaman Sea
      [80.00, 7.00],     // Sri Lanka
      [73.00, 10.00],    // Arabian Sea
      [60.00, 20.00],    // Arabian Sea
      [50.00, 23.50],    // Oman
      [45.00, 13.00],    // Bab el-Mandeb
      [43.30, 12.60],    // Strait
      [38.50, 18.00],    // Red Sea
      [34.00, 27.00],    // Red Sea
      [32.35, 30.60],    // Suez Canal
      [32.00, 31.30],    // Port Said
      [28.00, 35.00],    // Crete
      [16.00, 37.00],    // Sicily
      [10.00, 37.50],    // Tunisia
      [3.00, 36.50],     // Algiers
      [-5.35, 36.00],    // Gibraltar
      [-9.00, 37.00],    // Portugal
      [-3.00, 47.00],    // Bay of Biscay
      [1.50, 51.00],     // English Channel
      [3.50, 51.50],     // Rotterdam approach
    ],
  },
  // ── Asia → Europe (Cape of Good Hope) ─────────────────────────────────────
  {
    id: 'asia-europe-cape', name: 'Asia–Europe (Cape)',
    annualTonnageMt: 400,
    keyGoods: ['Crude oil', 'Bulk commodities', 'Container (diverted)'],
    color: '#ff8844',
    path: [
      [104.00, 1.30],    // Singapore
      [95.00, -2.00],    // Indian Ocean
      [80.00, -5.00],
      [60.00, -15.00],
      [45.00, -20.00],   // Madagascar
      [35.00, -28.00],   // Mozambique Channel
      [25.00, -33.50],   // South Africa
      [18.50, -34.40],   // Cape of Good Hope
      [10.00, -30.00],   // Atlantic
      [0.00, -15.00],
      [-10.00, 0.00],    // Gulf of Guinea
      [-15.00, 15.00],   // West Africa
      [-15.00, 30.00],
      [-10.00, 42.00],   // Iberia
      [-3.00, 47.00],    // Bay of Biscay
      [1.50, 51.00],     // English Channel
      [3.50, 51.50],     // Rotterdam
    ],
  },
  // ── Transpacific (Asia → North America West Coast) ────────────────────────
  {
    id: 'transpacific', name: 'Transpacific',
    annualTonnageMt: 900,
    keyGoods: ['Electronics', 'Furniture', 'Machinery', 'Vehicles', 'Toys'],
    color: '#44ff88',
    path: [
      [121.50, 31.20],   // Shanghai
      [125.00, 33.00],   // East China Sea
      [135.00, 35.00],   // Japan
      [145.00, 38.00],   // Pacific
      [160.00, 42.00],   // North Pacific
      [180.00, 45.00],   // Date line
      [-170.00, 47.00],
      [-155.00, 48.00],
      [-140.00, 48.50],
      [-130.00, 48.00],
      [-125.00, 46.00],  // Pacific NW
      [-122.40, 37.80],  // San Francisco
      [-118.25, 33.75],  // Los Angeles / Long Beach
    ],
  },
  // ── Transatlantic ─────────────────────────────────────────────────────────
  {
    id: 'transatlantic', name: 'Transatlantic',
    annualTonnageMt: 600,
    keyGoods: ['Vehicles', 'Machinery', 'Chemicals', 'Pharmaceuticals'],
    color: '#aa88ff',
    path: [
      [3.50, 51.50],     // Rotterdam
      [1.00, 51.00],     // English Channel
      [-5.00, 50.00],    // Cornwall
      [-15.00, 50.00],   // Atlantic
      [-30.00, 48.00],
      [-50.00, 44.00],
      [-65.00, 42.00],
      [-74.00, 40.70],   // New York / New Jersey
    ],
  },
  // ── Persian Gulf → East Asia ──────────────────────────────────────────────
  {
    id: 'gulf-asia', name: 'Persian Gulf–East Asia',
    annualTonnageMt: 1100,
    keyGoods: ['Crude oil', 'LNG', 'Refined petroleum'],
    color: '#ff4466',
    path: [
      [50.50, 26.20],    // Persian Gulf
      [56.30, 26.50],    // Hormuz
      [60.00, 23.00],    // Arabian Sea
      [73.00, 15.00],    // India west coast
      [80.00, 8.00],     // Sri Lanka
      [85.00, 5.00],     // Bay of Bengal
      [98.00, 3.00],     // Malacca approach
      [103.80, 1.30],    // Singapore
      [110.00, 5.00],    // South China Sea
      [117.00, 15.00],
      [121.50, 31.20],   // Shanghai
      [129.00, 35.00],   // Busan
      [140.00, 35.50],   // Tokyo Bay
    ],
  },
  // ── South America → East Asia ─────────────────────────────────────────────
  {
    id: 'south-america-asia', name: 'South America–East Asia',
    annualTonnageMt: 350,
    keyGoods: ['Iron ore', 'Soybeans', 'Copper', 'Lithium'],
    color: '#ffcc00',
    path: [
      [-43.17, -22.90],  // Rio / Santos
      [-38.00, -15.00],
      [-25.00, 0.00],    // Mid-Atlantic
      [0.00, -10.00],
      [20.00, -25.00],   // South Atlantic
      [40.00, -30.00],
      [60.00, -20.00],   // Indian Ocean
      [80.00, -8.00],
      [100.00, 0.00],    // Malacca
      [104.00, 1.30],    // Singapore
      [115.00, 10.00],   // South China Sea
      [121.50, 31.20],   // Shanghai
    ],
  },
  // ── US Gulf → Europe ──────────────────────────────────────────────────────
  {
    id: 'usgulf-europe', name: 'US Gulf–Europe',
    annualTonnageMt: 250,
    keyGoods: ['LNG', 'Crude oil', 'Grain', 'Chemicals'],
    color: '#88ddff',
    path: [
      [-90.00, 29.00],   // Gulf of Mexico
      [-85.00, 25.00],   // Florida Straits
      [-78.00, 25.50],
      [-65.00, 32.00],
      [-50.00, 40.00],   // Mid-Atlantic
      [-30.00, 45.00],
      [-15.00, 48.00],
      [-5.00, 50.00],    // English Channel approach
      [1.50, 51.00],
      [3.50, 51.50],     // Rotterdam
    ],
  },
  // ── Australia → East Asia ─────────────────────────────────────────────────
  {
    id: 'australia-asia', name: 'Australia–East Asia',
    annualTonnageMt: 800,
    keyGoods: ['Iron ore', 'Coal', 'LNG', 'Wheat'],
    color: '#ff88aa',
    path: [
      [118.60, -20.30],  // Port Hedland
      [115.00, -15.00],  // NW Australia
      [115.50, -8.50],   // Lombok Strait
      [112.00, -4.00],   // Java Sea
      [110.00, 5.00],    // South China Sea
      [117.00, 15.00],
      [121.50, 31.20],   // Shanghai
      [129.00, 35.00],   // Busan
      [140.00, 35.50],   // Tokyo Bay
    ],
  },
]
