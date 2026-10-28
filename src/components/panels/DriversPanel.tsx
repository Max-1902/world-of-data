import { BACKTEST_AS_OF, BACKTEST_ROWS, NOISE_BAND } from '../../data/predictorBacktest'

const r3 = (v: number) => v.toFixed(3)

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
        Each was added to AR(2) and scored on forecasts it had not seen, 217 economies, origin years 2010–2024. The bar was fixed before any accuracy was computed.
      </div>
      <div className="viz-table-wrap" style={{ maxHeight: 'none' }}>
        <table className="viz-table">
          <thead><tr>
            <th scope="col">Indicator</th><th scope="col">Economies</th><th scope="col">Error vs AR(2), own slope</th>
            <th scope="col">Error vs AR(2), pooled slope</th><th scope="col">Beat AR(2), own slope</th><th scope="col">Verdict</th>
          </tr></thead>
          <tbody>{BACKTEST_ROWS.map(r => (
            <tr key={r.id}>
              <th scope="row">{r.label}{r.exploratory ? ' (exploratory)' : ''}</th>
              <td>{r.economies}</td><td>{r3(r.ratioOwn)}</td><td>{r3(r.ratioPooled)}</td>
              <td>{Math.round(r.shareOwn * 100)}% of economies</td>
              <td>{r.exploratory ? 'not scored' : r.passed ? 'improves' : 'no gain'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="viz-note">
        An error ratio above 1 means the forecast got worse. A predictor of pure noise scores about {r3(NOISE_BAND.own)} with a per-economy slope and {r3(NOISE_BAND.pooled)} pooled, and every row sits in that band.
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
