import { useState } from 'react'
import { SEQUENTIAL, BELOW, NEUTRAL, ABOVE } from '../../../utils/vizPalette'
import { WB_ECONOMY_ISO3 } from '../../../services/economies'
import { selectForMap } from '../../../services/countryAnalytics'
import { STALE_YEARS, type countryColors } from '../../../utils/countryStats'
import type { useCountryAnalytics } from '../../../hooks/useCountryAnalytics'
import type { Shading } from '../layers/countryAnalytics'
import { NO_DATA_FILL } from '../layers/countryAnalytics'
import { EvidenceTag, SourceLine, StatusLabel } from '../../DataLabels'
import { IndicatorPicker } from './IndicatorPicker'

interface Props {
  on: boolean
  onToggle: () => void
  countryData: ReturnType<typeof useCountryAnalytics>
  countryShading: ReturnType<typeof countryColors>
  shading: Shading
  /** the hazard-hex legend sits at the bottom right too, so this one moves up when it is showing */
  raised: boolean
}

/**
 * "Colour countries by …": the one place on the map to shade every country by any catalogue indicator. It is also the
 * legend, and says what kind of claim the colours are, how many countries report, and how comparable their years are.
 */
export default function CountryColorControl({ on, onToggle, countryData, countryShading, shading, raised }: Props) {
  const [picking, setPicking] = useState<'y' | 'x' | null>(null)
  const bottom = raised ? 232 : 58
  if (!on) {
    return (
      <button className="cc-launch" style={{ bottom }} onClick={onToggle} title="Shade every country by an economic, energy, security or social indicator">
        ▦ Colour countries by data
      </button>
    )
  }

  const { xMeta, yMeta, xSlice, ySlice, state } = countryData
  const trend = state.mapMode === 'trend'
  const loading = ySlice.status === 'idle' || ySlice.status === 'loading' || (trend && (xSlice.status === 'idle' || xSlice.status === 'loading'))
  const failed = ySlice.status === 'error' ? ySlice : trend && xSlice.status === 'error' ? xSlice : null
  const { cover } = shading
  const source = trend && xMeta.source !== yMeta.source ? `${yMeta.source}, ${xMeta.source}` : yMeta.source

  return (
    <div className="cc-card" style={{ bottom }} onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} role="region" aria-label="Colour countries by data">
      <div className="cc-kicker">
        <span>Colour countries by</span>
        <button className="cc-x" onClick={onToggle} aria-label="Stop colouring countries" title="Stop colouring countries">×</button>
      </div>

      <button className="cc-pick" aria-expanded={picking === 'y'} onClick={() => setPicking(p => p === 'y' ? null : 'y')}>
        <span>{yMeta.label}</span><small>▾</small>
      </button>
      {picking === 'y' && (
        <IndicatorPicker value={yMeta.id} onPick={id => { selectForMap(id); if (trend) countryData.setMapMode('trend'); setPicking(null) }} onClose={() => setPicking(null)} />
      )}

      <div className="cc-modes" role="group" aria-label="Colour by">
        <button aria-pressed={!trend} onClick={() => countryData.setMapMode('value')}>Value</button>
        <button aria-pressed={trend} onClick={() => countryData.setMapMode('trend')}>Vs trend</button>
      </div>
      {trend && (
        <>
          <div className="cc-sublabel">…compared with what this predicts:</div>
          <button className="cc-pick" aria-expanded={picking === 'x'} onClick={() => setPicking(p => p === 'x' ? null : 'x')}>
            <span>{xMeta.label}</span><small>▾</small>
          </button>
          {picking === 'x' && (
            <IndicatorPicker value={xMeta.id} exclude={yMeta.id} onPick={id => { countryData.setSelection(id, yMeta.id); setPicking(null) }} onClose={() => setPicking(null)} />
          )}
        </>
      )}

      <div>
        <div className="cc-ramp" style={{ background: trend ? `linear-gradient(90deg, ${BELOW}, ${NEUTRAL}, ${ABOVE})` : `linear-gradient(90deg, ${SEQUENTIAL.join(',')})` }} />
        <div className="cc-ends">
          {trend
            ? <><span>Below trend</span><span>On trend</span><span>Above</span></>
            : <><span>{countryShading.lo === null ? 'Low' : yMeta.format(countryShading.lo)}</span><span>{countryShading.hi === null ? 'High' : yMeta.format(countryShading.hi)}</span></>}
        </div>
      </div>

      <div className="cc-ev">
        <EvidenceTag kind={trend ? 'statistical' : 'observed'} />
        <span>{trend
          ? `Distance from a least-squares line fitted across countries, in standard deviations. An association, not a cause.`
          : `As reported${countryShading.lo !== null ? '; colour scale clipped to the 2nd–98th percentile' : ''}.`}</span>
      </div>

      {loading ? <StatusLabel status="loading">{source} data…</StatusLabel>
        : failed ? <StatusLabel status="error">Could not load this indicator{failed.error ? ` (${failed.error})` : ''}.</StatusLabel>
        : shading.shaded === 0 ? <StatusLabel status="empty">No countries to shade for this selection.</StatusLabel>
        : (
          <div className="cc-cover">
            <div>{shading.shaded} countries shaded · <span className="cc-swatch" style={{ background: NO_DATA_FILL }} />{shading.noData.length} of {WB_ECONOMY_ISO3.size} World Bank economies have no value</div>
            {cover.typicalYear !== null && (
              <div>
                Years {cover.minYear === cover.maxYear ? cover.minYear : `${cover.minYear}–${cover.maxYear}`}, most often {cover.typicalYear}.
                {shading.stale.size > 0 && ` Faded: ${shading.stale.size} ${shading.stale.size === 1 ? 'country' : 'countries'} with data from ${cover.typicalYear - STALE_YEARS} or earlier${trend ? ' in either indicator' : ''}.`}
              </div>
            )}
          </div>
        )}

      <SourceLine source={source} asOf="each country's latest year since 2010">click a country</SourceLine>
    </div>
  )
}
