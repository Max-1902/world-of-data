import { useMemo, useState } from 'react'
import { ArrowLeftRight, Map as MapIcon, RefreshCw } from 'lucide-react'
import { useCountryAnalytics } from '../../hooks/useCountryAnalytics'
import { sliceOf } from '../../services/countryAnalytics'
import { INDICATORS, INDICATOR_BY_ID, INDICATOR_GROUPS, MATRIX_IDS, PRESETS } from '../../services/countryIndicators'
import { correlationMatrix, describeFit, describePair, histogram, type MapMode } from '../../utils/countryStats'
import { ChartFrame } from '../charts/ChartFrame'
import { ScatterChart } from '../charts/ScatterChart'
import { RankChart } from '../charts/RankChart'
import { BarsChart } from '../charts/BarsChart'
import { CorrMatrixChart } from '../charts/CorrMatrixChart'
import type { PanelState } from '../../types'

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="viz-kpi">
      <div className="viz-kpi-l">{label}</div>
      <div className="viz-kpi-v">{value}</div>
      {detail && <div className="viz-kpi-d">{detail}</div>}
    </div>
  )
}

function IndicatorSelect({ id, label, onChange }: { id: string; label: string; onChange: (id: string) => void }) {
  return (
    <label className="viz-field">
      <span>{label}</span>
      <select className="viz-select" value={id} onChange={e => onChange(e.target.value)}>
        {INDICATOR_GROUPS.map(g => (
          <optgroup key={g} label={g}>
            {INDICATORS.filter(i => i.group === g).map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

const sign = (v: number) => (v >= 0 ? '+' : '−')

export function CountryAnalyticsPanel({ panelState, onToggleLayer, onGeoSearch }: {
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  onGeoSearch?: (q: string) => void
}) {
  const [showMatrix, setShowMatrix] = useState(false)
  const c = useCountryAnalytics(true, showMatrix ? MATRIX_IDS : [])
  const { xMeta, yMeta, xs, ys, xSlice, ySlice, analysis, state } = c
  const { x, y } = state.selection
  const layerOn = panelState.countryAnalytics

  const topY = useMemo(() => [...ySlice.rows].sort((a, b) => b.value - a.value).slice(0, 10), [ySlice.rows])
  const hist = useMemo(() => histogram(ySlice.rows.map(r => r.value), ys, 12), [ySlice.rows, ys])
  const matrix = useMemo(() => {
    if (!showMatrix) return null
    const items = MATRIX_IDS.map(id => ({ id, rows: sliceOf(state, id).rows }))
    return items.some(i => i.rows.length > 0) ? correlationMatrix(items) : null
  }, [showMatrix, state])
  const matrixLoading = showMatrix && MATRIX_IDS.some(id => ['idle', 'loading'].includes(sliceOf(state, id).status))
  const matrixFailed = showMatrix ? MATRIX_IDS.filter(id => sliceOf(state, id).status === 'error').length : 0

  const loading = [xSlice, ySlice].some(s => s.status === 'idle' || s.status === 'loading')
  const failed = [xSlice, ySlice].find(s => s.status === 'error')
  const fly = (name: string) => onGeoSearch?.(name)

  return (
    <div className="viz-root">
      <div className="viz-chips" role="group" aria-label="Starting comparisons">
        {PRESETS.map(p => (
          <button key={p.title} className={`cy-btn ${p.x === x && p.y === y ? 'active' : ''}`} aria-pressed={p.x === x && p.y === y} title={p.blurb} onClick={() => c.setSelection(p.x, p.y)}>
            {p.title}
          </button>
        ))}
      </div>

      <div className="viz-pickers">
        <IndicatorSelect id={x} label="X axis" onChange={id => c.setSelection(id, y)} />
        <button className="cy-btn viz-swap" title="Swap the two indicators" aria-label="Swap X and Y" onClick={() => c.setSelection(y, x)}><ArrowLeftRight size={12} /></button>
        <IndicatorSelect id={y} label="Y axis" onChange={id => c.setSelection(x, id)} />
      </div>

      <p className="viz-sub" style={{ margin: '-2px 2px 0' }}>
        {INDICATORS.length} indicators from {[...new Set(INDICATORS.map(i => i.source))].join(', ')}. This pair: {xMeta.source}{xMeta.source !== yMeta.source ? ` and ${yMeta.source}` : ''}.
      </p>

      <div className="viz-filters">
        <button className={`cy-btn ${layerOn ? 'active' : ''}`} aria-pressed={layerOn} onClick={() => onToggleLayer('countryAnalytics')} title="Colour the countries on the globe with these results">
          <MapIcon size={11} /> {layerOn ? 'On the map' : 'Show on map'}
        </button>
        {(['value', 'trend'] as MapMode[]).map(m => (
          <button key={m} className={`cy-btn ${state.mapMode === m ? 'active' : ''}`} aria-pressed={state.mapMode === m} onClick={() => c.setMapMode(m)}
            title={m === 'value' ? `Shade countries by ${yMeta.label}` : 'Shade countries by how far they sit above or below the trend'}>
            {m === 'value' ? 'Value' : 'Vs trend'}
          </button>
        ))}
      </div>

      {loading && <div className="viz-note" role="status">Loading country data from the World Bank…</div>}
      {failed && (
        <div className="viz-note" role="status">
          Could not load {failed === xSlice ? xMeta.label : yMeta.label}{failed.error ? ` (${failed.error})` : ''}.
          <div style={{ marginTop: 6 }}><button className="cy-btn" onClick={() => { void c.reload(x); void c.reload(y) }}><RefreshCw size={11} /> Retry</button></div>
        </div>
      )}
      {!loading && !failed && !analysis && (
        <div className="viz-note" role="status">Too few countries report both of these indicators to compare them. Pick another pair.</div>
      )}

      {analysis && (
        <>
          <div className="viz-kpis">
            <Kpi label="Countries" value={String(analysis.n)} detail="reporting both" />
            <Kpi label="Spearman ρ" value={analysis.spearman === null ? '—' : analysis.spearman.toFixed(2)} detail={analysis.ci ? `95%: ${analysis.ci[0].toFixed(2)} to ${analysis.ci[1].toFixed(2)}` : undefined} />
            <Kpi label="Pearson r" value={analysis.pearson === null ? '—' : analysis.pearson.toFixed(2)} detail="on the plotted axes" />
            <Kpi label="Trend R²" value={analysis.fit.r2.toFixed(2)} detail={`${Math.round(analysis.fit.r2 * 100)}% along the line`} />
          </div>

          <ChartFrame
            title={`${yMeta.short} vs ${xMeta.short}`}
            subtitle="Each dot is a country. Click one to fly there."
            table={{
              columns: ['Country', xMeta.short, yMeta.short, 'Trend expects', 'σ from trend'],
              rows: [...analysis.points].sort((a, b) => b.z - a.z).map(p => [p.name, xMeta.format(p.x), yMeta.format(p.y), yMeta.format(p.expected), `${sign(p.z)}${Math.abs(p.z).toFixed(1)}`]),
            }}
            footer="Each country's value is its latest year since 2010, so years differ by country (shown on hover). Correlation is not causation."
          >
            <p className="viz-verdict" style={{ marginBottom: 6 }}>{describePair(analysis, xMeta, yMeta)} {describeFit(analysis.fit, xs, ys, xMeta, yMeta)}</p>
            <ScatterChart points={analysis.points} xs={xs} ys={ys} xMeta={xMeta} yMeta={yMeta} fit={analysis.fit} over={analysis.over} under={analysis.under} onSelect={iso => { const p = analysis.points.find(q => q.iso3 === iso); if (p) fly(p.name) }} />
          </ChartFrame>

          <ChartFrame
            title="Furthest from the trend"
            subtitle={`Countries whose ${yMeta.short} is most above or below what their ${xMeta.short} predicts, in standard deviations (σ) of the fit.`}
            table={{
              columns: ['Country', 'Actual', 'Trend expects', 'σ'],
              rows: [...analysis.over, ...analysis.under].map(p => [p.name, yMeta.format(p.y), yMeta.format(p.expected), `${sign(p.z)}${Math.abs(p.z).toFixed(1)}`]),
            }}
          >
            <p className="viz-sub" style={{ margin: '0 0 2px' }}>Above the trend</p>
            <RankChart ariaLabel={`Countries furthest above the trend line for ${yMeta.label}`} onSelect={k => fly(k)}
              items={analysis.over.map(p => ({ key: p.name, label: p.name, value: p.z, text: `+${p.z.toFixed(1)} σ`, detail: `${yMeta.format(p.y)} actual vs ${yMeta.format(p.expected)} expected` }))} />
            <p className="viz-sub" style={{ margin: '8px 0 2px' }}>Below the trend</p>
            <RankChart ariaLabel={`Countries furthest below the trend line for ${yMeta.label}`} onSelect={k => fly(k)}
              items={analysis.under.map(p => ({ key: p.name, label: p.name, value: -p.z, text: `−${Math.abs(p.z).toFixed(1)} σ`, detail: `${yMeta.format(p.y)} actual vs ${yMeta.format(p.expected)} expected` }))} />
          </ChartFrame>
        </>
      )}

      {ySlice.status === 'ready' && ySlice.rows.length > 0 && (
        <>
          <ChartFrame
            title={`Highest ${yMeta.short}`}
            subtitle={`Top 10 of ${ySlice.rows.length} countries with data for ${yMeta.label}.`}
            table={{ columns: ['Rank', 'Country', yMeta.short, 'Year'], rows: [...ySlice.rows].sort((a, b) => b.value - a.value).slice(0, 25).map((r, i) => [i + 1, r.name, yMeta.format(r.value), r.year]) }}
            footer="Table lists the top 25."
          >
            <RankChart ariaLabel={`Ten countries with the highest ${yMeta.label}`} onSelect={fly}
              items={topY.map(r => ({ key: r.name, label: r.name, value: r.value, text: yMeta.format(r.value), detail: `Latest year: ${r.year}` }))} />
          </ChartFrame>

          <ChartFrame
            title={`Distribution of ${yMeta.short}`}
            subtitle={`How the ${ySlice.rows.length} countries spread across the range${ys.kind === 'log' ? ' (log-spaced bins)' : ''}.`}
            table={{ columns: ['From', 'To', 'Countries'], rows: hist.map(b => [yMeta.format(b.lo), yMeta.format(b.hi), b.count]) }}
          >
            <BarsChart items={hist.map(b => ({ label: yMeta.format(b.lo), value: b.count, detail: `${yMeta.format(b.lo)} to ${yMeta.format(b.hi)}` }))} unit="countries" tickEvery={3} ariaLabel={`Histogram of ${yMeta.label} across countries`} />
          </ChartFrame>
        </>
      )}

      <ChartFrame
        title="What moves together"
        subtitle="Spearman rank correlation between ten indicators, using the countries each pair has in common. Click a cell to plot that pair."
        table={{
          columns: ['Indicator', ...MATRIX_IDS.map(id => INDICATOR_BY_ID.get(id)!.short)],
          rows: matrix ? MATRIX_IDS.map((id, i) => [INDICATOR_BY_ID.get(id)!.short, ...matrix.rho[i].map(r => (r === null ? '—' : r.toFixed(2)))]) : [],
        }}
        footer={matrix ? `Blank cells ("–") have fewer than 12 countries in common.${matrixFailed ? ` ${matrixFailed} indicator${matrixFailed === 1 ? '' : 's'} could not be loaded.` : ''}` : undefined}
      >
        {!showMatrix ? (
          <button className="cy-btn" onClick={() => setShowMatrix(true)} title="Fetches ten World Bank indicators">Compute (loads 10 indicators)</button>
        ) : matrix && !matrixLoading ? (
          <CorrMatrixChart matrix={matrix} labels={MATRIX_IDS.map(id => INDICATOR_BY_ID.get(id)!.short)} names={MATRIX_IDS.map(id => INDICATOR_BY_ID.get(id)!.label)}
            onPick={(i, j) => c.setSelection(MATRIX_IDS[j], MATRIX_IDS[i])} />
        ) : <div className="viz-note" role="status">Loading the indicators…</div>}
      </ChartFrame>

      <div className="viz-note">
        Sources: World Bank Open Data (economy, trade, population, military, society, resource rents), Our World in Data (conflict and terrorism deaths, R&D, primary and renewable energy) and Ember (electricity mix) — all free, no key, and the same feeds the other country panels use. Military series are SIPRI/IISS-derived and missing for many countries; conflict figures come from UCDP via Our World in Data. Everything is computed in the browser from the rows those services return; nothing is estimated or filled in.
      </div>
    </div>
  )
}
