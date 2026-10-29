import { useState } from 'react'
import { Palette } from 'lucide-react'
import { BELOW, NEUTRAL, ABOVE, sequentialColor } from '../../../utils/vizPalette'
import { WB_ECONOMY_ISO3 } from '../../../services/economies'
import { selectForMap } from '../../../services/countryAnalytics'
import { STALE_YEARS, TREND_Z_FULL, makeScale, type countryColors } from '../../../utils/countryStats'
import type { useCountryAnalytics } from '../../../hooks/useCountryAnalytics'
import type { Shading } from '../layers/countryAnalytics'
import { NO_DATA_FILL, NO_DATA_OPACITY } from '../layers/countryAnalytics'
import { EvidenceTag, SourceLine, StatusLabel } from '../../DataLabels'
import { IndicatorPicker } from './IndicatorPicker'

/** The ramp as drawn on the map: values start at 20% along SEQUENTIAL, so the legend bar starts there too. */
const RAMP_STOPS = [0.2, 0.36, 0.52, 0.68, 0.84, 1].map(sequentialColor)

/** The value halfway along the colour ramp, which on a log scale is the geometric middle, not the average. */
function midpoint(lo: number, hi: number, kind: Parameters<typeof makeScale>[0]): number {
  const sc = makeScale(kind)
  return sc.inv((sc.fwd(lo) + sc.fwd(hi)) / 2)
}

/** The quick-pick list for "Colour countries by": the four indicators people reach for most, as a plain dropdown. */
export const COLOUR_BY_OPTIONS = [
  { id: 'NY.GDP.PCAP.CD', label: 'GDP per capita' },
  { id: 'SP.DYN.LE00.IN', label: 'Life expectancy' },
  { id: 'EN.GHG.CO2.MT.CE.AR5', label: 'CO₂ emissions' },
  { id: 'EG.FEC.RNEW.ZS', label: 'Renewable energy' },
] as const

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
      // wrapped: the app-wide `.dashboard button` rule would override a button's own absolute positioning
      <div className="cc-anchor" style={{ bottom }}>
        <button className="cc-launch" onClick={onToggle} title="Shade every country by an economic, energy, security or social indicator">
          <Palette size={14} strokeWidth={1.8} aria-hidden /> Colour countries by data
        </button>
      </div>
    )
  }

  const { xMeta, yMeta, xSlice, ySlice, state } = countryData
  const trend = state.mapMode === 'trend'
  const loading = ySlice.status === 'idle' || ySlice.status === 'loading' || (trend && (xSlice.status === 'idle' || xSlice.status === 'loading'))
  const failed = ySlice.status === 'error' ? ySlice : trend && xSlice.status === 'error' ? xSlice : null
  const { cover } = shading
  const source = trend && xMeta.source !== yMeta.source ? `${yMeta.source}, ${xMeta.source}` : yMeta.source
  // computed in the browser by a panel (e.g. Shock Exposure), not a catalogue series
  const derived = yMeta.id.startsWith('derived:') || (trend && xMeta.id.startsWith('derived:'))

  return (
    <div className="cc-card" style={{ bottom }} onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} role="region" aria-label="Colour countries by data">
      <div className="cc-kicker">
        <span>Colour countries by</span>
        <button className="cc-x" onClick={onToggle} aria-label="Stop colouring countries" title="Stop colouring countries">×</button>
      </div>

      <select
        className="cc-select"
        aria-label="Colour countries by"
        value={COLOUR_BY_OPTIONS.some(o => o.id === yMeta.id) ? yMeta.id : 'more'}
        onChange={e => {
          const id = e.target.value
          if (id === 'more') { setPicking('y'); return }
          selectForMap(id)
          if (trend) countryData.setMapMode('trend')
        }}
      >
        {COLOUR_BY_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        <option value="more">{COLOUR_BY_OPTIONS.some(o => o.id === yMeta.id) ? 'More…' : yMeta.label}</option>
      </select>
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
        <div className="cc-ramp" style={{ background: trend ? `linear-gradient(90deg, ${BELOW}, ${NEUTRAL}, ${ABOVE})` : `linear-gradient(90deg, ${RAMP_STOPS.join(',')})` }} />
        <div className="cc-ends">
          {trend
            ? <><span>Below · −{TREND_Z_FULL} σ</span><span>On trend · 0</span><span>Above · +{TREND_Z_FULL} σ</span></>
            : <>
                <span>{countryShading.lo === null ? 'Low' : yMeta.format(countryShading.lo)}</span>
                {countryShading.lo !== null && countryShading.hi !== null && <span>{yMeta.format(midpoint(countryShading.lo, countryShading.hi, yMeta.scale))}</span>}
                <span>{countryShading.hi === null ? 'High' : yMeta.format(countryShading.hi)}</span>
              </>}
        </div>
      </div>

      <div className="cc-ev">
        <EvidenceTag kind={trend ? 'statistical' : 'observed'} />
        <span>{trend
          ? `Distance from a least-squares line fitted across countries, in standard deviations (σ); colour is full at ±${TREND_Z_FULL} σ. An association, not a cause.`
          : `${derived ? 'Computed from reported figures; open the panel that made it for each step' : 'As reported'}${countryShading.lo !== null ? `; colour scale clipped to the 2nd–98th percentile${yMeta.scale === 'linear' ? '' : ' and spaced logarithmically, so the middle label is the geometric middle'}` : ''}.`}</span>
      </div>

      {loading ? <StatusLabel status="loading">{source} data…</StatusLabel>
        : failed ? <StatusLabel status="error">Could not load this indicator{failed.error ? ` (${failed.error})` : ''}.</StatusLabel>
        : shading.shaded === 0 ? <StatusLabel status="empty">No countries to shade for this selection.</StatusLabel>
        : (
          <div className="cc-cover">
            <div>{shading.shaded} countries shaded · <span className="cc-swatch" style={{ background: NO_DATA_FILL, opacity: NO_DATA_OPACITY + 0.2 }} />{shading.noData.length} of {WB_ECONOMY_ISO3.size} World Bank economies have no value</div>
            {cover.typicalYear !== null && (
              <div>
                Years {cover.minYear === cover.maxYear ? cover.minYear : `${cover.minYear}–${cover.maxYear}`}, most often {cover.typicalYear}.
                {shading.stale.size > 0 && ` Faded: ${shading.stale.size} ${shading.stale.size === 1 ? 'country' : 'countries'} with data from ${cover.typicalYear - STALE_YEARS} or earlier${trend ? ' in either indicator' : ''}.`}
              </div>
            )}
          </div>
        )}

      <SourceLine source={source} asOf={derived ? "each country's own reporting year" : "each country's latest year since 2010"}>click a country</SourceLine>
    </div>
  )
}
