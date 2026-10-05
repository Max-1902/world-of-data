/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useEffect, useMemo } from 'react'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../../services/military'
import { TRADE_PROFILES } from '../../services/tradeStats'
import { fetchCountryEcon, formatEconValue, groupIndicators, type CountryEconData } from '../../services/worldbank'
import { fetchMilitaryPersonnelRanking, formatPersonnel, type MilitaryPersonnelEntry } from '../../services/militaryPersonnel'
import { fetchInfraIndicatorRanking, formatInfraValue, type CountryInfraEntry } from '../../services/infraIndicators'
import { RESOURCE_PROFILES, fetchResourceRents, type ResourceRent } from '../../services/resources'
import { ALL_INFRA_POINTS, INFRA_COLORS } from '../../services/infrastructure'
import { fetchDataCenters, type DataCenterPoint } from '../../services/datacenters'
import { OWID_CHARTS, fetchOwidChart, formatOwidValue, TOPIC_LABELS, type OwidTopic, type OwidChartData } from '../../services/owid'

// ── Global Economy Panel ──────────────────────────────────────────────────
// All 249 countries/territories (ISO 3166-1) for World Bank lookup
const ALL_COUNTRIES: { iso2: string; name: string }[] = [
  {iso2:'AF',name:'Afghanistan'},{iso2:'AL',name:'Albania'},{iso2:'DZ',name:'Algeria'},{iso2:'AD',name:'Andorra'},{iso2:'AO',name:'Angola'},
  {iso2:'AG',name:'Antigua and Barbuda'},{iso2:'AR',name:'Argentina'},{iso2:'AM',name:'Armenia'},{iso2:'AU',name:'Australia'},{iso2:'AT',name:'Austria'},
  {iso2:'AZ',name:'Azerbaijan'},{iso2:'BS',name:'Bahamas'},{iso2:'BH',name:'Bahrain'},{iso2:'BD',name:'Bangladesh'},{iso2:'BB',name:'Barbados'},
  {iso2:'BY',name:'Belarus'},{iso2:'BE',name:'Belgium'},{iso2:'BZ',name:'Belize'},{iso2:'BJ',name:'Benin'},{iso2:'BT',name:'Bhutan'},
  {iso2:'BO',name:'Bolivia'},{iso2:'BA',name:'Bosnia and Herzegovina'},{iso2:'BW',name:'Botswana'},{iso2:'BR',name:'Brazil'},{iso2:'BN',name:'Brunei'},
  {iso2:'BG',name:'Bulgaria'},{iso2:'BF',name:'Burkina Faso'},{iso2:'BI',name:'Burundi'},{iso2:'CV',name:'Cabo Verde'},{iso2:'KH',name:'Cambodia'},
  {iso2:'CM',name:'Cameroon'},{iso2:'CA',name:'Canada'},{iso2:'CF',name:'Central African Republic'},{iso2:'TD',name:'Chad'},{iso2:'CL',name:'Chile'},
  {iso2:'CN',name:'China'},{iso2:'CO',name:'Colombia'},{iso2:'KM',name:'Comoros'},{iso2:'CG',name:'Congo'},{iso2:'CD',name:'DR Congo'},
  {iso2:'CR',name:'Costa Rica'},{iso2:'CI',name:'Côte d\'Ivoire'},{iso2:'HR',name:'Croatia'},{iso2:'CU',name:'Cuba'},{iso2:'CY',name:'Cyprus'},
  {iso2:'CZ',name:'Czech Republic'},{iso2:'DK',name:'Denmark'},{iso2:'DJ',name:'Djibouti'},{iso2:'DM',name:'Dominica'},{iso2:'DO',name:'Dominican Republic'},
  {iso2:'EC',name:'Ecuador'},{iso2:'EG',name:'Egypt'},{iso2:'SV',name:'El Salvador'},{iso2:'GQ',name:'Equatorial Guinea'},{iso2:'ER',name:'Eritrea'},
  {iso2:'EE',name:'Estonia'},{iso2:'SZ',name:'Eswatini'},{iso2:'ET',name:'Ethiopia'},{iso2:'FJ',name:'Fiji'},{iso2:'FI',name:'Finland'},
  {iso2:'FR',name:'France'},{iso2:'GA',name:'Gabon'},{iso2:'GM',name:'Gambia'},{iso2:'GE',name:'Georgia'},{iso2:'DE',name:'Germany'},
  {iso2:'GH',name:'Ghana'},{iso2:'GR',name:'Greece'},{iso2:'GD',name:'Grenada'},{iso2:'GT',name:'Guatemala'},{iso2:'GN',name:'Guinea'},
  {iso2:'GW',name:'Guinea-Bissau'},{iso2:'GY',name:'Guyana'},{iso2:'HT',name:'Haiti'},{iso2:'HN',name:'Honduras'},{iso2:'HU',name:'Hungary'},
  {iso2:'IS',name:'Iceland'},{iso2:'IN',name:'India'},{iso2:'ID',name:'Indonesia'},{iso2:'IR',name:'Iran'},{iso2:'IQ',name:'Iraq'},
  {iso2:'IE',name:'Ireland'},{iso2:'IL',name:'Israel'},{iso2:'IT',name:'Italy'},{iso2:'JM',name:'Jamaica'},{iso2:'JP',name:'Japan'},
  {iso2:'JO',name:'Jordan'},{iso2:'KZ',name:'Kazakhstan'},{iso2:'KE',name:'Kenya'},{iso2:'KI',name:'Kiribati'},{iso2:'KP',name:'North Korea'},
  {iso2:'KR',name:'South Korea'},{iso2:'KW',name:'Kuwait'},{iso2:'KG',name:'Kyrgyzstan'},{iso2:'LA',name:'Laos'},{iso2:'LV',name:'Latvia'},
  {iso2:'LB',name:'Lebanon'},{iso2:'LS',name:'Lesotho'},{iso2:'LR',name:'Liberia'},{iso2:'LY',name:'Libya'},{iso2:'LI',name:'Liechtenstein'},
  {iso2:'LT',name:'Lithuania'},{iso2:'LU',name:'Luxembourg'},{iso2:'MG',name:'Madagascar'},{iso2:'MW',name:'Malawi'},{iso2:'MY',name:'Malaysia'},
  {iso2:'MV',name:'Maldives'},{iso2:'ML',name:'Mali'},{iso2:'MT',name:'Malta'},{iso2:'MH',name:'Marshall Islands'},{iso2:'MR',name:'Mauritania'},
  {iso2:'MU',name:'Mauritius'},{iso2:'MX',name:'Mexico'},{iso2:'FM',name:'Micronesia'},{iso2:'MD',name:'Moldova'},{iso2:'MC',name:'Monaco'},
  {iso2:'MN',name:'Mongolia'},{iso2:'ME',name:'Montenegro'},{iso2:'MA',name:'Morocco'},{iso2:'MZ',name:'Mozambique'},{iso2:'MM',name:'Myanmar'},
  {iso2:'NA',name:'Namibia'},{iso2:'NR',name:'Nauru'},{iso2:'NP',name:'Nepal'},{iso2:'NL',name:'Netherlands'},{iso2:'NZ',name:'New Zealand'},
  {iso2:'NI',name:'Nicaragua'},{iso2:'NE',name:'Niger'},{iso2:'NG',name:'Nigeria'},{iso2:'MK',name:'North Macedonia'},{iso2:'NO',name:'Norway'},
  {iso2:'OM',name:'Oman'},{iso2:'PK',name:'Pakistan'},{iso2:'PW',name:'Palau'},{iso2:'PA',name:'Panama'},{iso2:'PG',name:'Papua New Guinea'},
  {iso2:'PY',name:'Paraguay'},{iso2:'PE',name:'Peru'},{iso2:'PH',name:'Philippines'},{iso2:'PL',name:'Poland'},{iso2:'PT',name:'Portugal'},
  {iso2:'QA',name:'Qatar'},{iso2:'RO',name:'Romania'},{iso2:'RU',name:'Russia'},{iso2:'RW',name:'Rwanda'},{iso2:'KN',name:'Saint Kitts and Nevis'},
  {iso2:'LC',name:'Saint Lucia'},{iso2:'VC',name:'Saint Vincent'},{iso2:'WS',name:'Samoa'},{iso2:'SM',name:'San Marino'},{iso2:'ST',name:'São Tomé and Príncipe'},
  {iso2:'SA',name:'Saudi Arabia'},{iso2:'SN',name:'Senegal'},{iso2:'RS',name:'Serbia'},{iso2:'SC',name:'Seychelles'},{iso2:'SL',name:'Sierra Leone'},
  {iso2:'SG',name:'Singapore'},{iso2:'SK',name:'Slovakia'},{iso2:'SI',name:'Slovenia'},{iso2:'SB',name:'Solomon Islands'},{iso2:'SO',name:'Somalia'},
  {iso2:'ZA',name:'South Africa'},{iso2:'SS',name:'South Sudan'},{iso2:'ES',name:'Spain'},{iso2:'LK',name:'Sri Lanka'},{iso2:'SD',name:'Sudan'},
  {iso2:'SR',name:'Suriname'},{iso2:'SE',name:'Sweden'},{iso2:'CH',name:'Switzerland'},{iso2:'SY',name:'Syria'},{iso2:'TW',name:'Taiwan'},
  {iso2:'TJ',name:'Tajikistan'},{iso2:'TZ',name:'Tanzania'},{iso2:'TH',name:'Thailand'},{iso2:'TL',name:'Timor-Leste'},{iso2:'TG',name:'Togo'},
  {iso2:'TO',name:'Tonga'},{iso2:'TT',name:'Trinidad and Tobago'},{iso2:'TN',name:'Tunisia'},{iso2:'TR',name:'Turkey'},{iso2:'TM',name:'Turkmenistan'},
  {iso2:'TV',name:'Tuvalu'},{iso2:'UG',name:'Uganda'},{iso2:'UA',name:'Ukraine'},{iso2:'AE',name:'UAE'},{iso2:'GB',name:'United Kingdom'},
  {iso2:'US',name:'United States'},{iso2:'UY',name:'Uruguay'},{iso2:'UZ',name:'Uzbekistan'},{iso2:'VU',name:'Vanuatu'},{iso2:'VE',name:'Venezuela'},
  {iso2:'VN',name:'Vietnam'},{iso2:'YE',name:'Yemen'},{iso2:'ZM',name:'Zambia'},{iso2:'ZW',name:'Zimbabwe'},
  {iso2:'HK',name:'Hong Kong'},{iso2:'MO',name:'Macau'},{iso2:'PS',name:'Palestine'},{iso2:'XK',name:'Kosovo'},
]

export function GlobalEconomyPanel({ onCountryClick }: { onCountryClick?: (country: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [econData, setEconData] = useState<CountryEconData | null>(null)
  const [econLoading, setEconLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!selected) { setEconData(null); return }
    setEconLoading(true)
    fetchCountryEcon(selected).then(d => { setEconData(d); setEconLoading(false) }).catch(() => setEconLoading(false))
  }, [selected])

  // Merge: trade profiles first (with balance), then all other countries
  const tradeMap = new Map(TRADE_PROFILES.map(t => [t.iso2, t]))
  const allEntries = ALL_COUNTRIES.map(c => ({ ...c, trade: tradeMap.get(c.iso2) ?? null }))
  // Sort: countries with trade profiles first (by balance), then alphabetical
  const sorted = allEntries.sort((a, b) => {
    if (a.trade && !b.trade) return -1
    if (!a.trade && b.trade) return 1
    if (a.trade && b.trade) return (b.trade.tradeBalance ?? 0) - (a.trade.tradeBalance ?? 0)
    return a.name.localeCompare(b.name)
  })
  const filtered = search.trim()
    ? sorted.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.iso2.toLowerCase().includes(search.toLowerCase()))
    : sorted
  const maxBal = Math.max(...TRADE_PROFILES.map(t => Math.abs(t.tradeBalance ?? 0)), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${ALL_COUNTRIES.length} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        {filtered.length} countries · {TRADE_PROFILES.length} with trade profiles · Click for World Bank data
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {filtered.map(c => {
          const t = c.trade
          const isOpen = selected === c.name
          const bal = t?.tradeBalance ?? null
          const balColor = bal != null ? (bal >= 0 ? 'var(--accent)' : 'var(--red)') : 'var(--text3)'
          const barW = bal != null ? Math.abs(bal) / maxBal * 100 : 0
          return (
            <div key={c.iso2} style={{ borderBottom: '1px solid var(--border)', marginBottom: 1 }}>
              <button
                onClick={() => { setSelected(isOpen ? null : c.name); onCountryClick?.(c.name) }}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--accent-soft)' : 'none',
                  border: 'none', padding: '3px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 700, color: t ? 'var(--accent)' : 'var(--text3)', width: 20, flexShrink: 0 }}>{c.iso2}</span>
                <span style={{ fontSize: 10.5, color: t ? 'var(--text1)' : 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                {bal != null && (
                  <>
                    <div style={{ width: 50, height: 3, background: 'var(--border)', borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${barW}%`, height: '100%', background: balColor, borderRadius: 1 }} />
                    </div>
                    <span style={{ fontSize: 9, color: balColor, fontWeight: 700, width: 38, textAlign: 'right', flexShrink: 0 }}>
                      {bal >= 0 ? '+' : ''}{bal}B
                    </span>
                  </>
                )}
              </button>
              {isOpen && (
                <div style={{ padding: '4px 0 6px 20px' }}>
                  {t && (
                    <>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                        {t.tradeToGDP != null && (
                          <span style={{ fontSize: 9, padding: '1px 4px', background: 'var(--accent-soft)', border: '1px solid var(--accent)22', color: 'var(--accent)' }}>
                            Trade/GDP {t.tradeToGDP}%
                          </span>
                        )}
                        <span style={{ fontSize: 9, padding: '1px 4px', background: 'var(--amber-soft)', border: '1px solid var(--amber)22', color: 'var(--amber)' }}>
                          {t.currency}
                        </span>
                        <span style={{ fontSize: 9, padding: '1px 4px', background: 'color-mix(in srgb, var(--series-5) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--series-5) 13%, transparent)', color: 'var(--series-5)' }}>
                          {t.incomeGroup}
                        </span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text2)', marginBottom: 2 }}>TOP EXPORTS</div>
                      {t.topExports.slice(0, 4).map(e => (
                        <div key={e.product} style={{ fontSize: 9.5, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{e.product}</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{e.pct}%</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 3, marginBottom: 2 }}>TOP PARTNERS</div>
                      {t.topExportPartners.slice(0, 3).map(p => (
                        <div key={p.country} style={{ fontSize: 9.5, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{p.country}</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.pct}%</span>
                        </div>
                      ))}
                      {t.dependencies && t.dependencies.length > 0 && (
                        <>
                          <div style={{ fontSize: 9, color: 'var(--red)', marginTop: 3, marginBottom: 2 }}>DEPENDENCIES</div>
                          {t.dependencies.slice(0, 3).map(d => (
                            <div key={d} style={{ fontSize: 9, color: 'var(--text2)' }}>▸ {d}</div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                  {/* World Bank live data */}
                  {econLoading && <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>Loading World Bank data…</div>}
                  {econData && econData.indicators.length > 0 && (() => {
                    const groups = groupIndicators(econData.indicators)
                    return Object.entries(groups).map(([groupName, indicators]) => (
                      <div key={groupName} style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 9, color: 'var(--text2)', letterSpacing: '.08em', marginBottom: 2 }}>{groupName}</div>
                        {indicators.map(ind => {
                          if (ind.value == null) return null
                          const formatted = formatEconValue(ind.id, ind.value)
                          const isGrowth = ind.id.includes('.ZG') || ind.id === 'SP.POP.GROW'
                          let valColor = 'var(--accent)'
                          if (isGrowth) valColor = ind.value >= 0 ? 'var(--accent)' : 'var(--red)'
                          return (
                            <div key={ind.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, padding: '0.5px 0' }}>
                              <span style={{ color: 'var(--text2)' }}>{ind.label}</span>
                              <span style={{ color: valColor, fontWeight: 700 }}>{formatted} <span style={{ fontSize: 8, color: 'var(--text2)' }}>{ind.year}</span></span>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  })()}
                  {!t && !econLoading && !econData && (
                    <div style={{ fontSize: 9.5, color: 'var(--text2)', fontStyle: 'italic' }}>Click to load World Bank economic data</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Resources Panel — critical minerals, reserves & production by country ──
export function ResourcesPanel({ onCountryClick }: { onCountryClick?: (country: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [rents, setRents] = useState<ResourceRent[]>([])
  const [rentsLoading, setRentsLoading] = useState(false)
  const [search, setSearch] = useState('')

  const resourceMap = useMemo(() => new Map(RESOURCE_PROFILES.map(r => [r.iso2, r])), [])
  const allEntries = useMemo(
    () => ALL_COUNTRIES.map(c => ({ ...c, res: resourceMap.get(c.iso2) ?? null })),
    [resourceMap],
  )
  const sorted = useMemo(() => allEntries.slice().sort((a, b) => {
    if (a.res && !b.res) return -1
    if (!a.res && b.res) return 1
    if (a.res && b.res) return b.res.resources.length - a.res.resources.length
    return a.name.localeCompare(b.name)
  }), [allEntries])
  const filtered = search.trim()
    ? sorted.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.iso2.toLowerCase().includes(search.toLowerCase()))
    : sorted

  useEffect(() => {
    if (!selected) { setRents([]); return }
    const entry = allEntries.find(c => c.name === selected)
    if (!entry) return
    setRentsLoading(true)
    fetchResourceRents(entry.iso2).then(r => { setRents(r); setRentsLoading(false) }).catch(() => setRentsLoading(false))
  }, [selected, allEntries])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${ALL_COUNTRIES.length} countries…`}
          style={{
            width: '100%', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text1)',
            padding: '4px 6px', fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        {filtered.length} countries · {RESOURCE_PROFILES.length} major producers profiled · click any country for live World Bank resource-rent data
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {filtered.map(c => {
          const r = c.res
          const isOpen = selected === c.name
          return (
            <div key={c.iso2} style={{ borderBottom: '1px solid var(--border)', marginBottom: 1 }}>
              <button
                onClick={() => { setSelected(isOpen ? null : c.name); onCountryClick?.(c.name) }}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--accent-soft)' : 'none',
                  border: 'none', padding: '3px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 700, color: r ? 'var(--accent)' : 'var(--text3)', width: 20, flexShrink: 0 }}>{c.iso2}</span>
                <span style={{ fontSize: 10.5, color: r ? 'var(--text1)' : 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                {r && (
                  <span style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 700, flexShrink: 0 }}>
                    {r.resources.length} resource{r.resources.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
              {isOpen && (
                <div style={{ padding: '4px 0 6px 20px' }}>
                  {r && (
                    <>
                      {r.strategic && (
                        <div style={{ fontSize: 9.5, color: 'var(--text2)', marginBottom: 4, fontStyle: 'italic', lineHeight: 1.4 }}>
                          {r.strategic}
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: 'var(--text2)', marginBottom: 2 }}>PRODUCTION / RESERVES</div>
                      {r.resources.map(m => (
                        <div key={m.mineral} style={{ fontSize: 9.5, color: 'var(--text2)', padding: '1.5px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text1)' }}>{m.mineral}</span>
                            <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
                              {m.rank ? `#${m.rank}` : ''}{m.shareOfWorld != null ? ` · ${m.shareOfWorld}% world` : ''}
                            </span>
                          </div>
                          {m.note && <div style={{ fontSize: 8.5, color: 'var(--text3)' }}>{m.note}</div>}
                        </div>
                      ))}
                    </>
                  )}
                  {rentsLoading && <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>Loading World Bank resource-rent data…</div>}
                  {rents.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--text2)', letterSpacing: '.08em', marginBottom: 2 }}>RESOURCE RENTS (% OF GDP)</div>
                      {rents.map(rt => (
                        <div key={rt.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, padding: '0.5px 0' }}>
                          <span style={{ color: 'var(--text2)' }}>{rt.label}</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{rt.value.toFixed(2)}% <span style={{ fontSize: 8, color: 'var(--text2)' }}>{rt.year}</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!r && !rentsLoading && rents.length === 0 && (
                    <div style={{ fontSize: 9.5, color: 'var(--text2)', fontStyle: 'italic' }}>Click to load World Bank resource-rent data</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

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

// ── Military Personnel Panel — ranked by armed forces personnel (World Bank) ──
export function MilitaryPersonnelPanel({ onCountryClick }: { onCountryClick?: (country: string) => void }) {
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
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        Ranked by total armed forces personnel · World Bank (IISS Military Balance)
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {loading && <div style={{ fontSize: 9.5, color: 'var(--text2)', padding: '8px 0', fontStyle: 'italic' }}>Loading World Bank ranking…</div>}
        {error && <div style={{ fontSize: 9.5, color: 'var(--red)', padding: '8px 0' }}>Failed to load World Bank data.</div>}
        {filtered.map(c => {
          const barW = (c.personnel / maxPersonnel) * 100
          return (
            <button
              key={c.iso2}
              onClick={() => onCountryClick?.(c.country)}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                borderBottom: '1px solid var(--border)', padding: '3.5px 0', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 9, color: 'var(--text3)', width: 22, flexShrink: 0, textAlign: 'right' }}>#{c.rank}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--red)', width: 20, flexShrink: 0 }}>{c.iso2}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.country}</span>
              <div style={{ width: 40, height: 3, background: 'var(--border)', borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${barW}%`, height: '100%', background: 'var(--red)', borderRadius: 1 }} />
              </div>
              <span style={{ fontSize: 9, color: 'var(--text2)', fontWeight: 700, width: 46, textAlign: 'right', flexShrink: 0 }}>
                {formatPersonnel(c.personnel)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Infrastructure Access Panel — ranked by electricity access (World Bank) ──
export function InfraIndicatorsPanel({ onCountryClick }: { onCountryClick?: (country: string) => void }) {
  const [ranking, setRanking] = useState<CountryInfraEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchInfraIndicatorRanking()
      .then(r => { setRanking(r); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const filtered = search.trim()
    ? ranking.filter(c => c.country.toLowerCase().includes(search.toLowerCase()) || c.iso2.toLowerCase().includes(search.toLowerCase()))
    : ranking

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
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        Ranked by access to electricity · World Bank (World Development Indicators)
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {loading && <div style={{ fontSize: 9.5, color: 'var(--text2)', padding: '8px 0', fontStyle: 'italic' }}>Loading World Bank data…</div>}
        {error && <div style={{ fontSize: 9.5, color: 'var(--red)', padding: '8px 0' }}>Failed to load World Bank data.</div>}
        {filtered.map(c => (
          <button
            key={c.iso2}
            onClick={() => onCountryClick?.(c.country)}
            style={{
              width: '100%', textAlign: 'left', background: 'none', border: 'none',
              borderBottom: '1px solid var(--border)', padding: '3.5px 0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 9, color: 'var(--text3)', width: 22, flexShrink: 0, textAlign: 'right' }}>#{c.rank}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--blue)', width: 20, flexShrink: 0 }}>{c.iso2}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.country}</span>
            <div style={{ width: 40, height: 3, background: 'var(--border)', borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ width: `${c.electricityAccessPct}%`, height: '100%', background: 'var(--blue)', borderRadius: 1 }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--text2)', fontWeight: 700, width: 46, textAlign: 'right', flexShrink: 0 }}>
              {formatInfraValue('EG.ELC.ACCS.ZS', c.electricityAccessPct)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Our World in Data Panel — agriculture, violence & war, energy & environment, innovation & tech ──
const OWID_TOPICS: OwidTopic[] = ['agriculture', 'violence', 'energy', 'innovation']

export function OwidPanel({ onCountryClick }: { onCountryClick?: (country: string) => void }) {
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
      <div style={{ fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)' }}>
        Our World in Data (OECD / UCDP / World Bank / WIPO — most recent year per country)
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
        {loading && <div style={{ fontSize: 9.5, color: 'var(--text2)', padding: '8px 0', fontStyle: 'italic' }}>Loading Our World in Data…</div>}
        {error && <div style={{ fontSize: 9.5, color: 'var(--red)', padding: '8px 0' }}>Failed to load data for this chart.</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ fontSize: 9.5, color: 'var(--text2)', padding: '8px 0', fontStyle: 'italic' }}>No countries match.</div>
        )}
        {filtered.map((v, i) => (
          <button
            key={v.entity}
            onClick={() => onCountryClick?.(v.entity)}
            style={{
              width: '100%', textAlign: 'left', background: 'none', border: 'none',
              borderBottom: '1px solid var(--border)', padding: '3.5px 0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 9, color: 'var(--text3)', width: 22, flexShrink: 0, textAlign: 'right' }}>#{i + 1}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--accent)', width: 26, flexShrink: 0 }}>{v.code}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.entity}</span>
            <div style={{ width: 40, height: 3, background: 'var(--border)', borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ width: `${maxValue ? (v.value / maxValue) * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 1 }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--text2)', fontWeight: 700, width: 52, textAlign: 'right', flexShrink: 0 }}>
              {data ? formatOwidValue(data.unit, v.value) : ''}
            </span>
            <span style={{ fontSize: 8, color: 'var(--text3)', width: 30, textAlign: 'right', flexShrink: 0 }}>{v.year}</span>
          </button>
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
        {loading ? 'Loading…' : error ? 'Failed to load' : `${filtered.length} facilities`}
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
