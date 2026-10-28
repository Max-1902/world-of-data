import { useMemo, useState } from 'react'
import { useCountryAnalytics } from '../../hooks/useCountryAnalytics'
import { sliceOf } from '../../services/countryAnalytics'
import { INDICATOR_BY_ID, MATRIX_IDS } from '../../services/countryIndicators'
import { correlationMatrix } from '../../utils/countryStats'
import { ChartFrame } from './ChartFrame'
import { CorrMatrixChart } from './CorrMatrixChart'

const LABELS = MATRIX_IDS.map(id => INDICATOR_BY_ID.get(id)!.short)
const NAMES = MATRIX_IDS.map(id => INDICATOR_BY_ID.get(id)!.label)

/**
 * "What moves together": the Spearman matrix over MATRIX_IDS, loaded only when asked for (it fetches every indicator).
 * Shared by the Country Analytics panel and the home page; clicking a cell sets the shared comparison selection and
 * calls `onPick`, so a host can open the panel that plots that pair.
 */
export function CorrMatrixCard({ onPick }: { onPick?: (x: string, y: string) => void }) {
  const [show, setShow] = useState(false)
  const c = useCountryAnalytics(show, show ? MATRIX_IDS : [])
  const { state } = c

  const matrix = useMemo(() => {
    if (!show) return null
    const items = MATRIX_IDS.map(id => ({ id, rows: sliceOf(state, id).rows }))
    return items.some(i => i.rows.length > 0) ? correlationMatrix(items) : null
  }, [show, state])
  // each country contributes its own latest value, so the reporting year differs by country; list the spread per indicator
  const yearSpans = useMemo(() => {
    if (!show) return []
    return MATRIX_IDS.map((id, i) => {
      const years = sliceOf(state, id).rows.map(r => r.year).filter(y => /^\d{4}$/.test(y)).map(Number)
      return { name: NAMES[i], span: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : 'no data' }
    })
  }, [show, state])
  const loading = show && MATRIX_IDS.some(id => ['idle', 'loading'].includes(sliceOf(state, id).status))
  const failed = show ? MATRIX_IDS.filter(id => sliceOf(state, id).status === 'error').length : 0

  return (
    <ChartFrame
      title="What moves together"
      subtitle={`Spearman rank correlation between ${MATRIX_IDS.length} indicators across countries, using the countries each pair has in common. Click a cell to plot that pair.`}
      table={{
        columns: ['Indicator', ...LABELS],
        rows: matrix ? MATRIX_IDS.map((id, i) => [INDICATOR_BY_ID.get(id)!.short, ...matrix.rho[i].map(r => (r === null ? '—' : r.toFixed(2)))]) : [],
      }}
      footer={matrix ? (
        <>
          <p>
            <b>Association between countries, not a forecast.</b> A cell says that countries ranking high on one indicator tend to rank high or low on the other, at one point in time. It does not show cause, and it is not a test of what predicts a country's future GDP growth: the Drivers page tests that, and found no gain.
          </p>
          <p>
            Blank cells ("–") have fewer than 12 countries in common.{failed ? ` ${failed} indicator${failed === 1 ? '' : 's'} could not be loaded.` : ''} Each country contributes its latest available value, so reporting years differ by country.
          </p>
          <details>
            <summary>Years covered per indicator</summary>
            <ul>{yearSpans.map(y => <li key={y.name}>{y.name}: {y.span}</li>)}</ul>
          </details>
        </>
      ) : undefined}
    >
      {!show ? (
        <button className="cy-btn" onClick={() => setShow(true)} title={`Fetches ${MATRIX_IDS.length} indicators`}>Compute (loads {MATRIX_IDS.length} indicators)</button>
      ) : matrix && !loading ? (
        <CorrMatrixChart matrix={matrix} labels={LABELS} names={NAMES}
          onPick={(i, j) => { c.setSelection(MATRIX_IDS[j], MATRIX_IDS[i]); onPick?.(MATRIX_IDS[j], MATRIX_IDS[i]) }} />
      ) : <div className="viz-note" role="status">Loading the indicators…</div>}
    </ChartFrame>
  )
}
