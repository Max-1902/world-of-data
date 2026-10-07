import { SEQUENTIAL, BELOW, NEUTRAL, ABOVE } from '../../../utils/vizPalette'
import type { useCountryAnalytics } from '../../../hooks/useCountryAnalytics'
import type { countryColors } from '../../../utils/countryStats'

interface Props {
  countryData: ReturnType<typeof useCountryAnalytics>
  countryShading: ReturnType<typeof countryColors>
  /** the hazard-hex legend sits at the bottom right too, so this one moves up when it is showing */
  raised: boolean
}

export default function CountryAnalyticsLegend({ countryData, countryShading, raised }: Props) {
  return (
  <div style={{ position:'absolute', right:10, bottom: raised ? 232 : 58, zIndex:30, width:230, padding:'8px 10px', background:'rgba(9,16,22,0.94)', border:'1px solid #263843', borderRadius:6, backdropFilter:'blur(10px)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
    <div style={{ fontSize:10.5, fontWeight:650, color:'#e5ecef', lineHeight:1.35 }}>
      {countryData.state.mapMode === 'trend' ? `${countryData.yMeta.short} vs what ${countryData.xMeta.short} predicts` : countryData.yMeta.label}
    </div>
    <div style={{ marginTop:6, height:6, borderRadius:3, background: countryData.state.mapMode === 'trend'
      ? `linear-gradient(90deg, ${BELOW}, ${NEUTRAL}, ${ABOVE})` : `linear-gradient(90deg, ${SEQUENTIAL.join(',')})` }} />
    <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9, color:'#98aab4' }}>
      {countryData.state.mapMode === 'trend'
        ? <><span>Below trend</span><span>On trend</span><span>Above</span></>
        : <><span>{countryShading.lo === null ? 'Low' : countryData.yMeta.format(countryShading.lo)}</span><span>{countryShading.hi === null ? 'High' : countryData.yMeta.format(countryShading.hi)}</span></>}
    </div>
    <div style={{ marginTop:5, fontSize:9, color:'#647883', lineHeight:1.45 }}>
      {countryData.xSlice.status === 'loading' || countryData.ySlice.status === 'loading' || countryData.ySlice.status === 'idle' ? 'Loading World Bank data…'
        : countryData.ySlice.status === 'error' ? `Could not load this indicator${countryData.ySlice.error ? ` (${countryData.ySlice.error})` : ''}.`
        : Object.keys(countryShading.colors).length === 0 ? 'No countries to shade for this selection.'
        : `${Object.keys(countryShading.colors).length} countries shaded${countryData.state.mapMode === 'value' ? ' (colour clipped to the 2nd–98th percentile)' : ''}. Click a country.`}
    </div>
    <div style={{ marginTop:6, display:'flex', gap:4 }}>
      {(['value', 'trend'] as const).map(m => (
        <button key={m} onClick={() => countryData.setMapMode(m)}
          style={{ padding:'3px 8px', fontSize:9.5, color: countryData.state.mapMode === m ? '#d5a85f' : '#e5ecef', background: countryData.state.mapMode === m ? 'rgba(213,168,95,0.12)' : 'rgba(255,255,255,0.06)', border:'1px solid #263843', borderRadius:4, cursor:'pointer' }}>
          {m === 'value' ? 'Value' : 'Vs trend'}
        </button>
      ))}
    </div>
  </div>
  )
}
