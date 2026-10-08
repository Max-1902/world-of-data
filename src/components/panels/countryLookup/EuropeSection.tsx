import type { ReactNode } from 'react'
import type { EuropeData, EuroSeries, EuroSeriesId } from '../../../services/europeMacro'
import { spreadSeries, type PeriodPt } from '../../../utils/econAnalysis'
import { ChartFrame } from '../../charts/ChartFrame'
import { LineChart, type LineSeries, type RefLine } from '../../charts/LineChart'
import { inPeriodT, plain, type Period } from './shared'

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']
const line = (pts: PeriodPt[]) => pts.map(p => ({ t: p.t, v: p.value }))
const last = (pts: PeriodPt[] | undefined) => (pts?.length ? pts[pts.length - 1] : null)

interface Item { label: string; pts: PeriodPt[] | undefined; dashed?: boolean }

/** One European box: the listed series on one axis, the latest reading of each, and the exact source keys. */
function EuroBox({ title, subtitle, items, refs, cites, period, unit, note }: {
  title: string
  subtitle: string
  items: Item[]
  refs?: RefLine[]
  cites: EuroSeries[]
  period: Period
  unit: string
  note?: ReactNode
}) {
  const present = items.filter(i => i.pts?.length)
  const series: LineSeries[] = present.map((i, k) => ({ key: i.label, label: i.label, color: COLORS[k], points: line(inPeriodT(i.pts!, period)), dashed: i.dashed }))
  const failed = cites.filter(c => c.error)
  const periods = [...new Set(present.flatMap(i => inPeriodT(i.pts!, period).map(p => p.period)))].sort().reverse()
  const maps = present.map(i => new Map(i.pts!.map(p => [p.period, p.value])))
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={{ columns: ['Period', ...present.map(i => i.label)], rows: periods.map(p => [p, ...maps.map(m => (m.has(p) ? plain(m.get(p)!, 2) : '—'))]) }}
      footer={<>
        {present.length > 0 && (
          <div className="cl-latest">
            {present.map((i, k) => { const l = last(i.pts)!; return <span key={i.label}><i style={{ background: COLORS[k] }} />{i.label}: <b>{plain(l.value, 2)}{unit}</b> <em>{l.period}</em></span> })}
          </div>
        )}
        {note && <p className="cl-cite">{note}</p>}
        <p className="cl-cite">{cites.map(c => `${c.source}: ${c.ref}`).join(' · ')}{failed.length ? ` — ${failed.length} request${failed.length > 1 ? 's' : ''} failed (${failed[0].error}); retry from the top of the panel.` : ''}</p>
      </>}
    >
      {present.length ? <LineChart ariaLabel={`${title}.`} xKind="time" fmtY={v => `${plain(v, Math.abs(v) < 10 ? 1 : 0)}${unit}`} series={series} refLines={refs} />
        : <div className="viz-note">Not published for this country by these sources.</div>}
    </ChartFrame>
  )
}

/**
 * ECB, Eurostat and BIS series for a European country. The euro area (EA21, current composition) is shown alongside
 * as context where the same series exists — not as a ranking.
 */
export function EuropeSection({ eu, period, countryName }: { eu: EuropeData; period: Period; countryName: string }) {
  const s = eu.series
  const get = (id: EuroSeriesId) => s[id]
  const cites = (...ids: EuroSeriesId[]) => ids.map(get).filter((x): x is EuroSeries => !!x)
  const spread = s.yield10 && s.yieldDE ? spreadSeries(s.yield10.points, s.yieldDE.points) : []
  const policyLabel = eu.euroMember ? 'ECB rates' : 'Central bank policy rate (BIS)'
  const ecbTarget: RefLine[] = eu.euroMember ? [{ v: 2, label: 'ECB target 2%' }] : []

  return (
    <>
      <div className="viz-section">
        <h2>Europe · ECB &amp; Eurostat</h2>
        <span>{eu.euroMember ? `Euro area member since ${eu.euroSince}` : `Not in the euro area${eu.currency ? ` · currency ${eu.currency}` : ''}`}</span>
      </div>
      <EuroBox title="Prices" subtitle="Harmonised index of consumer prices, annual rate of change" unit="%" period={period}
        items={[{ label: countryName, pts: get('hicp')?.points }, { label: 'Euro area', pts: get('hicp')?.ea }]} refs={ecbTarget} cites={cites('hicp')}
        note={eu.euroMember ? 'The ECB aims for 2% inflation over the medium term for the euro area as a whole, not for each member.' : undefined} />
      <EuroBox title="Labour market" subtitle="Unemployment rate, % of labour force, seasonally adjusted, monthly" unit="%" period={period}
        items={[{ label: countryName, pts: get('unemployment')?.points }, { label: 'Euro area', pts: get('unemployment')?.ea }]} cites={cites('unemployment')} />
      <EuroBox title="Growth" subtitle="Real GDP, % change on the same quarter a year earlier, seasonally and calendar adjusted" unit="%" period={period}
        items={[{ label: countryName, pts: get('gdp')?.points }, { label: 'Euro area', pts: get('gdp')?.ea }]} refs={[{ v: 0, label: '0' }]} cites={cites('gdp')} />
      <EuroBox title="Economic sentiment" subtitle="European Commission Economic Sentiment Indicator; 100 = long-term average" unit="" period={period}
        items={[{ label: countryName, pts: get('esi')?.points }, { label: 'Euro area', pts: get('esi')?.ea }]} refs={[{ v: 100, label: 'long-term avg' }]} cites={cites('esi')}
        note="A survey composite of industry, services, consumer, construction and retail confidence. It is published within the month, before hard data." />
      <EuroBox title="Public debt" subtitle="General government gross debt, % of GDP, quarterly" unit="%" period={period}
        items={[{ label: countryName, pts: get('debtQ')?.points }, { label: 'Euro area', pts: get('debtQ')?.ea }]}
        refs={[{ v: 60, label: 'Maastricht reference 60%' }]} cites={cites('debtQ')} />
      <EuroBox title={policyLabel} subtitle={eu.euroMember ? 'Key ECB interest rates in force at month-end' : 'Policy rate set by the national central bank, month-end'} unit="%" period={period}
        items={eu.euroMember
          ? [{ label: 'Deposit facility', pts: get('ecbDfr')?.points }, { label: 'Main refinancing', pts: get('ecbMro')?.points }, { label: 'Marginal lending', pts: get('ecbMlf')?.points }]
          : [{ label: 'Policy rate', pts: get('policy')?.points }]}
        cites={eu.euroMember ? cites('ecbDfr', 'ecbMro', 'ecbMlf') : cites('policy')} />
      <EuroBox title="Government bond yields" subtitle="10-year benchmark yield, % per year (Maastricht convergence series)" unit="%" period={period}
        items={[{ label: countryName, pts: get('yield10')?.points }, ...(eu.iso2 !== 'DE' ? [{ label: 'Germany', pts: get('yieldDE')?.points }] : [])]} cites={cites('yield10', 'yieldDE')} />
      {spread.length > 0 && (
        <EuroBox title="Spread over Germany" subtitle="10-year yield minus the German 10-year yield, percentage points" unit=" pp" period={period}
          items={[{ label: 'Spread', pts: spread }]} refs={[{ v: 0, label: '0' }]} cites={cites('yield10', 'yieldDE')}
          note="The market's extra compensation for lending to this government rather than Germany's: credit, liquidity and, outside the euro, currency risk." />
      )}
      {eu.euroMember && (
        <EuroBox title="Bank lending rates" subtitle="Composite cost of borrowing on new loans, % per year" unit="%" period={period}
          items={[{ label: 'Households, house purchase', pts: get('mortgage')?.points }, { label: 'Corporations', pts: get('corporate')?.points },
            { label: 'Euro area, house purchase', pts: get('mortgageEA')?.points, dashed: true }, { label: 'Euro area, corporations', pts: get('corporateEA')?.points, dashed: true }]}
          cites={cites('mortgage', 'corporate', 'mortgageEA', 'corporateEA')}
          note="How far ECB rate changes reach households and firms in this country (pass-through)." />
      )}
      <EuroBox title="House prices" subtitle="House price index, % change on a year earlier, quarterly" unit="%" period={period}
        items={[{ label: countryName, pts: get('hpi')?.points }, { label: 'Euro area', pts: get('hpi')?.ea }]} refs={[{ v: 0, label: '0' }]} cites={cites('hpi')} />
      <EuroBox title="Exchange rate" subtitle={get('fx')?.label ?? 'Euro reference rate'} unit="" period={period}
        items={[{ label: get('fx')?.label ?? 'Rate', pts: get('fx')?.points }]} cites={cites('fx')}
        note={eu.euroMember ? 'Shared by every euro member; shown for context.' : 'Monthly average of the ECB euro reference rate. A rise means the national currency weakened against the euro.'} />
    </>
  )
}
