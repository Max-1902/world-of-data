import { useCallback, useState } from 'react'
import { countFlightTypes, FLIGHT_TYPE_COLORS, type FlightType } from '../../../utils/flightType'
import { ALL_TYPES } from '../flightLayer'
import type { Flight } from '../../../types'

interface Props {
  flights: Flight[]
  /** flights left after the filter, shown on the toggle button */
  filteredCount: number
  filterQuery: string
  setFilterQuery: (q: string) => void
  filterTypes: Set<FlightType>
  setFilterTypes: (update: Set<FlightType> | ((prev: Set<FlightType>) => Set<FlightType>)) => void
}

// Size shortcut groups (derived from type — OpenSky has no size data)
const SIZE_GROUPS: { label: string; color: string; types: FlightType[] }[] = [
  { label: 'LARGE',  color: '#00ff88', types: ['airline', 'cargo'] },
  { label: 'MEDIUM', color: '#ffaa00', types: ['military'] },
  { label: 'SMALL',  color: '#8844ff', types: ['private', 'unknown'] },
]

export default function FlightFilter({ flights, filteredCount, filterQuery, setFilterQuery, filterTypes, setFilterTypes }: Props) {
  const [showFilter, setShowFilter] = useState(false)
  const typeCounts = countFlightTypes(flights)

  const toggleType = useCallback((t: FlightType) => {
    setFilterTypes((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }, [setFilterTypes])

  return (
  <div style={{ position:'absolute', top:52, left:10, zIndex:30 }}>
    {/* Toggle button */}
    <button
      onClick={() => setShowFilter(v => !v)}
      style={{
        display:'flex', alignItems:'center', gap:5,
        padding:'3px 10px', fontSize:8.5, fontWeight:700,
        letterSpacing:'.14em', textTransform:'uppercase',
        border:`1px solid ${showFilter ? 'rgba(105,201,167,.55)' : '#263843'}`,
        background: showFilter ? 'rgba(105,201,167,.10)' : 'rgba(9,16,22,.9)',
        color: showFilter ? '#69c9a7' : '#c0cbd0',
        cursor:'pointer', transition:'all .15s', fontFamily:'monospace',
        backdropFilter:'blur(8px)',
      }}
    >
      ✈ FILTER
      <span style={{ fontSize:7, color: showFilter ? '#9ad9c2' : '#7c909a', fontVariantNumeric:'tabular-nums' }}>
        {filteredCount.toLocaleString()}
      </span>
    </button>

    {/* Flyout panel */}
    {showFilter && (
      <div style={{
        marginTop:3,
        background:'rgba(9,16,22,0.97)',
        border:'1px solid #263843', borderLeft:'2px solid rgba(105,201,167,.55)',
        backdropFilter:'blur(10px)',
        width:230,
        boxShadow:'0 4px 20px rgba(0,0,0,0.7)',
      }}>
        {/* Search input */}
        <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 8px', borderBottom:'1px solid #263843' }}>
          <span style={{ fontSize:9, color:'#7c909a', flexShrink:0 }}>⌕</span>
          <input
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="callsign · country · icao24"
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              fontSize:9, color:'#e5ecef', fontFamily:'monospace', letterSpacing:'.03em',
            }}
          />
          {filterQuery && (
            <button onClick={() => setFilterQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#98aab4', fontSize:10, padding:0 }}>×</button>
          )}
        </div>

        {/* Type filters with count badges */}
        <div style={{ padding:'5px 8px', borderBottom:'1px solid #263843' }}>
          <div style={{ fontSize:7, color:'#7c909a', letterSpacing:'.15em', marginBottom:4 }}>// TYPE</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            <button onClick={() => setFilterTypes(new Set(ALL_TYPES))}
              style={{ padding:'2px 6px', fontSize:7.5, fontWeight:700, letterSpacing:'.1em', border:'1px solid #31434d', background:'rgba(255,255,255,0.04)', color:'#c0cbd0', cursor:'pointer' }}>
              ALL
            </button>
            {ALL_TYPES.map(type => {
              const on    = filterTypes.has(type)
              const color = FLIGHT_TYPE_COLORS[type]
              const icon  = type === 'airline' ? '✈' : type === 'cargo' ? '▣' : type === 'military' ? '⚔' : type === 'private' ? '◆' : '?'
              const label = type === 'airline' ? 'AIR' : type === 'cargo' ? 'CGO' : type === 'military' ? 'MIL' : type === 'private' ? 'PVT' : 'UNK'
              const count = typeCounts[type] || 0
              return (
                <button key={type} onClick={() => toggleType(type)} style={{
                  display:'flex', alignItems:'center', gap:3,
                  padding:'2px 6px', fontSize:7.5, fontWeight:700, letterSpacing:'.08em',
                  border:`1px solid ${on ? color + '66' : '#263843'}`,
                  background: on ? color + '18' : 'transparent',
                  color: on ? color : '#7c909a', cursor:'pointer', transition:'all .12s',
                }}>
                  {icon} {label}
                  <span style={{ fontSize:7, opacity:.7, fontVariantNumeric:'tabular-nums' }}>{count.toLocaleString()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Size shortcuts */}
        <div style={{ padding:'5px 8px', borderBottom:'1px solid #263843' }}>
          <div style={{ fontSize:7, color:'#7c909a', letterSpacing:'.15em', marginBottom:4 }}>// SIZE</div>
          <div style={{ display:'flex', gap:3 }}>
            {SIZE_GROUPS.map(g => {
              const on = g.types.every(t => filterTypes.has(t))
              return (
                <button key={g.label} onClick={() => setFilterTypes(new Set(g.types))} style={{
                  padding:'2px 7px', fontSize:7.5, fontWeight:700, letterSpacing:'.08em',
                  border:`1px solid ${on ? g.color + '55' : '#263843'}`,
                  background: on ? g.color + '14' : 'transparent',
                  color: on ? g.color : '#7c909a', cursor:'pointer', transition:'all .12s',
                }}>
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Distribution bars */}
        <div style={{ padding:'5px 8px 7px' }}>
          {ALL_TYPES.map(type => {
            const count = typeCounts[type] || 0
            const pct   = flights.length ? (count / flights.length) * 100 : 0
            const color = FLIGHT_TYPE_COLORS[type]
            const on    = filterTypes.has(type)
            return (
              <div key={type} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3, opacity: on ? 1 : 0.35 }}>
                <div style={{ width:4, height:4, background:color, flexShrink:0 }} />
                <span style={{ fontSize:7, color:'#98aab4', width:22, letterSpacing:'.06em', flexShrink:0, textTransform:'uppercase' }}>{type.slice(0,3)}</span>
                <div style={{ flex:1, height:2, background:'#263843', position:'relative', borderRadius:1 }}>
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`, background:color, opacity:.6, transition:'width .5s', borderRadius:1 }} />
                </div>
                <span style={{ fontSize:7, color:'#7c909a', width:28, textAlign:'right', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{count.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>
    )}
  </div>
  )
}
