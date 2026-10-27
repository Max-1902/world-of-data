import { useCallback, useState } from 'react'
import { Plane, Search } from 'lucide-react'
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
const SIZE_GROUPS: { label: string; types: FlightType[] }[] = [
  { label: 'Large',  types: ['airline', 'cargo'] },
  { label: 'Medium', types: ['military'] },
  { label: 'Small',  types: ['private', 'unknown'] },
]

const TYPE_LABEL: Record<FlightType, string> = { airline: 'Airline', cargo: 'Cargo', military: 'Military', private: 'Private', unknown: 'Unknown' }

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
  <div className="ff">
    <button className={`ff-launch${showFilter ? ' open' : ''}`} onClick={() => setShowFilter(v => !v)} aria-expanded={showFilter}>
      <Plane size={12} strokeWidth={1.8} /> Filter flights
      <span className="ff-count">{filteredCount.toLocaleString()}</span>
    </button>

    {showFilter && (
      <div className="ff-panel">
        <div className="ff-search">
          <Search size={12} />
          <input value={filterQuery} onChange={e => setFilterQuery(e.target.value)} placeholder="Search callsign, country or ICAO24" aria-label="Filter flights by callsign, country or ICAO24" />
          {filterQuery && <button className="ff-clear" onClick={() => setFilterQuery('')}>×</button>}
        </div>

        <div className="ff-section">
          <div className="ff-label">TYPE</div>
          <div className="ff-chips">
            <button className="ff-chip" onClick={() => setFilterTypes(new Set(ALL_TYPES))}>All</button>
            {ALL_TYPES.map(type => {
              const on = filterTypes.has(type)
              const color = FLIGHT_TYPE_COLORS[type]
              return (
                <button key={type} className={`ff-chip${on ? ' on' : ''}`} onClick={() => toggleType(type)} aria-pressed={on}
                  style={on ? { color, borderColor: color + '66', background: color + '18' } : undefined}>
                  {TYPE_LABEL[type]} <small>{(typeCounts[type] || 0).toLocaleString()}</small>
                </button>
              )
            })}
          </div>
        </div>

        <div className="ff-section">
          <div className="ff-label">SIZE</div>
          <div className="ff-chips">
            {SIZE_GROUPS.map(g => {
              const on = g.types.every(t => filterTypes.has(t))
              return <button key={g.label} className={`ff-chip${on ? ' on' : ''}`} onClick={() => setFilterTypes(new Set(g.types))} aria-pressed={on}>{g.label}</button>
            })}
          </div>
        </div>

        <div className="ff-section ff-dist">
          {ALL_TYPES.map(type => {
            const count = typeCounts[type] || 0
            const pct   = flights.length ? (count / flights.length) * 100 : 0
            const color = FLIGHT_TYPE_COLORS[type]
            return (
              <div key={type} className={`ff-bar${filterTypes.has(type) ? '' : ' off'}`}>
                <i style={{ background: color }} />
                <span>{TYPE_LABEL[type]}</span>
                <div className="ff-track"><div style={{ width: `${pct}%`, background: color }} /></div>
                <b>{count.toLocaleString()}</b>
              </div>
            )
          })}
        </div>
      </div>
    )}
  </div>
  )
}
