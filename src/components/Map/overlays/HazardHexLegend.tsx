import { SEQUENTIAL } from '../../../utils/vizPalette'
import { analyticsData } from '../../../services/analyticsData'
import type { useAnalyticsData } from '../../../hooks/useAnalyticsData'

type Analytics = ReturnType<typeof useAnalyticsData>

interface Props {
  analytics: Analytics
  hexSlice: Analytics['fires'] | Analytics['quakes']
  onTilt: () => void
}

export default function HazardHexLegend({ analytics, hexSlice, onTilt }: Props) {
  return (
  <div style={{ position:'absolute', right:10, bottom:58, zIndex:30, width:220, padding:'8px 10px', background:'rgba(9,16,22,0.94)', border:'1px solid #263843', borderRadius:6, backdropFilter:'blur(10px)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
    <div style={{ fontSize:10.5, fontWeight:650, color:'#e5ecef' }}>
      {analytics.hexSource === 'fires' ? 'Wildfire power, last 24 h' : 'Earthquakes M4.5+, last 7 days'}
    </div>
    <div style={{ marginTop:6, height:6, borderRadius:3, background:`linear-gradient(90deg, ${SEQUENTIAL.join(',')})` }} />
    <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9, color:'#98aab4' }}><span>Low</span><span>High</span></div>
    <div style={{ marginTop:5, fontSize:9, color:'#647883', lineHeight:1.45 }}>
      {hexSlice.status === 'loading' || hexSlice.status === 'idle' ? 'Loading…'
        : hexSlice.status === 'error' ? `Could not load this feed${hexSlice.error ? ` (${hexSlice.error})` : ''}.`
        : hexSlice.status === 'empty' ? 'The feed returned no data — nothing to draw.'
        : `${hexSlice.cells.length.toLocaleString()} cells from ${hexSlice.data.length.toLocaleString()} ${analytics.hexSource === 'fires' ? 'detections' : 'quakes'}. Height and colour = ${analytics.hexSource === 'fires' ? 'total fire power' : 'quake count'}. Click a cell.`}
    </div>
    <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
      {(['fires', 'quakes'] as const).map(k => (
        <button key={k} onClick={() => analyticsData.setHexSource(k)}
          style={{ padding:'3px 8px', fontSize:9.5, color: analytics.hexSource === k ? '#d5a85f' : '#e5ecef', background: analytics.hexSource === k ? 'rgba(213,168,95,0.12)' : 'rgba(255,255,255,0.06)', border:'1px solid #263843', borderRadius:4, cursor:'pointer' }}>
          {k === 'fires' ? 'Wildfires' : 'Earthquakes'}
        </button>
      ))}
      <button onClick={onTilt}
        style={{ padding:'3px 8px', fontSize:9.5, color:'#e5ecef', background:'rgba(255,255,255,0.06)', border:'1px solid #263843', borderRadius:4, cursor:'pointer' }}>
        Tilt map
      </button>
    </div>
  </div>
  )
}
