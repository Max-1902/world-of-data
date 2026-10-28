import { BACKTEST_AS_OF, BACKTEST_ROWS, NOISE_BAND } from '../../data/predictorBacktest'

const r3 = (v: number) => v.toFixed(3)
const pair = (a: number | null, b: number | null) => (a === null || b === null ? 'no data' : `${r3(a)} / ${r3(b)}`)

/**
 * Drivers: which indicators help predict a country's next-year GDP growth. Kept separate from "moves with GDP":
 * co-movement is descriptive and lives in Explore; this page only reports what survived an out-of-sample test.
 */
export default function DriversPanel() {
  const scored = BACKTEST_ROWS.filter(r => !r.exploratory)
  const passed = scored.filter(r => r.passed).length
  return (
    <div className="viz-root">
      <div className="viz-section"><h2>Does it improve the forecast?</h2><span>Backtest, run {BACKTEST_AS_OF}</span></div>
      <div className="viz-note" role="status">
        <b>{passed} of {scored.length}</b> candidate indicators improved one-year-ahead GDP-growth forecasts over the AR(2) model the Forecasts page uses.
        Each was added to AR(2) and scored on forecasts it had not seen, across up to 217 economies. The bar was fixed before any accuracy was computed.
      </div>
      <div className="viz-note">
        <b>To pass, all of these had to hold</b>, for a per-economy or a pooled slope, against both baselines:
        <ol style={{ margin: '4px 0 0 18px', padding: 0 }}>
          <li>Error ratio below 1 in <b>both</b> origin periods, 1990–2009 and 2010–2024.</li>
          <li>Lower error in more than half of the economies in each period.</li>
          <li>Diebold–Mariano p below 0.0042 across origin years (0.05 split over 12 tests), so one global shock cannot decide it.</li>
        </ol>
        An indicator with no data before 2010 (unemployment, Brent) cannot satisfy the first condition. Unemployment also fails 2010–2024 on its own: its pooled slope has a ratio below 1 (0.988) but beat AR(2) in only 45% of economies, p = 0.297.
      </div>
      <div className="viz-table-wrap" style={{ maxHeight: 'none' }}>
        <table className="viz-table">
          <thead><tr>
            <th scope="col">Indicator</th><th scope="col">Economies 1990–2009 / 2010–2024</th>
            <th scope="col">Error ratio 1990–2009, own / pooled</th><th scope="col">Error ratio 2010–2024, own / pooled</th>
            <th scope="col">Beat AR(2) 2010–2024, own / pooled</th><th scope="col">DM p, own / pooled</th><th scope="col">Verdict</th>
          </tr></thead>
          <tbody>{BACKTEST_ROWS.map(r => (
            <tr key={r.id}>
              <th scope="row">{r.label}{r.exploratory ? ' (exploratory)' : ''}</th>
              <td>{r.economiesEarly} / {r.economies}</td>
              <td>{pair(r.ratioEarlyOwn, r.ratioEarlyPooled)}</td>
              <td>{pair(r.ratioOwn, r.ratioPooled)}</td>
              <td>{Math.round(r.shareOwn * 100)}% / {Math.round(r.sharePooled * 100)}%</td>
              <td>{r.dmOwn} / {r.dmPooled}</td>
              <td>{r.exploratory ? 'not scored' : r.passed ? 'improves' : 'no gain'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="viz-note">
        Ratios and shares are against the shipped AR(2); the second baseline (AR(2) refitted on the same years as the indicator) gave the same verdict for every candidate. An error ratio above 1 means the forecast got worse. A predictor of pure noise scores about {r3(NOISE_BAND.own)} with a per-economy slope and {r3(NOISE_BAND.pooled)} pooled, and every candidate's ratio sits in that noise band (own slope 1.01–1.10, pooled 0.97–1.04).
        The per-economy versions are mostly worse than AR(2), the usual cost of fitting an extra parameter on about 30 annual points.
      </div>
      <div className="viz-section"><h2>What this does not show</h2><span /></div>
      <div className="viz-note">
        This is a statement about <i>this</i> test: one-year horizon, AR(2) baseline, current-vintage World Bank data (revised after first release, which flatters models slightly),
        and these seven candidates. It does not show that growth is unrelated to inflation, credit or unemployment. It shows that adding them did not make this forecast more accurate.
        Trade-weighted partner growth could not be tested: the bundled trade profiles cover one recent year.
      </div>
      <div className="viz-section"><h2>Where else to look</h2><span /></div>
      <div className="viz-note">
        <b>How shocks spread</b> (below) traces which economies a shock reaches through sourced trade links.
        <b> Explore</b> compares any two country indicators and shows what moves together across countries: description only, not prediction.
      </div>
    </div>
  )
}
