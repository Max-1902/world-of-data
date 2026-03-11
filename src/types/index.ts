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

export interface StockCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketEvent {
  date: string
  description: string
  impact: 'positive' | 'negative' | 'neutral'
  symbols: string[]
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
  oilgas:         boolean
  gpsjam:         boolean
}

export interface MapMarker {
  id: string
  type: 'flight' | 'crisis' | 'news' | 'stock'
  latitude: number
  longitude: number
  data: Flight | CrisisEvent | NewsArticle
}
