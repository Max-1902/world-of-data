/**
 * Vessel tracking via AISStream.io WebSocket
 * Real-time global AIS vessel positions.
 * https://aisstream.io/documentation
 *
 * Requires VITE_AISSTREAM_KEY in .env
 */

const AISSTREAM_KEY = import.meta.env.VITE_AISSTREAM_KEY || ''
// WebSocket handshakes aren't subject to fetch/CORS restrictions, so the
// browser can connect straight to AISStream's public endpoint — this also
// means it works the same in `vite dev` and in any production deployment,
// with no server-side proxy needed.
const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Vessel {
  mmsi: number
  name: string
  latitude: number
  longitude: number
  cog: number        // course over ground (degrees)
  sog: number        // speed over ground (knots)
  heading: number    // true heading (0-359)
  navStatus: number
  shipType: number   // AIS ship type code (0-99)
  timestamp: string
  destination?: string
}

export type VesselType = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'tug' | 'other'

export function vesselTypeFromCode(code: number): VesselType {
  if (code >= 70 && code <= 79) return 'cargo'
  if (code >= 80 && code <= 89) return 'tanker'
  if (code >= 60 && code <= 69) return 'passenger'
  if (code === 30) return 'fishing'
  if (code >= 31 && code <= 32) return 'tug'
  if (code === 35) return 'military'
  return 'other'
}

export function detectVesselType(name: string): VesselType {
  const n = name.toUpperCase()
  if (/\b(NAVY|USCG|HMCS|USS |HMS |FRIGATE|CORVETTE|PATROL)\b/.test(n)) return 'military'
  if (/\b(TANKER|CRUDE|LNG |LPG |OIL|CHEMICAL|PRODUCT)\b/.test(n)) return 'tanker'
  if (/\b(CRUISE|FERRY|PASSENGER|SPIRIT OF|QUEEN)\b/.test(n)) return 'passenger'
  if (/\b(FISH|TRAWL|SEINER|LONGLIN)\b/.test(n)) return 'fishing'
  if (/\b(TUG|PILOT|PUSH|SALVAG)\b/.test(n)) return 'tug'
  if (/\b(CONTAINER|BULK|CARGO|CARRIER|MAERSK|MSC |CMA |COSCO|EVERGREEN|BOX)\b/.test(n)) return 'cargo'
  return 'other'
}

export const VESSEL_TYPE_COLORS: Record<VesselType, string> = {
  cargo:     '#00cc88',
  tanker:    '#ff6600',
  passenger: '#00aaff',
  fishing:   '#ffcc00',
  military:  '#ff2244',
  tug:       '#aa88ff',
  other:     '#888888',
}

export const VESSEL_TYPE_LABELS: Record<VesselType, string> = {
  cargo:     'Cargo',
  tanker:    'Tanker',
  passenger: 'Passenger',
  fishing:   'Fishing',
  military:  'Military',
  tug:       'Tug/Pilot',
  other:     'Other',
}

// ── In-memory store ──────────────────────────────────────────────────────────
const vesselStore = new Map<number, Vessel>()
const metaCache = new Map<number, { name: string; shipType: number; destination: string }>()

// ── AISStream WebSocket ──────────────────────────────────────────────────────

function connectAISStreamWS(): (() => void) | null {
  if (!AISSTREAM_KEY) {
    console.warn('[AIS] No VITE_AISSTREAM_KEY set — vessel tracking disabled')
    return null
  }

  let ws: WebSocket | null = null
  let closed = false
  let reconnectTimer: number | null = null
  let msgCount = 0

  function connect() {
    if (closed) return
    msgCount = 0
    console.log('[AIS] Attempting AISStream WebSocket…')
    try { ws = new WebSocket(AISSTREAM_URL) } catch (e) {
      console.error('[AIS] WebSocket constructor failed:', e)
      return
    }

    ws.onopen = () => {
      console.log('[AIS] AISStream connected — subscribing')
      ws!.send(JSON.stringify({
        APIkey: AISSTREAM_KEY,
        BoundingBoxes: [[[-180, -90], [180, 90]]],
        FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
      }))
      setTimeout(() => {
        if (msgCount === 0 && !closed) {
          console.warn('[AIS] No messages received after 10s — check API key')
        }
      }, 10000)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '')
        if (msg.error || msg.ERROR) {
          console.error('[AIS] AISStream error response:', msg.error || msg.ERROR)
          return
        }
        msgCount++
        if (msgCount === 1) console.log('[AIS] First AISStream message received — stream active')
        if (msgCount % 1000 === 0) console.log(`[AIS] AISStream: ${msgCount} messages, ${vesselStore.size} vessels tracked`)

        const type = msg.MessageType
        if (type === 'PositionReport') {
          const meta = msg.MetaData
          const pos = msg.Message?.PositionReport
          if (!meta || !pos) return
          const mmsi = meta.MMSI
          const lat = pos.Latitude ?? meta.latitude
          const lng = pos.Longitude ?? meta.longitude
          if (lat == null || lng == null || (lat === 0 && lng === 0)) return
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return
          const rawH = pos.TrueHeading
          const heading = (rawH === 511 || rawH > 360) ? (pos.Cog ?? 0) : rawH
          const cached = metaCache.get(mmsi)
          vesselStore.set(mmsi, {
            mmsi,
            name: meta.ShipName?.trim() || cached?.name || '',
            latitude: lat, longitude: lng,
            cog: pos.Cog ?? 0, sog: pos.Sog ?? 0, heading: heading ?? 0,
            navStatus: pos.NavigationalStatus ?? 0,
            shipType: cached?.shipType ?? 0,
            timestamp: meta.time_utc || new Date().toISOString(),
            destination: cached?.destination,
          })
        } else if (type === 'ShipStaticData') {
          const meta = msg.MetaData
          const data = msg.Message?.ShipStaticData
          if (!meta || !data) return
          metaCache.set(meta.MMSI, {
            name: data.Name?.trim() || '', shipType: data.Type ?? 0,
            destination: data.Destination?.trim() || '',
          })
          const existing = vesselStore.get(meta.MMSI)
          if (existing) {
            existing.name = data.Name?.trim() || existing.name
            existing.shipType = data.Type ?? existing.shipType
            existing.destination = data.Destination?.trim() || existing.destination
          }
        }
      } catch { /* skip malformed */ }
    }

    ws.onerror = (e) => {
      console.error('[AIS] WebSocket error:', e)
    }
    ws.onclose = (e) => {
      console.warn(`[AIS] WebSocket closed: code=${e.code} reason="${e.reason}"`)
      if (!closed) {
        console.log('[AIS] Reconnecting in 10s…')
        reconnectTimer = window.setTimeout(connect, 10000)
      }
    }
  }

  connect()
  return () => {
    closed = true
    if (ws) { ws.close(); ws = null }
    if (reconnectTimer) clearTimeout(reconnectTimer)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function connectAISStream(onUpdate: (vessels: Vessel[]) => void): () => void {
  let closed = false

  // AISStream WebSocket — sole data source
  const wsCleanup = connectAISStreamWS()

  // Push snapshots to React every 5 seconds
  const snapshotTimer = window.setInterval(() => {
    if (closed) return
    const snapshot = Array.from(vesselStore.values())
    if (snapshot.length > 0) onUpdate(snapshot)
  }, 5000)

  return () => {
    closed = true
    clearInterval(snapshotTimer)
    wsCleanup?.()
    vesselStore.clear()
    metaCache.clear()
  }
}
