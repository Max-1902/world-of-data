import { useState } from 'react'
import { DISASTER_LABELS, ALERT_MEANING, type DisasterAlert } from '../../../services/gdacs'
import { SEVERITY_LABEL, type OutageEvent, type OutageSeverity } from '../../../services/outages'
import { DISASTER_COLORS, OUTAGE_COLORS, SEVERITY_MEANING } from '../incidentPopups'

interface Props {
  outages: OutageEvent[] | null      // null = layer off
  disasters: DisasterAlert[] | null
}

const dot = (color: string, opts: { ring?: boolean; size?: number; faded?: boolean } = {}) => {
  const size = opts.size ?? 9
  return (
    <span style={{
      display:'inline-block', flexShrink:0, width:size, height:size, borderRadius:'50%',
      background: opts.ring ? 'transparent' : color, border:`${opts.ring ? 2 : 1}px solid ${opts.ring ? color : 'rgba(255,255,255,.55)'}`,
      opacity: opts.faded ? 0.45 : 1,
    }} />
  )
}

const ROW = { display:'flex', alignItems:'flex-start', gap:6, marginTop:4, fontSize:9.5, color:'#c0cbd0', lineHeight:1.35 } as const
const HEAD = { fontSize:10.5, fontWeight:650, color:'#e5ecef' } as const
const NOTE = { marginTop:5, fontSize:9, color:'#647883', lineHeight:1.45 } as const

/** Explains the incident pins: what each colour/shape means and how many of each are on the map. */
export default function IncidentLegend({ outages, disasters }: Props) {
  const [open, setOpen] = useState(true)
  if (!outages && !disasters) return null

  const ongoing = outages?.filter(o => o.status === 'ongoing') ?? []
  const bySeverity = (s: OutageSeverity) => ongoing.filter(o => o.severity === s && o.location).length
  const recovered = outages?.filter(o => o.status === 'recovered' && o.location).length ?? 0
  const unplaced = outages?.filter(o => !o.location).length ?? 0

  return (
    <div style={{ position:'absolute', left:10, bottom:36, zIndex:30, width:250, maxHeight:'60%', overflowY:'auto', padding:'8px 10px', background:'rgba(9,16,22,0.94)', border:'1px solid #263843', borderRadius:6, backdropFilter:'blur(10px)', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ ...HEAD, display:'flex', width:'100%', justifyContent:'space-between', background:'none', border:'none', padding:0, cursor:'pointer' }}>
        <span>Incident legend</span><span style={{ color:'#647883' }}>{open ? '–' : '+'}</span>
      </button>

      {open && disasters && (
        <div style={{ marginTop:6 }}>
          <div style={HEAD}>Disaster alerts · {disasters.filter(a => a.isCurrent).length} active</div>
          {(['Red', 'Orange'] as const).map(level => (
            <div key={level} style={ROW}>
              {dot(DISASTER_COLORS[level], { size:11 })}
              <span><b style={{ color:DISASTER_COLORS[level] }}>{level}</b> ({disasters.filter(a => a.alert === level).length}) — {ALERT_MEANING[level]}</span>
            </div>
          ))}
          <div style={NOTE}>
            Letters in the pin: {Object.entries(DISASTER_LABELS).map(([k, v]) => `${k} ${v.toLowerCase()}`).join(' · ')}. Faded = event over. Source: GDACS, last 14 days.
          </div>
        </div>
      )}

      {open && outages && (
        <div style={{ marginTop:8, paddingTop: disasters ? 6 : 0, borderTop: disasters ? '1px solid #263843' : 'none' }}>
          <div style={HEAD}>Internet outages · {ongoing.length} ongoing</div>
          {(['severe', 'major', 'minor'] as const).map(s => (
            <div key={s} style={ROW}>
              {dot(OUTAGE_COLORS[s])}
              <span><b style={{ color:OUTAGE_COLORS[s] }}>{SEVERITY_LABEL[s]}</b> ({bySeverity(s)}) — {SEVERITY_MEANING[s]}</span>
            </div>
          ))}
          <div style={ROW}>{dot(OUTAGE_COLORS.recovered, { faded:true })}<span><b>Recovered</b> ({recovered}) — back to normal within the last 24 h</span></div>
          <div style={ROW}>{dot('#c0cbd0')}<span>Solid dot = located to a region</span></div>
          <div style={ROW}>{dot('#c0cbd0', { ring:true, size:12 })}<span>Ring = reported country-wide only</span></div>
          <div style={NOTE}>
            Source: IODA (Georgia Tech), last 24 h. "% below normal" compares each signal with IODA's own baseline; the severity bands are this app's grading.
            {unplaced > 0 && ` ${unplaced} network-level alert${unplaced === 1 ? ' has' : 's have'} no location in the data and ${unplaced === 1 ? 'is' : 'are'} only listed in the Outages panel.`}
          </div>
        </div>
      )}
    </div>
  )
}
