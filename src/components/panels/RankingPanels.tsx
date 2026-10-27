/**
 * Global ranking panels: military personnel, power output, Our World in Data topics, data centres.
 * Wired up in src/panels/registry.tsx.
 */
import { useState, useEffect } from 'react'
import { fetchMilitaryPersonnelRanking, formatPersonnel, type MilitaryPersonnelEntry } from '../../services/militaryPersonnel'
import { freshness } from '../../utils/freshness'
import { fetchPowerGenerationRanking, formatTwh, POWER_SOURCES, type PowerGenerationEntry, type PowerSource } from '../../services/powerGeneration'
import { fetchDataCenters, type DataCenterPoint } from '../../services/datacenters'
import { OnMapButton } from './OnMapButton'
import { INDICATOR_BY_ID } from '../../services/countryIndicators'
import { OWID_CHARTS, fetchOwidChart, formatOwidValue, TOPIC_LABELS, type OwidTopic, type OwidChartData } from '../../services/owid'

import { type MapLinkProps, infoStrip } from './countryDataShared'
import { MetricRow, RankRow, StatusLabel } from '../DataLabels'

// ── Military Personnel Panel — ranked by armed forces personnel (World Bank) ──
export function MilitaryPersonnelPanel({ onCountryClick, panelState, onToggleLayer }: { onCountryClick?: (country: string) => void } & MapLinkProps) {
  const [ranking, setRanking] = useState<MilitaryPersonnelEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchMilitaryPersonnelRanking()
      .then(r => { setRanking(r); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const filtered = search.trim()
    ? ranking.filter(c => c.country.toLowerCase().includes(search.toLowerCase()) || c.iso2.toLowerCase().includes(search.toLowerCase()))
    : ranking
  const maxPersonnel = ranking[0]?.personnel ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${ranking.length || '…'} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={infoStrip}>
        <span>Armed forces personnel, latest reported year per country (years differ; most stop at 2020) · World Bank (IISS Military Balance)</span>
        <OnMapButton indicatorId="MS.MIL.TOTL.P1" panelState={panelState} onToggleLayer={onToggleLayer} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {loading && <StatusLabel status="loading">World Bank ranking…</StatusLabel>}
        {error && <StatusLabel status="error">The World Bank ranking could not be loaded.</StatusLabel>}
        {filtered.map(c => {
          const fresh = freshness(c.year, 'military', c.iso2)
          return (
            <RankRow key={c.iso2} rank={c.rank} code={c.iso2} name={c.country} share={c.personnel / maxPersonnel} tone="down"
              value={formatPersonnel(c.personnel)} year={c.year} stale={fresh?.stale} staleLabel={fresh?.label ?? undefined}
              onClick={() => onCountryClick?.(c.country)} />
          )
        })}
      </div>
    </div>
  )
}

// ── Power Output Panel — countries ranked by electricity generated (Ember via Our World in Data) ──
const POWER_COLORS: Record<PowerSource, string> = {
  coal: 'var(--text3)', gas: 'var(--amber)', oil: 'var(--red)',
  nuclear: 'var(--series-5)', hydro: 'var(--blue)', wind: 'var(--series-3)',
  solar: 'var(--series-4)', bioenergy: 'var(--green)', other: 'var(--series-1)',
}

export function InfraIndicatorsPanel({ onCountryClick, panelState, onToggleLayer }: { onCountryClick?: (country: string) => void } & MapLinkProps) {
  const [ranking, setRanking] = useState<PowerGenerationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    fetchPowerGenerationRanking()
      .then(r => { setRanking(r); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? ranking.filter(c => c.country.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    : ranking
  const max = ranking[0]?.totalTwh || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${ranking.length || '…'} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={infoStrip}>
        <span>Ranked by electricity generated per year · low-carbon share · Ember via Our World in Data</span>
        <OnMapButton indicatorId="ember:total" panelState={panelState} onToggleLayer={onToggleLayer} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {loading && <StatusLabel status="loading">Electricity data…</StatusLabel>}
        {error && <StatusLabel status="error">The electricity data could not be loaded.</StatusLabel>}
        {filtered.map(c => {
          const expanded = open === c.code
          return (
            <div key={c.code} style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setOpen(expanded ? null : c.code)}
                title="Show generation by source"
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '3.5px 0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 9, color: 'var(--text3)', width: 22, flexShrink: 0, textAlign: 'right' }}>#{c.rank}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.country}</span>
                <div style={{ width: 52, height: 4, background: 'var(--border)', borderRadius: 1, overflow: 'hidden', flexShrink: 0, display: 'flex' }}>
                  {POWER_SOURCES.map(src => c.bySource[src.id] > 0 && (
                    <div key={src.id} style={{ width: `${(c.bySource[src.id] / max) * 100}%`, minWidth: 0, background: POWER_COLORS[src.id] }} />
                  ))}
                </div>
                <span style={{ fontSize: 9.5, color: 'var(--text1)', fontWeight: 700, width: 62, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {formatTwh(c.totalTwh)}
                </span>
                <span title="Share of generation from non-fossil sources" style={{ fontSize: 9, color: c.lowCarbonPct >= 50 ? 'var(--green)' : 'var(--text2)', width: 30, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(c.lowCarbonPct)}%
                </span>
              </button>
              {expanded && (
                <div style={{ padding: '2px 0 6px 28px' }}>
                  {POWER_SOURCES.filter(src => c.bySource[src.id] > 0).sort((a, b) => c.bySource[b.id] - c.bySource[a.id]).map(src => (
                    <MetricRow key={src.id}
                      label={<><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: POWER_COLORS[src.id], marginRight: 6 }} />{src.label}</>}
                      value={`${formatTwh(c.bySource[src.id])} · ${Math.round((c.bySource[src.id] / c.totalTwh) * 100)}%`} />
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 9, color: 'var(--text3)' }}>
                    <span>Data year {c.year}</span>
                    <button
                      onClick={() => onCountryClick?.(c.country)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 9, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    >Open country →</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Our World in Data Panel — agriculture, violence & war, energy & environment, innovation & tech ──
const OWID_TOPICS: OwidTopic[] = ['agriculture', 'violence', 'energy', 'innovation']

export function OwidPanel({ onCountryClick, panelState, onToggleLayer }: { onCountryClick?: (country: string) => void } & MapLinkProps) {
  const [topic, setTopic] = useState<OwidTopic>('violence')
  const [chartSlug, setChartSlug] = useState<string>(OWID_CHARTS.find(c => c.topic === 'violence')!.slug)
  const [data, setData] = useState<OwidChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')

  const chartsForTopic = OWID_CHARTS.filter(c => c.topic === topic)

  useEffect(() => {
    setLoading(true)
    setError(false)
    setData(null)
    fetchOwidChart(chartSlug)
      .then(r => { if (r) setData(r); else setError(true); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [chartSlug])

  const filtered = data
    ? (search.trim()
        ? data.values.filter(v => v.entity.toLowerCase().includes(search.toLowerCase()) || v.code.toLowerCase().includes(search.toLowerCase()))
        : data.values)
    : []
  const maxValue = filtered.length ? Math.max(...filtered.map(v => v.value)) : 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {OWID_TOPICS.map(t => (
          <button
            key={t}
            onClick={() => { setTopic(t); const first = OWID_CHARTS.find(c => c.topic === t)!.slug; setChartSlug(first) }}
            style={{
              flex: 1, padding: '4px 2px', fontSize: 8.5, fontFamily: 'inherit', fontWeight: 700,
              background: topic === t ? 'var(--border)' : 'none', border: 'none', borderBottom: topic === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: topic === t ? 'var(--text1)' : 'var(--text2)', cursor: 'pointer', letterSpacing: 0.3,
            }}
          >
            {TOPIC_LABELS[t].toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <select
          value={chartSlug}
          onChange={e => setChartSlug(e.target.value)}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 9.5, fontFamily: 'inherit', outline: 'none', marginBottom: 4,
          }}
        >
          {chartsForTopic.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${data?.values.length || '…'} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={infoStrip}>
        <span>Our World in Data (OECD / UCDP / World Bank / WIPO — most recent year per country)</span>
        <OnMapButton indicatorId={INDICATOR_BY_ID.has(`owid:${chartSlug}`) ? `owid:${chartSlug}` : null} panelState={panelState} onToggleLayer={onToggleLayer} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {loading && <StatusLabel status="loading">Our World in Data…</StatusLabel>}
        {error && <StatusLabel status="error">The data for this chart could not be loaded.</StatusLabel>}
        {!loading && !error && filtered.length === 0 && <StatusLabel status="empty">No countries match.</StatusLabel>}
        {filtered.map((v, i) => (
          <RankRow key={v.entity} rank={i + 1} code={v.code} name={v.entity} share={maxValue ? v.value / maxValue : 0}
            value={data ? formatOwidValue(data.unit, v.value) : ''} year={v.year} onClick={() => onCountryClick?.(v.entity)} />
        ))}
      </div>
    </div>
  )
}

// ── Data Centers Panel ───────────────────────────────────────────────────────
export function DataCentersPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const [datacenters, setDatacenters] = useState<DataCenterPoint[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)
  const [search, setSearch]           = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchDataCenters()
      .then(pts => { if (!cancelled) { setDatacenters(pts); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = datacenters.filter(d =>
    !q || d.name.toLowerCase().includes(q) || (d.operator ?? '').toLowerCase().includes(q) || (d.country ?? '').toLowerCase().includes(q)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search facility, operator, country…"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 11.5, padding: '2px 6px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <div style={{ padding: '2px 8px', borderBottom: '1px solid var(--border)', fontSize: '9.5px', color: 'var(--text3)' }}>
        {loading ? <StatusLabel status="loading">OpenStreetMap data centres…</StatusLabel> : error ? <StatusLabel status="error">OpenStreetMap could not be reached.</StatusLabel> : `${filtered.length} facilities`}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(d => (
          <div key={d.id}
            onClick={() => onGeoSearch?.(d.name)}
            style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'flex-start', cursor: onGeoSearch ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
            title={onGeoSearch ? `Fly to ${d.name}` : undefined}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', flexShrink: 0, marginTop: 3 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>{d.name}</span>
              <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: 2 }}>
                {d.operator ? `${d.operator}` : ''}{d.operator && d.country ? ' · ' : ''}{d.country ?? ''}
              </div>
              {d.notes && <div style={{ fontSize: '10.5px', color: 'var(--text2)', lineHeight: 1.5, marginTop: 2 }}>{d.notes}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '3px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', flexShrink: 0 }}>
        SOURCE: OPENSTREETMAP (telecom=data_center)
      </div>
    </div>
  )
}
