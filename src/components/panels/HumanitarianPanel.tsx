/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useEffect } from 'react'
import { sameCountry } from '../../utils/countryBrief'
import { CrisisEvent, Flight } from '../../types'
import { onGlobalReload } from '../../utils/reloadBus'
import { UNHCR_GLOBAL_2023, TOP_HOSTING, TOP_ORIGINS, UNHCR_OFFICES, BORDER_CROSSINGS, REFUGEE_CAMPS, CROSSING_STATUS_COLORS, OFFICE_TYPE_COLORS, fetchUNHCRPopulation, type UNHCRStat } from '../../services/unhcr'
import { MIN_CORRIDOR, TREND_THRESHOLD, changeLabel, trendOf, type Trend } from '../../services/displacement'
import { useDisplacement, type DisplacementState } from '../../hooks/useDisplacement'

// ── Humanitarian Panel (UNHCR) ─────────────────────────────────────────────────
const HUM_TABS = ['OVERVIEW', 'NEXUS', 'FLOWS', 'IDPS', 'OFFICES', 'CROSSINGS', 'CAMPS'] as const

type HumTab = typeof HUM_TABS[number]

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString()
}

const TREND_VAR: Record<Trend, string> = { new: 'var(--red)', rising: 'var(--red)', steady: 'var(--amber)', falling: 'var(--blue)' }

function DisplacementStatus({ state }: { state: DisplacementState }) {
  return (
    <div style={{ flex: 1, padding: '16px 12px', fontSize: 10.5, color: 'var(--text3)', textAlign: 'center' }}>
      {state.status === 'loading' ? 'Loading UNHCR corridor data…' : 'UNHCR data could not be loaded. Nothing is shown rather than an old or estimated table.'}
    </div>
  )
}

export function HumanitarianPanel({ crises, flights, onGeoSearch }: { crises: CrisisEvent[]; flights: Flight[]; onGeoSearch?: (q: string) => void }) {
  const [tab, setTab]         = useState<HumTab>('OVERVIEW')
  const [stats, setStats]     = useState<UNHCRStat[]>(TOP_HOSTING)
  const [showOrigin, setShowOrigin] = useState(false)
  const [officeFilter, setOfficeFilter] = useState('')
  const [crossFilter, setCrossFilter]   = useState<'all'|'open'|'restricted'|'closed'>('all')
  const [campSearch, setCampSearch]     = useState('')
  const [flowFilter, setFlowFilter]     = useState<'all' | 'rising' | 'falling'>('all')
  const disp = useDisplacement()
  const snap = disp.status === 'ok' ? disp.snap : null

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

      {/* ─ NEXUS: live UNHCR corridors ↔ active crises ↔ flights ─ */}
      {tab === 'NEXUS' && (() => {
        if (!snap) return <DisplacementStatus state={disp} />
        // Origins with at least one mapped corridor, most displaced first
        const origins = snap.countries.filter(c => snap.corridors.some(f => f.from === c.iso3)).slice(0, 14)

        // Match crises to origin countries by ISO code / whole-word name (not substring: "Sudan" ≠ "South Sudan")
        const matchCrises = (origin: string) => crises.filter(c => sameCountry(c.country, origin))

        // Count flights near camps in host countries
        const countFlightsNear = (lat: number, lng: number, radius = 2) =>
          flights.filter(f => f.latitude && f.longitude
            && Math.abs(f.latitude - lat) < radius && Math.abs(f.longitude - lng) < radius).length

        const getCamps = (dest: string) => REFUGEE_CAMPS.filter(c => sameCountry(c.country, dest))

        return (
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 6 }}>
              // CRISIS → DISPLACEMENT NEXUS · UNHCR {snap.year} × LIVE EVENTS
            </div>
            {origins.map(o => {
              const flows = snap.corridors.filter(f => f.from === o.iso3)
              const linked = matchCrises(o.name)
              const severity = linked.length > 0
                ? (linked.some(c => c.severity === 'critical') ? 'critical'
                  : linked.some(c => c.severity === 'high') ? 'high' : 'medium')
                : 'low'
              const sevColor = severity === 'critical' ? 'var(--red)' : severity === 'high' ? 'var(--amber)' : severity === 'medium' ? 'var(--amber)' : 'var(--text2)'

              return (
                <div key={o.iso3} style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--surface2)', border: `1px solid ${sevColor}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text1)', flex: 1 }}>{o.name.toUpperCase()}</span>
                    <span style={{ fontSize: 9.5, color: sevColor, fontWeight: 700, letterSpacing: '.08em' }}>{severity.toUpperCase()}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 4, marginLeft: 13, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>DISPLACED: <b>{fmt(o.displaced)}</b></span>
                    <span style={{ fontSize: 9.5, color: 'var(--text2)' }}>ABROAD {fmt(o.abroad)} · IDPS {fmt(o.idps)}</span>
                    <span style={{ fontSize: 9.5, color: TREND_VAR[o.trend], fontWeight: 700 }}>{changeLabel(o.displaced, o.abroadPrev + o.idpsPrev)} vs {snap.prevYear}</span>
                  </div>

                  {linked.length > 0 && (
                    <div style={{ marginLeft: 13, marginBottom: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--red)', letterSpacing: '.1em', marginBottom: 2 }}>ACTIVE CRISES ({linked.length})</div>
                      {linked.slice(0, 4).map((c, i) => (
                        <div key={c.id + i}
                          onClick={() => onGeoSearch?.(`${c.latitude},${c.longitude}`)}
                          style={{ fontSize: 10, color: 'var(--text1)', marginBottom: 1, cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', gap: 4, alignItems: 'center' }}
                        >
                          <span style={{ fontSize: 8.5, color: c.severity === 'critical' ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>
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

                  <div style={{ marginLeft: 13 }}>
                    <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '.1em', marginBottom: 2 }}>CORRIDORS ≥ {fmt(MIN_CORRIDOR)} ({flows.length})</div>
                    {flows.map(f => {
                      const camps = getCamps(f.toName)
                      const nearbyFlights = camps.length > 0 ? countFlightsNear(camps[0].lat, camps[0].lng) : 0
                      return (
                        <div key={f.to}
                          onClick={() => onGeoSearch?.(`${f.toPoint[1]},${f.toPoint[0]}`)}
                          style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2, cursor: onGeoSearch ? 'pointer' : 'default', display: 'flex', gap: 4, alignItems: 'center' }}
                        >
                          <span style={{ color: TREND_VAR[f.trend], fontWeight: 700 }}>→</span>
                          <span style={{ flex: 1 }}>{f.toName}</span>
                          <span style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.count)}</span>
                          <span style={{ fontSize: 9, color: TREND_VAR[f.trend], width: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{changeLabel(f.count, f.prev)}</span>
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
              CORRELATION: UNHCR {snap.year} CORRIDORS × LIVE CRISIS EVENTS × OPENSKY<br />
              A SHARED COUNTRY IS A LINK TO CHECK, NOT A MEASURED CAUSE
            </div>
          </div>
        )
      })()}

      {/* ─ FLOWS: live refugee corridor listing ─ */}
      {tab === 'FLOWS' && (() => {
        if (!snap) return <DisplacementStatus state={disp} />
        const list = snap.corridors.filter(f =>
          flowFilter === 'all' || (flowFilter === 'rising' ? f.trend === 'rising' || f.trend === 'new' : f.trend === 'falling'))
        const maxCount = snap.corridors[0]?.count || 1
        return (
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {(['all', 'rising', 'falling'] as const).map(k => (
                <button key={k} onClick={() => setFlowFilter(k)} style={{
                  flex: 1, padding: '3px 6px', fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', cursor: 'pointer',
                  border: `1px solid ${flowFilter === k ? 'var(--accent)55' : 'var(--border)'}`,
                  background: flowFilter === k ? 'var(--accent-soft)' : 'transparent',
                  color: flowFilter === k ? 'var(--accent)' : 'var(--text3)',
                }}>{k === 'all' ? `ALL ${snap.corridors.length}` : k === 'rising' ? '▲ GROWING' : '▼ SHRINKING'}</button>
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 6 }}>
              // ORIGIN → ASYLUM · ≥ {fmt(MIN_CORRIDOR)} PEOPLE · {snap.prevYear} → {snap.year}
            </div>
            {list.map((f, i) => {
              const pct = (f.count / maxCount) * 100
              const linked = crises.filter(c => sameCountry(c.country, f.fromName))
              const color = TREND_VAR[f.trend]
              return (
                <div key={f.from + f.to}
                  onClick={() => onGeoSearch?.(`${f.fromPoint[1]},${f.fromPoint[0]}`)}
                  style={{ marginBottom: 5, cursor: onGeoSearch ? 'pointer' : 'default' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 9.5, color: 'var(--text3)', width: 18, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text1)', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.fromName} <span style={{ color: 'var(--text2)' }}>→</span> {f.toName}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text1)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(f.count)}</span>
                    <span style={{ fontSize: 9.5, color, fontWeight: 700, width: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{changeLabel(f.count, f.prev)}</span>
                    {linked.length > 0 && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} title={`${linked.length} live crisis events in ${f.fromName}`} />}
                  </div>
                  <div style={{ marginLeft: 23, height: 2, background: 'var(--border)', borderRadius: 1 }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, opacity: 0.6, borderRadius: 1, transition: 'width .5s' }} />
                  </div>
                </div>
              )
            })}
            {list.length === 0 && <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>No corridors in this group.</div>}
            <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text3)', letterSpacing: '.05em', lineHeight: 1.7 }}>
              SOURCE: UNHCR REFUGEE DATA FINDER (api.unhcr.org), {snap.year} vs {snap.prevYear}<br />
              REFUGEES + ASYLUM-SEEKERS + OTHERS IN NEED OF PROTECTION · ±{Math.round(TREND_THRESHOLD * 100)}% = GROWING/SHRINKING<br />
              A CHANGE CAN BE ARRIVALS, RETURNS OR RE-REGISTRATION · {fmt(snap.unplaced)} WITH UNKNOWN ORIGIN NOT MAPPED
            </div>
          </div>
        )
      })()}

      {/* ─ IDPS: internal displacement (UNHCR) ─ */}
      {tab === 'IDPS' && (() => {
        if (!snap) return <DisplacementStatus state={disp} />
        const rows = snap.countries.filter(c => c.idps > 0).sort((a, b) => b.idps - a.idps).slice(0, 20)
        const max = rows[0]?.idps || 1
        return (
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 6 }}>
              // DISPLACED INSIDE THEIR OWN COUNTRY · UNHCR {snap.year}
            </div>
            {rows.map(c => {
              return (
                <div key={c.iso3} style={{ marginBottom: 5 }}>
                  <div onClick={() => onGeoSearch?.(`${c.point[1]},${c.point[0]}`)} style={{ cursor: onGeoSearch ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text1)', fontWeight: 700, flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--amber)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.idps)}</span>
                      <span style={{ fontSize: 9.5, color: TREND_VAR[trendOf(c.idps, c.idpsPrev)], width: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{changeLabel(c.idps, c.idpsPrev)}</span>
                    </div>
                    <div style={{ marginLeft: 0, height: 2, background: 'var(--border)', borderRadius: 1 }}>
                      <div style={{ width: `${(c.idps / max) * 100}%`, height: '100%', background: 'var(--amber)', opacity: 0.55, borderRadius: 1 }} />
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text3)', letterSpacing: '.05em', lineHeight: 1.7 }}>
              SOURCE: UNHCR REFUGEE DATA FINDER · IDP FIGURES ARE CONFLICT-RELATED
            </div>
          </div>
        )
      })()}

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
