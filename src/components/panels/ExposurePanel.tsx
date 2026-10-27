import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { TRADE_PROFILES } from '../../services/tradeStats'
import { CHOKEPOINTS, EIA_CHOKEPOINTS_SOURCE } from '../../services/chokepoints'
import { countryAnalytics, showDerivedOnMap, sliceOf } from '../../services/countryAnalytics'
import { ISO2_TO_ISO3, ISO3_TO_ISO2 } from '../../services/economies'
import type { IndicatorMeta } from '../../services/countryIndicators'
import { fmtRange, gdpByIso2, mapRows, partnerNames, traceExposure, type ExposureResult, type ExposureRow, type Shock, type Step } from '../../utils/exposure'
import { EvidenceTag, SourceLine, StatusLabel } from '../DataLabels'
import { Method } from './countryLookup/shared'
import type { MapLinkProps } from './countryDataShared'

const GDP_ID = 'NY.GDP.MKTP.CD'
type Kind = Shock['kind']
const KINDS: { id: Kind; label: string }[] = [
  { id: 'demand', label: 'Demand falls in…' },
  { id: 'supply', label: 'Supply cut from…' },
  { id: 'oil', label: 'Oil chokepoint' },
]
const OIL_CHOKEPOINTS = CHOKEPOINTS.filter(c => c.oilFlowMbd != null)
const PARTNERS = partnerNames(TRADE_PROFILES)
const YEAR_OF = new Map(TRADE_PROFILES.map(p => [p.iso2, String(p.year)]))

function PathSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="ex-path">
      {steps.map((s, i) => (
        <li key={i}>
          <EvidenceTag kind={s.kind} />
          <div>
            <div>{s.text}</div>
            {s.source && <SourceLine source={s.source} asOf={s.year} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Row({ r, rank, open, onToggle, oil }: { r: ExposureRow; rank: number; open: boolean; onToggle: () => void; oil: boolean }) {
  return (
    <>
      <tr className={`ex-row ${open ? 'open' : ''}`} onClick={onToggle} aria-expanded={open}>
        <td>{rank}</td>
        <th scope="row">{open ? '▾' : '▸'} {r.name}</th>
        <td>{oil && r.net ? fmtRange(r.net.lo, r.net.hi) : fmtRange(r.lo, r.hi)}{r.bounded && <span className="ex-bound" title="A share outside the top-6 lists is only known to be below the smallest listed one"> range</span>}</td>
        {oil && <td className={r.direction === 'loss' ? 'ex-loss' : r.direction === 'gain' ? 'ex-gain' : ''}>{r.direction === 'loss' ? 'Net importer' : r.direction === 'gain' ? 'Net exporter' : 'Unclear'}</td>}
        <td>{r.effect ? fmtRange(r.effect.lo, r.effect.hi) : '—'}</td>
      </tr>
      {open && <tr className="ex-detail"><td colSpan={oil ? 5 : 4}><PathSteps steps={r.path} /></td></tr>}
    </>
  )
}

/**
 * Shock Exposure: pick a shock, see which economies it reaches through sourced trade links, and inspect the path behind
 * each one — every step labelled as observed data or as an assumption the shock makes.
 */
export default function ExposurePanel({ panelState, onToggleLayer }: MapLinkProps) {
  const [kind, setKind] = useState<Kind>('demand')
  const [partner, setPartner] = useState('China')
  const [chokeId, setChokeId] = useState(() => (OIL_CHOKEPOINTS.find(c => /hormuz/i.test(c.name)) ?? OIL_CHOKEPOINTS[0])?.id ?? '')
  const [size, setSize] = useState('')
  const [openRow, setOpenRow] = useState<string | null>(null)

  const gdpSlice = useSyncExternalStore(countryAnalytics.subscribe, () => sliceOf(countryAnalytics.getState(), GDP_ID))
  useEffect(() => { void countryAnalytics.load(GDP_ID) }, [])
  const gdp = useMemo(() => gdpByIso2(gdpSlice.rows, ISO3_TO_ISO2), [gdpSlice.rows])

  const sizeNum = Number(size)
  const shock = useMemo<Shock | null>(() => {
    const s = size.trim() && Number.isFinite(sizeNum) ? sizeNum : undefined
    if (kind === 'oil') {
      const c = OIL_CHOKEPOINTS.find(x => x.id === chokeId)
      return c ? { kind, chokepoint: c, pricePct: s } : null
    }
    return { kind, partner, sizePct: s }
  }, [kind, partner, chokeId, size, sizeNum])

  const res: ExposureResult | null = useMemo(
    () => (shock && gdpSlice.status === 'ready' ? traceExposure(shock, TRADE_PROFILES, gdp, EIA_CHOKEPOINTS_SOURCE) : null),
    [shock, gdp, gdpSlice.status],
  )
  const oil = kind === 'oil'

  function showOnMap() {
    if (!res || !shock) return
    const what = shock.kind === 'oil' ? 'Net fuel trade (% of GDP)' : shock.kind === 'demand' ? `Sales to ${shock.partner} (% of GDP)` : `Purchases from ${shock.partner} (% of GDP)`
    const meta: IndicatorMeta = {
      id: `derived:exposure:${shock.kind}:${shock.kind === 'oil' ? shock.chokepoint.id : shock.partner}`,
      label: what, short: shock.kind === 'oil' ? 'Net fuels' : 'Exposure', group: 'Trade & finance',
      source: 'UN Comtrade and World Bank (computed)', scale: 'linear', format: v => fmtRange(v, v),
    }
    showDerivedOnMap(meta, mapRows(res, ISO2_TO_ISO3, iso2 => YEAR_OF.get(iso2) ?? ''))
    if (panelState && onToggleLayer && !panelState.countryAnalytics) onToggleLayer('countryAnalytics')
  }

  return (
    <div className="ex-panel">
      <div className="viz-toggle ex-kinds" role="group" aria-label="Shock type">
        {KINDS.map(k => <button key={k.id} className={kind === k.id ? 'on' : ''} aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setOpenRow(null) }}>{k.label}</button>)}
      </div>

      <div className="ex-controls">
        {oil ? (
          <label>Chokepoint
            <select value={chokeId} onChange={e => setChokeId(e.target.value)}>
              {OIL_CHOKEPOINTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        ) : (
          <label>{kind === 'demand' ? 'Buyer' : 'Supplier'}
            <select value={partner} onChange={e => setPartner(e.target.value)}>
              {PARTNERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}
        <label title="Optional. An assumption you set, not a forecast">{oil ? 'Assumed fuel price change, %' : 'Assumed fall, %'}
          <input type="number" inputMode="decimal" value={size} placeholder="none" onChange={e => setSize(e.target.value)} />
        </label>
      </div>

      {gdpSlice.status === 'error' && <StatusLabel status="error">World Bank GDP could not be loaded{gdpSlice.error ? ` (${gdpSlice.error})` : ''}, so nothing can be scaled to GDP.</StatusLabel>}
      {(gdpSlice.status === 'idle' || gdpSlice.status === 'loading') && <StatusLabel status="loading">World Bank GDP…</StatusLabel>}

      {res && (
        <section className="viz-card" aria-label={res.title}>
          <header className="viz-head">
            <div style={{ minWidth: 0 }}>
              <h3 className="viz-title">{res.title}</h3>
              <p className="viz-sub">How the shock travels. Each step says whether it is reported data or an assumption.</p>
            </div>
            {panelState && onToggleLayer && (
              <button className="cy-btn" onClick={showOnMap} title="Shade the map's countries by this exposure (exact values only)" style={{ flexShrink: 0 }}>
                <MapIcon size={11} /> Show on map
              </button>
            )}
          </header>
          <PathSteps steps={res.shared} />

          <div className="viz-table-wrap ex-table-wrap">
            <table className="viz-table">
              <thead><tr>
                <th scope="col">#</th><th scope="col">Economy</th>
                <th scope="col">{oil ? 'Net fuel trade, % GDP' : `${kind === 'demand' ? 'Sales to' : 'Bought from'} ${partner}, % GDP`}</th>
                {oil && <th scope="col">A higher price…</th>}
                <th scope="col">Assumed-shock effect, % GDP</th>
              </tr></thead>
              <tbody>
                {res.rows.map((r, i) => <Row key={r.iso2} r={r} rank={i + 1} oil={oil} open={openRow === r.iso2} onToggle={() => setOpenRow(o => o === r.iso2 ? null : r.iso2)} />)}
              </tbody>
            </table>
          </div>
          <div className="viz-foot">
            Click an economy for its full path. {res.rows.length} of the {TRADE_PROFILES.length} economies with UN Comtrade profiles ranked
            {res.skipped.length > 0 && <> ({res.skipped.length} skipped: {res.skipped.map(s => s.name).join(', ')}, no GDP figure)</>}; every other economy is not covered.
          </div>
          <Method caveats={<ul className="ex-caveats">{res.caveats.map(c => <li key={c}>{c}</li>)}</ul>}>
            Arithmetic on reported figures: a partner's or product's share of goods trade × that trade as a share of GDP. Nothing is estimated or forecast;
            the shock size, when given, is your assumption and its effect is first-order.
          </Method>
        </section>
      )}
    </div>
  )
}
