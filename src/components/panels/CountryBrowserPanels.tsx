/**
 * "By country" browsers: pick a country, list its military sites, nuclear plants, infrastructure, resources and trade.
 * Wired up in src/panels/registry.tsx.
 */
import { useState, useMemo } from 'react'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../../services/military'
import { TRADE_PROFILES } from '../../services/tradeStats'
import { RESOURCE_PROFILES } from '../../services/resources'
import { ALL_INFRA_POINTS, INFRA_COLORS } from '../../services/infrastructure'


// ── Generic country → items browser ─────────────────────────────────────────
// Groups any point dataset by country: click a country to see its items,
// click an item to fly to it on the map. Used for Military Installations,
// Nuclear Facilities, Critical Infrastructure, and Resources workspaces.
interface CountryBrowserItem {
  id: string
  name: string
  country: string
  lat: number
  lng: number
  color: string
  tag?: string
  detail?: string
}

function CountryItemBrowser({ items, itemNoun, onGeoSearch }: {
  items: CountryBrowserItem[]
  itemNoun: string
  onGeoSearch?: (q: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const byCountry = useMemo(() => {
    const map = new Map<string, CountryBrowserItem[]>()
    for (const it of items) {
      const list = map.get(it.country) ?? []
      list.push(it)
      map.set(it.country, list)
    }
    return map
  }, [items])

  const countries = useMemo(
    () => Array.from(byCountry.keys()).sort((a, b) => byCountry.get(b)!.length - byCountry.get(a)!.length || a.localeCompare(b)),
    [byCountry],
  )
  const filtered = search.trim()
    ? countries.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : countries

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${countries.length} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        {countries.length} countries · {items.length} {itemNoun} · click a country, then an item to fly to it
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {filtered.map(country => {
          const countryItems = byCountry.get(country)!
          const isOpen = selected === country
          return (
            <div key={country} style={{ borderBottom: '1px solid var(--border)', marginBottom: 1 }}>
              <button
                onClick={() => setSelected(isOpen ? null : country)}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--accent-soft)' : 'none',
                  border: 'none', padding: '4px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{country}</span>
                <span style={{ fontSize: 9, color: 'var(--text2)', fontWeight: 700, flexShrink: 0 }}>({countryItems.length})</span>
              </button>
              {isOpen && (
                <div style={{ padding: '2px 0 6px 10px' }}>
                  {countryItems.map(it => (
                    <div
                      key={it.id}
                      onClick={() => onGeoSearch?.(`${it.lat},${it.lng}`)}
                      style={{
                        padding: '3px 6px', marginBottom: 1, cursor: onGeoSearch ? 'pointer' : 'default',
                        display: 'flex', gap: 6, alignItems: 'flex-start', borderRadius: 3, transition: 'background .1s',
                      }}
                      onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                      title={onGeoSearch ? `Fly to ${it.name}` : undefined}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: it.color, flexShrink: 0, marginTop: 3 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, color: 'var(--text1)', fontWeight: 600 }}>{it.name}</div>
                        {it.detail && <div style={{ fontSize: 9.5, color: 'var(--text2)' }}>{it.detail}</div>}
                      </div>
                      {it.tag && <span style={{ fontSize: 9, color: it.color, flexShrink: 0 }}>{it.tag}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MilitaryInstallationsByCountryPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const items: CountryBrowserItem[] = useMemo(() => MILITARY_FACILITIES.map(f => ({
    id: f.id, name: f.name, country: f.host, lat: f.lat, lng: f.lng,
    color: FACILITY_COLORS[f.type], tag: f.nuclear ? '☢ NUC' : undefined,
    detail: `${FACILITY_LABELS[f.type]} · ${f.operator}${f.personnel ? ` · ${f.personnel.toLocaleString()} personnel` : ''}`,
  })), [])
  return <CountryItemBrowser items={items} itemNoun="installations" onGeoSearch={onGeoSearch} />
}

export function NuclearFacilitiesByCountryPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const items: CountryBrowserItem[] = useMemo(() => {
    const plants: CountryBrowserItem[] = NUCLEAR_PLANTS.map(p => ({
      id: p.id, name: p.name, country: p.country, lat: p.lat, lng: p.lng,
      color: PLANT_STATUS_COLORS[p.status], tag: `${p.reactors}R`,
      detail: `${p.type} · ${p.capacity.toLocaleString()} MWe · ${p.status}`,
    }))
    const weapons: CountryBrowserItem[] = MILITARY_FACILITIES.filter(f => f.type === 'nuclear_weapons').map(f => ({
      id: f.id, name: f.name, country: f.host, lat: f.lat, lng: f.lng,
      color: 'var(--red)', tag: '☢ WPN',
      detail: `${f.operator} · nuclear weapons facility`,
    }))
    return [...plants, ...weapons]
  }, [])
  return <CountryItemBrowser items={items} itemNoun="facilities" onGeoSearch={onGeoSearch} />
}

export function InfrastructureByCountryPanel({ onGeoSearch }: { onGeoSearch?: (q: string) => void }) {
  const items: CountryBrowserItem[] = useMemo(() => ALL_INFRA_POINTS.map(p => ({
    id: p.id, name: p.name, country: p.country, lat: p.lat, lng: p.lng,
    color: INFRA_COLORS[p.type] ?? 'var(--amber)', tag: p.type.toUpperCase(),
    detail: `${p.capacity ? p.capacity + ' · ' : ''}${p.status}`,
  })), [])
  return <CountryItemBrowser items={items} itemNoun="facilities" onGeoSearch={onGeoSearch} />
}

export function ResourcesByCountryPanel({ onGeoSearch, onCountryClick }: { onGeoSearch?: (q: string) => void; onCountryClick?: (country: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const sorted = useMemo(() => RESOURCE_PROFILES.slice().sort((a, b) => b.resources.length - a.resources.length), [])
  const filtered = search.trim()
    ? sorted.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : sorted

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${sorted.length} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        {sorted.length} major-producer countries · click a country to see its commodities
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {filtered.map(c => {
          const isOpen = selected === c.iso2
          return (
            <div key={c.iso2} style={{ borderBottom: '1px solid var(--border)', marginBottom: 1 }}>
              <button
                onClick={() => { setSelected(isOpen ? null : c.iso2); onCountryClick?.(c.name) }}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--accent-soft)' : 'none',
                  border: 'none', padding: '4px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 700, flexShrink: 0 }}>({c.resources.length})</span>
              </button>
              {isOpen && (
                <div style={{ padding: '2px 0 6px 10px' }}>
                  {c.resources.map(r => (
                    <div
                      key={r.mineral}
                      onClick={() => onGeoSearch?.(c.name)}
                      style={{ padding: '3px 6px', marginBottom: 1, cursor: onGeoSearch ? 'pointer' : 'default', borderRadius: 3, transition: 'background .1s' }}
                      onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                      title={onGeoSearch ? `Fly to ${c.name}` : undefined}
                    >
                      <div style={{ fontSize: 10.5, color: 'var(--text1)', fontWeight: 600 }}>
                        {r.mineral}{r.rank ? <span style={{ color: 'var(--amber)', fontWeight: 700 }}> · #{r.rank} world</span> : ''}
                      </div>
                      {r.note && <div style={{ fontSize: 9.5, color: 'var(--text2)' }}>{r.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TradePartnersByCountryPanel({ onGeoSearch, onCountryClick }: { onGeoSearch?: (q: string) => void; onCountryClick?: (country: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const sorted = useMemo(() => TRADE_PROFILES.slice().sort((a, b) => a.name.localeCompare(b.name)), [])
  const filtered = search.trim()
    ? sorted.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : sorted

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${sorted.length} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        {sorted.length} countries · click a country, then a partner to fly to it
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {filtered.map(c => {
          const isOpen = selected === c.iso2
          const totalPartners = c.topExportPartners.length + c.topImportPartners.length
          return (
            <div key={c.iso2} style={{ borderBottom: '1px solid var(--border)', marginBottom: 1 }}>
              <button
                onClick={() => { setSelected(isOpen ? null : c.iso2); onCountryClick?.(c.name) }}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--accent-soft)' : 'none',
                  border: 'none', padding: '4px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>({totalPartners})</span>
              </button>
              {isOpen && (
                <div style={{ padding: '2px 0 6px 10px' }}>
                  <div style={{ fontSize: 9, color: 'var(--green)', marginBottom: 2 }}>EXPORT PARTNERS</div>
                  {c.topExportPartners.map(p => (
                    <div
                      key={`exp-${p.country}`}
                      onClick={() => onGeoSearch?.(p.country)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px', cursor: onGeoSearch ? 'pointer' : 'default', borderRadius: 3 }}
                      onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                      title={onGeoSearch ? `Fly to ${p.country}` : undefined}
                    >
                      <span style={{ fontSize: 10.5, color: 'var(--text1)' }}>{p.country}</span>
                      <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>{p.pct}%</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 9, color: 'var(--amber)', marginTop: 4, marginBottom: 2 }}>IMPORT PARTNERS</div>
                  {c.topImportPartners.map(p => (
                    <div
                      key={`imp-${p.country}`}
                      onClick={() => onGeoSearch?.(p.country)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px', cursor: onGeoSearch ? 'pointer' : 'default', borderRadius: 3 }}
                      onMouseEnter={e => { if (onGeoSearch) (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                      title={onGeoSearch ? `Fly to ${p.country}` : undefined}
                    >
                      <span style={{ fontSize: 10.5, color: 'var(--text1)' }}>{p.country}</span>
                      <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>{p.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TradeProductsByCountryPanel({ onCountryClick }: { onCountryClick?: (country: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const sorted = useMemo(() => TRADE_PROFILES.slice().sort((a, b) => a.name.localeCompare(b.name)), [])
  const filtered = search.trim()
    ? sorted.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : sorted

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${sorted.length} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        {sorted.length} countries · top exported/imported product categories
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {filtered.map(c => {
          const isOpen = selected === c.iso2
          const totalProducts = c.topExports.length + c.topImports.length
          return (
            <div key={c.iso2} style={{ borderBottom: '1px solid var(--border)', marginBottom: 1 }}>
              <button
                onClick={() => { setSelected(isOpen ? null : c.iso2); onCountryClick?.(c.name) }}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--accent-soft)' : 'none',
                  border: 'none', padding: '4px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ fontSize: 9, color: 'var(--blue)', fontWeight: 700, flexShrink: 0 }}>({totalProducts})</span>
              </button>
              {isOpen && (
                <div style={{ padding: '2px 0 6px 10px' }}>
                  <div style={{ fontSize: 9, color: 'var(--blue)', marginBottom: 2 }}>TOP EXPORTS</div>
                  {c.topExports.map(p => (
                    <div key={`exp-${p.product}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5px 6px' }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text1)' }}>{p.product}</span>
                      <span style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 700 }}>{p.pct}%</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 9, color: 'var(--series-5)', marginTop: 4, marginBottom: 2 }}>TOP IMPORTS</div>
                  {c.topImports.map(p => (
                    <div key={`imp-${p.product}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5px 6px' }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text1)' }}>{p.product}</span>
                      <span style={{ fontSize: 10, color: 'var(--series-5)', fontWeight: 700 }}>{p.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
