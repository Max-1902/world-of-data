/**
 * Global Gas Pipeline Network — major trunk lines, interconnectors, and LNG corridors.
 * Sourced from Global Energy Monitor Gas Infrastructure Tracker, IEA, ENTSOG.
 *
 * Each pipeline is a GeoJSON LineString with waypoints tracing the approximate route.
 * Status: operating | construction | proposed | shelved
 */

export type PipelineStatus = 'operating' | 'construction' | 'proposed' | 'shelved'

export interface GasPipeline {
  id: string
  name: string
  countries: string       // e.g. "Russia → Germany"
  status: PipelineStatus
  capacityBcmYr?: number  // billion cubic metres per year
  lengthKm?: number
  operator?: string
  notes?: string
  path: [number, number][]  // [lng, lat] waypoints
}

export const PIPELINE_STATUS_COLORS: Record<PipelineStatus, string> = {
  operating:    '#44ddaa',
  construction: '#ffaa22',
  proposed:     '#8888ff',
  shelved:      '#ff4466',
}

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  operating:    'Operating',
  construction: 'Under Construction',
  proposed:     'Proposed',
  shelved:      'Shelved / Cancelled',
}

export const GAS_PIPELINES: GasPipeline[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // EUROPE — RUSSIA SUPPLY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'nord-stream-1',
    name: 'Nord Stream 1',
    countries: 'Russia → Germany',
    status: 'shelved',
    capacityBcmYr: 55,
    lengthKm: 1224,
    operator: 'Nord Stream AG',
    notes: 'Sabotaged Sep 2022; out of service',
    path: [
      [28.73, 60.03], // Vyborg, Russia
      [27.80, 59.95], [26.50, 59.80], [24.80, 59.50],
      [22.00, 59.00], [19.80, 58.50], [18.30, 57.80],
      [16.50, 56.20], [14.50, 55.20], [13.30, 54.50],
      [12.10, 54.18], // Lubmin, Germany
    ],
  },
  {
    id: 'nord-stream-2',
    name: 'Nord Stream 2',
    countries: 'Russia → Germany',
    status: 'shelved',
    capacityBcmYr: 55,
    lengthKm: 1234,
    operator: 'Nord Stream 2 AG',
    notes: 'Completed but never commissioned; sabotaged Sep 2022',
    path: [
      [28.73, 60.03],
      [27.60, 59.90], [26.20, 59.70], [24.50, 59.40],
      [22.50, 58.90], [20.00, 58.20], [18.00, 57.50],
      [16.00, 56.00], [14.20, 55.10], [13.10, 54.40],
      [12.10, 54.18],
    ],
  },
  {
    id: 'yamal-europe',
    name: 'Yamal–Europe',
    countries: 'Russia → Belarus → Poland → Germany',
    status: 'operating',
    capacityBcmYr: 33,
    lengthKm: 4107,
    operator: 'Gazprom',
    notes: 'Major trunk line via Belarus; flows reversed since 2022',
    path: [
      [68.50, 66.50], // Yamal Peninsula
      [65.00, 63.00], [60.00, 60.00], [55.00, 58.00],
      [50.00, 56.50], [45.00, 55.50], [40.00, 55.00],
      [35.00, 54.50], [30.00, 53.80], // Belarus
      [27.57, 53.90], // Minsk area
      [24.00, 53.50], [21.00, 53.20], // Poland border
      [19.50, 53.00], [17.50, 52.50], [15.00, 52.30],
      [13.40, 52.50], // Frankfurt/Oder Germany
    ],
  },
  {
    id: 'brotherhood',
    name: 'Brotherhood (Urengoy–Pomary–Uzhgorod)',
    countries: 'Russia → Ukraine → Slovakia → Austria',
    status: 'operating',
    capacityBcmYr: 28,
    lengthKm: 4451,
    operator: 'Gazprom / Naftogaz',
    notes: 'Oldest major Russia–Europe pipeline; transit contract expired Dec 2024',
    path: [
      [76.63, 66.08], // Urengoy
      [70.00, 62.00], [65.00, 59.00], [60.00, 57.00],
      [55.00, 55.50], [50.00, 54.00], [45.00, 52.50],
      [40.00, 51.50], [35.00, 50.50], [32.00, 49.50],
      [30.00, 49.00], // Ukraine
      [27.00, 48.80], [24.00, 48.50], [22.30, 48.80],
      [20.00, 48.60], [18.00, 48.20], // Slovakia
      [16.37, 48.21], // Baumgarten, Austria
    ],
  },
  {
    id: 'turkstream',
    name: 'TurkStream',
    countries: 'Russia → Turkey → SE Europe',
    status: 'operating',
    capacityBcmYr: 31.5,
    lengthKm: 930,
    operator: 'Gazprom / BOTAŞ',
    notes: 'Two lines: one for Turkey, one for SE Europe via Bulgaria',
    path: [
      [38.90, 44.60], // Anapa, Russia
      [37.50, 43.80], [36.00, 43.20], [34.50, 42.80],
      [33.00, 42.50], [31.50, 42.00], [30.50, 41.50],
      [29.80, 41.30], // Kıyıköy, Turkey
      [29.00, 41.20], [28.70, 41.05], // Istanbul area
    ],
  },
  {
    id: 'blue-stream',
    name: 'Blue Stream',
    countries: 'Russia → Turkey',
    status: 'operating',
    capacityBcmYr: 16,
    lengthKm: 1213,
    operator: 'Gazprom / BOTAŞ',
    path: [
      [38.00, 44.70], // Beregovaya, Russia
      [37.50, 43.50], [37.00, 42.50], [36.50, 42.00],
      [36.20, 41.70], // Samsun, Turkey
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EUROPE — SOUTHERN CORRIDOR & NORTH AFRICA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'tanap',
    name: 'TANAP',
    countries: 'Azerbaijan → Georgia → Turkey',
    status: 'operating',
    capacityBcmYr: 16,
    lengthKm: 1850,
    operator: 'TANAP Doğalgaz',
    notes: 'Part of Southern Gas Corridor from Shah Deniz',
    path: [
      [49.95, 40.40], // Shah Deniz offshore
      [49.85, 40.45], [49.20, 40.70], // Sangachal
      [47.00, 41.40], [45.00, 41.60], // Georgia
      [43.50, 41.70], [42.50, 41.60],
      [41.50, 41.00], [40.50, 40.20], // Turkey border
      [39.00, 39.50], [37.00, 39.00], [35.00, 38.50],
      [33.00, 38.00], [31.00, 37.80], [29.50, 38.00],
      [27.50, 38.50], // Eskişehir
    ],
  },
  {
    id: 'tap',
    name: 'TAP (Trans-Adriatic Pipeline)',
    countries: 'Turkey → Greece → Albania → Italy',
    status: 'operating',
    capacityBcmYr: 10,
    lengthKm: 878,
    operator: 'TAP AG',
    notes: 'Final leg of Southern Gas Corridor to Europe',
    path: [
      [26.50, 40.80], // Turkey/Greece border
      [25.50, 41.00], [24.50, 41.10], [23.50, 41.00],
      [22.50, 40.80], [21.50, 40.60], [20.80, 40.50],
      [20.30, 40.60], // Albania
      [19.80, 40.50], [19.50, 40.30],
      [18.50, 40.30], // Adriatic crossing
      [17.50, 40.60], [17.00, 40.70], // San Foca, Italy
    ],
  },
  {
    id: 'transmed',
    name: 'TransMed (Enrico Mattei)',
    countries: 'Algeria → Tunisia → Italy',
    status: 'operating',
    capacityBcmYr: 33.5,
    lengthKm: 2475,
    operator: 'Sonatrach / ENI',
    notes: 'Major North African supply route to Italy via Sicily',
    path: [
      [3.04, 36.77], // Hassi R\'Mel area, Algeria
      [5.00, 35.50], [7.00, 35.00], [8.50, 35.50],
      [9.20, 36.30], // Oued el Shoul, Tunisia
      [10.20, 37.00], // Cap Bon
      [11.50, 37.30], // Sicily Channel
      [12.50, 37.50], // Mazara del Vallo, Sicily
      [13.50, 38.00], [14.50, 38.50],
      [15.50, 39.50], [16.00, 40.50],
      [15.50, 41.50], // Minerbio, Italy
    ],
  },
  {
    id: 'medgaz',
    name: 'MedGaz',
    countries: 'Algeria → Spain',
    status: 'operating',
    capacityBcmYr: 10.5,
    lengthKm: 756,
    operator: 'Sonatrach / Naturgy',
    path: [
      [3.04, 36.77], // Beni Saf, Algeria
      [1.50, 36.50], [0.00, 36.20], [-0.50, 36.30],
      [-1.50, 36.50], [-1.79, 36.72], // Almería, Spain
    ],
  },
  {
    id: 'greenstream',
    name: 'Greenstream',
    countries: 'Libya → Italy',
    status: 'operating',
    capacityBcmYr: 11,
    lengthKm: 520,
    operator: 'ENI / NOC',
    path: [
      [12.50, 32.90], // Mellitah, Libya
      [12.00, 34.00], [11.50, 35.50],
      [11.80, 37.00], // Gela, Sicily
    ],
  },
  {
    id: 'eastmed',
    name: 'EastMed Pipeline',
    countries: 'Israel → Cyprus → Greece → Italy',
    status: 'proposed',
    capacityBcmYr: 10,
    lengthKm: 1900,
    notes: 'Politically supported but technically challenging deep-water route',
    path: [
      [34.20, 31.80], // Leviathan field, Israel
      [33.50, 33.50], [33.00, 34.50], // Cyprus
      [31.00, 35.00], [28.00, 35.50],
      [25.00, 36.50], [22.00, 37.50],
      [20.00, 38.50], [18.00, 39.50],
      [16.00, 40.00], // Otranto, Italy
    ],
  },
  {
    id: 'balticpipe',
    name: 'Baltic Pipe',
    countries: 'Norway → Denmark → Poland',
    status: 'operating',
    capacityBcmYr: 10,
    lengthKm: 900,
    operator: 'Energinet / GAZ-SYSTEM',
    notes: 'Opened Oct 2022; Norwegian gas to Poland via Denmark',
    path: [
      [3.50, 57.80], // North Sea (Europipe II tie-in)
      [5.50, 57.50], [7.50, 56.50], [9.50, 56.00], // Jutland
      [10.50, 55.50], [11.50, 55.00], [13.00, 54.80],
      [14.50, 54.50], [16.00, 54.20], // Niechorze, Poland
    ],
  },
  {
    id: 'interconnector-uk-be',
    name: 'Interconnector (IUK)',
    countries: 'UK → Belgium',
    status: 'operating',
    capacityBcmYr: 25.5,
    lengthKm: 235,
    operator: 'Interconnector Ltd',
    path: [
      [1.10, 51.30], // Bacton, UK
      [1.50, 51.50], [2.00, 51.40], [2.50, 51.30],
      [3.20, 51.35], // Zeebrugge, Belgium
    ],
  },
  {
    id: 'langeled',
    name: 'Langeled',
    countries: 'Norway → UK',
    status: 'operating',
    capacityBcmYr: 26,
    lengthKm: 1166,
    operator: 'Gassco',
    notes: 'Longest subsea gas pipeline; from Nyhamna to Easington',
    path: [
      [6.00, 62.80], // Nyhamna, Norway
      [5.00, 61.50], [4.00, 60.00], [3.00, 58.50],
      [2.00, 56.50], [1.00, 55.00],
      [0.12, 53.65], // Easington, UK
    ],
  },
  {
    id: 'europipe-i',
    name: 'Europipe I',
    countries: 'Norway → Germany',
    status: 'operating',
    capacityBcmYr: 18,
    lengthKm: 660,
    operator: 'Gassco',
    path: [
      [2.50, 58.50], // Draupner platform
      [3.50, 57.50], [4.50, 56.50], [5.50, 55.50],
      [6.50, 55.00], [7.30, 54.50],
      [7.90, 53.90], // Dornum, Germany
    ],
  },
  {
    id: 'europipe-ii',
    name: 'Europipe II',
    countries: 'Norway → Germany',
    status: 'operating',
    capacityBcmYr: 24,
    lengthKm: 658,
    operator: 'Gassco',
    path: [
      [1.80, 59.50], // Kårstø, Norway
      [2.50, 58.50], [3.50, 57.00], [4.50, 56.00],
      [5.50, 55.20], [6.50, 54.50],
      [7.90, 53.90], // Dornum, Germany
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MIDDLE EAST & GULF
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'dolphin',
    name: 'Dolphin Gas Pipeline',
    countries: 'Qatar → UAE → Oman',
    status: 'operating',
    capacityBcmYr: 19,
    lengthKm: 370,
    operator: 'Dolphin Energy',
    path: [
      [51.50, 25.80], // Ras Laffan, Qatar
      [52.00, 25.50], [52.50, 25.00], [53.00, 24.80],
      [54.00, 24.50], [55.00, 24.90],
      [55.30, 25.10], // Taweelah, UAE
      [55.80, 25.00], [56.30, 24.50],
      [56.50, 24.20], // Fujairah
    ],
  },
  {
    id: 'arab-gas',
    name: 'Arab Gas Pipeline',
    countries: 'Egypt → Jordan → Syria → Lebanon',
    status: 'operating',
    capacityBcmYr: 10,
    lengthKm: 1200,
    operator: 'Various national cos.',
    notes: 'Partially operational; Syrian sections damaged',
    path: [
      [32.30, 31.25], // Arish, Egypt
      [34.00, 31.00], [35.00, 30.50], [35.50, 30.00],
      [36.00, 31.00], // Aqaba, Jordan
      [36.50, 32.00], [36.30, 33.00], [36.00, 34.00],
      [36.00, 34.70], // Homs, Syria
      [35.80, 35.50], // Banias, Syria
      [35.50, 34.50], // Tripoli, Lebanon
    ],
  },
  {
    id: 'igat-1',
    name: 'IGAT-1 (Iranian Gas Trunkline)',
    countries: 'Iran (internal)',
    status: 'operating',
    capacityBcmYr: 10,
    lengthKm: 1100,
    operator: 'NIGC',
    path: [
      [52.50, 27.50], // Bid Boland, SW Iran
      [51.50, 29.50], [51.00, 31.00], [51.50, 32.50],
      [52.00, 34.00], [52.50, 35.50],
      [51.50, 35.70], // Tehran
    ],
  },
  {
    id: 'tapi',
    name: 'TAPI (Turkmenistan–Afghanistan–Pakistan–India)',
    countries: 'Turkmenistan → Afghanistan → Pakistan → India',
    status: 'construction',
    capacityBcmYr: 33,
    lengthKm: 1814,
    notes: 'Construction started 2015; delayed by Afghan instability',
    path: [
      [62.50, 37.80], // Galkynysh field, Turkmenistan
      [63.00, 36.50], [64.50, 35.50], [65.50, 34.50], // Afghanistan
      [66.50, 33.50], [67.50, 32.00], [67.50, 30.50],
      [67.00, 29.00], // Quetta, Pakistan
      [68.00, 27.50], [69.00, 26.00],
      [70.00, 25.00], // Multan, Pakistan
      [71.50, 24.50], [73.00, 24.00],
      [74.00, 23.50], // Fazilka, India
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RUSSIA — ASIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'power-of-siberia',
    name: 'Power of Siberia',
    countries: 'Russia → China',
    status: 'operating',
    capacityBcmYr: 38,
    lengthKm: 3000,
    operator: 'Gazprom',
    notes: 'Chayandinskoye → Blagoveshchensk → Heihe (China)',
    path: [
      [112.50, 58.50], // Chayandinskoye field
      [116.00, 56.00], [120.00, 54.00], [124.00, 52.00],
      [127.50, 50.50],
      [127.50, 50.27], // Blagoveshchensk / Heihe border
      [128.50, 48.50], [130.00, 46.50],
      [131.00, 44.00], // Connects to China East-West
    ],
  },
  {
    id: 'power-of-siberia-2',
    name: 'Power of Siberia 2',
    countries: 'Russia → Mongolia → China',
    status: 'proposed',
    capacityBcmYr: 50,
    lengthKm: 2600,
    operator: 'Gazprom',
    notes: 'Via Mongolia; would connect West Siberian fields to China',
    path: [
      [76.63, 66.08], // Urengoy/Yamal area
      [80.00, 60.00], [85.00, 56.00], [90.00, 53.00],
      [95.00, 51.00], [100.00, 50.00],
      [105.00, 48.50], // Mongolia
      [107.50, 47.50], [110.00, 45.00],
      [112.00, 42.50], // China border
      [114.00, 41.00], // Beijing area
    ],
  },
  {
    id: 'sakhalin-khabarovsk',
    name: 'Sakhalin–Khabarovsk–Vladivostok',
    countries: 'Russia (internal)',
    status: 'operating',
    capacityBcmYr: 30,
    lengthKm: 1800,
    operator: 'Gazprom',
    path: [
      [143.00, 52.50], // Sakhalin
      [141.50, 50.50], [140.50, 49.00],
      [135.00, 48.50], // Khabarovsk
      [133.00, 46.00],
      [131.90, 43.10], // Vladivostok
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CENTRAL ASIA — CHINA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'central-asia-china-a',
    name: 'Central Asia–China (Line A)',
    countries: 'Turkmenistan → Uzbekistan → Kazakhstan → China',
    status: 'operating',
    capacityBcmYr: 15,
    lengthKm: 1833,
    operator: 'CNPC / National cos.',
    path: [
      [61.50, 38.00], // Gedaim, Turkmenistan
      [63.00, 39.50], [64.50, 40.50], // Uzbekistan
      [66.00, 41.00], [67.50, 41.50],
      [69.00, 41.80], // Tashkent area
      [70.50, 42.50], [73.00, 43.00], // Kazakhstan
      [76.00, 44.00], [79.50, 44.50],
      [80.30, 44.40], // Khorgos, China border
    ],
  },
  {
    id: 'central-asia-china-d',
    name: 'Central Asia–China (Line D)',
    countries: 'Turkmenistan → Uzbekistan → Tajikistan → Kyrgyzstan → China',
    status: 'construction',
    capacityBcmYr: 30,
    lengthKm: 1000,
    notes: 'Takes southern route through mountainous terrain',
    path: [
      [61.50, 38.00], // Gedaim, Turkmenistan
      [64.00, 38.50], [66.00, 38.50], // Uzbekistan south
      [68.00, 38.00], [69.50, 38.50], // Tajikistan
      [71.00, 39.50], [73.00, 40.50], // Kyrgyzstan
      [75.00, 41.00], [76.50, 40.50],
      [76.50, 39.80], // Kashgar, China
    ],
  },
  {
    id: 'myanmar-china',
    name: 'Myanmar–China Gas Pipeline',
    countries: 'Myanmar → China',
    status: 'operating',
    capacityBcmYr: 12,
    lengthKm: 793,
    operator: 'CNPC / MOGE',
    path: [
      [93.50, 19.50], // Kyaukpyu, Myanmar (Bay of Bengal)
      [95.00, 20.50], [96.50, 21.50], [97.50, 22.50],
      [98.50, 23.50], // Ruili border
      [100.00, 24.50], [102.00, 25.00],
      [103.50, 25.50], // Kunming, China
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AFRICA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'west-african-gas',
    name: 'West African Gas Pipeline',
    countries: 'Nigeria → Benin → Togo → Ghana',
    status: 'operating',
    capacityBcmYr: 5,
    lengthKm: 678,
    operator: 'WAPCo',
    path: [
      [3.40, 6.45], // Lagos, Nigeria
      [2.60, 6.35], // Benin
      [1.20, 6.15], // Lomé, Togo
      [0.00, 5.80],
      [-0.20, 5.60], // Takoradi, Ghana
    ],
  },
  {
    id: 'trans-saharan',
    name: 'Trans-Saharan Gas Pipeline (TSGP)',
    countries: 'Nigeria → Niger → Algeria',
    status: 'proposed',
    capacityBcmYr: 30,
    lengthKm: 4128,
    notes: 'Long-proposed; would connect Nigerian gas to Algerian network/Europe',
    path: [
      [7.50, 9.00], // Warri, Nigeria
      [7.50, 11.00], [7.50, 13.50], // Niger border
      [7.50, 15.00], [7.00, 17.00],
      [6.00, 19.00], [5.00, 21.00],
      [4.00, 23.00], [3.00, 26.00],
      [3.00, 28.00], [3.04, 32.50], // Hassi R'Mel, Algeria
    ],
  },
  {
    id: 'nigeria-morocco',
    name: 'Nigeria–Morocco Gas Pipeline',
    countries: 'Nigeria → West Africa → Morocco',
    status: 'proposed',
    capacityBcmYr: 25,
    lengthKm: 5660,
    notes: 'Atlantic coast route; could extend to Europe via Spain',
    path: [
      [3.40, 6.45], // Lagos
      [2.00, 6.30], [0.50, 5.60], [-1.00, 5.20], // Ghana
      [-4.00, 5.30], [-7.00, 5.00], // Liberia
      [-10.00, 7.00], [-14.00, 9.00], // Guinea
      [-16.50, 12.50], [-16.50, 14.50], // Senegal
      [-16.00, 18.00], [-16.00, 21.00], // Mauritania
      [-13.00, 27.00], [-10.00, 30.50],
      [-7.00, 33.50], // Casablanca, Morocco
    ],
  },
  {
    id: 'mozambique-sa',
    name: 'ROMPCO (Mozambique → South Africa)',
    countries: 'Mozambique → South Africa',
    status: 'operating',
    capacityBcmYr: 4,
    lengthKm: 865,
    operator: 'ROMPCO',
    path: [
      [35.40, -23.80], // Temane, Mozambique
      [34.50, -24.50], [33.50, -25.00],
      [32.00, -25.50], [31.00, -25.80],
      [29.50, -26.00], [28.50, -26.20],
      [28.20, -26.20], // Secunda, South Africa
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NORTH AMERICA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'tcpl-mainline',
    name: 'TransCanada Mainline',
    countries: 'Canada (internal)',
    status: 'operating',
    capacityBcmYr: 38,
    lengthKm: 14000,
    operator: 'TC Energy',
    notes: 'Largest gas pipeline system in Canada; WCSB to Ontario/Quebec',
    path: [
      [-118.00, 54.00], // Alberta (WCSB)
      [-114.00, 53.50], [-110.00, 53.00], [-106.00, 52.50],
      [-100.00, 51.00], [-96.00, 50.00], // Manitoba
      [-92.00, 49.50], [-88.00, 49.00], [-84.00, 48.00], // Ontario
      [-80.00, 46.00], [-76.00, 45.50], [-73.50, 45.50], // Montreal
    ],
  },
  {
    id: 'coastal-gaslink',
    name: 'Coastal GasLink',
    countries: 'Canada (internal)',
    status: 'operating',
    capacityBcmYr: 19,
    lengthKm: 670,
    operator: 'TC Energy',
    notes: 'Feeds LNG Canada export terminal in Kitimat',
    path: [
      [-120.00, 56.00], // Dawson Creek, BC
      [-122.00, 55.50], [-124.00, 55.00],
      [-126.00, 54.50], [-128.00, 54.00],
      [-128.70, 54.00], // Kitimat LNG
    ],
  },
  {
    id: 'mountain-valley',
    name: 'Mountain Valley Pipeline',
    countries: 'USA (WV → VA)',
    status: 'operating',
    capacityBcmYr: 6,
    lengthKm: 518,
    operator: 'EQT / NextEra',
    notes: 'Appalachian shale gas; completed 2024 after years of legal battles',
    path: [
      [-80.50, 39.50], // Wetzel County, WV
      [-80.20, 38.50], [-80.00, 37.80],
      [-79.80, 37.30], [-79.50, 37.00],
      [-79.30, 36.80], // Pittsylvania County, VA
    ],
  },
  {
    id: 'permian-highway',
    name: 'Permian Highway Pipeline',
    countries: 'USA (TX)',
    status: 'operating',
    capacityBcmYr: 6,
    lengthKm: 684,
    operator: 'Kinder Morgan',
    notes: 'Permian Basin to Gulf Coast LNG/petrochemical hubs',
    path: [
      [-102.50, 32.00], // Waha Hub, Permian Basin
      [-101.00, 31.00], [-99.50, 30.50],
      [-98.00, 30.00], [-97.00, 29.50],
      [-95.50, 29.00], // Katy Hub, TX
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUTH AMERICA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'tnp-arg',
    name: 'Néstor Kirchner Pipeline',
    countries: 'Argentina (internal)',
    status: 'operating',
    capacityBcmYr: 11,
    lengthKm: 573,
    operator: 'IEASA',
    notes: 'Vaca Muerta shale gas to Buenos Aires demand center',
    path: [
      [-68.50, -38.50], // Tratayén, Neuquén (Vaca Muerta)
      [-66.00, -37.50], [-63.50, -36.50],
      [-61.00, -35.50], [-59.50, -35.00],
      [-58.50, -34.60], // Buenos Aires
    ],
  },
  {
    id: 'gasbol',
    name: 'GASBOL (Bolivia–Brazil)',
    countries: 'Bolivia → Brazil',
    status: 'operating',
    capacityBcmYr: 11,
    lengthKm: 3150,
    operator: 'TBG / YPFB',
    path: [
      [-63.20, -18.00], // Santa Cruz, Bolivia
      [-60.00, -18.50], [-57.50, -19.50], // Brazil border
      [-55.00, -20.50], [-52.00, -21.50],
      [-49.50, -22.00], [-47.50, -22.50],
      [-46.50, -23.50], // Campinas/São Paulo
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIA-PACIFIC & SOUTHEAST ASIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'west-east-china-1',
    name: 'West–East Gas Pipeline I',
    countries: 'China (internal)',
    status: 'operating',
    capacityBcmYr: 17,
    lengthKm: 3900,
    operator: 'PetroChina',
    notes: 'Tarim Basin (Xinjiang) to Shanghai',
    path: [
      [82.00, 40.50], // Lunnan, Tarim Basin
      [86.00, 41.00], [90.00, 41.50],
      [95.00, 40.00], [100.00, 38.50],
      [104.00, 36.50], [107.00, 35.00],
      [110.00, 34.50], [113.00, 34.50],
      [116.00, 34.00], [118.00, 33.00],
      [121.50, 31.20], // Shanghai
    ],
  },
  {
    id: 'west-east-china-2',
    name: 'West–East Gas Pipeline II',
    countries: 'Turkmenistan → China (internal)',
    status: 'operating',
    capacityBcmYr: 30,
    lengthKm: 4895,
    operator: 'PetroChina',
    notes: 'Connects Central Asia imports to Guangzhou via Xinjiang',
    path: [
      [80.30, 44.40], // Khorgos, China border
      [82.00, 43.00], [85.00, 42.00],
      [90.00, 41.00], [95.00, 39.50],
      [100.00, 37.50], [104.00, 35.50],
      [107.00, 34.50], [110.00, 33.50],
      [113.00, 30.50], [115.00, 28.00],
      [114.00, 25.00], [113.30, 23.10], // Guangzhou
    ],
  },
  {
    id: 'west-east-china-3',
    name: 'West–East Gas Pipeline III',
    countries: 'China (internal)',
    status: 'operating',
    capacityBcmYr: 30,
    lengthKm: 5220,
    operator: 'PetroChina',
    notes: 'Xinjiang to Fujian; parallel route south of WE-II',
    path: [
      [80.30, 44.40], // Khorgos
      [82.00, 42.50], [86.00, 40.50],
      [90.00, 39.00], [95.00, 37.00],
      [100.00, 35.00], [104.00, 33.00],
      [108.00, 31.00], [112.00, 29.00],
      [115.00, 27.50], [117.00, 26.00],
      [119.30, 26.00], // Fuzhou, Fujian
    ],
  },
  {
    id: 'trans-asean',
    name: 'Trans-ASEAN Gas Pipeline',
    countries: 'Malaysia → Singapore → Indonesia',
    status: 'operating',
    capacityBcmYr: 8,
    lengthKm: 350,
    operator: 'Petronas / Various',
    notes: 'Multiple interconnectors; Peninsular Malaysia to Singapore',
    path: [
      [103.70, 2.50], // Kertih, Malaysia
      [103.80, 2.00], [103.90, 1.60],
      [103.85, 1.30], // Singapore
      [104.00, 1.10],
      [104.50, 0.50], // Batam, Indonesia
    ],
  },
  {
    id: 'hga-australia',
    name: 'Eastern Gas Pipeline',
    countries: 'Australia (internal)',
    status: 'operating',
    capacityBcmYr: 4.5,
    lengthKm: 795,
    operator: 'Jemena',
    notes: 'Bass Strait to Sydney',
    path: [
      [147.00, -38.30], // Longford, Gippsland
      [147.50, -37.50], [148.00, -36.50],
      [149.00, -35.50], [150.00, -34.50],
      [151.00, -33.90], // Horsley Park, Sydney
    ],
  },
  {
    id: 'dammpier-bunbury',
    name: 'Dampier to Bunbury',
    countries: 'Australia (internal)',
    status: 'operating',
    capacityBcmYr: 12,
    lengthKm: 1530,
    operator: 'DBNGP Trust',
    notes: 'Major WA trunk line from NW Shelf to Perth/Bunbury',
    path: [
      [116.71, -20.66], // Dampier
      [116.00, -22.00], [115.50, -24.00],
      [115.00, -26.00], [114.80, -28.00],
      [115.20, -30.00], [115.50, -31.50],
      [115.60, -31.95], // Perth
      [115.65, -33.30], // Bunbury
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INDIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'hbj',
    name: 'HBJ (Hazira–Bijaipur–Jagdishpur)',
    countries: 'India (internal)',
    status: 'operating',
    capacityBcmYr: 18,
    lengthKm: 1750,
    operator: 'GAIL',
    notes: 'India\'s main trunk gas pipeline',
    path: [
      [72.60, 21.10], // Hazira (Gujarat coast)
      [73.50, 22.50], [75.00, 23.00],
      [77.00, 23.50], [79.00, 24.00],
      [80.50, 24.50], [82.00, 26.50],
      [83.50, 26.80], // Jagdishpur, UP
    ],
  },
  {
    id: 'dvpl',
    name: 'Dahej–Vijaipur Pipeline',
    countries: 'India (internal)',
    status: 'operating',
    capacityBcmYr: 16,
    lengthKm: 730,
    operator: 'GAIL',
    path: [
      [72.60, 21.70], // Dahej LNG terminal
      [73.00, 22.50], [74.00, 23.50],
      [75.50, 24.00], [76.50, 24.50],
      [75.70, 24.10], // Vijaipur
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EUROPE — INTERNAL INTERCONNECTORS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gipl',
    name: 'GIPL (Gas Interconnection Poland–Lithuania)',
    countries: 'Poland → Lithuania',
    status: 'operating',
    capacityBcmYr: 2.4,
    lengthKm: 508,
    operator: 'GAZ-SYSTEM / Amber Grid',
    notes: 'Key Baltic energy independence link, opened 2022',
    path: [
      [21.90, 53.80], // Hołowczyce, Poland
      [22.50, 54.00], [23.00, 54.50],
      [23.50, 55.00], [24.00, 55.50],
      [24.50, 55.70], // Jauniūnai, Lithuania
    ],
  },
  {
    id: 'ig-bulgaria-greece',
    name: 'IGB (Interconnector Greece–Bulgaria)',
    countries: 'Greece → Bulgaria',
    status: 'operating',
    capacityBcmYr: 3,
    lengthKm: 182,
    operator: 'ICGB AD',
    notes: 'Opened 2022; diversification from Russian gas',
    path: [
      [24.40, 41.10], // Komotini, Greece
      [25.00, 41.30], [25.50, 41.60],
      [25.70, 42.10], // Stara Zagora, Bulgaria
    ],
  },
]
