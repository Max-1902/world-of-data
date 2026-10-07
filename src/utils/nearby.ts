import { distanceKm, type LatLng } from './geo'
import type { CrisisEvent, Flight } from '../types'
import type { Earthquake } from '../services/earthquakes'
import type { FirePoint } from '../services/wildfires'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, type MilitaryFacility, type NuclearPlant } from '../services/military'
import { ALL_INFRA_POINTS, type InfraPoint } from '../services/infrastructure'
import { PORTS, type Port } from '../services/ports'

export interface Near<T> { item: T; km: number }

/** How far from the picked place each kind of thing still counts as "here". */
export const RADIUS_KM = { incidents: 75, quakes: 200, fires: 50, flights: 60, assets: 60 } as const

/** Items within `radiusKm` of `center`, nearest first. Items without usable coordinates are skipped. */
export function within<T>(items: readonly T[], center: LatLng, radiusKm: number, pos: (t: T) => Partial<LatLng> | null): Near<T>[] {
  const out: Near<T>[] = []
  for (const item of items) {
    const p = pos(item)
    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number' || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    const km = distanceKm(center, p as LatLng)
    if (km <= radiusKm) out.push({ item, km })
  }
  return out.sort((a, b) => a.km - b.km)
}

export interface NearbyInput {
  crises: CrisisEvent[]
  flights: Flight[]
  earthquakes?: Earthquake[]
  fires?: FirePoint[]
}

export interface NearbyData {
  incidents: Near<CrisisEvent>[]
  quakes: Near<Earthquake>[]
  fires: Near<FirePoint>[]
  /** airborne + on-ground aircraft inside the radius */
  flights: { airborne: number; onGround: number; sample: Flight[] }
  military: Near<MilitaryFacility>[]
  nuclear: Near<NuclearPlant>[]
  infra: Near<InfraPoint>[]
  ports: Near<Port>[]
}

/** Everything the dashboard already tracks that lies around `center`. Synthetic baseline conflict markers are left out. */
export function nearbyData(center: LatLng, input: NearbyInput): NearbyData {
  const real = input.crises.filter(c => c.source !== 'Baseline' && !c.id.startsWith('baseline-'))
  const aircraft = within(input.flights, center, RADIUS_KM.flights, f =>
    f.latitude != null && f.longitude != null ? { lat: f.latitude, lng: f.longitude } : null)
  return {
    incidents: within(real, center, RADIUS_KM.incidents, c => ({ lat: c.latitude, lng: c.longitude })),
    quakes: within(input.earthquakes ?? [], center, RADIUS_KM.quakes, q => ({ lat: q.latitude, lng: q.longitude })),
    fires: within(input.fires ?? [], center, RADIUS_KM.fires, f => ({ lat: f.latitude, lng: f.longitude })),
    flights: {
      airborne: aircraft.filter(a => !a.item.on_ground).length,
      onGround: aircraft.filter(a => a.item.on_ground).length,
      sample: aircraft.slice(0, 5).map(a => a.item),
    },
    military: within(MILITARY_FACILITIES, center, RADIUS_KM.assets, m => ({ lat: m.lat, lng: m.lng })),
    nuclear: within(NUCLEAR_PLANTS, center, RADIUS_KM.assets, n => ({ lat: n.lat, lng: n.lng })),
    infra: within(ALL_INFRA_POINTS, center, RADIUS_KM.assets, p => ({ lat: p.lat, lng: p.lng })),
    ports: within(PORTS, center, RADIUS_KM.assets, p => ({ lat: p.lat, lng: p.lng })),
  }
}
