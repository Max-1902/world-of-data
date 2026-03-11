import { useMemo } from 'react'
import type { CrisisEvent, Flight } from '../types'
import type { Earthquake } from '../services/earthquakes'
import type { FirePoint } from '../services/wildfires'
import { REFUGEE_FLOWS, REFUGEE_CAMPS, BORDER_CROSSINGS, UNHCR_OFFICES } from '../services/unhcr'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../services/military'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS } from '../services/sanctions'
import { ALL_INFRA_POINTS } from '../services/infrastructure'
import { computeCountryRisk } from './panels/PanelContent'
import { detectFlightType, FLIGHT_TYPE_COLORS, FLIGHT_TYPE_LABELS } from '../utils/flightType'

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

  const riskScore = risk?.score ?? 0
  const sevColor = riskScore >= 40 ? '#ff1a3e' : riskScore >= 20 ? '#ff6600' : riskScore >= 10 ? '#ffaa00' : '#00ff88'

  // Section renderer helper
  const Section = ({ title, color, count, children }: { title: string; color: string; count?: number; children: React.ReactNode }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 7, color, letterSpacing: '.12em', marginBottom: 4 }}>
        // {title}{count !== undefined ? ` (${count})` : ''}
      </div>
      {children}
    </div>
  )

  const Row = ({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) => (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', fontSize: 8, cursor: onClick ? 'pointer' : 'default', ...style }}
      onMouseEnter={onClick ? e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,255,136,0.03)' } : undefined}
      onMouseLeave={onClick ? e => { (e.currentTarget as HTMLDivElement).style.background = '' } : undefined}
    >
      {children}
    </div>
  )

  const Dot = ({ color }: { color: string }) => (
    <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
  )

  const hasData = linkedCrises.length > 0 || outflows.length > 0 || inflows.length > 0
    || camps.length > 0 || milBases.length > 0 || nukes.length > 0 || sanction
    || infra.length > 0 || nearbyFlights > 0 || nearbyQuakes.length > 0

  return (
    <div style={{
      position: 'absolute', top: 8, right: 8, zIndex: 40,
      width: 290, maxHeight: 'calc(100% - 16px)',
      background: 'rgba(8,14,10,0.96)', border: '1px solid #141e16',
      backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column',
      fontFamily: 'monospace', overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px', borderBottom: `2px solid ${sevColor}33`,
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#c0dcc4', flex: 1, letterSpacing: '.06em' }}>
          {country.toUpperCase()}
        </span>
        {riskScore > 0 && (
          <span style={{
            fontSize: 8, fontWeight: 800, color: sevColor, background: `${sevColor}14`,
            border: `1px solid ${sevColor}33`, padding: '1px 6px', borderRadius: 2, letterSpacing: '.08em',
          }}>RISK {riskScore}</span>
        )}
        {sanction && (
          <span style={{
            fontSize: 6.5, fontWeight: 800, color: SANCTION_COLORS[sanction.severity],
            background: `${SANCTION_COLORS[sanction.severity]}14`,
            border: `1px solid ${SANCTION_COLORS[sanction.severity]}33`,
            padding: '1px 4px', borderRadius: 2, letterSpacing: '.06em',
          }}>SANCTIONED</span>
        )}
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#4a6a50', cursor: 'pointer',
          fontSize: 14, lineHeight: 1, padding: '0 2px', fontFamily: 'monospace',
        }}>&times;</button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>

        {/* ── Sanctions ─────────────────────────────────────── */}
        {sanction && (
          <Section title="SANCTIONS" color={SANCTION_COLORS[sanction.severity]}>
            <div style={{ fontSize: 8, color: '#8aac90', lineHeight: 1.5, marginBottom: 3 }}>{sanction.summary}</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {sanction.regimes.map(r => (
                <span key={r} style={{ fontSize: 6, padding: '0 3px', color: '#ff8844', border: '1px solid #ff884422', borderRadius: 1 }}>{r}</span>
              ))}
              {sanction.categories.map(c => (
                <span key={c} style={{ fontSize: 6, padding: '0 3px', color: '#4a6a50', border: '1px solid #141e16', borderRadius: 1, textTransform: 'uppercase' }}>{c}</span>
              ))}
            </div>
            {sanction.since && <div style={{ fontSize: 6.5, color: '#2a3e2e', marginTop: 2 }}>Since {sanction.since} · ~{fmt(sanction.totalDesignations ?? 0)} designations</div>}
          </Section>
        )}

        {/* ── Displacement ──────────────────────────────────── */}
        {(hosting > 0 || origin > 0) && (
          <Section title="DISPLACEMENT" color="#ff8844">
            <div style={{ display: 'flex', gap: 6 }}>
              {origin > 0 && (
                <div style={{ flex: 1, padding: '4px 6px', background: 'rgba(255,136,0,0.06)', border: '1px solid #ff880022' }}>
                  <div style={{ fontSize: 6, color: '#ff8844', letterSpacing: '.1em' }}>ORIGIN</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#ff8844' }}>{fmt(origin)}</div>
                </div>
              )}
              {hosting > 0 && (
                <div style={{ flex: 1, padding: '4px 6px', background: 'rgba(0,170,255,0.06)', border: '1px solid #00aaff22' }}>
                  <div style={{ fontSize: 6, color: '#00aaff', letterSpacing: '.1em' }}>HOSTING</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#00aaff' }}>{fmt(hosting)}</div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Active crises ─────────────────────────────────── */}
        {linkedCrises.length > 0 && (
          <Section title="ACTIVE CRISES" color="#ff1a3e" count={linkedCrises.length}>
            {linkedCrises.slice(0, 6).map((c, i) => {
              const sc = c.severity === 'critical' ? '#ff1a3e' : c.severity === 'high' ? '#ff6600' : '#ffaa00'
              return (
                <Row key={c.id + i} onClick={() => onFlyTo?.(`${c.latitude},${c.longitude}`)}>
                  <span style={{ fontSize: 6, fontWeight: 700, color: sc, border: `1px solid ${sc}44`, padding: '0 3px', borderRadius: 1 }}>
                    {c.type.toUpperCase().slice(0, 3)}
                  </span>
                  <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  {c.fatalities ? <span style={{ fontSize: 6, color: '#ff1a3e' }}>{c.fatalities}</span> : null}
                </Row>
              )
            })}
            {linkedCrises.length > 6 && <div style={{ fontSize: 7, color: '#2a3e2e' }}>+{linkedCrises.length - 6} more</div>}
          </Section>
        )}

        {/* ── Military bases ────────────────────────────────── */}
        {milBases.length > 0 && (
          <Section title="MILITARY INSTALLATIONS" color="#4488ff" count={milBases.length}>
            {milBases.slice(0, 8).map(b => (
              <Row key={b.id} onClick={() => onFlyTo?.(`${b.lat},${b.lng}`)}>
                <Dot color={FACILITY_COLORS[b.type]} />
                <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                <span style={{ fontSize: 6, color: '#4a6a50', flexShrink: 0 }}>{b.operator}</span>
                {b.nuclear && <span style={{ fontSize: 6, color: '#ffdd00', fontWeight: 700 }}>NUC</span>}
              </Row>
            ))}
            {milBases.length > 8 && <div style={{ fontSize: 7, color: '#2a3e2e' }}>+{milBases.length - 8} more</div>}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
              {Object.entries(milBases.reduce((acc, b) => { acc[b.type] = (acc[b.type] ?? 0) + 1; return acc }, {} as Record<string, number>))
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <span key={type} style={{ fontSize: 6, padding: '0 3px', color: FACILITY_COLORS[type as keyof typeof FACILITY_COLORS] ?? '#4a6a50', border: '1px solid #141e16', borderRadius: 1 }}>
                    {(FACILITY_LABELS[type as keyof typeof FACILITY_LABELS] ?? type).toUpperCase()} ×{count}
                  </span>
                ))
              }
            </div>
            {milBases.some(b => b.personnel) && (
              <div style={{ fontSize: 7, color: '#4a6a50', marginTop: 2 }}>
                ~{fmt(milBases.reduce((s, b) => s + (b.personnel ?? 0), 0))} total personnel
              </div>
            )}
          </Section>
        )}

        {/* ── Nuclear plants ────────────────────────────────── */}
        {nukes.length > 0 && (
          <Section title="NUCLEAR FACILITIES" color="#ffdd00" count={nukes.length}>
            {nukes.map(p => (
              <Row key={p.id} onClick={() => onFlyTo?.(`${p.lat},${p.lng}`)}>
                <Dot color={PLANT_STATUS_COLORS[p.status]} />
                <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 6.5, color: '#ffdd00', fontWeight: 700 }}>{p.reactors}R</span>
                <span style={{ fontSize: 6.5, color: '#4a6a50' }}>{fmt(p.capacity)}MW</span>
              </Row>
            ))}
            <div style={{ fontSize: 7, color: '#4a6a50', marginTop: 2 }}>
              {nukes.reduce((s, p) => s + p.reactors, 0)} reactors · {fmt(nukes.reduce((s, p) => s + p.capacity, 0))} MWe total
            </div>
          </Section>
        )}

        {/* ── Infrastructure ────────────────────────────────── */}
        {infra.length > 0 && (
          <Section title="CRITICAL INFRASTRUCTURE" color="#ff8800" count={infra.length}>
            {infra.slice(0, 6).map(p => (
              <Row key={p.id} onClick={() => onFlyTo?.(`${p.lat},${p.lng}`)}>
                <Dot color={p.type === 'dam' ? '#00aaff' : p.type === 'refinery' ? '#ff8800' : p.type === 'lng' ? '#00ff88' : '#ffaa00'} />
                <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 6, color: '#4a6a50', textTransform: 'uppercase' }}>{p.type}</span>
                {p.capacity && <span style={{ fontSize: 6, color: '#ff8800' }}>{p.capacity}</span>}
              </Row>
            ))}
            {infra.length > 6 && <div style={{ fontSize: 7, color: '#2a3e2e' }}>+{infra.length - 6} more</div>}
          </Section>
        )}

        {/* ── Air traffic ───────────────────────────────────── */}
        {nearbyFlights > 0 && (
          <Section title="AIR TRAFFIC" color="#aa44ff">
            <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <div style={{ padding: '3px 6px', background: 'rgba(170,68,255,0.06)', border: '1px solid #aa44ff22' }}>
                <div style={{ fontSize: 6, color: '#aa44ff', letterSpacing: '.1em' }}>NEARBY</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#aa44ff' }}>{nearbyFlights}</div>
              </div>
              {countryFlights > 0 && (
                <div style={{ padding: '3px 6px', background: 'rgba(0,255,136,0.06)', border: '1px solid #00ff8822' }}>
                  <div style={{ fontSize: 6, color: '#00ff88', letterSpacing: '.1em' }}>FROM COUNTRY</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#00ff88' }}>{countryFlights}</div>
                </div>
              )}
            </div>
            {Object.keys(flightTypes).length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {Object.entries(flightTypes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, count]) => (
                  <span key={type} style={{
                    fontSize: 6, padding: '0 3px', borderRadius: 1,
                    color: FLIGHT_TYPE_COLORS[type as keyof typeof FLIGHT_TYPE_COLORS] ?? '#4a6a50',
                    border: `1px solid ${(FLIGHT_TYPE_COLORS[type as keyof typeof FLIGHT_TYPE_COLORS] ?? '#4a6a50')}33`,
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
          <Section title="REFUGEE CORRIDORS" color="#00aaff">
            {outflows.map(f => (
              <Row key={f.label} onClick={() => onFlyTo?.(`${f.dest[1]},${f.dest[0]}`)}>
                <span style={{ color: '#ff8844', fontWeight: 700, fontSize: 7 }}>OUT</span>
                <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label.split(' \u2192 ')[1]}</span>
                <span style={{ color: '#ff8844', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
              </Row>
            ))}
            {inflows.map(f => (
              <Row key={f.label} onClick={() => onFlyTo?.(`${f.origin[1]},${f.origin[0]}`)}>
                <span style={{ color: '#00aaff', fontWeight: 700, fontSize: 7 }}>IN</span>
                <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>from {f.label.split(' \u2192 ')[0]}</span>
                <span style={{ color: '#00aaff', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Camps & offices ───────────────────────────────── */}
        {(camps.length > 0 || offices.length > 0) && (
          <Section title="HUMANITARIAN PRESENCE" color="#00ff88" count={camps.length + offices.length}>
            {camps.slice(0, 5).map(c => (
              <Row key={c.id} onClick={() => onFlyTo?.(`${c.lat},${c.lng}`)}>
                <Dot color="#00ff88" />
                <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ color: '#00ff88', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.population)}</span>
              </Row>
            ))}
            {camps.length > 5 && <div style={{ fontSize: 7, color: '#2a3e2e' }}>+{camps.length - 5} more camps</div>}
            {offices.length > 0 && (
              <div style={{ fontSize: 7, color: '#4a6a50', marginTop: 2 }}>
                {offices.length} UNHCR office{offices.length > 1 ? 's' : ''} ({offices.map(o => o.type).join(', ')})
              </div>
            )}
          </Section>
        )}

        {/* ── Border crossings ──────────────────────────────── */}
        {crossings.length > 0 && (
          <Section title="BORDER CROSSINGS" color="#ffaa00" count={crossings.length}>
            {crossings.map(c => (
              <Row key={c.id} onClick={() => onFlyTo?.(`${c.lat},${c.lng}`)}>
                <Dot color={c.status === 'open' ? '#00ff88' : c.status === 'restricted' ? '#ffaa00' : '#ff1a3e'} />
                <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{
                  fontSize: 6.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                  color: c.status === 'open' ? '#00ff88' : c.status === 'restricted' ? '#ffaa00' : '#ff1a3e',
                }}>{c.status}</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Earthquakes ───────────────────────────────────── */}
        {nearbyQuakes.length > 0 && (
          <Section title="SEISMIC ACTIVITY" color="#ff6600" count={nearbyQuakes.length}>
            {nearbyQuakes.map(eq => (
              <Row key={eq.id} onClick={() => onFlyTo?.(`${eq.latitude},${eq.longitude}`)}>
                <span style={{
                  fontSize: 7, fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 20, textAlign: 'right',
                  color: eq.magnitude >= 6 ? '#ff1a3e' : eq.magnitude >= 4.5 ? '#ff6600' : '#ffaa00',
                }}>{eq.magnitude.toFixed(1)}</span>
                <span style={{ color: '#8aac90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.place}</span>
                <span style={{ fontSize: 6, color: '#4a6a50' }}>{eq.depth}km</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Wildfires ─────────────────────────────────────── */}
        {nearbyFires > 0 && (
          <Section title="ACTIVE FIRES" color="#ff6600">
            <div style={{ fontSize: 9, color: '#ff6600', fontWeight: 700 }}>
              {nearbyFires} fire{nearbyFires > 1 ? 's' : ''} detected near infrastructure
            </div>
          </Section>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {!hasData && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.1em' }}>NO LINKED INTELLIGENCE</div>
            <div style={{ fontSize: 7, color: '#1a2e1e', marginTop: 4, lineHeight: 1.6 }}>
              No active crises, military presence,<br />or displacement data linked to {country}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '4px 10px', borderTop: '1px solid #141e16', flexShrink: 0,
        fontSize: 6.5, color: '#1a2e1e', letterSpacing: '.08em',
      }}>
        CONTEXTUAL INTEL · CLICK MAP TO SELECT COUNTRY
      </div>
    </div>
  )
}
