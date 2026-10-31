import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { NOWCAST_ECONOMIES, fetchNowcastData, type NowcastData } from '../../services/eurostatNowcast'
import { BACKTEST_FROM, MIN_SCORED, SPLIT, backtestNowcast, monthsOf, nextQuarter, nowcast, scoreLastQuarter, type Backtest, type Quarter, type Scorecard } from '../../utils/nowcast'
import { ChartFrame } from '../charts/ChartFrame'
import { LineChart } from '../charts/LineChart'
import { Metric, StatusLabel } from '../DataLabels'
import { Method } from './countryLookup/shared'
import { onFocusCountry, storedFocus } from '../../utils/focusCountry'

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pct = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}`
const r2 = (v: number) => v.toFixed(2)
/** mid-quarter timestamp, so quarters plot on the time axis */
const qTime = (q: Quarter) => Date.UTC(Number(q.slice(0, 4)), (Number(q.slice(6)) - 1) * 3 + 1, 15)
const monthName = (m: string) => `${MONTH[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

function useNowcastData(geo: string) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data?: NowcastData; error?: string }>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    fetchNowcastData(geo).then(
      data => { if (live) setState({ status: 'ready', data }) },
      e => { if (live) setState({ status: 'error', error: e instanceof Error ? e.message : String(e) }) },
    )
    return () => { live = false }
  }, [geo, tick])
  return { ...state, retry: () => setTick(t => t + 1) }
}

/** Eurostat usually publishes a month's industrial production about six weeks after it ends. */
function ipDue(m: string): string {
  const i = Number(m.slice(5, 7)) + 1, y = Number(m.slice(0, 4)) + (i >= 12 ? 1 : 0)
  return `mid-${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][i % 12]} ${y}`
}

/** Between a GDP release and the next quarter's first IP month: what the nowcast said for the quarter just published. */
function GapView({ lastQ, sc, updated }: { lastQ: Quarter; sc: Scorecard | null; updated: string | null }) {
  const next = nextQuarter(lastQ), first = monthsOf(next)[0]
  const months = sc ? monthsOf(sc.quarter).slice(0, sc.said.known).map(monthName) : []
  const miss = sc ? sc.actual - sc.said.value : 0
  return <>
    <StatusLabel status="empty">
      {lastQ} GDP is published, and no industrial production month for {next} is out yet, so there is no {next} nowcast.
      {' '}{monthName(first).split(' ')[0]}'s figure, the first one, usually comes about six weeks after the month ends (around {ipDue(first)}).
    </StatusLabel>
    {sc && <>
      <div className="viz-kpis">
        <Metric label={`${sc.quarter} nowcast`} value={pct(sc.said.value)} unit="% q/q" evidence="statistical"
          range={sc.said.range !== null ? `80% range ${pct(sc.said.value - sc.said.range)} to ${pct(sc.said.value + sc.said.range)}%` : 'range: too few past errors'}
          asOf={`${sc.said.known} of 3 months of industrial production (${months.join(', ')})`}
          detail={sc.said.headline === 'model' ? 'Bridge model on industrial production' : '"Same as last quarter": the model did not pass the backtest rule here'} />
        <Metric label={`${sc.quarter} published`} value={pct(sc.actual)} unit="% q/q" evidence="observed" asOf={updated ? `Eurostat, updated ${updated.slice(0, 10)}` : 'Eurostat'} />
      </div>
      <p className="viz-verdict">
        With the {months.join(' and ')} figures, the nowcast for {sc.quarter} was <b>{pct(sc.said.value)}%</b>; Eurostat has published <b>{pct(sc.actual)}%</b>,
        {' '}{Math.abs(miss) < 0.05 ? 'the same to one decimal' : <>{Math.abs(miss).toFixed(1)} points {miss > 0 ? 'higher' : 'lower'}</>}
        {sc.inRange === null ? '.' : sc.inRange ? ', inside its 80% range.' : ', outside its 80% range (about 1 quarter in 5 should be).'}
        {' '}One quarter says little about the method; the backtest is the real test.
      </p>
      <Method caveats={<>Re-run on today's figures with the data cut back to just before the {sc.quarter} release, so it can differ slightly from what the panel showed live: Eurostat revises both series. The first GDP estimate is itself revised later.</>}>
        The same rule as the live nowcast, given earlier GDP quarters and the first {sc.said.known} months of {sc.quarter} industrial production, which is what is normally out when the GDP flash estimate lands.
      </Method>
    </>}
  </>
}

function BacktestTable({ rows }: { rows: Backtest[] }) {
  const cell = (s: Backtest['early']) => s ? `${r2(s.rmseModel)} vs ${r2(s.rmseNaive)} (${s.n})` : '—'
  return (
    <div className="viz-table-wrap">
      <table className="viz-table">
        <thead><tr>
          <th scope="col">Months of IP known</th><th scope="col">{BACKTEST_FROM.slice(0, 4)}–{Number(SPLIT.slice(0, 4)) - 1}</th>
          <th scope="col">{SPLIT.slice(0, 4)} on</th><th scope="col">2020–21 (not counted)</th><th scope="col">Model qualifies?</th>
        </tr></thead>
        <tbody>{rows.map(b => (
          <tr key={b.known}><th scope="row">{b.known}</th><td>{cell(b.early)}</td><td>{cell(b.late)}</td><td>{cell(b.pandemic)}</td><td>{b.modelQualifies ? 'yes' : 'no'}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}

/**
 * GDP nowcast: this quarter's real GDP growth for an EU economy before Eurostat publishes it, from the industrial
 * production months already out. Model, baseline, backtest and headline rule are fixed in utils/nowcast.ts.
 */
export default function NowcastPanel() {
  const [geo, setGeo] = useState(() => { const g = storedFocus('nowcast'); return g && NOWCAST_ECONOMIES.some(e => e.geo === g) ? g : 'DE' })
  useEffect(() => onFocusCountry('nowcast', g => { if (NOWCAST_ECONOMIES.some(e => e.geo === g)) setGeo(g) }), [])
  const name = NOWCAST_ECONOMIES.find(e => e.geo === geo)?.name ?? geo
  const d = useNowcastData(geo)
  const nc = useMemo(() => (d.data ? nowcast(d.data.gdp, d.data.ip) : null), [d.data])
  const sc = useMemo(() => (d.data && !nc ? scoreLastQuarter(d.data.gdp, d.data.ip) : null), [d.data, nc])
  const allK = useMemo(() => (d.data && nc ? ([1, 2, 3] as const).map(k => k === nc.known ? nc.backtest : backtestNowcast(d.data!.gdp, d.data!.ip, k)) : []), [d.data, nc])

  const months = nc ? monthsOf(nc.quarter).slice(0, nc.known).map(monthName) : []
  // 16 quarters: enough to see the recent path without the 2020 collapse and rebound flattening everything; the table has more
  const all = d.data ? [...d.data.gdp].sort((a, b) => a[0].localeCompare(b[0])) : []
  const recent = all.slice(-16)
  const lastQ = recent[recent.length - 1]

  return (
    <div className="viz-root cl-root">
      <label className="viz-field">
        <span>Economy</span>
        <select className="viz-select" value={geo} onChange={e => setGeo(e.target.value)} aria-label="Economy">
          {NOWCAST_ECONOMIES.map(e => <option key={e.geo} value={e.geo}>{e.name}</option>)}
        </select>
      </label>

      {d.status === 'loading' && <StatusLabel status="loading">Eurostat GDP and industrial production for {name}…</StatusLabel>}
      {d.status === 'error' && <StatusLabel status="error">Eurostat could not be reached ({d.error}). <button className="cy-btn" onClick={d.retry}><RefreshCw size={11} /> Retry</button></StatusLabel>}
      {d.status === 'ready' && !nc && (lastQ
        ? <GapView lastQ={lastQ[0]} sc={sc} updated={d.data!.updated.gdp} />
        : <StatusLabel status="empty">Eurostat returned no GDP figures for {name}, so there is nothing to nowcast.</StatusLabel>)}

      {nc && d.data && (
        <ChartFrame
          title={`${name}: GDP growth this quarter, before it is published`}
          subtitle={`${nc.quarter} real GDP growth on the previous quarter, from ${nc.known} of 3 months of industrial production`}
          table={{
            columns: ['Quarter', 'Published', 'Nowcast', '80% range'],
            rows: [
              [nc.quarter, '—', `${pct(nc.value)}%`, nc.range !== null ? `${pct(nc.value - nc.range)} to ${pct(nc.value + nc.range)}%` : '—'],
              ...all.slice(-40).reverse().map(([q, v]) => [q, `${pct(v)}%`, '', '']),
            ],
          }}
          footer={<>
            <div className="viz-kpis">
              <Metric label={`${nc.quarter} nowcast`} value={pct(nc.value)} unit="% q/q" evidence="statistical"
                range={nc.range !== null ? `80% range ${pct(nc.value - nc.range)} to ${pct(nc.value + nc.range)}%` : 'range: too few past errors'}
                asOf={`${nc.known} of 3 months of industrial production (${months.join(', ')})`}
                detail={nc.headline === 'model' ? 'Bridge model on industrial production' : `"Same as last quarter": the model did not pass the backtest rule here`} />
              <Metric label={`${nc.naive.from} published`} value={pct(nc.naive.value)} unit="% q/q" evidence="observed" asOf={d.data.updated.gdp ? `Eurostat, updated ${d.data.updated.gdp.slice(0, 10)}` : 'Eurostat'} />
            </div>
            <p className="viz-verdict">
              {nc.headline === 'model'
                ? <>Industrial production so far points to <b>{pct(nc.value)}%</b> growth in {nc.quarter}, against {pct(nc.naive.value)}% in {nc.naive.from}. The model is the headline here because, with {nc.known} month{nc.known > 1 ? 's' : ''} of data known, it beat "same as last quarter" in both test periods.</>
                : <>The headline is "same as last quarter" (<b>{pct(nc.value)}%</b>): with {nc.known} month{nc.known > 1 ? 's' : ''} of data, the bridge model did not beat it in both test periods{nc.model ? <>, so its {pct(nc.model.value)}% is shown for reference only</> : ''}.</>}
              {' '}The 80% range is from the headline method's own past errors: in about 4 of 5 past quarters the published figure fell inside a range this wide.
            </p>
            <BacktestTable rows={allK} />
            <p className="viz-foot">Root-mean-square error, model vs "same as last quarter", in percentage points (number of quarters). The model qualifies only if it wins in both periods with at least {MIN_SCORED} quarters each; 2020–21 is shown but never counted.</p>
            <Method caveats={<>Scored on today's revised figures, not on the data as first published, so the backtest flatters both methods. Industrial production covers mining, manufacturing and energy only; services-led quarters can move differently, and a quarter with 1–2 months fills the missing months with the last one. Rule and model were committed before any real data was scored (commit 5802e09).</>}>
              Bridge equation: GDP growth = a + b × industrial production growth (quarter mean on previous quarter), ordinary least squares, refit before every quarter on all earlier quarters. Baseline: last published growth. Backtest: every quarter from {BACKTEST_FROM} nowcast from earlier data only, with 1, 2 and 3 months of production known.
            </Method>
          </>}>
          <LineChart xKind="time" height={220} ariaLabel={`${name} quarterly GDP growth with the ${nc.quarter} nowcast`}
            fmtX={t => { const dt = new Date(t); return `${dt.getUTCFullYear()}-Q${Math.floor(dt.getUTCMonth() / 3) + 1}` }}
            fmtY={v => `${pct(v)}%`} refLines={[{ v: 0, label: '0' }]}
            forecastBoundary={lastQ ? (qTime(lastQ[0]) + qTime(nc.quarter)) / 2 : undefined} observedLabel="Published" projectedLabel="Nowcast"
            areas={nc.range !== null && lastQ ? [{ key: 'range', label: '80% range', color: 'var(--series-2)', points: [{ t: qTime(lastQ[0]), lo: lastQ[1], hi: lastQ[1] }, { t: qTime(nc.quarter), lo: nc.value - nc.range, hi: nc.value + nc.range }] }] : []}
            series={[
              { key: 'gdp', label: 'Published', color: 'var(--series-1)', points: recent.map(([q, v]) => ({ t: qTime(q), v })), markers: true },
              { key: 'now', label: 'Nowcast', color: 'var(--series-2)', points: lastQ ? [{ t: qTime(lastQ[0]), v: lastQ[1] }, { t: qTime(nc.quarter), v: nc.value }] : [], dashed: true, markers: true },
            ]} />
        </ChartFrame>
      )}
    </div>
  )
}
