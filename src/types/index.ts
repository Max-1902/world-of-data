export type MapViewMode = 'earth' | 'standard' | 'dark' | 'satellite' | 'nightvision' | 'bw' | 'infrared' | 'snow' | 'thermal' | 'city3d'

export interface Flight {
  icao24: string
  callsign: string
  origin_country: string
  longitude: number | null
  latitude: number | null
  altitude: number | null
  velocity: number | null
  heading: number | null
  on_ground: boolean
}

export interface CrisisEvent {
  id: string
  title: string
  type: 'war' | 'conflict' | 'protest' | 'political' | 'disaster' | 'terrorism'
  severity: 'low' | 'medium' | 'high' | 'critical'
  latitude: number
  longitude: number
  country: string
  date: string
  description: string
  source: string
  fatalities?: number
  /** Year-old ACLED fallback (services/crises.ts fetchACLEDArchive): map display only, never in the live list. */
  archived?: boolean
}

export interface NewsArticle {
  id: string
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  imageUrl?: string
  latitude?: number
  longitude?: number
  category?: string
  /** Language of title/description when the feed isn't English (ISO 639-1); undefined = English or unknown. */
  lang?: string
}

export interface Stock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  open: number
  previousClose: number
  currency: string
  exchange: string
  lastUpdated: string
}

export interface PanelState {
  flights:   boolean
  crises:    boolean
  news:      boolean
  stocks:    boolean
  wildfires: boolean
  military:  boolean
  nuclear:   boolean
  sanctions: boolean
  cameras:        boolean
  infrastructure: boolean
  airspace:       boolean
  humanitarian:   boolean
  vessels:        boolean
  oil:            boolean
  gas:            boolean
  gpsjam:         boolean
  ports:          boolean
  pipelines:      boolean
  chokepoints:    boolean
  supplychain:    boolean
  shippingDensity: boolean
  outages:        boolean
  disasters:      boolean
  resources:      boolean
  tradeStats:     boolean
  militaryPersonnel: boolean
  datacenters:    boolean
  infraIndicators: boolean
  analyticsHex:   boolean
  countryAnalytics: boolean
}

/** A city/town picked on the map: the regional outlook then reports on the area around it, not the whole country. */
export interface SelectedPlace {
  name: string
  /** state / province, when the geocoder knows one */
  region?: string
  country: string
  lat: number
  lng: number
}

/** Live conflict events as fetched (no baseline markers, no map thinning) and whether the poll hit its row cap. */
export interface ConflictFeed { events: CrisisEvent[]; capped: boolean }
