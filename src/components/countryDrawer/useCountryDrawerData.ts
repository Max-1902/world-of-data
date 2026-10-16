/** Data behind the country drawer: what the static datasets and live feeds already on the map say about one country, plus per-country fetches. */
import { useMemo, useState, useEffect } from 'react'
import type { CrisisEvent, Flight } from '../../types'
import type { Earthquake } from '../../services/earthquakes'
import type { FirePoint } from '../../services/wildfires'
import { REFUGEE_FLOWS, REFUGEE_CAMPS, BORDER_CROSSINGS, UNHCR_OFFICES } from '../../services/unhcr'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS } from '../../services/military'
import { SANCTIONED_COUNTRIES } from '../../services/sanctions'
import { ALL_INFRA_POINTS, fetchPowerPlantsForCountry, type InfraPoint } from '../../services/infrastructure'
import { computeCountryRisk } from '../../utils/risk'
import { detectFlightType } from '../../utils/flightType'
import { fetchCountryEcon, resolveISO2, type CountryEconData } from '../../services/worldbank'
import { fetchMilitaryPersonnelRanking, type MilitaryPersonnelEntry } from '../../services/militaryPersonnel'
import { fetchInfraIndicatorRanking, type CountryInfraEntry } from '../../services/infraIndicators'
import { fetchCivilFacilities, type CivilFacility } from '../../services/civilFacilities'
import { matchCountry } from './parts'
import { mentionsCountry } from '../../utils/countryBrief'

export function useCountryDrawerData(country: string, crises: CrisisEvent[], flights: Flight[], earthquakes?: Earthquake[], fires?: FirePoint[]) {
  return useMemo(() => {
    const lc = country.toLowerCase()

    // Match crises
    const linkedCrises = crises.filter(c => matchCountry(c.country, lc))

    // Risk score
    const allRisks = computeCountryRisk(crises)
    const risk = allRisks.find(r => matchCountry(r.country, lc))

    // Refugee flows
    const outflows = REFUGEE_FLOWS.filter(f => matchCountry(f.label.split(' → ')[0], lc))
    const inflows = REFUGEE_FLOWS.filter(f => {
      const d = f.label.split(' → ')[1]
      return d ? matchCountry(d, lc) : false
    })
    const hosting = inflows.reduce((s, f) => s + f.count, 0)
    const origin = outflows.reduce((s, f) => s + f.count, 0)

    // Camps, crossings, offices
    const camps = REFUGEE_CAMPS.filter(c => matchCountry(c.country, lc))
    const crossings = BORDER_CROSSINGS.filter(c =>
      matchCountry(c.country1, lc) || matchCountry(c.country2, lc)
    )
    const offices = UNHCR_OFFICES.filter(o => matchCountry(o.country, lc))

    // Military bases (hosted in this country)
    const milBases = MILITARY_FACILITIES.filter(f => matchCountry(f.host, lc))

    // Nuclear plants
    const nukes = NUCLEAR_PLANTS.filter(p => matchCountry(p.country, lc))

    // Sanctions
    const sanction = SANCTIONED_COUNTRIES.find(s => matchCountry(s.name, lc))

    // Infrastructure
    const infra = ALL_INFRA_POINTS.filter(p => matchCountry(p.country, lc))

    // Flights from/over this country
    const countryFlights = flights.filter(f =>
      f.origin_country && matchCountry(f.origin_country, lc)
    )
    // Flights near camps/bases (broader search)
    const allPoints = [
      ...camps.map(c => ({ lat: c.lat, lng: c.lng })),
      ...milBases.map(b => ({ lat: b.lat, lng: b.lng })),
      ...nukes.map(n => ({ lat: n.lat, lng: n.lng })),
    ]
    const nearbyFlights = allPoints.length > 0
      ? flights.filter(f => f.latitude && f.longitude && allPoints.some(p =>
          Math.abs(f.latitude! - p.lat) < 3 && Math.abs(f.longitude! - p.lng) < 3
        )).length
      : countryFlights.length

    // Flight type breakdown
    const flightTypes: Record<string, number> = {}
    const flightsToCount = allPoints.length > 0
      ? flights.filter(f => f.latitude && f.longitude && allPoints.some(p =>
          Math.abs(f.latitude! - p.lat) < 3 && Math.abs(f.longitude! - p.lng) < 3
        ))
      : countryFlights
    for (const f of flightsToCount.slice(0, 200)) {
      const t = detectFlightType(f.callsign || '', f.icao24 || '')
      flightTypes[t] = (flightTypes[t] ?? 0) + 1
    }

    // Earthquakes near this country (within ~5 deg of any known point)
    const refPoints = [...camps, ...milBases, ...nukes, ...infra]
    const nearbyQuakes = (earthquakes ?? []).filter(eq =>
      refPoints.some(p => Math.abs(eq.latitude - p.lat) < 5 && Math.abs(eq.longitude - p.lng) < 5)
      || (eq.place && mentionsCountry(eq.place, country))
    ).sort((a, b) => b.magnitude - a.magnitude).slice(0, 5)

    // Wildfires near this country
    const nearbyFires = (fires ?? []).filter(f =>
      refPoints.some(p => Math.abs(f.latitude - p.lat) < 3 && Math.abs(f.longitude - p.lng) < 3)
    ).length

    return {
      linkedCrises, risk, outflows, inflows, camps, crossings, offices,
      milBases, nukes, sanction, infra,
      nearbyFlights, flightTypes, countryFlights: countryFlights.length,
      nearbyQuakes, nearbyFires,
      hosting, origin,
    }
  }, [country, crises, flights, earthquakes, fires])
}

/** Per-country fetches (World Bank, WRI, OSM Overpass); each resets when the country changes. */
export function useCountryLiveData(country: string) {
  // ── World Bank economic data (async fetch) ─────────────────────────────────
  const [econData, setEconData] = useState<CountryEconData | null>(null)
  const [econLoading, setEconLoading] = useState(false)
  useEffect(() => {
    setEconData(null)
    setEconLoading(true)
    fetchCountryEcon(country).then(d => {
      setEconData(d)
      setEconLoading(false)
    }).catch(() => setEconLoading(false))
  }, [country])

  // ── Live power plants (WRI Global Power Plant Database, async fetch) ───────
  const [powerPlants, setPowerPlants] = useState<InfraPoint[]>([])
  useEffect(() => {
    setPowerPlants([])
    let cancelled = false
    fetchPowerPlantsForCountry(country).then(pts => { if (!cancelled) setPowerPlants(pts) }).catch(() => {})
    return () => { cancelled = true }
  }, [country])

  // ── Live civil facilities: hospitals / police / telecom (OSM Overpass) ─────
  const [civilFacilities, setCivilFacilities] = useState<CivilFacility[]>([])
  const [civilLoading, setCivilLoading] = useState(false)
  useEffect(() => {
    setCivilFacilities([])
    const iso2 = resolveISO2(country)
    if (!iso2) return
    setCivilLoading(true)
    fetchCivilFacilities(iso2).then(f => {
      setCivilFacilities(f)
      setCivilLoading(false)
    }).catch(() => setCivilLoading(false))
  }, [country])

  // ── Armed forces personnel ranking (World Bank, IISS Military Balance) ─────
  const [milPersonnel, setMilPersonnel] = useState<MilitaryPersonnelEntry | null>(null)
  const [milPersonnelTotal, setMilPersonnelTotal] = useState(0)
  useEffect(() => {
    setMilPersonnel(null)
    const iso2 = resolveISO2(country)
    if (!iso2) return
    fetchMilitaryPersonnelRanking().then(ranking => {
      setMilPersonnelTotal(ranking.length)
      setMilPersonnel(ranking.find(r => r.iso2 === iso2) ?? null)
    }).catch(() => {})
  }, [country])

  // ── Infrastructure access indicators (World Bank, WDI) ──────────────────────
  const [infraIndicators, setInfraIndicators] = useState<CountryInfraEntry | null>(null)
  const [infraIndicatorsTotal, setInfraIndicatorsTotal] = useState(0)
  useEffect(() => {
    setInfraIndicators(null)
    const iso2 = resolveISO2(country)
    if (!iso2) return
    fetchInfraIndicatorRanking().then(ranking => {
      setInfraIndicatorsTotal(ranking.length)
      setInfraIndicators(ranking.find(r => r.iso2 === iso2) ?? null)
    }).catch(() => {})
  }, [country])

  return {
    econData, econLoading, powerPlants, civilFacilities, civilLoading,
    milPersonnel, milPersonnelTotal, infraIndicators, infraIndicatorsTotal,
  }
}
