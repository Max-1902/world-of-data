import { useMemo, useState } from 'react'
import { useDisasterMarkets } from '../../hooks/useDisasterMarkets'
import { DISASTER_LABELS } from '../../services/gdacs'
import { BENCHMARK, COUNTRY_FUNDS, FUNDS_CHECKED } from '../../services/countryFunds'
import { baseRates, completed, MERGE_DAYS, RECENT_DAYS, type BaseRate, type Reaction } from '../../services/disasterMarkets'
import { HORIZONS, summarise, UNUSUAL, type GroupSummary, type Horizon, type WindowResult } from '../../utils/eventStudy'
import type { EvidenceKind } from '../../utils/evidence'
import { EvidenceTag, SourceLine, StatusLabel, type Tone } from '../DataLabels'
import { Method, pct } from './countryLookup/shared'

const day = (iso: string) => iso.slice(0, 10)
const pc = (frac: number) => pct(frac * 100)
const share = (s: number) => (s < 0.01 ? 'under 1%' : `${Math.round(s * 100)}%`)
const isUnusual = (w: WindowResult) => w.extremeShare < UNUSUAL
/** a fall is worse for that market, a rise better; ordinary moves stay neutral */
const toneOf = (w: WindowResult): Tone => (!isUnusual(w) ? 'neutral' : w.car < 0 ? 'down' : 'up')
const groupKey = (r: Reaction) => `${r.event.type}-${r.event.alert}`
const groupLabel = (r: Reaction) => `${r.event.alert} ${DISASTER_LABELS[r.event.type].toLowerCase()}`
const daysText = (d: number) => `${d} trading day${d === 1 ? '' : 's'}`

function Verdict({ w }: { w: WindowResult }) {
  return isUnusual(w)
    ? <span className={`dl-tone-${toneOf(w)}`}><b>Unusual</b>: only {share(w.extremeShare)} of this fund's ordinary {w.days}-day periods moved this much</span>
    : <span><b>Ordinary</b>: {share(w.extremeShare)} of this fund's ordinary {w.days}-day periods moved as much or more</span>
}

function chanceLine(s: GroupSummary, h: Horizon) {
  return `${s.unusual} of ${s.n} followed by an unusual ${h}-day move; chance alone would give about ${s.expected.toFixed(1)}`
}

/** The headline window for a reaction: 5 days once complete, else the longest it has. */
function mainWindow(r: Reaction): WindowResult | undefined {
  const w = r.study.windows
  return w[5] ?? w[1]
}

function Path({ steps }: { steps: { kind: EvidenceKind; text: string; source?: string; asOf?: string }[] }) {
  return (
    <ol className="ex-path">
      {steps.map((s, i) => (
        <li key={i}>
          <EvidenceTag kind={s.kind} />
          <div><div>{s.text}</div>{s.source && <SourceLine source={s.source} asOf={s.asOf} />}</div>
        </li>
      ))}
    </ol>
  )
}

function ReactionPath({ r, rate }: { r: Reaction; rate?: BaseRate }) {
  const w = mainWindow(r)!
  const past = rate?.byHorizon[5]
  return (
    <>
      <Path steps={[
        { kind: 'observed', text: `GDACS ${r.event.alert} alert: ${r.event.name}, starting ${r.event.from.replace('T', ' ').slice(0, 16)} UTC${r.event.severityText ? ` (${r.event.severityText})` : ''}.`, source: 'GDACS (EU JRC / UN OCHA)' },
        { kind: 'assumption', text: `${r.fund.fund} (${r.fund.symbol}) stands in for ${r.country}'s stock market. It holds that market's large listed companies, priced in US dollars on a US exchange.`, source: 'Fund name and listing as reported by Yahoo Finance', asOf: `checked ${FUNDS_CHECKED}` },
        { kind: 'observed', text: `${r.fund.symbol} returned ${pc(w.raw)} over the first ${daysText(w.days)} after the alert (from the close of ${new Date(r.study.baseT * 1000).toISOString().slice(0, 10)}).`, source: 'Yahoo Finance daily closes, dividend-adjusted' },
        { kind: 'statistical', text: `Compared with what the world market (${BENCHMARK.symbol}) predicts for it: ${pc(w.car)}. Fitted on the ${r.study.estDays} trading days before the alert (β ${r.study.beta.toFixed(2)}: it usually moves ${r.study.beta.toFixed(2)}× the world market).`, source: 'Computed in your browser' },
        { kind: 'statistical', text: isUnusual(w)
          ? `Larger than ${share(1 - w.extremeShare)} of this fund's ordinary ${w.days}-day periods since 2008. That says the move was rare, not that the disaster caused it.`
          : `${share(w.extremeShare)} of this fund's ordinary ${w.days}-day periods since 2008 moved as much or more, so nothing here stands out from normal market noise.`, source: 'Computed in your browser' },
      ]} />
      {past && <p className="viz-foot">Past {groupLabel(r)} alerts since 2009: {chanceLine(past, 5)}.</p>}
      {r.merged.length > 0 && <p className="viz-foot">Folded in (same fund within {MERGE_DAYS} days): {r.merged.join(', ')}.</p>}
    </>
  )
}

type Markets = ReturnType<typeof useDisasterMarkets>

function RecentCard({ recent, rates }: { recent: Markets['recent']; rates: Map<string, BaseRate> }) {
  const [open, setOpen] = useState<string | null>(null)
  const data = recent.data
  return (
    <section className="viz-card" aria-label="Recent alerts">
      <header className="viz-head">
        <div>
          <h3 className="viz-title">Last {RECENT_DAYS} days</h3>
          <p className="viz-sub">Orange and Red alerts for sudden disasters, and how each affected country's stock-market fund has moved since, against the world market.</p>
        </div>
      </header>
      {recent.loading && !data && <StatusLabel status="loading">GDACS alerts and Yahoo Finance prices…</StatusLabel>}
      {recent.error && <StatusLabel status="error">{recent.error}</StatusLabel>}
      {data && data.reactions.length === 0 && <StatusLabel status="empty">No recent alert hit a country with a US-listed fund.</StatusLabel>}
      {data && data.reactions.length > 0 && (
        <div className="viz-table-wrap ex-table-wrap">
          <table className="viz-table">
            <thead><tr><th scope="col">Alert</th><th scope="col">Fund</th><th scope="col">vs world market</th><th scope="col">Move</th></tr></thead>
            <tbody>
              {data.reactions.map(r => {
                const id = `${r.event.id}-${r.fund.symbol}`
                const w = mainWindow(r)
                if (!w) return null
                return [
                  <tr key={id} className={`ex-row ${open === id ? 'open' : ''}`} onClick={() => setOpen(o => (o === id ? null : id))} aria-expanded={open === id}>
                    <th scope="row">{open === id ? '▾' : '▸'} {r.event.name}<div className="dm-meta">{r.event.alert} · {day(r.event.from)}</div></th>
                    <td title={r.fund.fund}>{r.fund.symbol}<div className="dm-meta">{r.country}</div></td>
                    <td className={`dl-tone-${toneOf(w)}`}>{pc(w.car)}<div className="dm-meta">{daysText(w.days)}</div></td>
                    <td>{isUnusual(w) ? <b className={`dl-tone-${toneOf(w)}`}>Unusual</b> : 'Ordinary'}</td>
                  </tr>,
                  open === id && <tr key={`${id}-d`} className="ex-detail"><td colSpan={4}><Verdict w={w} /><ReactionPath r={r} rate={rates.get(groupKey(r))} /></td></tr>,
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && data.unmatched.length > 0 && (
        <details className="viz-foot">
          <summary>{data.unmatched.length} other recent alert{data.unmatched.length === 1 ? '' : 's'} not measured</summary>
          <ul className="ex-caveats">{data.unmatched.map(u => <li key={u.event.id}>{u.event.name} ({day(u.event.from)}): {u.reason}</li>)}</ul>
        </details>
      )}
    </section>
  )
}

function HistoryCard({ history, rates }: { history: Markets['history']; rates: BaseRate[] }) {
  const [h, setH] = useState<Horizon>(5)
  const data = history.data
  const overall = useMemo(() => (data ? summarise(completed(data.reactions, h)) : null), [data, h])
  const biggest = useMemo(() => (data
    ? data.reactions.filter(r => r.study.windows[h]?.days === h).sort((a, b) => Math.abs(b.study.windows[h]!.car) - Math.abs(a.study.windows[h]!.car)).slice(0, 8)
    : []), [data, h])
  const rows = rates.filter(g => g.byHorizon[h]).sort((a, b) => b.byHorizon[h]!.n - a.byHorizon[h]!.n)

  return (
    <section className="viz-card" aria-label="History since 2009">
      <header className="viz-head">
        <div>
          <h3 className="viz-title">What usually happens</h3>
          <p className="viz-sub">Every past Orange or Red alert since {data?.fromYear ?? 2009} that hit a country with a fund, measured the same way.</p>
        </div>
        <div className="viz-toggle" role="group" aria-label="Window">
          {HORIZONS.map(k => <button key={k} className={h === k ? 'on' : ''} aria-pressed={h === k} onClick={() => setH(k)}>{k}d</button>)}
        </div>
      </header>
      {history.loading && !data && <StatusLabel status="loading">GDACS alert archive since 2009 and fund histories (about 20 requests)…</StatusLabel>}
      {history.error && <StatusLabel status="error">{history.error}</StatusLabel>}
      {overall && (
        <p className="dm-headline">
          <EvidenceTag kind="statistical" /> {chanceLine(overall, h)}
          {overall.pChance < 0.05 ? ` (p = ${overall.pChance.toFixed(3)}: more than chance).` : ' — no more than chance would give.'}
        </p>
      )}
      {rows.length > 0 && (
        <div className="viz-table-wrap">
          <table className="viz-table">
            <thead><tr>
              <th scope="col">Alert type</th><th scope="col">Measured</th>
              <th scope="col" title="Median cumulative return against the world market">Median vs market</th>
              <th scope="col" title="Middle half of outcomes (25th to 75th percentile)">Middle half</th>
              <th scope="col">Unusual (chance)</th>
            </tr></thead>
            <tbody>
              {rows.map(g => {
                const s = g.byHorizon[h]!
                return (
                  <tr key={g.key}>
                    <th scope="row">{g.label}</th><td>{s.n}</td><td>{pc(s.median)}</td>
                    <td>{pc(s.q1)} to {pc(s.q3)}</td><td>{s.unusual} ({s.expected.toFixed(1)})</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {biggest.length > 0 && (
        <>
          <div className="dl-section">Largest {h}-day moves after an alert</div>
          <div className="viz-table-wrap">
            <table className="viz-table">
              <tbody>
                {biggest.map(r => {
                  const w = r.study.windows[h]!
                  return (
                    <tr key={`${r.event.id}-${r.fund.symbol}`}>
                      <th scope="row">{r.event.name}<div className="dm-meta">{r.event.alert} · {day(r.event.from)}</div></th>
                      <td>{r.fund.symbol}</td>
                      <td className={`dl-tone-${toneOf(w)}`}>{pc(w.car)}</td>
                      <td>{isUnusual(w) ? 'Unusual' : 'Ordinary'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {data && (
        <p className="viz-foot">
          {data.reactions.length} alert–fund pairs measured. Left out: {data.noFund} alerts where no affected country has a fund,
          {' '}{data.noHistory} pairs with under a year of fund prices before the alert, and {data.folded} alerts folded into an earlier one on the same fund within {MERGE_DAYS} days.
        </p>
      )}
    </section>
  )
}

/**
 * Disasters & Markets: did the affected country's stock market move unusually after a GDACS alert? Recent alerts on
 * top, the historical base rate for the same kind of alert below, each step labelled as data, estimate or assumption.
 */
export function DisasterMarketsPanel() {
  const { recent, history } = useDisasterMarkets()
  const rates = useMemo(() => (history.data ? baseRates(history.data.reactions, r => ({ key: groupKey(r), label: groupLabel(r) })) : []), [history.data])
  const rateMap = useMemo(() => new Map(rates.map(g => [g.key, g])), [rates])
  return (
    <div className="ex-panel">
      <RecentCard recent={recent} rates={rateMap} />
      <HistoryCard history={history} rates={rates} />
      <Method caveats={(
        <ul className="ex-caveats">
          <li>A move after an alert is not proof the alert caused it: other news on the same days moves funds too, and this cannot separate them.</li>
          <li>A country fund holds that market's large listed companies only, so it misses local firms, insurers abroad and the commodities a disaster can move.</li>
          <li>GDACS's start date is when an event was first tracked. For storms and floods the damage often comes days later, so the 5- and 20-day windows suit them better than the 1-day one.</li>
          <li>Covers the {COUNTRY_FUNDS.length} countries with a US-listed single-country fund. The United States is left out: it is about 60% of the world fund, so comparing the two cannot isolate it.</li>
          <li>Yahoo Finance's chart data is unofficial and can change or stop without notice.</li>
        </ul>
      )}>
        Market-model event study. For each alert and affected country, the fund's daily returns are regressed on the world fund
        ({BENCHMARK.symbol}) over trading days −260 to −11 before the alert; the abnormal return is the actual return minus that
        prediction, summed over the first 1, 5 or 20 trading days after it. A move is called unusual when fewer than {UNUSUAL * 100}% of the
        fund's ordinary windows of the same length (non-overlapping, at least 30 trading days from the alert) moved as much. If alerts had
        no effect, about {UNUSUAL * 100}% of them would look unusual by chance, which is what each count is compared with.
      </Method>
    </div>
  )
}
