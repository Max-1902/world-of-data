import type { CrisisEvent, Flight } from '../types'
import type { Earthquake } from '../services/earthquakes'
import type { FirePoint } from '../services/wildfires'
import { FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../services/military'
import { SANCTION_COLORS } from '../services/sanctions'
import { INFRA_LABELS } from '../services/infrastructure'
import WatchButton from './WatchButton'
import { FLIGHT_TYPE_COLORS, FLIGHT_TYPE_LABELS } from '../utils/flightType'
import { formatPersonnel } from '../services/militaryPersonnel'
import { freshness } from '../utils/freshness'
import { INCIDENT_WINDOWS } from '../utils/countryBrief'
import { formatInfraValue } from '../services/infraIndicators'
import { getTradeProfile } from '../services/tradeStats'
import CloseButton from './CloseButton'
import { CIVIL_FACILITY_COLORS, CIVIL_FACILITY_LABELS } from '../services/civilFacilities'
import { fmt, soft, Section, Row, Dot, MiniBarChart } from './countryDrawer/parts'
import { useCountryDrawerData, useCountryLiveData } from './countryDrawer/useCountryDrawerData'
import { TradeSections, EconomicDataSection } from './countryDrawer/TradeSections'

interface Props {
  country: string
  crises: CrisisEvent[]
  flights: Flight[]
  earthquakes?: Earthquake[]
  fires?: FirePoint[]
  onClose: () => void
  onFlyTo?: (q: string) => void
}

export default function CountryDrawer({ country, crises, flights, earthquakes, fires, onClose, onFlyTo }: Props) {
  const {
    linkedCrises, risk, outflows, inflows, camps, crossings, offices,
    milBases, nukes, sanction, infra,
    nearbyFlights, flightTypes, countryFlights,
    nearbyQuakes, nearbyFires,
    hosting, origin, idps, displacementYear,
  } = useCountryDrawerData(country, crises, flights, earthquakes, fires)

  const {
    econData, econLoading, powerPlants, civilFacilities, civilLoading,
    milPersonnel, milPersonnelTotal, infraIndicators, infraIndicatorsTotal,
  } = useCountryLiveData(country)
  const milFresh = milPersonnel ? freshness(milPersonnel.year, 'military', milPersonnel.iso2) : null

  const riskScore = risk?.score ?? 0
  const sevColor = riskScore >= 40 ? 'var(--red)' : riskScore >= 20 ? 'var(--amber)' : riskScore >= 10 ? 'var(--amber)' : 'var(--green)'

  const hasData = linkedCrises.length > 0 || outflows.length > 0 || inflows.length > 0
    || camps.length > 0 || milBases.length > 0 || nukes.length > 0 || sanction
    || infra.length > 0 || nearbyFlights > 0 || nearbyQuakes.length > 0
    || powerPlants.length > 0 || civilFacilities.length > 0 || civilLoading
    || !!getTradeProfile(country) || !!milPersonnel || !!infraIndicators

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
            fontSize: 10, fontWeight: 700, color: sevColor, background: soft(sevColor),
            padding: '2px 8px', borderRadius: 'var(--r-pill)',
          }}>RISK {riskScore}</span>
        )}
        {sanction && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: SANCTION_COLORS[sanction.severity],
            background: soft(SANCTION_COLORS[sanction.severity]),
            padding: '2px 7px', borderRadius: 'var(--r-pill)',
          }}>SANCTIONED</span>
        )}
        <WatchButton country={country} />
        <CloseButton onClick={onClose} label={`Close ${country} details`} />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>

        {/* ── Sanctions ─────────────────────────────────────── */}
        {sanction && (
          <Section title="SANCTIONS" color={SANCTION_COLORS[sanction.severity]}>
            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 3 }}>{sanction.summary}</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {sanction.regimes.map(r => (
                <span key={r} style={{ fontSize: 10, padding: '0 4px', color: 'var(--amber)', background: soft('var(--amber)'), borderRadius: 3 }}>{r}</span>
              ))}
              {sanction.categories.map(c => (
                <span key={c} style={{ fontSize: 10, padding: '0 4px', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 3, textTransform: 'uppercase' }}>{c}</span>
              ))}
            </div>
            {sanction.since && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Since {sanction.since} · ~{fmt(sanction.totalDesignations ?? 0)} designations</div>}
          </Section>
        )}

        {/* ── Displacement ──────────────────────────────────── */}
        {(hosting > 0 || origin > 0 || idps > 0) && (
          <Section title={`DISPLACEMENT · UNHCR ${displacementYear ?? ''}`} color="var(--amber)">
            <div style={{ display: 'flex', gap: 6 }}>
              {origin > 0 && (
                <div style={{ flex: 1, padding: '4px 6px', background: soft('var(--amber)', 8), borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--amber)', letterSpacing: '.1em' }}>FLED ABROAD</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--amber)' }}>{fmt(origin)}</div>
                </div>
              )}
              {idps > 0 && (
                <div style={{ flex: 1, padding: '4px 6px', background: soft('var(--red)', 8), borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--red)', letterSpacing: '.1em' }}>IDPS</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)' }}>{fmt(idps)}</div>
                </div>
              )}
              {hosting > 0 && (
                <div style={{ flex: 1, padding: '4px 6px', background: soft('var(--blue)', 8), borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--blue)', letterSpacing: '.1em' }}>HOSTING</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)' }}>{fmt(hosting)}</div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Active crises ─────────────────────────────────── */}
        {linkedCrises.length > 0 && (
          <Section title="ACTIVE CRISES" color="var(--red)" count={linkedCrises.length}>
            {linkedCrises.slice(0, 6).map((c, i) => {
              const sc = c.severity === 'critical' ? 'var(--red)' : c.severity === 'high' ? 'var(--amber)' : 'var(--amber)'
              return (
                <Row key={c.id + i} onClick={() => onFlyTo?.(`${c.latitude},${c.longitude}`)}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: sc, background: soft(sc), padding: '0 4px', borderRadius: 3 }}>
                    {c.type.toUpperCase().slice(0, 3)}
                  </span>
                  <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  {c.fatalities ? <span style={{ fontSize: 10, color: 'var(--red)' }}>{c.fatalities}</span> : null}
                </Row>
              )
            })}
            {linkedCrises.length > 6 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{linkedCrises.length - 6} more</div>}
          </Section>
        )}

        {/* ── Military bases ────────────────────────────────── */}
        {milBases.length > 0 && (
          <Section title="MILITARY INSTALLATIONS" color="var(--blue)" count={milBases.length}>
            {milBases.slice(0, 8).map(b => (
              <Row key={b.id} onClick={() => onFlyTo?.(`${b.lat},${b.lng}`)}>
                <Dot color={FACILITY_COLORS[b.type]} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{b.operator}</span>
                {b.nuclear && <span style={{ fontSize: 10, color: 'var(--series-4)', fontWeight: 700 }}>NUC</span>}
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
          <Section title="NUCLEAR FACILITIES" color="var(--series-4)" count={nukes.length}>
            {nukes.map(p => (
              <Row key={p.id} onClick={() => onFlyTo?.(`${p.lat},${p.lng}`)}>
                <Dot color={PLANT_STATUS_COLORS[p.status]} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--series-4)', fontWeight: 700 }}>{p.reactors}R</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{fmt(p.capacity)}MW</span>
              </Row>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              {nukes.reduce((s, p) => s + p.reactors, 0)} reactors · {fmt(nukes.reduce((s, p) => s + p.capacity, 0))} MWe total
            </div>
          </Section>
        )}

        {/* ── Armed forces personnel (World Bank, IISS Military Balance) ───── */}
        {milPersonnel && (
          <Section title="ARMED FORCES PERSONNEL" color="var(--red)">
            <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <div style={{ padding: '3px 6px', background: soft('var(--red)', 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--red)', letterSpacing: '.1em' }}>PERSONNEL · {milPersonnel.year}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)' }}>{formatPersonnel(milPersonnel.personnel)}</div>
              </div>
              <div style={{ padding: '3px 6px', background: soft('var(--red)', 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--red)', letterSpacing: '.1em' }} title="Rank among each country's latest reported figure; the years differ between countries">RANK (MIXED YEARS)</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)' }}>#{milPersonnel.rank} / {milPersonnelTotal}</div>
              </div>
            </div>
            {milFresh?.label && (
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--amber)', margin: '2px 0' }}>⚠ {milFresh.label.toUpperCase()}: not current strength</div>
            )}
            <div style={{ fontSize: 9, color: 'var(--text3)' }}>Source: World Bank (IISS Military Balance), {milPersonnel.year}</div>
          </Section>
        )}

        {/* ── Infrastructure access indicators (World Bank, WDI) ────────── */}
        {infraIndicators && (
          <Section title="INFRASTRUCTURE ACCESS" color="var(--blue)">
            <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <div style={{ flex: 1, padding: '3px 6px', background: soft('var(--blue)', 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--blue)', letterSpacing: '.1em' }}>ACCESS INDEX</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)' }}>{infraIndicators.accessIndex === null ? 'n/a' : `${infraIndicators.accessIndex.toFixed(1)}%`}</div>
              </div>
              <div style={{ flex: 1, padding: '3px 6px', background: soft('var(--blue)', 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--blue)', letterSpacing: '.1em' }}>WORLD RANK</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)' }}>#{infraIndicators.rank} / {infraIndicatorsTotal}</div>
              </div>
            </div>
            {infraIndicators.indicators.map(i => (
              <Row key={i.id}>
                <span style={{ color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text1)', fontWeight: 700, flexShrink: 0 }}>{formatInfraValue(i.id, i.value)}</span>
              </Row>
            ))}
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Source: World Bank (World Development Indicators), {infraIndicators.year}</div>
          </Section>
        )}

        {/* ── Infrastructure ────────────────────────────────── */}
        {infra.length > 0 && (
          <Section title="CRITICAL INFRASTRUCTURE" color="var(--amber)" count={infra.length}>
            {(() => {
              const byType = infra.reduce((acc, p) => { acc[p.type] = (acc[p.type] ?? 0) + 1; return acc }, {} as Record<string, number>)
              const seriesColors = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']
              const chartData = Object.entries(byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count], i) => ({ label: (INFRA_LABELS[type as keyof typeof INFRA_LABELS] ?? type).toUpperCase(), value: count, color: seriesColors[i % seriesColors.length] }))
              return chartData.length > 1
                ? <div style={{ marginBottom: 6 }}><MiniBarChart data={chartData} /></div>
                : null
            })()}
            {infra.slice(0, 6).map(p => (
              <Row key={p.id} onClick={() => onFlyTo?.(`${p.lat},${p.lng}`)}>
                <Dot color={p.type === 'dam' ? 'var(--blue)' : p.type === 'refinery' ? 'var(--amber)' : p.type === 'lng' ? 'var(--green)' : 'var(--amber)'} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>{p.type}</span>
                {p.capacity && <span style={{ fontSize: 10, color: 'var(--amber)' }}>{p.capacity}</span>}
              </Row>
            ))}
            {infra.length > 6 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{infra.length - 6} more</div>}
          </Section>
        )}

        {/* ── Power plants (live, WRI Global Power Plant Database) ────────── */}
        {powerPlants.length > 0 && (
          <Section title="POWER PLANTS" color="var(--amber)" count={powerPlants.length}>
            {(() => {
              const seriesColors = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']
              const top = [...powerPlants].sort((a, b) => {
                const mwA = parseFloat(a.capacity ?? '0') || 0
                const mwB = parseFloat(b.capacity ?? '0') || 0
                return mwB - mwA
              }).slice(0, 5)
              const chartData = top.map((p, i) => ({
                label: p.name, value: parseFloat((p.capacity ?? '0').replace(/,/g, '')) || 0,
                color: seriesColors[i % seriesColors.length],
              }))
              return chartData.length > 1
                ? <div style={{ marginBottom: 6 }}><MiniBarChart data={chartData} unit=" MW" /></div>
                : null
            })()}
            {powerPlants.slice(0, 8).map(p => (
              <Row key={p.id} onClick={() => onFlyTo?.(`${p.lat},${p.lng}`)}>
                <Dot color={p.type === 'power_coal' ? 'var(--text3)' : p.type === 'power_gas' ? 'var(--series-2)' : p.type === 'power_wind' ? 'var(--series-1)' : p.type === 'power_solar' ? 'var(--series-4)' : 'var(--amber)'} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>{p.type.replace('power_', '')}</span>
                {p.capacity && <span style={{ fontSize: 10, color: 'var(--amber)' }}>{p.capacity}</span>}
              </Row>
            ))}
            {powerPlants.length > 8 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{powerPlants.length - 8} more</div>}
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Source: WRI Global Power Plant Database</div>
          </Section>
        )}

        {/* ── Civil facilities: hospitals / police / telecom (live OSM) ────── */}
        {(civilLoading || civilFacilities.length > 0) && (
          <Section title="CIVIL FACILITIES" color="var(--series-5)" count={civilLoading ? undefined : civilFacilities.length}>
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
          <Section title="AIR TRAFFIC" color="var(--series-5)">
            <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <div style={{ padding: '3px 6px', background: soft('var(--series-5)', 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--series-5)', letterSpacing: '.1em' }}>NEARBY</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--series-5)' }}>{nearbyFlights}</div>
              </div>
              {countryFlights > 0 && (
                <div style={{ padding: '3px 6px', background: soft('var(--green)', 8), borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--green)', letterSpacing: '.1em' }}>FROM COUNTRY</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>{countryFlights}</div>
                </div>
              )}
            </div>
            {Object.keys(flightTypes).length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {Object.entries(flightTypes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, count]) => (
                  <span key={type} style={{
                    fontSize: 10, padding: '0 4px', borderRadius: 3,
                    color: FLIGHT_TYPE_COLORS[type as keyof typeof FLIGHT_TYPE_COLORS] ?? 'var(--text3)',
                    background: soft(FLIGHT_TYPE_COLORS[type as keyof typeof FLIGHT_TYPE_COLORS] ?? 'var(--text3)'),
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
          <Section title="REFUGEE CORRIDORS" color="var(--blue)">
            {outflows.map(f => (
              <Row key={f.label} onClick={() => onFlyTo?.(`${f.dest[1]},${f.dest[0]}`)}>
                <span style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 10 }}>OUT</span>
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label.split(' → ')[1]}</span>
                <span style={{ color: 'var(--amber)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
              </Row>
            ))}
            {inflows.map(f => (
              <Row key={f.label} onClick={() => onFlyTo?.(`${f.origin[1]},${f.origin[0]}`)}>
                <span style={{ color: 'var(--blue)', fontWeight: 700, fontSize: 10 }}>IN</span>
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>from {f.label.split(' → ')[0]}</span>
                <span style={{ color: 'var(--blue)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Camps & offices ───────────────────────────────── */}
        {(camps.length > 0 || offices.length > 0) && (
          <Section title="HUMANITARIAN PRESENCE" color="var(--green)" count={camps.length + offices.length}>
            {camps.slice(0, 5).map(c => (
              <Row key={c.id} onClick={() => onFlyTo?.(`${c.lat},${c.lng}`)}>
                <Dot color="var(--green)" />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ color: 'var(--green)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.population)}</span>
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
          <Section title="BORDER CROSSINGS" color="var(--amber)" count={crossings.length}>
            {crossings.map(c => (
              <Row key={c.id} onClick={() => onFlyTo?.(`${c.lat},${c.lng}`)}>
                <Dot color={c.status === 'open' ? 'var(--green)' : c.status === 'restricted' ? 'var(--amber)' : 'var(--red)'} />
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                  color: c.status === 'open' ? 'var(--green)' : c.status === 'restricted' ? 'var(--amber)' : 'var(--red)',
                }}>{c.status}</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Earthquakes ───────────────────────────────────── */}
        {nearbyQuakes.length > 0 && (
          <Section title={`EARTHQUAKES · ${INCIDENT_WINDOWS.quakes.toUpperCase()}`} color="var(--amber)" count={nearbyQuakes.length}>
            {nearbyQuakes.map(eq => (
              <Row key={eq.id} onClick={() => onFlyTo?.(`${eq.latitude},${eq.longitude}`)}>
                <span style={{
                  fontSize: 10, fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  color: eq.magnitude >= 6 ? 'var(--red)' : eq.magnitude >= 4.5 ? 'var(--amber)' : 'var(--amber)',
                }}>{eq.magnitude.toFixed(1)}</span>
                <span style={{ color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.place}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{eq.depth}km</span>
              </Row>
            ))}
          </Section>
        )}

        {/* ── Wildfires ─────────────────────────────────────── */}
        {nearbyFires > 0 && (
          <Section title="ACTIVE FIRES" color="var(--amber)">
            <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700 }}>
              {nearbyFires} fire{nearbyFires > 1 ? 's' : ''} detected near infrastructure
            </div>
          </Section>
        )}

        <TradeSections country={country} crises={crises} linkedCrises={linkedCrises} />

        <EconomicDataSection econData={econData} econLoading={econLoading} />


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
