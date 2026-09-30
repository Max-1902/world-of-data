/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useEffect } from 'react'
import { CrisisEvent, Flight } from '../../types'
import { onGlobalReload } from '../../utils/reloadBus'
import { UNHCR_GLOBAL_2023, TOP_HOSTING, TOP_ORIGINS, UNHCR_OFFICES, BORDER_CROSSINGS, REFUGEE_CAMPS, CROSSING_STATUS_COLORS, OFFICE_TYPE_COLORS, REFUGEE_FLOWS, COUNTRY_DISPLACEMENT, fetchUNHCRPopulation, type UNHCRStat } from '../../services/unhcr'

// ── Humanitarian Panel (UNHCR) ─────────────────────────────────────────────────
const HUM_TABS = ['OVERVIEW', 'NEXUS', 'FLOWS', 'OFFICES', 'CROSSINGS', 'CAMPS'] as const

type HumTab = typeof HUM_TABS[number]

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString()
}

export function HumanitarianPanel({ crises, flights, onGeoSearch }: { crises: CrisisEvent[]; flights: Flight[]; onGeoSearch?: (q: string) => void }) {
  const [tab, setTab]         = useState<HumTab>('OVERVIEW')
  const [stats, setStats]     = useState<UNHCRStat[]>(TOP_HOSTING)
  const [showOrigin, setShowOrigin] = useState(false)
  const [officeFilter, setOfficeFilter] = useState('')
  const [crossFilter, setCrossFilter]   = useState<'all'|'open'|'restricted'|'closed'>('all')
  const [campSearch, setCampSearch]     = useState('')

  useEffect(() => {
    const load = () => { fetchUNHCRPopulation().then(data => { if (data.length) setStats(data) }) }
    load()
    const t = window.setInterval(load, 30 * 60_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(t); unsub() }
  }, [])

  const g = UNHCR_GLOBAL_2023

  const filteredOffices = UNHCR_OFFICES.filter(o =>
    !officeFilter || o.country.toLowerCase().includes(officeFilter.toLowerCase()) ||
    o.city.toLowerCase().includes(officeFilter.toLowerCase()) ||
    o.name.toLowerCase().includes(officeFilter.toLowerCase())
  )

  const filteredCrossings = BORDER_CROSSINGS.filter(c =>
    crossFilter === 'all' || c.status === crossFilter
  )

  const filteredCamps = REFUGEE_CAMPS
    .filter(c => !campSearch || c.name.toLowerCase().includes(campSearch.toLowerCase()) || c.country.toLowerCase().includes(campSearch.toLowerCase()))
    .sort((a, b) => b.population - a.population)

  const maxHosting = Math.max(...TOP_HOSTING.map(s => s.total))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: 11.5 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {HUM_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '4px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            background: tab === t ? 'var(--accent-soft)' : 'transparent',
            border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', transition: 'all .12s',
          }}>{t}</button>
        ))}
      </div>

      {/* ─ OVERVIEW ─ */}
      {tab === 'OVERVIEW' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {/* Global summary */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.15em', marginBottom: 5 }}>// GLOBAL DISPLACEMENT · {g.year}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
              {[
                { label: 'FORCIBLY DISPLACED', value: g.total_forcibly_displaced, color: 'var(--red)' },
                { label: 'REFUGEES (UNHCR)',   value: g.refugees_unhcr,           color: 'var(--amber)' },
                { label: 'INT. DISPLACED',     value: g.idps,                     color: 'var(--amber)' },
                { label: 'ASYLUM SEEKERS',     value: g.asylum_seekers,           color: 'var(--accent)' },
                { label: 'STATELESS',          value: g.stateless,                color: 'var(--series-5)' },
                { label: 'RETURNEES',          value: g.returnees,                color: 'var(--accent)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--surface2)', padding: '5px 7px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>{fmt(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Toggle hosting / origin */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button onClick={() => setShowOrigin(false)} style={{
              flex: 1, padding: '3px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              border: `1px solid ${!showOrigin ? 'var(--accent)55' : 'var(--border)'}`,
              background: !showOrigin ? 'var(--accent-soft)' : 'transparent',
              color: !showOrigin ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer',
            }}>TOP HOSTING</button>
            <button onClick={() => setShowOrigin(true)} style={{
              flex: 1, padding: '3px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              border: `1px solid ${showOrigin ? 'var(--amber)55' : 'var(--border)'}`,
              background: showOrigin ? 'var(--amber-soft)' : 'transparent',
              color: showOrigin ? 'var(--amber)' : 'var(--text3)', cursor: 'pointer',
            }}>TOP ORIGINS</button>
          </div>

          {/* Country ranking */}
          <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 4 }}>
            {!showOrigin ? '// COUNTRIES HOSTING MOST DISPLACED (2023)' : '// TOP COUNTRIES OF ORIGIN (2023)'}
          </div>
          {(!showOrigin ? (stats.length ? stats : TOP_HOSTING) : TOP_ORIGINS).map((s, i) => {
            const pct = (s.total / (showOrigin ? 16_000_000 : maxHosting)) * 100
            const color = showOrigin ? 'var(--amber)' : 'var(--accent)'
            return (
              <div key={s.iso3 + i} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, color: 'var(--text3)', width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.country}</span>
                  <span style={{ fontSize: 10.5, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(s.total)}</span>
                </div>
                <div style={{ marginLeft: 19, height: 2, background: 'var(--border)', borderRadius: 1 }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, opacity: 0.55, borderRadius: 1, transition: 'width .5s' }} />
                </div>
                {s.refugees > 0 && s.idps > 0 && (
                  <div style={{ marginLeft: 19, marginTop: 1, display: 'flex', gap: 6 }}>
                    {s.refugees > 0     && <span style={{ fontSize: 9, color: 'var(--amber)' }}>REF {fmt(s.refugees)}</span>}
                    {s.idps > 0         && <span style={{ fontSize: 9, color: 'var(--amber)' }}>IDP {fmt(s.idps)}</span>}
                    {s.asylum_seekers > 0 && <span style={{ fontSize: 9, color: 'var(--accent)' }}>ASY {fmt(s.asylum_seekers)}</span>}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.05em', lineHeight: 1.7 }}>
              SOURCE: UNHCR GLOBAL TRENDS {g.year} · api.unhcr.org<br />
              DATA: MID-YEAR ESTIMATES · UNHCR POPULATION STATISTICS
            </div>
          </div>
        </div>
      )}

      {/* ─ NEXUS: cross-link refugee flows ↔ active crises ↔ flights ─ */}
      {tab === 'NEXUS' && (() => {
        // Group flows by origin country (extract from "Origin → Dest" label)
        const originCountries = [...new Set(REFUGEE_FLOWS.map(f => f.label.split(' → ')[0]))]

        // Match crises to origin countries (fuzzy — country name substring)
        const matchCrises = (origin: string) =>
          crises.filter(c => c.country.toLowerCase().includes(origin.toLowerCase())
            || origin.toLowerCase().includes(c.country.toLowerCase()))

        // Count flights near camps in host countries
        const countFlightsNear = (lat: number, lng: number, radius = 2) =>
          flights.filter(f => f.latitude && f.longitude
            && Math.abs(f.latitude - lat) < radius && Math.abs(f.longitude - lng) < radius).length

        // Get displacement data for a country
        const getDisp = (name: string) => {
          const entry = Object.entries(COUNTRY_DISPLACEMENT).find(([, d]) => {
            const stat = [...TOP_HOSTING, ...TOP_ORIGINS].find(s => s.iso3 === Object.keys(COUNTRY_DISPLACEMENT).find(k => COUNTRY_DISPLACEMENT[k] === d))
            return stat?.country.toLowerCase().includes(name.toLowerCase())
              || name.toLowerCase().includes(stat?.country.toLowerCase() ?? '')
          })
          return entry ? entry[1] : null
        }

        // Get camps in a country (host side)
        const getCamps = (dest: string) =>
          REFUGEE_CAMPS.filter(c => c.country.toLowerCase().includes(dest.toLowerCase())
            || dest.toLowerCase().includes(c.country.toLowerCase()))

        return (
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 6 }}>
              // CRISIS → DISPLACEMENT NEXUS · LIVE CORRELATION
            </div>
            {originCountries.map(origin => {
              const flows = REFUGEE_FLOWS.filter(f => f.label.startsWith(origin + ' →'))
              const linked = matchCrises(origin)
              const totalDisplaced = flows.reduce((s, f) => s + f.count, 0)
              const disp = getDisp(origin)
              const severity = linked.length > 0
                ? (linked.some(c => c.severity === 'critical') ? 'critical'
                  : linked.some(c => c.severity === 'high') ? 'high' : 'medium')
                : 'low'
              const sevColor = severity === 'critical' ? 'var(--red)' : severity === 'high' ? 'var(--amber)' : severity === 'medium' ? 'var(--amber)' : 'var(--text2)'

              return (
                <div key={origin} style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--surface2)', border: `1px solid ${sevColor}22` }}>
                  {/* Origin header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text1)', flex: 1 }}>{origin.toUpperCase()}</span>
                    <span style={{ fontSize: 9.5, color: sevColor, fontWeight: 700, letterSpacing: '.08em' }}>{severity.toUpperCase()}</span>
                  </div>

                  {/* Displacement total */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4, marginLeft: 13 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>DISPLACED: <b>{fmt(totalDisplaced)}</b></span>
                    {disp && disp.origin > 0 && <span style={{ fontSize: 9.5, color: 'var(--text2)' }}>UNHCR ORIGIN: {fmt(disp.origin)}</span>}
                  </div>

                  {/* Active crises linked */}
                  {linked.length > 0 && (
                    <div style={{ marginLeft: 13, marginBottom: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--red)', letterSpacing: '.1em', marginBottom: 2 }}>ACTIVE CRISES ({linked.length})</div>
                      {linked.slice(0, 4).map((c, i) => (
                        <div key={c.id + i}
                          onClick={() => onGeoSearch?.(`${c.latitude},${c.longitude}`)}
                          style={{ fontSize: 10, color: 'var(--text1)', marginBottom: 1, cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', gap: 4, alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--text1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--text1)' }}
                        >
                          <span style={{ fontSize: 8.5, color: c.severity === 'critical' ? 'var(--red)' : c.severity === 'high' ? 'var(--amber)' : 'var(--amber)', fontWeight: 700 }}>
                            {c.type.toUpperCase().slice(0, 3)}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                          {c.fatalities ? <span style={{ fontSize: 9, color: 'var(--red)', flexShrink: 0 }}>†{c.fatalities}</span> : null}
                        </div>
                      ))}
                      {linked.length > 4 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{linked.length - 4} more</div>}
                    </div>
                  )}
                  {linked.length === 0 && (
                    <div style={{ marginLeft: 13, fontSize: 9.5, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 4 }}>No live crisis events detected</div>
                  )}

                  {/* Flow corridors */}
                  <div style={{ marginLeft: 13 }}>
                    <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '.1em', marginBottom: 2 }}>CORRIDORS ({flows.length})</div>
                    {flows.map(f => {
                      const dest = f.label.split(' → ')[1]
                      const camps = getCamps(dest)
                      const nearbyFlights = camps.length > 0 ? countFlightsNear(camps[0].lat, camps[0].lng) : 0
                      return (
                        <div key={f.label}
                          onClick={() => onGeoSearch?.(`${f.dest[1]},${f.dest[0]}`)}
                          style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2, cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', gap: 4, alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--text1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--text2)' }}
                        >
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>→</span>
                          <span style={{ flex: 1 }}>{dest}</span>
                          <span style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
                          {camps.length > 0 && <span style={{ fontSize: 8.5, color: 'var(--accent)' }}>{camps.length} sites</span>}
                          {nearbyFlights > 0 && <span style={{ fontSize: 8.5, color: 'var(--series-5)' }}>✈{nearbyFlights}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text3)', letterSpacing: '.05em', lineHeight: 1.7 }}>
              CORRELATION: UNHCR GLOBAL TRENDS × ACLED LIVE EVENTS × OPENSKY<br />
              NEXUS UPDATES IN REAL-TIME WITH INCOMING DATA
            </div>
          </div>
        )
      })()}

      {/* ─ FLOWS: refugee corridor listing ─ */}
      {tab === 'FLOWS' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 6 }}>
            // MAJOR REFUGEE CORRIDORS · {REFUGEE_FLOWS.length} ROUTES
          </div>
          {REFUGEE_FLOWS
            .sort((a, b) => b.count - a.count)
            .map((f, i) => {
              const maxCount = REFUGEE_FLOWS[0].count  // already sorted
              const pct = (f.count / (maxCount || 1)) * 100
              const origin = f.label.split(' → ')[0]
              const dest = f.label.split(' → ')[1]
              const linked = crises.filter(c =>
                c.country.toLowerCase().includes(origin.toLowerCase())
                || origin.toLowerCase().includes(c.country.toLowerCase()))
              const isActive = linked.length > 0
              // Color gradient by count
              const t = Math.min(1, f.count / 4_000_000)
              const color = t > 0.6 ? 'var(--red)' : t > 0.3 ? 'var(--amber)' : 'var(--accent)'

              return (
                <div key={f.label}
                  onClick={() => onGeoSearch?.(`${f.origin[1]},${f.origin[0]}`)}
                  style={{ marginBottom: 5, cursor: onGeoSearch ? 'pointer' : 'default' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 9.5, color: 'var(--text3)', width: 16, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text1)', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {origin} <span style={{ color: 'var(--text2)' }}>→</span> {dest}
                    </span>
                    <span style={{ fontSize: 10.5, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(f.count)}</span>
                    {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, animation: 'blink 1s step-end infinite' }} title={`${linked.length} active crises in ${origin}`} />}
                  </div>
                  <div style={{ marginLeft: 21, height: 2, background: 'var(--border)', borderRadius: 1, marginBottom: 2 }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, opacity: 0.55, borderRadius: 1, transition: 'width .5s' }} />
                  </div>
                  {isActive && (
                    <div style={{ marginLeft: 21, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {linked.slice(0, 3).map((c, j) => (
                        <span key={j} style={{
                          fontSize: 8.5, padding: '1px 4px', borderRadius: 2,
                          background: c.severity === 'critical' ? 'var(--red-soft)' : 'var(--amber-soft)',
                          color: c.severity === 'critical' ? 'var(--red)' : 'var(--amber)',
                          border: `1px solid ${c.severity === 'critical' ? 'var(--red)22' : 'var(--amber)22'}`,
                        }}>
                          {c.type.toUpperCase().slice(0, 3)} · {c.title.slice(0, 30)}{c.title.length > 30 ? '…' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text3)', letterSpacing: '.05em', lineHeight: 1.7 }}>
            SOURCE: UNHCR GLOBAL TRENDS 2023 · CRISIS TAGS FROM ACLED LIVE
          </div>
        </div>
      )}

      {/* ─ OFFICES ─ */}
      {tab === 'OFFICES' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              placeholder="Filter by country or city…"
              value={officeFilter}
              onChange={e => setOfficeFilter(e.target.value)}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text1)', fontSize: 10.5, padding: '3px 6px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOffices.map(o => (
              <div
                key={o.id}
                onClick={() => onGeoSearch?.(`${o.lat},${o.lng}`)}
                style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                title={onGeoSearch ? `Fly to ${o.name}` : undefined}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: OFFICE_TYPE_COLORS[o.type], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 1 }}>{o.city} · {o.country}</div>
                </div>
                <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>
                  {o.type === 'hq' ? 'HQ' : o.type === 'regional' ? 'REG' : o.type === 'liaison' ? 'LNK' : 'CO'}
                </span>
              </div>
            ))}
            {filteredOffices.length === 0 && (
              <div style={{ padding: 10, fontSize: 10.5, color: 'var(--text3)', textAlign: 'center' }}>No offices match filter</div>
            )}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredOffices.length} OFFICES · UNHCR PRESENCE MAP
          </div>
        </div>
      )}

      {/* ─ CROSSINGS ─ */}
      {tab === 'CROSSINGS' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Status filter */}
          <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexShrink: 0 }}>
            {(['all', 'open', 'restricted', 'closed'] as const).map(s => (
              <button key={s} onClick={() => setCrossFilter(s)} style={{
                flex: 1, padding: '2px 3px', fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em',
                border: `1px solid ${crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? 'var(--accent)') + '55' : 'var(--border)'}`,
                background: crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? 'var(--accent-soft)') + '14' : 'transparent',
                color: crossFilter === s ? (CROSSING_STATUS_COLORS[s as keyof typeof CROSSING_STATUS_COLORS] ?? 'var(--accent)') : 'var(--text3)',
                cursor: 'pointer', textTransform: 'uppercase',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredCrossings.map(c => (
              <div
                key={c.id}
                onClick={() => onGeoSearch?.(`${c.lat},${c.lng}`)}
                style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                title={onGeoSearch ? `Fly to ${c.name}` : undefined}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: CROSSING_STATUS_COLORS[c.status], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 1 }}>{c.country1} ↔ {c.country2}</div>
                </div>
                <span style={{ fontSize: 9.5, color: CROSSING_STATUS_COLORS[c.status], fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>{c.status}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredCrossings.length} CROSSINGS · UNHCR BORDER MONITORING
          </div>
        </div>
      )}

      {/* ─ CAMPS ─ */}
      {tab === 'CAMPS' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              placeholder="Search camps or countries…"
              value={campSearch}
              onChange={e => setCampSearch(e.target.value)}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text1)', fontSize: 10.5, padding: '3px 6px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredCamps.map((c, i) => {
              const maxPop = REFUGEE_CAMPS[0].population
              const pct = (c.population / maxPop) * 100
              const color = c.type === 'camp' ? 'var(--accent)' : c.type === 'settlement' ? 'var(--accent)' : c.type === 'poc_site' ? 'var(--amber)' : c.type === 'transit' ? 'var(--amber)' : 'var(--series-5)'
              return (
                <div
                  key={c.id}
                  onClick={() => onGeoSearch?.(`${c.lat},${c.lng}`)}
                  style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', cursor: onGeoSearch ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                  title={onGeoSearch ? `Fly to ${c.name}` : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 9.5, color: 'var(--text3)', width: 16, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 10.5, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(c.population)}</span>
                  </div>
                  <div style={{ marginLeft: 27, height: 2, background: 'var(--border)', borderRadius: 1, marginBottom: 2 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, opacity: 0.5, borderRadius: 1 }} />
                  </div>
                  <div style={{ marginLeft: 27, display: 'flex', gap: 5 }}>
                    <span style={{ fontSize: 9, color: 'var(--text2)' }}>{c.country}</span>
                    <span style={{ fontSize: 9, color: color, opacity: 0.7, textTransform: 'uppercase' }}>{c.type.replace('_', ' ')}</span>
                    {c.notes && <span style={{ fontSize: 9, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '3px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', flexShrink: 0 }}>
            {filteredCamps.length} SITES · UNHCR POPULATION REFERENCE POINTS
          </div>
        </div>
      )}
    </div>
  )
}
