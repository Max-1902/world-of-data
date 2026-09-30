import { useMemo, useState, useEffect } from 'react'
import type { CrisisEvent, Flight } from '../types'
import type { Earthquake } from '../services/earthquakes'
import type { FirePoint } from '../services/wildfires'
import { REFUGEE_FLOWS, REFUGEE_CAMPS, BORDER_CROSSINGS, UNHCR_OFFICES } from '../services/unhcr'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../services/military'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS, type SanctionedCountry } from '../services/sanctions'
import { CHOKEPOINTS } from '../services/chokepoints'
import { TRADE_PROFILES } from '../services/tradeStats'
import { ALL_INFRA_POINTS, fetchPowerPlantsForCountry, type InfraPoint } from '../services/infrastructure'
import { computeCountryRisk } from './panels/PanelContent'
import { detectFlightType, FLIGHT_TYPE_COLORS, FLIGHT_TYPE_LABELS } from '../utils/flightType'
import { fetchCountryEcon, formatEconValue, groupIndicators, resolveISO2, type CountryEconData } from '../services/worldbank'
import { getTradeProfile } from '../services/tradeStats'
import { fetchCivilFacilities, CIVIL_FACILITY_COLORS, CIVIL_FACILITY_LABELS, type CivilFacility } from '../services/civilFacilities'

interface Props {
  country: string
  crises: CrisisEvent[]
  flights: Flight[]
  earthquakes?: Earthquake[]
  fires?: FirePoint[]
  onClose: () => void
  onFlyTo?: (q: string) => void
}

const fmt = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : n.toString()

// Fuzzy country name match helper
function matchCountry(name: string, lc: string): boolean {
  const nameLc = name.toLowerCase()
  return nameLc.includes(lc) || lc.includes(nameLc)
}

export default function CountryDrawer({ country, crises, flights, earthquakes, fires, onClose, onFlyTo }: Props) {
  const data = useMemo(() => {
    const lc = country.toLowerCase()

    // Match crises
    const linkedCrises = crises.filter(c => matchCountry(c.country, lc))

    // Risk score
    const allRisks = computeCountryRisk(crises)
    const risk = allRisks.find(r => matchCountry(r.country, lc))

    // Refugee flows
    const outflows = REFUGEE_FLOWS.filter(f => matchCountry(f.label.split(' \u2192 ')[0], lc))
    const inflows = REFUGEE_FLOWS.filter(f => {
      const d = f.label.split(' \u2192 ')[1]
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
      || (eq.place && matchCountry(eq.place, lc))
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

  const {
    linkedCrises, risk, outflows, inflows, camps, crossings, offices,
    milBases, nukes, sanction, infra,
    nearbyFlights, flightTypes, countryFlights,
    nearbyQuakes, nearbyFires,
    hosting, origin,
  } = data

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

  const riskScore = risk?.score ?? 0
  const sevColor = riskScore >= 40 ? '#dc2626' : riskScore >= 20 ? '#ea580c' : riskScore >= 10 ? '#d97706' : '#16a34a'

  // Section renderer helper
  const Section = ({ title, color, count, children }: { title: string; color: string; count?: number; children: React.ReactNode }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.04em', marginBottom: 5, textTransform: 'uppercase' }}>
        {title}{count !== undefined ? ` (${count})` : ''}
      </div>
      {children}
    </div>
  )

  const Row = ({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) => (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 'var(--r-sm)', fontSize: 11, cursor: onClick ? 'pointer' : 'default', ...style }}
      onMouseEnter={onClick ? e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' } : undefined}
      onMouseLeave={onClick ? e => { (e.currentTarget as HTMLDivElement).style.background = '' } : undefined}
    >
      {children}
    </div>
  )

  const Dot = ({ color }: { color: string }) => (
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
  )

  const hasData = linkedCrises.length > 0 || outflows.length > 0 || inflows.length > 0
    || camps.length > 0 || milBases.length > 0 || nukes.length > 0 || sanction
    || infra.length > 0 || nearbyFlights > 0 || nearbyQuakes.length > 0
    || powerPlants.length > 0 || civilFacilities.length > 0 || civilLoading
    || !!getTradeProfile(country)

  return (
    <div className="country-drawer" style={{
      position: 'absolute', top: 16, right: 16, zIndex: 40,
      width: 320, maxHeight: 'calc(100% - 32px)',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, -apple-system, sans-serif', overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>
          {country}
        </span>
        {riskScore > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: sevColor, background: `${sevColor}14`,
            padding: '2px 8px', borderRadius: 'var(--r-pill)',
          }}>RISK {riskScore}</span>
        )}
        {sanction && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: SANCTION_COLORS[sanction.severity],
            background: `${SANCTION_COLORS[sanction.severity]}14`,
            padding: '2px 7px', borderRadius: 'var(--r-pill)',
          }}>SANCTIONED</span>
        )}
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: '2px 4px', borderRadius: 'var(--r-sm)',
        }}>&times;</button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>

        {/* ── Sanctions ─────────────────────────────────────── */}
        {sanction && (
          <Section title="SANCTIONS" color={SANCTION_COLORS[sanction.severity]}>
            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 3 }}>{sanction.summary}</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {sanction.regimes.map(r => (
                <span key={r} style={{ fontSize: 10, padding: '0 4px', color: '#ea580c', background: '#ea580c14', borderRadius: 3 }}>{r}</span>
              ))}
              {sanction.categories.map(c => (
                <span key={c} style={{ fontSize: 10, padding: '0 4px', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 3, textTransform: 'uppercase' }}>{c}</span>
              ))}
            </div>
            {sanction.since && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Since {sanction.since} · ~{fmt(sanction.totalDesignations ?? 0)} designations</div>}
          </Section>
        )}

        {/* ── Displacement ──────────────────────────────────── */}
        {(hosting > 0 || origin > 0) && (
          <Section title="DISPLACEMENT" color="#ea580c">
            <div style={{ display: 'flex', gap: 6 }}>
              {origin > 0 && (
                <div style={{ flex: 1, padding: '4px 6px', background: '#ea580c0f', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: '#ea580c', letterSpacing: '.1em' }}>ORIGIN</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#ea580c' }}>{fmt(origin)}</div>
                </div>
              )}
              {hosting > 0 && (
                <div style={{ flex: 1, padding: '4px 6px', background: '#2563eb0f', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: '#2563eb', letterSpacing: '.1em' }}>HOSTING</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb' }}>{fmt(hosting)}</div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Active crises ─────────────────────────────────── */}
        {linkedCrises.length > 0 && (
          <Section title="ACTIVE CRISES" color="#dc2626" count={linkedCrises.length}>
            {linkedCrises.slice(0, 6).map((c, i) => {
              const sc = c.severity === 'critical' ? '#dc2626' : c.severity === 'high' ? '#ea580c' : '#d97706'
              return (
                <Row key={c.id + i} onClick={() => onFlyTo?.(`${c.latitude},${c.longitude}`)}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: sc, background: `${sc}14`, padding: '0 4px', borderRadius: 3 }}>
                    {c.type.toUpperCase().slice(0, 3)}
                  </span>
                  <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  {c.fatalities ? <span style={{ fontSize: 10, color: '#dc2626' }}>{c.fatalities}</span> : null}
                </Row>
              )
            })}
            {linkedCrises.length > 6 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{linkedCrises.length - 6} more</div>}
          </Section>
        )}

        {/* ── Military bases ────────────────────────────────── */}
        {milBases.length > 0 && (
          <Section title="MILITARY INSTALLATIONS" color="#2563eb" count={milBases.length}>
            {milBases.slice(0, 8).map(b => (
              <Row key={b.id} onClick={() => onFlyTo?.(`${b.lat},${b.lng}`)}>
                <Dot color={FACILITY_COLORS[b.type]} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{b.operator}</span>
                {b.nuclear && <span style={{ fontSize: 10, color: '#ca8a04', fontWeight: 700 }}>NUC</span>}
              </Row>
            ))}
            {milBases.length > 8 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{milBases.length - 8} more</div>}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
              {Object.entries(milBases.reduce((acc, b) => { acc[b.type] = (acc[b.type] ?? 0) + 1; return acc }, {} as Record<string, number>))
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <span key={type} style={{ fontSize: 10, padding: '0 4px', color: FACILITY_COLORS[type as keyof typeof FACILITY_COLORS] ?? 'var(--text3)', border: '1px solid var(--border)', borderRadius: 3 }}>
                    {(FACILITY_LABELS[type as keyof typeof FACILITY_LABELS] ?? type).toUpperCase()} ×{count}
                  </span>
                ))
              }
            </div>
            {milBases.some(b => b.personnel) && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                ~{fmt(milBases.reduce((s, b) => s + (b.personnel ?? 0), 0))} total personnel
              </div>
            )}
          </Section>
        )}

        {/* ── Nuclear plants ────────────────────────────────── */}
        {nukes.length > 0 && (
          <Section title="NUCLEAR FACILITIES" color="#ca8a04" count={nukes.length}>
            {nukes.map(p => (
              <Row key={p.id} onClick={() => onFlyTo?.(`${p.lat},${p.lng}`)}>
                <Dot color={PLANT_STATUS_COLORS[p.status]} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 10, color: '#ca8a04', fontWeight: 700 }}>{p.reactors}R</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{fmt(p.capacity)}MW</span>
              </Row>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              {nukes.reduce((s, p) => s + p.reactors, 0)} reactors · {fmt(nukes.reduce((s, p) => s + p.capacity, 0))} MWe total
            </div>
          </Section>
        )}

        {/* ── Infrastructure ────────────────────────────────── */}
        {infra.length > 0 && (
          <Section title="CRITICAL INFRASTRUCTURE" color="#ea580c" count={infra.length}>
            {infra.slice(0, 6).map(p => (
              <Row key={p.id} onClick={() => onFlyTo?.(`${p.lat},${p.lng}`)}>
                <Dot color={p.type === 'dam' ? '#2563eb' : p.type === 'refinery' ? '#ea580c' : p.type === 'lng' ? '#16a34a' : '#d97706'} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>{p.type}</span>
                {p.capacity && <span style={{ fontSize: 10, color: '#ea580c' }}>{p.capacity}</span>}
              </Row>
            ))}
            {infra.length > 6 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{infra.length - 6} more</div>}
          </Section>
        )}

        {/* ── Power plants (live, WRI Global Power Plant Database) ────────── */}
        {powerPlants.length > 0 && (
          <Section title="POWER PLANTS" color="#d97706" count={powerPlants.length}>
            {powerPlants.slice(0, 8).map(p => (
              <Row key={p.id} onClick={() => onFlyTo?.(`${p.lat},${p.lng}`)}>
                <Dot color={p.type === 'power_coal' ? '#6b7280' : p.type === 'power_gas' ? '#f97316' : p.type === 'power_wind' ? '#22d3ee' : p.type === 'power_solar' ? '#facc15' : '#d97706'} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>{p.type.replace('power_', '')}</span>
                {p.capacity && <span style={{ fontSize: 10, color: '#d97706' }}>{p.capacity}</span>}
              </Row>
            ))}
            {powerPlants.length > 8 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{powerPlants.length - 8} more</div>}
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Source: WRI Global Power Plant Database</div>
          </Section>
        )}

        {/* ── Civil facilities: hospitals / police / telecom (live OSM) ────── */}
        {(civilLoading || civilFacilities.length > 0) && (
          <Section title="CIVIL FACILITIES" color="#a855f7" count={civilLoading ? undefined : civilFacilities.length}>
            {civilLoading && <div style={{ fontSize: 10, color: 'var(--text3)' }}>Loading from OpenStreetMap…</div>}
            {(['hospital', 'police', 'telecom'] as const).map(t => {
              const items = civilFacilities.filter(f => f.type === t)
              if (items.length === 0) return null
              return (
                <div key={t} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: CIVIL_FACILITY_COLORS[t], fontWeight: 700, marginBottom: 2 }}>
                    {CIVIL_FACILITY_LABELS[t]} ({items.length})
                  </div>
                  {items.slice(0, 4).map(f => (
                    <Row key={f.id} onClick={() => onFlyTo?.(`${f.lat},${f.lng}`)}>
                      <Dot color={CIVIL_FACILITY_COLORS[t]} />
                      <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    </Row>
                  ))}
                  {items.length > 4 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{items.length - 4} more</div>}
                </div>
              )
            })}
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Source: OpenStreetMap (live, community-mapped — coverage varies by country)</div>
          </Section>
        )}

        {/* ── Air traffic ───────────────────────────────────── */}
        {nearbyFlights > 0 && (
          <Section title="AIR TRAFFIC" color="#7c3aed">
            <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <div style={{ padding: '3px 6px', background: '#7c3aed0f', borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: '#7c3aed', letterSpacing: '.1em' }}>NEARBY</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed' }}>{nearbyFlights}</div>
              </div>
              {countryFlights > 0 && (
                <div style={{ padding: '3px 6px', background: '#16a34a0f', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: '#16a34a', letterSpacing: '.1em' }}>FROM COUNTRY</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>{countryFlights}</div>
                </div>
              )}
            </div>
            {Object.keys(flightTypes).length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {Object.entries(flightTypes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, count]) => (
                  <span key={type} style={{
                    fontSize: 10, padding: '0 4px', borderRadius: 3,
                    color: FLIGHT_TYPE_COLORS[type as keyof typeof FLIGHT_TYPE_COLORS] ?? 'var(--text3)',
                    background: `${(FLIGHT_TYPE_COLORS[type as keyof typeof FLIGHT_TYPE_COLORS] ?? 'var(--text3)')}14`,
                  }}>
                    {(FLIGHT_TYPE_LABELS[type as keyof typeof FLIGHT_TYPE_LABELS] ?? type).toUpperCase()} ×{count}
                  </span>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Refugee corridors ─────────────────────────────── */}
        {(outflows.length > 0 || inflows.length > 0) && (
          <Section title="REFUGEE CORRIDORS" color="#2563eb">
            {outflows.map(f => (
              <Row key={f.label} onClick={() => onFlyTo?.(`${f.dest[1]},${f.dest[0]}`)}>
                <span style={{ color: '#ea580c', fontWeight: 700, fontSize: 10 }}>OUT</span>
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label.split(' \u2192 ')[1]}</span>
                <span style={{ color: '#ea580c', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
              </Row>
            ))}
            {inflows.map(f => (
              <Row key={f.label} onClick={() => onFlyTo?.(`${f.origin[1]},${f.origin[0]}`)}>
                <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 10 }}>IN</span>
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>from {f.label.split(' \u2192 ')[0]}</span>
                <span style={{ color: '#2563eb', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Camps & offices ───────────────────────────────── */}
        {(camps.length > 0 || offices.length > 0) && (
          <Section title="HUMANITARIAN PRESENCE" color="#16a34a" count={camps.length + offices.length}>
            {camps.slice(0, 5).map(c => (
              <Row key={c.id} onClick={() => onFlyTo?.(`${c.lat},${c.lng}`)}>
                <Dot color="#16a34a" />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ color: '#16a34a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.population)}</span>
              </Row>
            ))}
            {camps.length > 5 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{camps.length - 5} more camps</div>}
            {offices.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                {offices.length} UNHCR office{offices.length > 1 ? 's' : ''} ({offices.map(o => o.type).join(', ')})
              </div>
            )}
          </Section>
        )}

        {/* ── Border crossings ──────────────────────────────── */}
        {crossings.length > 0 && (
          <Section title="BORDER CROSSINGS" color="#d97706" count={crossings.length}>
            {crossings.map(c => (
              <Row key={c.id} onClick={() => onFlyTo?.(`${c.lat},${c.lng}`)}>
                <Dot color={c.status === 'open' ? '#16a34a' : c.status === 'restricted' ? '#d97706' : '#dc2626'} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                  color: c.status === 'open' ? '#16a34a' : c.status === 'restricted' ? '#d97706' : '#dc2626',
                }}>{c.status}</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Earthquakes ───────────────────────────────────── */}
        {nearbyQuakes.length > 0 && (
          <Section title="SEISMIC ACTIVITY" color="#ea580c" count={nearbyQuakes.length}>
            {nearbyQuakes.map(eq => (
              <Row key={eq.id} onClick={() => onFlyTo?.(`${eq.latitude},${eq.longitude}`)}>
                <span style={{
                  fontSize: 10, fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right',
                  fontFamily: 'IBM Plex Mono, monospace',
                  color: eq.magnitude >= 6 ? '#dc2626' : eq.magnitude >= 4.5 ? '#ea580c' : '#d97706',
                }}>{eq.magnitude.toFixed(1)}</span>
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.place}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{eq.depth}km</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Wildfires ─────────────────────────────────────── */}
        {nearbyFires > 0 && (
          <Section title="ACTIVE FIRES" color="#ea580c">
            <div style={{ fontSize: 11, color: '#ea580c', fontWeight: 700 }}>
              {nearbyFires} fire{nearbyFires > 1 ? 's' : ''} detected near infrastructure
            </div>
          </Section>
        )}

        {/* ── Trade Profile ─────────────────────────────────── */}
        {(() => {
          const trade = getTradeProfile(country)
          if (!trade) return null
          const barMax = 100
          const Bar = ({ pct, color }: { pct: number; color: string }) => (
            <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(pct, barMax)}%`, height: '100%', background: color, borderRadius: 2 }} />
            </div>
          )
          return (
            <Section title="TRADE INTELLIGENCE" color="#0891b2">
              {/* Key metrics row */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 5, flexWrap: 'wrap' }}>
                {trade.tradeBalance != null && (
                  <div style={{ padding: '3px 5px', background: trade.tradeBalance >= 0 ? '#16a34a0f' : '#dc26260f', borderRadius: 'var(--r-sm)' }}>
                    <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>BALANCE</div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: trade.tradeBalance >= 0 ? '#16a34a' : '#dc2626' }}>
                      {trade.tradeBalance >= 0 ? '+' : ''}{trade.tradeBalance}B
                    </div>
                  </div>
                )}
                {trade.tradeToGDP != null && (
                  <div style={{ padding: '3px 5px', background: '#2563eb0f', borderRadius: 'var(--r-sm)' }}>
                    <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>TRADE/GDP</div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#2563eb' }}>{trade.tradeToGDP}%</div>
                  </div>
                )}
                <div style={{ padding: '3px 5px', background: '#7c3aed0f', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>INCOME</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>{trade.incomeGroup.toUpperCase()}</div>
                </div>
                <div style={{ padding: '3px 5px', background: '#ca8a040f', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>CURRENCY</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#ca8a04' }}>{trade.currency}</div>
                </div>
              </div>

              {/* Trade blocs */}
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 5 }}>
                {trade.tradeBlocs.map(b => (
                  <span key={b} style={{ fontSize: 9, padding: '0 4px', color: '#0891b2', background: '#0891b214', borderRadius: 3 }}>{b}</span>
                ))}
              </div>

              {/* Top export partners */}
              <div style={{ fontSize: 10, color: '#16a34a', letterSpacing: '.1em', marginBottom: 2 }}>TOP EXPORT PARTNERS</div>
              {trade.topExportPartners.slice(0, 5).map(p => (
                <div key={p.country} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 11 }}>
                  <span style={{ color: 'var(--text2)', width: 65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.country}</span>
                  <Bar pct={p.pct * 2} color="#16a34a" />
                  <span style={{ color: '#16a34a', fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 28, textAlign: 'right', flexShrink: 0 }}>{p.pct}%</span>
                </div>
              ))}

              {/* Top import partners */}
              <div style={{ fontSize: 10, color: '#ea580c', letterSpacing: '.1em', marginTop: 4, marginBottom: 2 }}>TOP IMPORT PARTNERS</div>
              {trade.topImportPartners.slice(0, 5).map(p => (
                <div key={p.country} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 11 }}>
                  <span style={{ color: 'var(--text2)', width: 65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.country}</span>
                  <Bar pct={p.pct * 2} color="#ea580c" />
                  <span style={{ color: '#ea580c', fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 28, textAlign: 'right', flexShrink: 0 }}>{p.pct}%</span>
                </div>
              ))}

              {/* Top exports */}
              <div style={{ fontSize: 10, color: '#2563eb', letterSpacing: '.1em', marginTop: 4, marginBottom: 2 }}>TOP EXPORTS</div>
              {trade.topExports.slice(0, 5).map(p => (
                <div key={p.product} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 11 }}>
                  <span style={{ color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product}</span>
                  <span style={{ color: '#2563eb', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{p.pct}%</span>
                </div>
              ))}

              {/* Top imports */}
              <div style={{ fontSize: 10, color: '#7c3aed', letterSpacing: '.1em', marginTop: 4, marginBottom: 2 }}>TOP IMPORTS</div>
              {trade.topImports.slice(0, 5).map(p => (
                <div key={p.product} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 11 }}>
                  <span style={{ color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product}</span>
                  <span style={{ color: '#7c3aed', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{p.pct}%</span>
                </div>
              ))}

              {/* Dependencies / vulnerabilities */}
              {trade.dependencies && trade.dependencies.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: '#dc2626', letterSpacing: '.1em', marginTop: 4, marginBottom: 2 }}>KEY DEPENDENCIES</div>
                  {trade.dependencies.map(d => (
                    <div key={d} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ color: '#dc262688', fontSize: 9 }}>▸</span>{d}
                    </div>
                  ))}
                </>
              )}
            </Section>
          )
        })()}

        {/* ── Sanctions Impact Modeling ─────────────────────── */}
        {(() => {
          const trade = getTradeProfile(country)
          if (!trade) return null
          // Find sanctioned trade partners
          const sanctionedPartners = [
            ...trade.topExportPartners.filter(p =>
              SANCTIONED_COUNTRIES.some(s => matchCountry(s.name, p.country.toLowerCase()))
            ).map(p => ({ ...p, direction: 'export' as const, sanction: SANCTIONED_COUNTRIES.find(s => matchCountry(s.name, p.country.toLowerCase()))! })),
            ...trade.topImportPartners.filter(p =>
              SANCTIONED_COUNTRIES.some(s => matchCountry(s.name, p.country.toLowerCase()))
            ).map(p => ({ ...p, direction: 'import' as const, sanction: SANCTIONED_COUNTRIES.find(s => matchCountry(s.name, p.country.toLowerCase()))! })),
          ]
          if (sanctionedPartners.length === 0) return null
          const totalExposure = sanctionedPartners.reduce((s, p) => s + p.pct, 0)
          return (
            <Section title="SANCTIONS EXPOSURE" color="#dc2626">
              <div style={{ fontSize: 11, color: totalExposure > 15 ? '#dc2626' : '#d97706', fontWeight: 700, marginBottom: 3 }}>
                {totalExposure.toFixed(1)}% trade with sanctioned states
              </div>
              {sanctionedPartners.map(p => (
                <div key={`${p.direction}-${p.country}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '1px 0' }}>
                  <span style={{ fontSize: 9, color: p.direction === 'export' ? '#16a34a' : '#ea580c', background: p.direction === 'export' ? '#16a34a14' : '#ea580c14', padding: '0 3px', borderRadius: 3 }}>
                    {p.direction === 'export' ? 'EXP' : 'IMP'}
                  </span>
                  <span style={{ color: 'var(--text2)', flex: 1 }}>{p.country}</span>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>{p.pct}%</span>
                  <span style={{ fontSize: 9, color: SANCTION_COLORS[p.sanction.severity], border: `1px solid ${SANCTION_COLORS[p.sanction.severity]}44`, padding: '0 3px', borderRadius: 3 }}>
                    {p.sanction.severity.toUpperCase()}
                  </span>
                </div>
              ))}
            </Section>
          )
        })()}

        {/* ── Commodity Price Correlation ──────────────────────── */}
        {(() => {
          const trade = getTradeProfile(country)
          if (!trade) return null
          // Map exported products to commodity benchmarks
          const COMMODITY_MAP: Record<string, { benchmark: string; color: string }> = {
            'crude petroleum': { benchmark: 'Brent Crude', color: '#ea580c' },
            'refined petroleum': { benchmark: 'Brent Crude', color: '#ea580c' },
            'natural gas': { benchmark: 'Henry Hub / TTF', color: '#16a34a' },
            'iron ore': { benchmark: 'Iron Ore 62% Fe', color: '#b45309' },
            'coal': { benchmark: 'Newcastle Coal', color: '#6b7280' },
            'copper': { benchmark: 'LME Copper', color: '#ea580c' },
            'soybeans': { benchmark: 'CBOT Soybeans', color: '#65a30d' },
            'wheat': { benchmark: 'CBOT Wheat', color: '#d97706' },
            'gold': { benchmark: 'LBMA Gold', color: '#ca8a04' },
            'lithium batteries': { benchmark: 'Lithium Carbonate', color: '#16a34a' },
            'solar panels': { benchmark: 'Polysilicon Spot', color: '#2563eb' },
            'semiconductors': { benchmark: 'SOX Index', color: '#0891b2' },
          }
          const linked = trade.topExports.filter(e =>
            Object.keys(COMMODITY_MAP).some(k => e.product.toLowerCase().includes(k))
          ).map(e => {
            const key = Object.keys(COMMODITY_MAP).find(k => e.product.toLowerCase().includes(k))!
            return { product: e.product, pct: e.pct, ...COMMODITY_MAP[key] }
          })
          if (linked.length === 0) return null
          return (
            <Section title="COMMODITY EXPOSURE" color="#ca8a04">
              {linked.map(l => (
                <div key={l.product} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '1.5px 0' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text2)', flex: 1 }}>{l.product}</span>
                  <span style={{ color: l.color, fontSize: 10, fontWeight: 600 }}>{l.benchmark}</span>
                  <span style={{ color: '#ca8a04', fontWeight: 700, width: 28, textAlign: 'right', flexShrink: 0 }}>{l.pct}%</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                Revenue sensitivity: {linked.reduce((s, l) => s + l.pct, 0).toFixed(1)}% of exports commodity-linked
              </div>
            </Section>
          )
        })()}

        {/* ── Currency Risk ────────────────────────────────────── */}
        {(() => {
          const trade = getTradeProfile(country)
          if (!trade || trade.currency === 'USD') return null
          const highOpenness = (trade.tradeToGDP ?? 0) > 60
          const deficit = (trade.tradeBalance ?? 0) < -50
          const riskLevel = highOpenness && deficit ? 'HIGH' : highOpenness || deficit ? 'ELEVATED' : 'MODERATE'
          const riskColor = riskLevel === 'HIGH' ? '#dc2626' : riskLevel === 'ELEVATED' ? '#ea580c' : '#ca8a04'
          return (
            <Section title="CURRENCY RISK" color={riskColor}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 3, flexWrap: 'wrap' }}>
                <div style={{ padding: '2px 5px', background: `${riskColor}0f`, borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>FX RISK</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: riskColor }}>{riskLevel}</div>
                </div>
                <div style={{ padding: '2px 5px', background: '#2563eb0f', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>OPENNESS</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>{trade.tradeToGDP ?? '?'}%</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
                {highOpenness && `High trade/GDP ratio (${trade.tradeToGDP}%) = elevated FX sensitivity. `}
                {deficit && `Persistent trade deficit ($${Math.abs(trade.tradeBalance!)}B) creates depreciation pressure. `}
                {trade.currency} exposure across {trade.topImportPartners.length} import partners.
              </div>
            </Section>
          )
        })()}

        {/* ── Conflict-Trade Correlation ───────────────────────── */}
        {(() => {
          if (linkedCrises.length === 0) return null
          const trade = getTradeProfile(country)
          // Find trade partners that are also in crisis
          const crisisCountries = new Set(crises.map(c => c.country.toLowerCase()))
          const atRiskPartners = trade ? [
            ...trade.topExportPartners.filter(p => crisisCountries.has(p.country.toLowerCase())).map(p => ({ ...p, dir: 'export' })),
            ...trade.topImportPartners.filter(p => crisisCountries.has(p.country.toLowerCase())).map(p => ({ ...p, dir: 'import' })),
          ] : []
          // Check if any chokepoint is near a crisis
          const nearbyChokepoints = CHOKEPOINTS.filter(cp =>
            crises.some(c => Math.abs(c.latitude - cp.lat) < 8 && Math.abs(c.longitude - cp.lng) < 8)
          )
          // Find other countries dependent on this country's exports
          const dependents = TRADE_PROFILES.filter(tp =>
            tp.iso2 !== trade?.iso2 &&
            tp.topImportPartners.some(p => matchCountry(p.country, country.toLowerCase()) && p.pct > 5)
          )
          if (atRiskPartners.length === 0 && nearbyChokepoints.length === 0 && dependents.length === 0) return null
          return (
            <Section title="CONFLICT–TRADE CORRELATION" color="#dc2626">
              {atRiskPartners.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: '#ea580c', letterSpacing: '.1em', marginBottom: 2 }}>TRADE PARTNERS IN CRISIS</div>
                  {atRiskPartners.slice(0, 4).map(p => (
                    <div key={`${p.dir}-${p.country}`} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', display: 'flex', gap: 4 }}>
                      <span style={{ color: '#dc262688', fontSize: 9 }}>▸</span>
                      <span style={{ flex: 1 }}>{p.country} ({p.dir} {p.pct}%)</span>
                    </div>
                  ))}
                </>
              )}
              {nearbyChokepoints.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: '#dc2626', letterSpacing: '.1em', marginTop: 3, marginBottom: 2 }}>THREATENED CHOKEPOINTS</div>
                  {nearbyChokepoints.map(cp => (
                    <div key={cp.id} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', display: 'flex', gap: 4 }}>
                      <span style={{ color: '#dc262688', fontSize: 9 }}>▸</span>
                      <span style={{ flex: 1 }}>{cp.name} ({cp.pctWorldTrade}% world trade)</span>
                    </div>
                  ))}
                </>
              )}
              {dependents.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: '#d97706', letterSpacing: '.1em', marginTop: 3, marginBottom: 2 }}>DOWNSTREAM IMPACT</div>
                  {dependents.slice(0, 4).map(d => {
                    const dep = d.topImportPartners.find(p => matchCountry(p.country, country.toLowerCase()))
                    return (
                      <div key={d.iso2} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', display: 'flex', gap: 4 }}>
                        <span style={{ color: '#d9770688', fontSize: 9 }}>▸</span>
                        <span style={{ flex: 1 }}>{d.name} depends on imports ({dep?.pct}%)</span>
                      </div>
                    )
                  })}
                </>
              )}
            </Section>
          )
        })()}

        {/* ── Economic Data (World Bank) ────────────────────── */}
        {econLoading && (
          <Section title="ECONOMIC DATA" color="#2563eb">
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Loading World Bank data…</div>
          </Section>
        )}
        {econData && econData.indicators.length > 0 && (() => {
          const groups = groupIndicators(econData.indicators)
          return (
            <Section title="ECONOMIC DATA" color="#2563eb">
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, letterSpacing: '.08em' }}>
                Source: World Bank Open Data · {econData.iso3}
              </div>
              {Object.entries(groups).map(([groupName, indicators]) => (
                <div key={groupName} style={{ marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '.1em', marginBottom: 2 }}>
                    {groupName}
                  </div>
                  {indicators.map(ind => {
                    const val = ind.value
                    if (val == null) return null
                    const formatted = formatEconValue(ind.id, val)
                    // Color: green for positive growth, red for negative, blue for neutral
                    const isGrowth = ind.id.includes('.ZG') || ind.id === 'SP.POP.GROW'
                    const isNegative = ind.id === 'SL.UEM.TOTL.ZS' || ind.id === 'FP.CPI.TOTL.ZG' || ind.id === 'GC.DOD.TOTL.GD.ZS'
                    let valColor = '#2563eb'
                    if (isGrowth) valColor = val >= 0 ? '#16a34a' : '#dc2626'
                    if (isNegative && val > 10) valColor = '#ea580c'
                    return (
                      <div key={ind.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', fontSize: 11 }}>
                        <span style={{ color: 'var(--text2)' }}>{ind.label}</span>
                        <span style={{ color: valColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'IBM Plex Mono, monospace' }}>
                          {formatted}
                          <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 3, fontFamily: 'Inter, sans-serif' }}>{ind.year}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </Section>
          )
        })()}

        {/* ── Empty state ───────────────────────────────────── */}
        {!hasData && !econData && !econLoading && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', letterSpacing: '.04em' }}>No linked intelligence</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, lineHeight: 1.6 }}>
              No active crises, military presence,<br />or displacement data linked to {country}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 10px', borderTop: '1px solid var(--border)', flexShrink: 0,
        fontSize: 10, color: 'var(--text3)', letterSpacing: '.02em',
      }}>
        Contextual intel · click map to select country
      </div>
    </div>
  )
}
