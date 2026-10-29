import { sequentialColor } from '../../../utils/vizPalette'
import { analyticsData } from '../../../services/analyticsData'
import type { useAnalyticsData } from '../../../hooks/useAnalyticsData'

type Analytics = ReturnType<typeof useAnalyticsData>

interface Props {
  analytics: Analytics
  hexSlice: Analytics['fires'] | Analytics['quakes']
  onTilt: () => void
}

/** The map ramp starts at 30% along the sequential scale so quiet cells stay visible (layers/hazardHex.ts). */
const RAMP_STOPS = [0.3, 0.44, 0.58, 0.72, 0.86, 1].map(sequentialColor)

/** Cell totals are drawn on a square-root scale (hexbin.drawProps), so the halfway colour is a quarter of the maximum. */
export function hexBreaks(maxValue: number): [number, number, number] {
  return [0, maxValue / 4, maxValue]
}

export default function HazardHexLegend({ analytics, hexSlice, onTilt }: Props) {
  const fires = analytics.hexSource === 'fires'
  const max = hexSlice.cells.reduce((m, c) => Math.max(m, c.value), 0)
  const fmt = (v: number) => Math.round(v).toLocaleString()
  return (
  <div className="map-legend" style={{ right:10, bottom:58, width:220 }}>
    <div style={{ fontSize:11, fontWeight:650, color:'var(--text1)' }}>
      {analytics.hexSource === 'fires' ? 'Wildfire power, last 24 h' : 'Earthquakes M4.5+, last 7 days'}
    </div>
    <div style={{ marginTop:6, height:6, borderRadius:3, background:`linear-gradient(90deg, ${RAMP_STOPS.join(',')})` }} />
    <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9, color:'var(--text2)' }}>{max > 0
      ? hexBreaks(max).map((v, i) => <span key={i}>{fmt(v)}</span>)
      : <><span>Low</span><span>High</span></>}</div>
    {max > 0 && (
      <div style={{ marginTop:2, fontSize:9, color:'var(--text3)' }}>
        {fires ? 'MW of fire radiative power per cell' : 'quakes per cell'}, square-root scale
      </div>
    )}
    <div style={{ marginTop:5, fontSize:9, color:'var(--text3)', lineHeight:1.45 }}>
      {hexSlice.status === 'loading' || hexSlice.status === 'idle' ? 'Loading…'
        : hexSlice.status === 'error' ? `Could not load this feed${hexSlice.error ? ` (${hexSlice.error})` : ''}.`
        : hexSlice.status === 'empty' ? 'The feed returned no data — nothing to draw.'
        : `${hexSlice.cells.length.toLocaleString()} cells from ${hexSlice.data.length.toLocaleString()} ${analytics.hexSource === 'fires' ? 'detections' : 'quakes'}. Height and colour = ${analytics.hexSource === 'fires' ? 'total fire power' : 'quake count'}. Click a cell.`}
    </div>
    <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
      {(['fires', 'quakes'] as const).map(k => (
        <button key={k} onClick={() => analyticsData.setHexSource(k)} className={`map-legend-btn${analytics.hexSource === k ? ' on' : ''}`} aria-pressed={analytics.hexSource === k}>
          {k === 'fires' ? 'Wildfires' : 'Earthquakes'}
        </button>
      ))}
      <button onClick={onTilt} className="map-legend-btn">
        Tilt map
      </button>
    </div>
  </div>
  )
}
