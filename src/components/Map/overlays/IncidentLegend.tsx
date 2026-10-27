import { useState } from 'react'
import { DISASTER_LABELS, ALERT_MEANING, type DisasterAlert } from '../../../services/gdacs'
import { SEVERITY_LABEL, type OutageEvent, type OutageSeverity } from '../../../services/outages'
import type { RadarOutage } from '../../../services/radarOutages'
import { DISASTER_COLORS, OUTAGE_COLORS, OUTAGE_CONFIRMED_COLORS, SEVERITY_MEANING } from '../incidentPopups'
import { outageCountries } from '../layers/outages'

interface Props {
  outages: OutageEvent[] | null      // null = layer off
  radarOutages?: RadarOutage[]
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

const swatch = (color: string, opts: { light?: boolean; outline?: string } = {}) => (
  <span style={{
    display:'inline-block', flexShrink:0, width:14, height:9, borderRadius:2, marginTop:2,
    background: color, opacity: opts.light ? 0.45 : 1, border: opts.outline ? `2px solid ${opts.outline}` : 'none',
  }} />
)

const ROW = { display:'flex', alignItems:'flex-start', gap:6, marginTop:4, fontSize:9.5, color:'var(--text2)', lineHeight:1.35 } as const
const HEAD = { fontSize:11, fontWeight:650, color:'var(--text1)' } as const
const NOTE = { marginTop:5, fontSize:9, color:'var(--text3)', lineHeight:1.45 } as const

/** Explains the incident layers: disaster pins and the outage shading, and how many of each are on the map. */
export default function IncidentLegend({ outages, radarOutages, disasters }: Props) {
  const [open, setOpen] = useState(true)
  if (!outages && !disasters) return null

  const shaded = outageCountries(outages ?? [], radarOutages ?? [])
  const bySeverity = (s: OutageSeverity) => [...shaded.values()].filter(c => c.severity === s).length
  const confirmed = [...shaded.values()].filter(c => c.confirmed.length).length
  const unplaced = outages?.filter(o => o.status === 'ongoing' && !o.countryCode).length ?? 0

  return (
    <div className="map-legend" style={{ left:10, bottom:58, width:250, maxHeight:'60%', overflowY:'auto' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ ...HEAD, display:'flex', width:'100%', justifyContent:'space-between', background:'none', border:'none', padding:0, cursor:'pointer' }}>
        <span>Incident legend</span><span style={{ color:'var(--text3)' }}>{open ? '–' : '+'}</span>
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
        <div style={{ marginTop:8, paddingTop: disasters ? 6 : 0, borderTop: disasters ? '1px solid var(--border)' : 'none' }}>
          <div style={HEAD}>Internet outages · {shaded.size} countries</div>
          {(['severe', 'major', 'minor'] as const).map(s => (
            <div key={s} style={ROW}>
              {swatch(OUTAGE_COLORS[s])}
              <span><b style={{ color:OUTAGE_COLORS[s] }}>{SEVERITY_LABEL[s]}</b> ({bySeverity(s)}) — {SEVERITY_MEANING[s]}</span>
            </div>
          ))}
          <div style={ROW}>{swatch('#c0cbd0', { light:true })}<span>Lighter shade = only a region or network inside the country</span></div>
          <div style={ROW}>{swatch('transparent', { outline:OUTAGE_CONFIRMED_COLORS.deliberate })}<span>Outlined = confirmed by Cloudflare Radar; red when the stated cause is a shutdown, military action, blocking or cyberattack ({confirmed})</span></div>
          <div style={NOTE}>
            Shading: IODA (Georgia Tech), ongoing alerts in the last 24 h; "% below normal" compares each signal with IODA's own baseline, the bands are this app's grading. Outlines: Cloudflare Radar, open outages, last 7 days.
            {unplaced > 0 && ` ${unplaced} network alert${unplaced === 1 ? ' has' : 's have'} no country in the data and ${unplaced === 1 ? 'is' : 'are'} only listed in the Connectivity panel.`}
          </div>
        </div>
      )}
    </div>
  )
}
