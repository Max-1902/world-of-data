import { useMemo } from 'react'
import { ALL_SERIES, SERIES_BY_ID, changeMode, formatSlope, formatValue, pointsOf, type CountryDataset } from '../../../services/countryLookup'
import type { EuropeData } from '../../../services/europeMacro'
import {
  ALPHA, ANOMALY_Z, BREAK_TRIM, HP_LAMBDA_ANNUAL, SUPF_CRIT_5, TREND_WINDOW,
  annualAverage, anomalyScan, benjaminiHochberg, byDecade, cagr, debtDynamics, growthDecomposition, meanBreak, okun,
  outputGap, persistence, phillips, recessions, sectoralBalances, spreadSeries, trendTest,
  type MeanBreak, type Pt,
} from '../../../utils/econAnalysis'
import { ChartFrame } from '../../charts/ChartFrame'
import { LineChart, type Band } from '../../charts/LineChart'
import { XYChart } from '../../charts/XYChart'
import { Kpi, Method, fmtP, plain, pp, pct, toLine } from './shared'

const THIS_YEAR = new Date().getUTCFullYear()

/**
 * Two dashed segments at the mean before and after a significant break (one line, stepping at the break). One point per
 * year: LineChart breaks a line at any step much longer than its typical one (a missing year), so a four-corner line
 * lost its whole second segment whenever the regimes differed in length.
 */
export function regimeLine(b: MeanBreak | null): Pt[] {
  if (!b?.significant) return []
  const flat = (r: MeanBreak['before']) => Array.from({ length: r.to - r.from + 1 }, (_, i) => ({ x: r.from + i, y: r.mean }))
  return [...flat(b.before), ...flat(b.after)]
}

function breakSentence(b: MeanBreak | null, what: string, unit = '%'): string {
  if (!b) return `Too few years (fewer than 20) to test ${what} for a regime change.`
  if (!b.significant) return `No significant shift in average ${what} (largest F = ${b.supF.toFixed(1)}, below the 5% critical value ${SUPF_CRIT_5}).`
  return `Average ${what} shifted in ${b.year}: ${plain(b.before.mean)}${unit} in ${b.before.from}–${b.before.to} (n = ${b.before.n}) vs ${plain(b.after.mean)}${unit} in ${b.after.from}–${b.after.to} (n = ${b.after.n}); sup-F = ${b.supF.toFixed(1)} > ${SUPF_CRIT_5}.`
}

const breakMethod = `Quandt–Andrews sup-F test for one unknown break in the mean, ${Math.round(BREAK_TRIM * 100)}% trimming, against Andrews' 5% critical value.`

export function AnalysisSection({ data, eu, name }: { data: CountryDataset; eu: EuropeData | null; name: string }) {
  const P = (id: string) => pointsOf(data, id)

  // ── Coverage ──
  const coverage = useMemo(() => {
    const present = ALL_SERIES.filter(m => P(m.id).length)
    const latest = present.map(m => { const p = P(m.id); return p[p.length - 1].x }).sort((a, b) => a - b)
    const earliest = present.map(m => P(m.id)[0].x)
    return {
      present: present.length, total: ALL_SERIES.length,
      medianLatest: latest.length ? latest[Math.floor(latest.length / 2)] : null,
      stale: latest.filter(y => y <= THIS_YEAR - 5).length,
      earliest: earliest.length ? Math.min(...earliest) : null,
      years: present.reduce((s, m) => s + P(m.id).length, 0),
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trends across every series, with FDR control ──
  const trends = useMemo(() => {
    const rows = ALL_SERIES.map(m => ({ meta: m, r: trendTest(P(m.id)) })).filter((x): x is { meta: typeof x.meta; r: NonNullable<typeof x.r> } => x.r !== null)
    const fdr = benjaminiHochberg(rows.map(x => x.r.p))
    return rows.map((x, i) => ({ ...x, fdr: fdr[i] })).sort((a, b) => a.r.p - b.r.p)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const sig = trends.filter(t => t.r.direction !== 'flat')

  // ── Growth & cycle ──
  const growth = P('NY.GDP.MKTP.KD.ZG'), realGdp = P('NY.GDP.MKTP.KD')
  const rec = useMemo(() => recessions(growth, realGdp), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const gap = useMemo(() => outputGap(realGdp), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const gBreak = useMemo(() => meanBreak(growth), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const decades = byDecade(growth)
  const decomp = growthDecomposition(growth, P('SP.POP.GROW'))
  const c10 = cagr(realGdp, 10), c20 = cagr(realGdp, 20)
  const bands: Band[] = rec.map(r => ({ from: r.start, to: r.end, label: `Contraction ${r.start === r.end ? r.start : `${r.start}–${r.end}`}: ${pct(r.depth)}` }))

  // ── Labour: prefer Eurostat measured unemployment (annual average of monthly) for European countries ──
  const euU = eu?.series.unemployment?.points?.length ? annualAverage(eu.series.unemployment.points, 12) : []
  const useEuU = euU.length >= 15
  const unemp = useEuU ? euU : P('SL.UEM.TOTL.ZS')
  const ok = useMemo(() => okun(growth, unemp), [data, eu]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inflation ──
  const cpi = P('FP.CPI.TOTL.ZG')
  const ar = useMemo(() => persistence(cpi), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const iBreak = useMemo(() => meanBreak(cpi), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const ph = useMemo(() => phillips(cpi, unemp), [data, eu]) // eslint-disable-line react-hooks/exhaustive-deps
  const cpi10 = cpi.filter(p => p.x > (cpi[cpi.length - 1]?.x ?? 0) - 10)

  // ── Balances: Eurostat general government where available, else World Bank central government ──
  const euGov = eu?.annual.balance ?? []
  const useEuGov = euGov.length >= 5
  const sect = sectoralBalances(P('BN.CAB.XOKA.GD.ZS'), useEuGov ? euGov : P('GC.NLD.TOTL.GD.ZS'))
  const lastSect = sect[sect.length - 1]

  // ── Debt dynamics (Eurostat only) ──
  const debt = eu ? debtDynamics({ debt: eu.annual.debt, balance: eu.annual.balance, interest: eu.annual.interest, nominalGdp: eu.annual.nominalGdp }) : []
  const lastDebt = debt[debt.length - 1]

  // ── Monetary stance (Europe) ──
  const policy = eu?.series.policy?.points ?? [], hicp = eu?.series.hicp?.points ?? []
  const real = policy.length && hicp.length ? spreadSeries(policy, hicp) : []
  const lastReal = real[real.length - 1]

  // ── Structural change ──
  const structIds = ['NE.CON.PRVT.ZS', 'NE.CON.GOVT.ZS', 'NE.GDI.TOTL.ZS', 'NY.GNS.ICTR.ZS', 'NE.EXP.GNFS.ZS', 'NE.IMP.GNFS.ZS', 'NV.AGR.TOTL.ZS', 'NV.IND.TOTL.ZS', 'NV.IND.MANF.ZS', 'NV.SRV.TOTL.ZS']
  const struct = structIds.map(id => {
    const p = P(id), end = p[p.length - 1]
    const start = end && p.find(q => q.x === end.x - 20)
    return end && start ? { id, short: SERIES_BY_ID.get(id)!.short, from: start, to: end, change: end.y - start.y } : null
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  // ── Anomalies ──
  const anomalies = useMemo(() => anomalyScan(ALL_SERIES.map(m => ({ id: m.id, points: P(m.id), mode: changeMode(m.kind) }))), [data]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="viz-section"><h2>Economic analysis · {name}</h2><span>computed in your browser</span></div>
      <p className="viz-sub cl-lead">
        Analysis of this one economy's own history: what is trending, where it is in its cycle, how its growth, jobs, prices and debt
        relate, and what moved unusually. These are descriptive statistics on published data. None of it is a forecast, and every
        result below comes with its method, sample size and caveats.
      </p>

      {/* 1 · Coverage */}
      <section className="viz-card" aria-label="What the evidence covers">
        <header className="viz-head"><div><h3 className="viz-title">What the evidence covers</h3><p className="viz-sub">Read this first: the analysis can only be as complete as the data.</p></div></header>
        <div className="viz-kpis">
          <Kpi label="Series reported" value={`${coverage.present} / ${coverage.total}`} detail="World Bank catalogue in this tool" />
          <Kpi label="Observations" value={coverage.years.toLocaleString('en-US')} detail={coverage.earliest ? `from ${coverage.earliest}` : undefined} />
          <Kpi label="Median latest year" value={coverage.medianLatest ? String(coverage.medianLatest) : '—'} detail="half the series end earlier" />
          <Kpi label="Stale series" value={String(coverage.stale)} detail={`latest value ${THIS_YEAR - 5} or older`} />
        </div>
        {data.failedBatches > 0 && <div className="viz-note" role="status">{data.failedBatches} of {data.totalBatches} World Bank requests failed, so some series below are missing for a network reason, not because they don't exist. Retry from the top.</div>}
        <Method caveats="Survey-based series (poverty, inequality, literacy) exist only in survey years. Several labour series are ILO modelled estimates, not measurements. Recent years are often revised.">
          Counts of what the World Bank returned for {name} since 1960{data.lastUpdated.length ? `; database last updated ${data.lastUpdated[data.lastUpdated.length - 1]}` : ''}.
        </Method>
      </section>

      {/* 2 · Trends */}
      <section className="viz-card" aria-label="Which indicators are trending">
        <header className="viz-head"><div><h3 className="viz-title">Which indicators are trending</h3><p className="viz-sub">Every series tested over its last {TREND_WINDOW} observations.</p></div></header>
        <div className="viz-kpis">
          <Kpi label="Series tested" value={String(trends.length)} detail="≥ 8 observations" />
          <Kpi label="Significant at 5%" value={String(sig.length)} detail={`${sig.filter(t => t.r.direction === 'up').length} rising · ${sig.filter(t => t.r.direction === 'down').length} falling`} />
          <Kpi label="Expected by chance" value={`≈ ${(trends.length * ALPHA).toFixed(1)}`} detail="if nothing were trending" />
          <Kpi label="Survive FDR 5%" value={String(trends.filter(t => t.fdr && t.r.direction !== 'flat').length)} detail="Benjamini–Hochberg" />
        </div>
        {sig.length > 0 && (
          <div className="viz-table-wrap">
            <table className="viz-table">
              <thead><tr><th scope="col">Indicator</th><th scope="col">Sen slope</th><th scope="col">p</th><th scope="col">Years</th><th scope="col">FDR</th></tr></thead>
              <tbody>{sig.map(t => (
                <tr key={t.meta.id}><th scope="row">{t.r.direction === 'up' ? '↑' : '↓'} {t.meta.short}</th><td>{formatSlope(t.meta.kind, t.r.slope)}</td><td>{t.r.p < 0.001 ? '<0.001' : t.r.p.toFixed(3)}</td><td>{t.r.from}–{t.r.to}</td><td>{t.fdr ? 'yes' : 'no'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Method caveats="A trend describes the recent past and is not a forecast. In simulation this test still calls about 9–12% of trendless but highly persistent series significant (nominal 5%), and it misses weak trends more often than the uncorrected test. Treat trends that do not survive the FDR correction as tentative.">
          Mann–Kendall test on the last {TREND_WINDOW} observations with its variance inflated for lag-1 autocorrelation (Yue &amp; Wang 2004 effective sample size, bias-corrected r₁); slope by Sen's estimator; two-sided, 5% level.
          The Benjamini–Hochberg column controls the share of false discoveries among all {trends.length} tests.
        </Method>
      </section>

      {/* 3 · Growth & cycle */}
      {growth.length >= 5 && (
        <ChartFrame title="Growth and the business cycle" subtitle="Real GDP growth, % per year; contractions shaded; dashed: average before and after a detected regime shift"
          table={{ columns: ['Decade', 'Mean growth', 'Std. dev.', 'Years'], rows: decades.map(d => [d.label, pct(d.mean), plain(d.sd), String(d.n)]) }}
          footer={<>
            <div className="viz-kpis">
              <Kpi label="Real growth, 10 yrs" value={c10 ? `${pct(c10.rate)}/yr` : '—'} detail={c10 ? `${c10.from}–${c10.to}, compound` : 'needs both end years'} />
              <Kpi label="Real growth, 20 yrs" value={c20 ? `${pct(c20.rate)}/yr` : '—'} detail={c20 ? `${c20.from}–${c20.to}, compound` : 'needs both end years'} />
              <Kpi label="Contraction years" value={String(rec.reduce((s, r) => s + r.end - r.start + 1, 0))} detail={`${rec.length} episode${rec.length === 1 ? '' : 's'} since ${growth[0].x}`} />
              <Kpi label="Volatility" value={`${plain(decades.length ? Math.sqrt(decades.reduce((s, d) => s + d.sd ** 2 * (d.n - 1), 0) / Math.max(1, decades.reduce((s, d) => s + d.n - 1, 0))) : NaN)} pp`} detail="pooled within-decade std. dev." />
            </div>
            <p className="viz-verdict">{breakSentence(gBreak, 'growth')}</p>
            {rec.length > 0 && (
              <p className="viz-sub">{rec.slice(-4).map(r => `${r.start === r.end ? r.start : `${r.start}–${r.end}`} (${pct(r.depth)}; ${r.recovered ? `pre-contraction output regained ${r.recovered}` : 'not yet regained'})`).join(' · ')}</p>
            )}
            <Method caveats="Annual data hide short recessions inside a year. A year of negative growth is a crude dating rule; official dating committees use quarterly and monthly data. Real GDP is revised, sometimes substantially.">
              Contractions are runs of years with negative real GDP growth; depth is the compound fall; recovery is the first year real GDP regained its pre-contraction level. {breakMethod}
            </Method>
          </>}>
          <LineChart ariaLabel="Real GDP growth by year." xKind="year" fmtY={v => `${plain(v, 0)}%`} bands={bands} refLines={[{ v: 0, label: '0' }]}
            series={[{ key: 'g', label: 'Real GDP growth', color: 'var(--series-1)', points: toLine(growth) },
              ...(gBreak?.significant ? [{ key: 'm', label: 'Regime average', color: 'var(--series-2)', points: toLine(regimeLine(gBreak)), dashed: true }] : [])]} />
        </ChartFrame>
      )}

      {gap && (
        <ChartFrame title="Output gap" subtitle="Real GDP relative to its smooth trend, % (Hodrick–Prescott)"
          table={{ columns: ['Year', 'Gap'], rows: [...gap.points].reverse().map(p => [String(p.x), pct(p.y, 2)]) }}
          footer={<>
            <p className="viz-verdict">Latest ({gap.points[gap.points.length - 1].x}): output {gap.points[gap.points.length - 1].y >= 0 ? 'above' : 'below'} trend by {Math.abs(gap.points[gap.points.length - 1].y).toFixed(1)}%.</p>
            <Method caveats="The last two or three years are the least reliable: the filter has no future data to anchor them, and they will move as new years arrive. This is a statistical trend, not the production-function potential output that official bodies estimate.">
              HP filter on log real GDP over the latest unbroken run of years, λ = {HP_LAMBDA_ANNUAL} (Ravn &amp; Uhlig 2002, for annual data).
            </Method>
          </>}>
          <LineChart ariaLabel="Output gap by year." xKind="year" fmtY={v => `${plain(v, 1)}%`} refLines={[{ v: 0, label: 'trend' }]} bands={bands}
            series={[{ key: 'gap', label: 'Output gap', color: 'var(--series-1)', points: toLine(gap.points) }]} />
        </ChartFrame>
      )}

      {/* 4 · Sources of growth & structural change */}
      {(decomp.length > 0 || struct.length > 0) && (
        <section className="viz-card" aria-label="Where growth came from, and how the economy changed">
          <header className="viz-head"><div><h3 className="viz-title">Where growth came from, and how the economy changed</h3><p className="viz-sub">More people or more output per person; and the shifts in what the economy spends on and produces.</p></div></header>
          {decomp.length > 0 && (
            <div className="viz-table-wrap">
              <table className="viz-table">
                <thead><tr><th scope="col">Decade</th><th scope="col">Real GDP</th><th scope="col">Population</th><th scope="col">Per person</th><th scope="col">Years</th></tr></thead>
                <tbody>{decomp.map(d => <tr key={d.label}><th scope="row">{d.label}</th><td>{pct(d.mean)}</td><td>{pct(d.pop)}</td><td>{pct(d.perCapita)}</td><td>{d.n}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {struct.length > 0 && (
            <div className="viz-table-wrap" style={{ marginTop: 8 }}>
              <table className="viz-table">
                <thead><tr><th scope="col">Share of GDP</th><th scope="col">{struct[0].from.x}</th><th scope="col">{struct[0].to.x}</th><th scope="col">Change</th></tr></thead>
                <tbody>{struct.map(r => <tr key={r.id}><th scope="row">{r.short.replace(' (% GDP)', '')}</th><td>{plain(r.from.y)}%</td><td>{plain(r.to.y)}%</td><td>{pp(r.change)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <Method caveats="Per-person growth is not productivity: it ignores how many people work and how long. Shares come from different national-accounts vintages and do not sum exactly to 100.">
            Annual averages by decade of (1 + real growth) = (1 + population growth) × (1 + per-person growth). Shares compared between the latest year and 20 years earlier, where both are reported.
          </Method>
        </section>
      )}

      {/* 5 · Okun */}
      {ok && (
        <ChartFrame title="Jobs and growth (Okun's law)" subtitle={`Each dot is a year: real GDP growth vs the change in unemployment. Unemployment: ${useEuU ? 'Eurostat, annual average of monthly data' : 'World Bank (ILO modelled estimate)'}`}
          table={{ columns: ['Year', 'Growth', 'Δ unemployment'], rows: [...ok.points].reverse().map(p => [String(p.x), pct(p.growth), pp(p.dU, 2)]) }}
          footer={<>
            <div className="viz-kpis">
              <Kpi label="Okun coefficient" value={`${plain(ok.fit.slope, 2)}`} detail={`pp per 1% growth · 95% CI ${plain(ok.fit.ci[0], 2)} to ${plain(ok.fit.ci[1], 2)}`} />
              <Kpi label="Fit" value={`R² ${ok.fit.r2.toFixed(2)}`} detail={`${fmtP(ok.fit.p)} · n = ${ok.fit.n} years`} />
            </div>
            <p className="viz-verdict">{ok.fit.p < ALPHA
              ? <>Each extra 1% of real growth went with unemployment {ok.fit.slope < 0 ? 'falling' : 'rising'} by about <b>{Math.abs(ok.fit.slope).toFixed(2)} pp</b>.{ok.stableGrowth !== null && <> Growth of about <b>{plain(ok.stableGrowth)}%</b> was enough to keep unemployment stable.</>}</>
              : <>No statistically reliable link between growth and unemployment changes at the 5% level ({fmtP(ok.fit.p)}).</>}</p>
            <Method caveats={<>{useEuU ? '' : <>The ILO modelled estimates partly impute unemployment from economic indicators where surveys are missing, which can create or strengthen this relationship mechanically. </>}The coefficient varies across periods and with labour-market institutions. The stable-growth figure is a ratio of two estimates and is less certain than the slope.</>}>
              OLS of the yearly change in unemployment on real GDP growth (difference form); 95% interval from the t distribution; consecutive years only.
            </Method>
          </>}>
          <XYChart ariaLabel="Okun's law scatter." points={ok.points.map(p => ({ key: String(p.x), x: p.growth, y: p.dU, label: String(p.x) }))} fit={ok.fit}
            xLabel="Real GDP growth, %" yLabel="Δ unemployment, pp" fmtX={v => `${plain(v, 0)}%`} fmtY={v => plain(v, 1)} />
        </ChartFrame>
      )}

      {/* 6 · Inflation */}
      {cpi.length >= 8 && (
        <ChartFrame title="Inflation: level, persistence, regimes" subtitle="Consumer price inflation, % per year (World Bank); dashed: average before and after a detected regime shift"
          table={{ columns: ['Year', 'Inflation'], rows: [...cpi].reverse().map(p => [String(p.x), pct(p.y)]) }}
          footer={<>
            <div className="viz-kpis">
              <Kpi label="Average, last 10 yrs" value={`${plain(cpi10.reduce((s, p) => s + p.y, 0) / Math.max(1, cpi10.length))}%`} detail={cpi10.length ? `${cpi10[0].x}–${cpi10[cpi10.length - 1].x}` : undefined} />
              <Kpi label="Persistence (AR1)" value={ar ? ar.slope.toFixed(2) : '—'} detail={ar ? `95% CI ${ar.ci[0].toFixed(2)} to ${ar.ci[1].toFixed(2)} · n = ${ar.n}` : 'too few years'} />
            </div>
            <p className="viz-verdict">{breakSentence(iBreak, 'inflation')}</p>
            {ph && (
              <p className="viz-sub">Phillips curve (accelerationist): change in inflation on unemployment, slope {plain(ph.fit.slope, 2)} (95% CI {plain(ph.fit.ci[0], 2)} to {plain(ph.fit.ci[1], 2)}; {fmtP(ph.fit.p)}; n = {ph.fit.n}).{' '}
                {ph.nairu !== null ? <>Inflation tended to be stable at unemployment of about <b>{plain(ph.nairu)}%</b>, a historical average and not an estimate of today's rate.</> : 'No reliable trade-off at the 5% level, which is common in recent decades.'}</p>
            )}
            <Method caveats="Persistence near 1 means shocks fade slowly. Inflation is persistent, so the break test over-rejects. Read a detected shift as a prompt to look (a new monetary regime, euro entry, a crisis), not as proof. Phillips-curve estimates are notoriously unstable.">
              AR(1): OLS of inflation on the previous year's inflation. {breakMethod} Phillips: OLS of the yearly change in inflation on the unemployment rate.
            </Method>
          </>}>
          <LineChart ariaLabel="Consumer price inflation by year." xKind="year" fmtY={v => `${plain(v, Math.abs(v) < 10 ? 1 : 0)}%`} refLines={[{ v: 0, label: '0' }]}
            series={[{ key: 'cpi', label: 'Inflation', color: 'var(--series-1)', points: toLine(cpi) },
              ...(iBreak?.significant ? [{ key: 'm', label: 'Regime average', color: 'var(--series-2)', points: toLine(regimeLine(iBreak)), dashed: true }] : [])]} />
        </ChartFrame>
      )}
      {ph && ph.points.length >= 5 && (
        <ChartFrame title="Inflation and unemployment" subtitle="Each dot is a year: unemployment rate vs the change in inflation"
          table={{ columns: ['Year', 'Unemployment', 'Δ inflation'], rows: [...ph.points].reverse().map(p => [String(p.x), `${plain(p.u)}%`, pp(p.dPi)]) }}>
          <XYChart ariaLabel="Phillips curve scatter." points={ph.points.map(p => ({ key: String(p.x), x: p.u, y: p.dPi, label: String(p.x) }))} fit={ph.fit}
            xLabel="Unemployment, %" yLabel="Δ inflation, pp" fmtX={v => `${plain(v, 0)}%`} fmtY={v => plain(v, 1)} />
        </ChartFrame>
      )}

      {/* 7 · Sectoral balances */}
      {sect.length >= 3 && (
        <ChartFrame title="Who lends and who borrows" subtitle={`Sectoral balances, % of GDP. Government: ${useEuGov ? 'general government (Eurostat)' : 'central government (World Bank)'}`}
          table={{ columns: ['Year', 'Current account', 'Government', 'Private (derived)'], rows: [...sect].reverse().map(r => [String(r.x), pct(r.currentAccount), pct(r.government), pct(r.privateSector)]) }}
          footer={<>
            {lastSect && <p className="viz-verdict">In {lastSect.x} the government {lastSect.government < 0 ? 'borrowed' : 'lent'} {Math.abs(lastSect.government).toFixed(1)}% of GDP, the private sector {lastSect.privateSector < 0 ? 'borrowed' : 'saved a net'} {Math.abs(lastSect.privateSector).toFixed(1)}%, and the country as a whole {lastSect.currentAccount < 0 ? 'borrowed' : 'lent'} {Math.abs(lastSect.currentAccount).toFixed(1)}% from or to the rest of the world.</p>}
            <Method caveats={useEuGov ? 'Eurostat government and World Bank current-account figures come from different compilations; small residuals end up in the derived private balance.' : 'World Bank fiscal data cover central government only; regional and local government end up in the "private" residual. Treat the private balance as indicative.'}>
              Accounting identity: private balance + government balance = current account balance. The private balance is derived as current account − government.
            </Method>
          </>}>
          <LineChart ariaLabel="Sectoral balances by year." xKind="year" fmtY={v => `${plain(v, 0)}%`} refLines={[{ v: 0, label: '0' }]}
            series={[
              { key: 'gov', label: 'Government', color: 'var(--series-1)', points: sect.map(r => ({ t: r.x, v: r.government })) },
              { key: 'priv', label: 'Private (derived)', color: 'var(--series-2)', points: sect.map(r => ({ t: r.x, v: r.privateSector })) },
              { key: 'ca', label: 'Current account', color: 'var(--series-3)', points: sect.map(r => ({ t: r.x, v: r.currentAccount })) },
            ]} />
        </ChartFrame>
      )}

      {/* 8 · Debt dynamics */}
      {debt.length >= 3 ? (
        <ChartFrame title="Debt dynamics: interest vs growth" subtitle="Effective interest rate on government debt vs nominal GDP growth, % (Eurostat)"
          table={{ columns: ['Year', 'Debt', 'Δ debt', 'Primary bal.', 'Snowball', 'Stock-flow'], rows: [...debt].reverse().map(r => [String(r.x), `${plain(r.debt)}%`, pp(r.change), pct(r.primaryBalance), pp(r.snowball), pp(r.sfa)]) }}
          footer={<>
            {lastDebt && (
              <div className="viz-kpis">
                <Kpi label={`Debt, ${lastDebt.x}`} value={`${plain(lastDebt.debt)}%`} detail={`${pp(lastDebt.change)} on the year`} />
                <Kpi label="i − g" value={pp(lastDebt.interestRate - lastDebt.growth)} detail={`i ${plain(lastDebt.interestRate)}% · g ${plain(lastDebt.growth)}%`} />
                <Kpi label="Debt-stabilising primary balance" value={pct(lastDebt.stabilising)} detail="% of GDP needed to hold the ratio flat" />
                <Kpi label="Actual primary balance" value={pct(lastDebt.primaryBalance)} detail={lastDebt.primaryBalance >= lastDebt.stabilising ? 'enough to stabilise' : 'not enough to stabilise'} />
              </div>
            )}
            <p className="viz-verdict">When interest exceeds growth (i &gt; g) debt grows by itself unless the government runs a primary surplus. When g &gt; i, growth erodes the ratio.</p>
            <Method caveats="The effective rate reflects debt issued years ago, so it reacts slowly to market yields. The stock-flow adjustment is a residual that absorbs privatisations, bank support, cash buffers and valuation effects. This is an accounting decomposition, not a sustainability forecast.">
              European Commission debt-dynamics identity: Δd = −pb + d₋₁(i − g)/(1 + g) + sfa. Here i = interest payable / last year's debt, g = nominal GDP growth, pb = balance + interest payable; sfa is the residual. Sources: Eurostat gov_10dd_edpt1 (B9, D41PAY, GD) and nama_10_gdp.
            </Method>
          </>}>
          <LineChart ariaLabel="Effective interest rate and nominal growth by year." xKind="year" fmtY={v => `${plain(v, 0)}%`} refLines={[{ v: 0, label: '0' }]}
            series={[
              { key: 'i', label: 'Effective interest rate (i)', color: 'var(--series-1)', points: debt.map(r => ({ t: r.x, v: r.interestRate })) },
              { key: 'g', label: 'Nominal GDP growth (g)', color: 'var(--series-2)', points: debt.map(r => ({ t: r.x, v: r.growth })) },
            ]} />
        </ChartFrame>
      ) : (
        <div className="viz-note">Debt dynamics need general-government interest, balance and nominal GDP on one basis. Free sources provide these consistently only for European countries (Eurostat), so this analysis is not run for {name}.</div>
      )}

      {/* 9 · Monetary stance */}
      {real.length > 12 && lastReal && (
        <ChartFrame title="Monetary stance" subtitle={`Policy rate minus HICP inflation (ex-post real rate), % · ${eu?.euroMember ? 'ECB deposit facility rate' : 'national policy rate (BIS)'}`}
          table={{ columns: ['Month', 'Policy rate', 'Inflation', 'Real rate'], rows: [...real].reverse().map(r => { const pol = policy.find(p => p.period === r.period)!, inf = hicp.find(p => p.period === r.period)!; return [r.period, `${plain(pol.value, 2)}%`, `${plain(inf.value)}%`, pp(r.value, 2)] }) }}
          footer={<>
            <p className="viz-verdict">Latest ({lastReal.period}): real policy rate <b>{pp(lastReal.value, 2)}</b>. Negative in {Math.round(100 * real.filter(r => r.value < 0).length / real.length)}% of the {real.length} months since {real[0].period}.</p>
            <Method caveats={<>Ex-post: uses inflation as measured, not as expected, so it overstates how loose policy felt when inflation surprised. {eu?.euroMember ? 'For a euro member the rate is set for the whole euro area, not for this country.' : ''} The neutral real rate is unobserved, so a negative rate is not by itself proof of stimulus.</>}>
              Monthly policy rate (month-end) minus HICP annual inflation for the same month.
            </Method>
          </>}>
          <LineChart ariaLabel="Policy rate, inflation and real policy rate by month." xKind="time" fmtY={v => `${plain(v, 0)}%`} refLines={[{ v: 0, label: '0' }]}
            series={[
              { key: 'pol', label: 'Policy rate', color: 'var(--series-1)', points: policy.filter(p => p.t >= real[0].t).map(p => ({ t: p.t, v: p.value })) },
              { key: 'inf', label: 'HICP inflation', color: 'var(--series-2)', points: hicp.filter(p => p.t >= real[0].t).map(p => ({ t: p.t, v: p.value })) },
              { key: 'real', label: 'Real rate', color: 'var(--series-3)', points: real.map(p => ({ t: p.t, v: p.value })) },
            ]} />
        </ChartFrame>
      )}

      {/* 10 · Anomalies */}
      <section className="viz-card" aria-label="What moved unusually in the latest year">
        <header className="viz-head"><div><h3 className="viz-title">What moved unusually in the latest year</h3><p className="viz-sub">The latest year-on-year change in every series, compared with that series' own past changes.</p></div></header>
        <div className="viz-kpis">
          <Kpi label="Series tested" value={String(anomalies.tested)} detail="≥ 11 yearly changes" />
          <Kpi label={`Flagged (|z| ≥ ${ANOMALY_Z})`} value={String(anomalies.flags.length)} detail={`≈ ${anomalies.expectedByChance.toFixed(1)} expected by chance`} />
        </div>
        {anomalies.flags.length ? (
          <div className="viz-table-wrap">
            <table className="viz-table">
              <thead><tr><th scope="col">Indicator</th><th scope="col">Year</th><th scope="col">Change</th><th scope="col">Typical</th><th scope="col">z</th></tr></thead>
              <tbody>{anomalies.flags.map(a => {
                const m = SERIES_BY_ID.get(a.id)!
                const unit = changeMode(m.kind) === 'log' ? '%' : (m.kind === 'pct' || m.kind === 'growth') ? ' pp' : ''
                return <tr key={a.id}><th scope="row">{m.short}</th><td>{a.year}</td><td>{signedVal(a.change, unit, m.kind)}</td><td>±{m.kind === 'pct' || m.kind === 'growth' || changeMode(m.kind) === 'log' ? a.typical.toFixed(2) : formatValue(m.kind, a.typical)}{unit}</td><td>{plain(a.z)}</td></tr>
              })}</tbody>
            </table>
          </div>
        ) : <p className="viz-sub">Nothing unusual: every latest change is within the usual range of that series' own history.</p>}
        <Method caveats="The chance figure assumes normally distributed changes; real macro changes have fatter tails, so expect somewhat more false flags. A flag says 'look here', not 'something is wrong'. Base revisions and methodology changes also show up as jumps.">
          Robust z-score: (latest change − median of past changes) / (1.4826 × median absolute deviation). Money and headcount series use log changes (%); rates and shares use differences.
        </Method>
      </section>
    </>
  )
}

function signedVal(v: number, unit: string, kind: Parameters<typeof formatValue>[0]): string {
  if (unit) return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}${unit}`
  return `${v > 0 ? '+' : ''}${formatValue(kind, v)}`
}
