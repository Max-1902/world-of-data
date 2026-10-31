import { useEffect, useMemo, useState } from 'react'
import { fetchWeo, type WeoPayload } from '../../services/imfWeo'
import { buildWorldOutlook, worldSentences, type WorldOutlook as Outlook } from '../../utils/worldOutlook'
import { EvidenceTag, Metric, SourceLine, StatusLabel } from '../DataLabels'
import { LineChart } from '../charts/LineChart'
import { ChartFrame, type TableData } from '../charts/ChartFrame'
import { AskAnalystButton } from '../AskAnalyst'

const CHART_FROM = 2000
const f1 = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`
const pct = (v: number | null | undefined) => v == null ? '—' : `${f1(v)}%`

/**
 * The top of the Outlook page: where the world economy is heading, answered with the IMF's World Economic Outlook
 * figures for the world and its main country groups. The country forecast below is this app's own model; this is not.
 */
export function WorldOutlook() {
  const [gdp, setGdp] = useState<WeoPayload | null | 'loading'>('loading')
  const [cpi, setCpi] = useState<WeoPayload | null>(null)
  useEffect(() => {
    let live = true
    void fetchWeo('NGDP_RPCH').then(d => { if (live) setGdp(d) })
    void fetchWeo('PCPIPCH').then(d => { if (live) setCpi(d) })
    return () => { live = false }
  }, [])
  const w = useMemo(() => gdp && gdp !== 'loading' ? buildWorldOutlook(gdp, cpi) : null, [gdp, cpi])

  return (
    <>
      <section id="outlook-world-economy" className="home-hero fh-hero" aria-label="World economy">
        <div className="hero-copy">
          <div className="home-eyebrow"><span className="new-live-dot" /> OUTLOOK · THE WORLD ECONOMY</div>
          <h1>Where is the <em>world</em> economy heading?</h1>
          {w ? <p>{worldSentences(w).join(' ')}</p>
            : <p>The IMF’s World Economic Outlook projections for the world and its main country groups.</p>}
          {w && <div className="cc-ev wo-ev"><EvidenceTag kind="statistical" /><span>The IMF’s projections, not this app’s forecast and not a measurement. Direction words compare the IMF’s own figures.</span></div>}
          {w && <AskAnalystButton className="cy-btn fh-ask" draft={`Where is the world economy heading? Use the IMF ${w.vintage} world figures on the dashboard: growth ${w.years.now}–${w.years.next}, inflation, and the advanced vs emerging split. Say what the figures do not show.`} />}
        </div>
        <aside className="fh-glance" aria-label="World economy at a glance">
          {w ? <Glance w={w} /> : <Status gdp={gdp} />}
        </aside>
      </section>

      {w && (
        <section id="outlook-world-detail" className="home-section fh-section" aria-label="World economy detail">
          <ChartFrame
            title={`World real GDP growth, ${CHART_FROM}–${w.years.end}`}
            subtitle={`IMF world aggregate with advanced and emerging economies · projections from ${w.years.now}`}
            table={worldTable(w)}
            footer={<p className="viz-verdict">Years from {w.years.now} on are IMF projections; {w.years.prev} and earlier may include IMF estimates. The dashed line labelled “{CHART_FROM}–19 avg” is the average of the IMF’s world figures for {CHART_FROM}–2019.</p>}>
            <WorldChart w={w} />
          </ChartFrame>
          <div className="fh-card">
            <div className="pred-block-h">Real GDP growth by group</div>
            <div className="viz-table-wrap fh-compare" role="region" aria-label="IMF real GDP growth by country group" tabIndex={0}><table className="viz-table">
              <thead><tr><th scope="col">Group</th><th scope="col">{w.years.now} <span className="fh-proj">proj.</span></th><th scope="col">{w.years.next} <span className="fh-proj">proj.</span></th></tr></thead>
              <tbody>
                <tr className="fh-selected"><th scope="row">World</th><td>{pct(w.growth.now)}</td><td>{pct(w.growth.next)}</td></tr>
                {w.groups.map(r => <tr key={r.code}><th scope="row">{r.label}</th><td>{pct(r.now)}</td><td>{pct(r.next)}</td></tr>)}
              </tbody>
            </table></div>
            <SourceLine source={`IMF, ${w.vintage}`} asOf={w.lastModified ? `updated ${w.lastModified.slice(0, 10)}` : undefined} />
          </div>
        </section>
      )}
    </>
  )
}

function Glance({ w }: { w: Outlook }) {
  return (
    <div className="fh-glance-body">
      <Metric label={`World growth, ${w.years.now}`} value={f1(w.growth.now)} unit="%" evidence="statistical" asOf="IMF projection" />
      <Metric label={`World growth, ${w.years.next}`} value={w.growth.next == null ? '—' : f1(w.growth.next)} unit={w.growth.next == null ? undefined : '%'} evidence="statistical"
        asOf={w.growth.next == null ? 'no IMF figure' : 'IMF projection'} />
      <Metric label={`World inflation, ${w.years.next}`} value={w.inflation?.next == null ? '—' : f1(w.inflation.next)} unit={w.inflation?.next == null ? undefined : '%'}
        evidence={w.inflation?.next == null ? undefined : 'statistical'} asOf={w.inflation?.next == null ? (w.inflation ? 'no IMF figure' : 'loading or unavailable') : 'IMF projection, consumer prices'} />
      <div className="fh-model">Source: IMF, {w.vintage}</div>
    </div>
  )
}

function Status({ gdp }: { gdp: WeoPayload | null | 'loading' }) {
  if (gdp === 'loading') return <StatusLabel status="loading">The IMF’s world figures…</StatusLabel>
  if (gdp === null) return <StatusLabel status="error">The IMF’s figures could not be loaded right now.</StatusLabel>
  return <StatusLabel status="empty">This IMF edition has no world figure for its own year.</StatusLabel>
}

function worldTable(w: Outlook): TableData {
  const adv = new Map(w.groupSeries.ADVEC.map(p => [p.year, p.value]))
  const em = new Map(w.groupSeries.OEMDC.map(p => [p.year, p.value]))
  return {
    columns: ['Year', 'World', 'Advanced economies', 'Emerging and developing', 'Kind'],
    rows: w.series.filter(p => p.year >= CHART_FROM && p.year <= w.years.end).reverse()
      .map(p => [String(p.year), pct(p.value), pct(adv.get(p.year)), pct(em.get(p.year)), p.year >= w.years.now ? 'IMF projection' : 'reported or IMF estimate']),
  }
}

function WorldChart({ w }: { w: Outlook }) {
  const inRange = (s: { year: number; value: number }[]) => s.filter(p => p.year >= CHART_FROM && p.year <= w.years.end).map(p => ({ t: p.year, v: p.value }))
  return (
    <LineChart
      ariaLabel={`World real GDP growth, ${CHART_FROM} to ${w.years.end}, IMF figures: ${f1(w.growth.now)}% projected for ${w.years.now}${w.growth.next != null ? ` and ${f1(w.growth.next)}% for ${w.years.next}` : ''}.`}
      xKind="year" height={230} fmtY={v => `${f1(v)}%`}
      refLines={[{ v: 0, label: '0' }, ...(w.baseline !== null ? [{ v: w.baseline, label: `${CHART_FROM}–19 avg` }] : [])]}
      forecastBoundary={w.years.now - 0.5} observedLabel="Reported / estimate" projectedLabel="IMF projection"
      series={[
        { key: 'world', label: 'World', color: 'var(--series-1)', points: inRange(w.series), markers: true },
        { key: 'em', label: 'Emerging and developing', color: 'var(--series-2)', points: inRange(w.groupSeries.OEMDC) },
        { key: 'adv', label: 'Advanced economies', color: 'var(--series-5)', points: inRange(w.groupSeries.ADVEC) },
      ]} />
  )
}
