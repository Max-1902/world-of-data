import type { Flight } from '../types'

/**
 * 'airline' = an airline-format callsign (operator prefix + flight number). Whether that flight carries passengers
 * or freight is NOT known: mixed operators (Qatar, Emirates, Cathay, Lufthansa…) fly freighters under the same
 * prefix, and OpenSky state vectors carry no aircraft type. Only operators that fly nothing but freight are 'cargo'.
 */
export type FlightType = 'airline' | 'cargo' | 'military' | 'private' | 'unknown'

export const FLIGHT_TYPE_COLORS: Record<FlightType, string> = {
  airline:   '#00c8ff',   // cyan  — most common; distinctive against dark map
  cargo:     '#ff9900',   // amber
  military:  '#ff1a3e',   // red
  private:   '#00ff88',   // green
  unknown:   '#cc88ff',   // violet — clearly different from airline
}

export const FLIGHT_TYPE_LABELS: Record<FlightType, string> = {
  airline:   'Airline (pax/cargo unknown)',
  cargo:     'Cargo',
  military:  'Military',
  private:   'Private / GA',
  unknown:   'Unknown',
}

// All-cargo operators by ICAO airline designator (first 3 characters of the callsign).
// Added 2026-10-15 from ICAO Doc 8585 designators: BOX AeroLogic, GEC Lufthansa Cargo, DHK DHL Air UK,
// DAE DHL Aero Expreso, CAO Air China Cargo, CKK China Cargo Airlines, CSS SF Airlines, MPH Martinair,
// ABW AirBridgeCargo, NCA Nippon Cargo Airlines, SWN West Atlantic, TAY ASL Airlines Belgium.
// The first three rows predate that and were not individually re-checked.
const CARGO_OPS = new Set([
  'UPS','FDX','FXE','GTI','ABX','ATN','CLX','CKS','FTH','POL',
  'NCR','WGN','KMI','MCF','SDO','TRK','BCS','AAO','DHL','TNT',
  'SQC','PAC','QTA','LCO','VGO','BGA','RAK','TUS','OPS',
  'BOX','GEC','DHK','DAE','CAO','CKK','CSS','MPH','ABW','NCA','SWN','TAY',
])

// Military callsign regex patterns (US DoD, NATO, USAF, USN, USMC, USCG)
const MIL_PATTERNS: RegExp[] = [
  /^RCH\d/,   // USAF REACH airlift
  /^SAM\d/,   // Special Air Mission (VIP)
  /^EXEC\d/,  // Executive flights
  /^EVAC\d/,  // Medical evacuation
  /^DUKE\d/,  // USAF
  /^PACK\d/,  // USAF
  /^MOOSE\d/, // USAF
  /^FORTE\d/, // E-4B NAOC "doomsday plane"
  /^TOPF\d/,  // USAF
  /^SPAR\d/,  // US DoD VIP
  /^KNIFE\d/, // USAF
  /^ENUF\d/,  // US Navy
  /^GOTCH/,   // USAF
  /^BISON\d/, // USAF
  /^ROCKY\d/, // USAF C-17
  /^RAIDER/,  // USAF B-21
  /^EAGLE\d/, // USAF
  /^COAST\d/, // USCG
  /^CG\d{2}/,  // USCG
  /^VV\d/,    // US Army
  /^VM[A-Z]\d/,// USMC
  /^VX\d/,    // US Navy test
  /^VR\d/,    // US Navy transport
  /^CNV\d/,   // US Navy
  /^CONVOY/,  // Military convoy
  /^HALO\d/,  // Special ops
  /^SPUD\d/,  // USAF
  /^RANGER/,  // US Army
  /^SNAKE\d/, // USAF
  /^TITAN\d/, // USAF
  /^GRND\d/,  // Military ground
  /^GAF\d/,   // German Air Force
  /^BAF\d/,   // Belgian Air Force
  /^NAF\d/,   // Netherlands Air Force
  /^FAF\d/,   // French Air Force
  /^IAF\d/,   // Israel Air Force
]

// US military ICAO24 hex ranges
const MIL_RANGES: [number, number][] = [
  [0xAE0000, 0xAFFFFF], // USAF/USN/USMC
  [0xA92000, 0xA97FFF], // US DoD
]

export function detectFlightType(callsign: string, icao24: string): FlightType {
  const cs   = (callsign || '').trim().toUpperCase()
  const icao = (icao24   || '').trim().toLowerCase()

  // Military by ICAO24 hex range
  const icaoNum = parseInt(icao, 16)
  if (!isNaN(icaoNum)) {
    for (const [lo, hi] of MIL_RANGES) {
      if (icaoNum >= lo && icaoNum <= hi) return 'military'
    }
  }

  // Military by callsign pattern
  if (MIL_PATTERNS.some((p) => p.test(cs))) return 'military'

  // Cargo by ICAO operator designator (all designators here are three letters)
  if (CARGO_OPS.has(cs.slice(0, 3))) return 'cargo'

  // Private: bare registration format (N1234AB, G-ABCD, D-ABCD, PH-ABC…)
  if (/^N\d{1,5}[A-Z]{0,2}$/.test(cs)) return 'private'
  if (/^[A-Z]-[A-Z]{3,4}$/.test(cs))   return 'private'
  if (/^[A-Z]{2}-[A-Z]{2,3}$/.test(cs)) return 'private'
  if (/^OE-[A-Z]/.test(cs))             return 'private'

  // Airline-format callsign: ICAO prefix (2-3 letters) + flight number. Passenger vs cargo is not determinable here.
  if (/^[A-Z]{2,3}\d{1,4}[A-Z]?$/.test(cs) && cs.length >= 4) return 'airline'

  return 'unknown'
}

// Compute counts of each type from a flight array
export function countFlightTypes(flights: Flight[]): Record<FlightType, number> {
  const counts: Record<FlightType, number> = { airline: 0, cargo: 0, military: 0, private: 0, unknown: 0 }
  for (const f of flights) {
    const t = detectFlightType(f.callsign || '', f.icao24 || '')
    counts[t]++
  }
  return counts
}

export function headingToCompass(deg: number): string {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}
