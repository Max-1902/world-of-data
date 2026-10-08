/** Trade and economics sections of the country drawer. */
import type { CrisisEvent } from '../../types'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS } from '../../services/sanctions'
import { CHOKEPOINTS } from '../../services/chokepoints'
import { formatEconValue, groupIndicators, type CountryEconData } from '../../services/worldbank'
import { TRADE_PROFILES, getTradeProfile } from '../../services/tradeStats'
import { Section, matchCountry, soft } from './parts'

export function TradeSections({ country, crises, linkedCrises }: { country: string; crises: CrisisEvent[]; linkedCrises: CrisisEvent[] }) {
  return (
    <>
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
          <Section title="TRADE INTELLIGENCE" color="var(--series-3)">
            {/* Key metrics row */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 5, flexWrap: 'wrap' }}>
              {trade.tradeBalance != null && (
                <div style={{ padding: '3px 5px', background: soft(trade.tradeBalance >= 0 ? 'var(--green)' : 'var(--red)', 8), borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>BALANCE</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: trade.tradeBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {trade.tradeBalance >= 0 ? '+' : ''}{trade.tradeBalance}B
                  </div>
                </div>
              )}
              {trade.tradeToGDP != null && (
                <div style={{ padding: '3px 5px', background: soft('var(--blue)', 8), borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>TRADE/GDP</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--blue)' }}>{trade.tradeToGDP}%</div>
                </div>
              )}
              <div style={{ padding: '3px 5px', background: soft('var(--series-5)', 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>INCOME</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--series-5)' }}>{trade.incomeGroup.toUpperCase()}</div>
              </div>
              <div style={{ padding: '3px 5px', background: soft('var(--series-4)', 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>CURRENCY</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--series-4)' }}>{trade.currency}</div>
              </div>
            </div>

            {/* Trade blocs */}
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 5 }}>
              {trade.tradeBlocs.map(b => (
                <span key={b} style={{ fontSize: 9, padding: '0 4px', color: 'var(--series-3)', background: soft('var(--series-3)'), borderRadius: 3 }}>{b}</span>
              ))}
            </div>

            {/* Top export partners */}
            <div style={{ fontSize: 10, color: 'var(--green)', letterSpacing: '.1em', marginBottom: 2 }}>TOP EXPORT PARTNERS</div>
            {trade.topExportPartners.slice(0, 5).map(p => (
              <div key={p.country} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 11 }}>
                <span style={{ color: 'var(--text2)', width: 65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.country}</span>
                <Bar pct={p.pct * 2} color="var(--green)" />
                <span style={{ color: 'var(--green)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 28, textAlign: 'right', flexShrink: 0 }}>{p.pct}%</span>
              </div>
            ))}

            {/* Top import partners */}
            <div style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '.1em', marginTop: 4, marginBottom: 2 }}>TOP IMPORT PARTNERS</div>
            {trade.topImportPartners.slice(0, 5).map(p => (
              <div key={p.country} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 11 }}>
                <span style={{ color: 'var(--text2)', width: 65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.country}</span>
                <Bar pct={p.pct * 2} color="var(--amber)" />
                <span style={{ color: 'var(--amber)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 28, textAlign: 'right', flexShrink: 0 }}>{p.pct}%</span>
              </div>
            ))}

            {/* Top exports */}
            <div style={{ fontSize: 10, color: 'var(--blue)', letterSpacing: '.1em', marginTop: 4, marginBottom: 2 }}>TOP EXPORTS</div>
            {trade.topExports.slice(0, 5).map(p => (
              <div key={p.product} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 11 }}>
                <span style={{ color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product}</span>
                <span style={{ color: 'var(--blue)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{p.pct}%</span>
              </div>
            ))}

            {/* Top imports */}
            <div style={{ fontSize: 10, color: 'var(--series-5)', letterSpacing: '.1em', marginTop: 4, marginBottom: 2 }}>TOP IMPORTS</div>
            {trade.topImports.slice(0, 5).map(p => (
              <div key={p.product} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: 11 }}>
                <span style={{ color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product}</span>
                <span style={{ color: 'var(--series-5)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{p.pct}%</span>
              </div>
            ))}

            {/* Dependencies / vulnerabilities */}
            {trade.dependencies && trade.dependencies.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: 'var(--red)', letterSpacing: '.1em', marginTop: 4, marginBottom: 2 }}>KEY DEPENDENCIES</div>
                {trade.dependencies.map(d => (
                  <div key={d} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ color: soft('var(--red)', 53), fontSize: 9 }}>▸</span>{d}
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
          <Section title="SANCTIONS EXPOSURE" color="var(--red)">
            <div style={{ fontSize: 11, color: totalExposure > 15 ? 'var(--red)' : 'var(--amber)', fontWeight: 700, marginBottom: 3 }}>
              {totalExposure.toFixed(1)}% trade with sanctioned states
            </div>
            {sanctionedPartners.map(p => (
              <div key={`${p.direction}-${p.country}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '1px 0' }}>
                <span style={{ fontSize: 9, color: p.direction === 'export' ? 'var(--green)' : 'var(--amber)', background: soft(p.direction === 'export' ? 'var(--green)' : 'var(--amber)'), padding: '0 3px', borderRadius: 3 }}>
                  {p.direction === 'export' ? 'EXP' : 'IMP'}
                </span>
                <span style={{ color: 'var(--text2)', flex: 1 }}>{p.country}</span>
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>{p.pct}%</span>
                <span style={{ fontSize: 9, color: SANCTION_COLORS[p.sanction.severity], border: `1px solid ${soft(SANCTION_COLORS[p.sanction.severity], 27)}`, padding: '0 3px', borderRadius: 3 }}>
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
          'crude petroleum': { benchmark: 'Brent Crude', color: 'var(--amber)' },
          'refined petroleum': { benchmark: 'Brent Crude', color: 'var(--amber)' },
          'natural gas': { benchmark: 'Henry Hub / TTF', color: 'var(--green)' },
          'iron ore': { benchmark: 'Iron Ore 62% Fe', color: 'var(--series-2)' },
          'coal': { benchmark: 'Newcastle Coal', color: 'var(--text3)' },
          'copper': { benchmark: 'LME Copper', color: 'var(--amber)' },
          'soybeans': { benchmark: 'CBOT Soybeans', color: 'var(--series-3)' },
          'wheat': { benchmark: 'CBOT Wheat', color: 'var(--amber)' },
          'gold': { benchmark: 'LBMA Gold', color: 'var(--series-4)' },
          'lithium batteries': { benchmark: 'Lithium Carbonate', color: 'var(--green)' },
          'solar panels': { benchmark: 'Polysilicon Spot', color: 'var(--blue)' },
          'semiconductors': { benchmark: 'SOX Index', color: 'var(--series-3)' },
        }
        const linked = trade.topExports.filter(e =>
          Object.keys(COMMODITY_MAP).some(k => e.product.toLowerCase().includes(k))
        ).map(e => {
          const key = Object.keys(COMMODITY_MAP).find(k => e.product.toLowerCase().includes(k))!
          return { product: e.product, pct: e.pct, ...COMMODITY_MAP[key] }
        })
        if (linked.length === 0) return null
        return (
          <Section title="COMMODITY EXPOSURE" color="var(--series-4)">
            {linked.map(l => (
              <div key={l.product} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '1.5px 0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text2)', flex: 1 }}>{l.product}</span>
                <span style={{ color: l.color, fontSize: 10, fontWeight: 600 }}>{l.benchmark}</span>
                <span style={{ color: 'var(--series-4)', fontWeight: 700, width: 28, textAlign: 'right', flexShrink: 0 }}>{l.pct}%</span>
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
        const riskColor = riskLevel === 'HIGH' ? 'var(--red)' : riskLevel === 'ELEVATED' ? 'var(--amber)' : 'var(--series-4)'
        return (
          <Section title="CURRENCY RISK" color={riskColor}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 3, flexWrap: 'wrap' }}>
              <div style={{ padding: '2px 5px', background: soft(riskColor, 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>FX RISK</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: riskColor }}>{riskLevel}</div>
              </div>
              <div style={{ padding: '2px 5px', background: soft('var(--blue)', 8), borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.1em' }}>OPENNESS</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)' }}>{trade.tradeToGDP ?? '?'}%</div>
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
          <Section title="CONFLICT–TRADE CORRELATION" color="var(--red)">
            {atRiskPartners.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '.1em', marginBottom: 2 }}>TRADE PARTNERS IN CRISIS</div>
                {atRiskPartners.slice(0, 4).map(p => (
                  <div key={`${p.dir}-${p.country}`} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', display: 'flex', gap: 4 }}>
                    <span style={{ color: soft('var(--red)', 53), fontSize: 9 }}>▸</span>
                    <span style={{ flex: 1 }}>{p.country} ({p.dir} {p.pct}%)</span>
                  </div>
                ))}
              </>
            )}
            {nearbyChokepoints.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: 'var(--red)', letterSpacing: '.1em', marginTop: 3, marginBottom: 2 }}>THREATENED CHOKEPOINTS</div>
                {nearbyChokepoints.map(cp => (
                  <div key={cp.id} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', display: 'flex', gap: 4 }}>
                    <span style={{ color: soft('var(--red)', 53), fontSize: 9 }}>▸</span>
                    <span style={{ flex: 1 }}>{cp.name}{cp.transits ? ` (${cp.transits.avgDaily} ships/day, ${cp.transits.year})` : ''}</span>
                  </div>
                ))}
              </>
            )}
            {dependents.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '.1em', marginTop: 3, marginBottom: 2 }}>DOWNSTREAM IMPACT</div>
                {dependents.slice(0, 4).map(d => {
                  const dep = d.topImportPartners.find(p => matchCountry(p.country, country.toLowerCase()))
                  return (
                    <div key={d.iso2} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', display: 'flex', gap: 4 }}>
                      <span style={{ color: soft('var(--amber)', 53), fontSize: 9 }}>▸</span>
                      <span style={{ flex: 1 }}>{d.name} depends on imports ({dep?.pct}%)</span>
                    </div>
                  )
                })}
              </>
            )}
          </Section>
        )
      })()}
    </>
  )
}

export function EconomicDataSection({ econData, econLoading }: { econData: CountryEconData | null; econLoading: boolean }) {
  return (
    <>
      {/* ── Economic Data (World Bank) ────────────────────── */}
      {econLoading && (
        <Section title="ECONOMIC DATA" color="var(--blue)">
          <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Loading World Bank data…</div>
        </Section>
      )}
      {econData && econData.indicators.length > 0 && (() => {
        const groups = groupIndicators(econData.indicators)
        return (
          <Section title="ECONOMIC DATA" color="var(--blue)">
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
                  let valColor = 'var(--blue)'
                  if (isGrowth) valColor = val >= 0 ? 'var(--green)' : 'var(--red)'
                  if (isNegative && val > 10) valColor = 'var(--amber)'
                  return (
                    <div key={ind.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', fontSize: 11 }}>
                      <span style={{ color: 'var(--text2)' }}>{ind.label}</span>
                      <span style={{ color: valColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter, -apple-system, sans-serif' }}>
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
    </>
  )
}
