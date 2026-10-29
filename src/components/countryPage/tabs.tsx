import { Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { WEO_FOR_WB, fetchWeo, vintageYear, weoPoints, type WeoPayload } from '../../services/imfWeo'
import { ISO2_TO_ISO3, ISO3_TO_ISO2 } from '../../services/economies'
import { NOWCAST_ECONOMIES, fetchNowcastData } from '../../services/eurostatNowcast'
import { TRADE_PROFILES } from '../../services/tradeStats'
import { CHOKEPOINTS, EIA_CHOKEPOINTS_SOURCE } from '../../services/chokepoints'
import { countryAnalytics, sliceOf } from '../../services/countryAnalytics'
import { nowcast, type Nowcast } from '../../utils/nowcast'
import { fmtRange, gdpByIso2, traceExposure } from '../../utils/exposure'
import { focusCountry } from '../../utils/focusCountry'
import { Metric, SectionLabel, StatusLabel } from '../DataLabels'

const PredictionsPanel = lazy(() => import('../panels/PredictionsPanel').then(m => ({ default: m.PredictionsPanel })))

const signed = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}`
// growth and inflation are rates of change and carry a sign; unemployment is a level and doesn't
const SERIES: { wb: string; label: string; change: boolean }[] = [
  { wb: 'NY.GDP.MKTP.KD.ZG', label: 'Real GDP growth', change: true },
  { wb: 'FP.CPI.TOTL.ZG', label: 'Inflation', change: true },
  { wb: 'SL.UEM.TOTL.ZS', label: 'Unemployment', change: false },
]
/** Eurostat writes Greece as EL; every other member uses its ISO code. */
const eurostatGeo = (iso2: string) => (iso2 === 'GR' ? 'EL' : iso2)

function GoButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button className="cp-go" onClick={onClick}>{children} <ArrowRight size={12} /></button>
}

/** IMF projections for this country, the GDP nowcast where Eurostat covers it, and the way into the full panels. */
export function ForecastsTab({ country, iso2, onOpenPanel }: { country: string; iso2: string | null; onOpenPanel: (id: string) => void }) {
  const [weo, setWeo] = useState<Record<string, WeoPayload | null> | null>(null)
  const [nc, setNc] = useState<{ status: 'none' | 'loading' | 'ready' | 'error'; value?: Nowcast | null }>({ status: 'none' })
  const geo = iso2 ? eurostatGeo(iso2) : null
  const inEu = !!geo && NOWCAST_ECONOMIES.some(e => e.geo === geo)

  useEffect(() => {
    let live = true
    setWeo(null)
    void Promise.all(SERIES.map(s => fetchWeo(WEO_FOR_WB[s.wb]))).then(r => { if (live) setWeo(Object.fromEntries(SERIES.map((s, i) => [s.wb, r[i]]))) })
    return () => { live = false }
  }, [country])
  useEffect(() => {
    if (!inEu || !geo) { setNc({ status: 'none' }); return }
    let live = true
    setNc({ status: 'loading' })
    fetchNowcastData(geo).then(d => { if (live) setNc({ status: 'ready', value: nowcast(d.gdp, d.ip) }) }, () => { if (live) setNc({ status: 'error' }) })
    return () => { live = false }
  }, [geo, inEu])

  const iso3 = iso2 ? ISO2_TO_ISO3.get(iso2) : undefined
  return (
    <>
      <SectionLabel>Outside benchmark · IMF World Economic Outlook</SectionLabel>
      {weo === null ? <StatusLabel status="loading">IMF projections…</StatusLabel> : (
        <div className="viz-kpis">
          {SERIES.map(s => {
            const w = weo[s.wb]
            const y = w ? vintageYear(w.vintage) ?? new Date().getUTCFullYear() : null
            const pts = w && iso3 && y ? weoPoints(w, iso3, [y, y + 1]) : []
            const [now, next] = pts
            const f = (v: number) => (s.change ? signed(v) : v.toFixed(1))
            return (
              <Metric key={s.wb} label={`${s.label}${now ? `, ${now.year}` : ''}`} evidence="statistical"
                value={now ? f(now.value) : '—'} unit={now ? '%' : undefined}
                detail={!w ? 'The IMF figures could not be loaded' : !now ? 'Not published by the IMF for this economy' : next ? `${next.year}: ${f(next.value)}% · the IMF's projection, not a measurement` : "the IMF's projection, not a measurement"}
                asOf={w ? w.vintage : undefined} />
            )
          })}
        </div>
      )}

      {inEu && (
        <>
          <SectionLabel>This quarter, before it is published · GDP nowcast</SectionLabel>
          {nc.status === 'loading' && <StatusLabel status="loading">Eurostat GDP and industrial production…</StatusLabel>}
          {nc.status === 'error' && <StatusLabel status="error">Eurostat could not be reached, so there is no nowcast right now.</StatusLabel>}
          {nc.status === 'ready' && !nc.value && <StatusLabel status="empty">No industrial production month is out yet for the next quarter.</StatusLabel>}
          {nc.status === 'ready' && nc.value && (
            <div className="viz-kpis">
              <Metric label={`${nc.value.quarter} GDP growth, nowcast`} evidence="statistical" value={signed(nc.value.value)} unit="% q/q"
                range={nc.value.range !== null ? `80% range ${signed(nc.value.value - nc.value.range)} to ${signed(nc.value.value + nc.value.range)}%` : undefined}
                detail={nc.value.headline === 'model' ? 'Bridge model on industrial production; it passed the backtest rule' : '"Same as last quarter": the model did not pass the backtest rule here'}
                asOf={`${nc.value.known} of 3 months of industrial production`} />
            </div>
          )}
          <GoButton onClick={() => { focusCountry('nowcast', geo!); onOpenPanel('nowcast') }}>Backtest and method for {country} in GDP Nowcast</GoButton>
        </>
      )}

      <SectionLabel>Our forecasts</SectionLabel>
      {iso2
        ? <Suspense fallback={<StatusLabel status="loading">Forecasts for {country}…</StatusLabel>}><PredictionsPanel iso2={iso2} /></Suspense>
        : <StatusLabel status="empty">No country code for {country}, so there is no forecast to compute.</StatusLabel>}
      {iso2 && <GoButton onClick={() => { focusCountry('predictions', iso2); onOpenPanel('predictions') }}>Open {country} in Predictions</GoButton>}
    </>
  )
}

const GDP_ID = 'NY.GDP.MKTP.CD'

/** This country's own exposure figures from the Shock Exposure engine, then the trade profile sections. */
export function TradeTab({ country, iso2, onOpenPanel }: { country: string; iso2: string | null; onOpenPanel: (id: string) => void }) {
  const profile = iso2 ? TRADE_PROFILES.find(p => p.iso2 === iso2) ?? null : null
  const gdpSlice = useSyncExternalStore(countryAnalytics.subscribe, () => sliceOf(countryAnalytics.getState(), GDP_ID))
  useEffect(() => { if (profile) void countryAnalytics.load(GDP_ID) }, [profile])
  const gdp = useMemo(() => gdpByIso2(gdpSlice.rows, ISO3_TO_ISO2), [gdpSlice.rows])

  const figures = useMemo(() => {
    if (!profile || gdpSlice.status !== 'ready') return null
    const hormuz = CHOKEPOINTS.find(c => /hormuz/i.test(c.name) && c.oilFlowMbd != null)
    const buyer = profile.topExportPartners[0]?.country
    const supplier = profile.topImportPartners[0]?.country
    const row = (r: ReturnType<typeof traceExposure>) => r.rows.find(x => x.iso2 === profile.iso2) ?? null
    return {
      oil: hormuz ? row(traceExposure({ kind: 'oil', chokepoint: hormuz }, TRADE_PROFILES, gdp, EIA_CHOKEPOINTS_SOURCE)) : null,
      buyer: buyer ? { name: buyer, row: row(traceExposure({ kind: 'demand', partner: buyer }, TRADE_PROFILES, gdp, EIA_CHOKEPOINTS_SOURCE)) } : null,
      supplier: supplier ? { name: supplier, row: row(traceExposure({ kind: 'supply', partner: supplier }, TRADE_PROFILES, gdp, EIA_CHOKEPOINTS_SOURCE)) } : null,
    }
  }, [profile, gdp, gdpSlice.status])

  return (
    <>
      <SectionLabel>Exposure · share of {country}'s own GDP</SectionLabel>
      {!profile ? <StatusLabel status="empty">No UN Comtrade profile for {country}: exposure covers the 45 economies with one.</StatusLabel>
        : gdpSlice.status === 'error' ? <StatusLabel status="error">World Bank GDP could not be loaded, so exposure can't be scaled to the economy.</StatusLabel>
        : !figures ? <StatusLabel status="loading">World Bank GDP…</StatusLabel>
        : (
          <div className="viz-kpis">
            {figures.buyer?.row && <Metric label={`Sales to ${figures.buyer.name}, its top buyer`} evidence="observed" value={fmtRange(figures.buyer.row.lo, figures.buyer.row.hi, '')} unit="% of GDP" asOf={`UN Comtrade ${profile.year} · World Bank GDP`} />}
            {figures.supplier?.row && <Metric label={`Purchases from ${figures.supplier.name}, its top supplier`} evidence="observed" value={fmtRange(figures.supplier.row.lo, figures.supplier.row.hi, '')} unit="% of GDP" asOf={`UN Comtrade ${profile.year} · World Bank GDP`} />}
            {figures.oil?.net && (
              <Metric label="Net fuel trade" evidence="observed" value={fmtRange(figures.oil.net.lo, figures.oil.net.hi, '')} unit="% of GDP"
                tone={figures.oil.direction === 'loss' ? 'down' : figures.oil.direction === 'gain' ? 'up' : 'neutral'}
                detail={figures.oil.direction === 'loss' ? 'Net importer: a higher oil price costs it' : figures.oil.direction === 'gain' ? 'Net exporter: a higher oil price pays it' : 'Too uncertain to say which way a higher price cuts'}
                asOf={`UN Comtrade ${profile.year}, HS 27`} />
            )}
          </div>
        )}
      <GoButton onClick={() => onOpenPanel('exposure')}>Trace a shock to {country} step by step in Shock Exposure</GoButton>
    </>
  )
}
