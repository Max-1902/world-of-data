import { useState } from 'react'
import { LAYER_SECTIONS } from '../../../utils/layerSections'
import { PIPELINE_COLORS } from '../../../services/pipelines'
import type { PanelState } from '../../../types'

const OVERLAY_ITEMS: Record<keyof PanelState, { label: string; icon: string; color: string }> = {
  outages: { label: 'OUTAGES', icon: '◐', color: '#f59e0b' },
  resources: { label: 'RESOURCES', icon: '◭', color: '#d97706' },
  tradeStats: { label: 'TRADE', icon: '⇄', color: '#22d3ee' },
  flights: { label: 'FLIGHTS', icon: '✈', color: '#00ff88' },
  crises: { label: 'CRISES', icon: '⚠', color: '#ff6600' },
  vessels: { label: 'VESSELS', icon: '⎈', color: '#00aaff' },
  wildfires: { label: 'WILDFIRES', icon: '✱', color: '#ff4400' },
  news: { label: 'NEWS', icon: '◉', color: '#cccccc' },
  stocks: { label: 'MARKETS', icon: '$', color: '#00ff88' },
  military: { label: 'MILITARY', icon: '⚔', color: '#ff2244' },
  militaryPersonnel: { label: 'FORCE SIZE', icon: '⚔', color: '#dc2626' },
  nuclear: { label: 'NUCLEAR', icon: '☢', color: '#ffcc00' },
  sanctions: { label: 'SANCTIONS', icon: '⊗', color: '#ff3344' },
  cameras: { label: 'CAMERAS', icon: '◎', color: '#aa88ff' },
  infrastructure: { label: 'INFRA', icon: '↯', color: '#ff8800' },
  airspace: { label: 'AIRSPACE', icon: '◇', color: '#44aaff' },
  humanitarian: { label: 'HUMANITARIAN', icon: '✚', color: '#ff6688' },
  oil: { label: 'OIL', icon: '▲', color: '#ff6600' },
  gas: { label: 'GAS', icon: '▲', color: '#00aaff' },
  ports: { label: 'PORTS', icon: '⎈', color: '#00ccff' },
  pipelines: { label: 'PIPELINES', icon: '═', color: PIPELINE_COLORS.gas },
  gpsjam: { label: 'GPS JAM', icon: '◌', color: '#ff3344' },
  chokepoints: { label: 'CHOKEPOINTS', icon: '⊘', color: '#ff4466' },
  supplychain: { label: 'SUPPLY CHAIN', icon: '◆', color: '#00ccff' },
  shippingDensity: { label: 'SHIPPING', icon: '≋', color: '#ff4466' },
  infraIndicators: { label: 'INFRA ACCESS', icon: '↯', color: '#22d3ee' },
  analyticsHex: { label: 'HAZARD HEX', icon: '⬢', color: '#3987e5' },
  countryAnalytics: { label: 'COUNTRY DATA', icon: '▦', color: '#3987e5' },
  datacenters: { label: 'DATA CENTERS', icon: '▤', color: '#a855f7' },
}

interface Props {
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  /** distance from the top of the map; the menu sits below the flight filter when that is showing */
  top: number
}

export default function OverlayMenu({ panelState, onToggleLayer, top }: Props) {
  const [showOverlays, setShowOverlays] = useState(false)
  return (
  <div style={{ position:'absolute', top, left:10, zIndex:29 }}
    onMouseDown={e => e.stopPropagation()}
    onPointerDown={e => e.stopPropagation()}
  >
    <button
      onClick={() => setShowOverlays(v => !v)}
      style={{
        display:'flex', alignItems:'center', gap:5,
        padding:'3px 10px', fontSize:8.5, fontWeight:700,
        letterSpacing:'.14em', textTransform:'uppercase',
        border:`1px solid ${showOverlays ? 'rgba(213,168,95,.58)' : '#263843'}`,
        background: showOverlays ? 'rgba(213,168,95,.10)' : 'rgba(9,16,22,.9)',
        color: showOverlays ? '#d5a85f' : '#c0cbd0',
        cursor:'pointer', transition:'all .15s', fontFamily:'monospace',
        backdropFilter:'blur(8px)',
      }}
    >
      ◈ OVERLAYS
      <span style={{ fontSize:7, color: showOverlays ? '#e5c997' : '#7c909a' }}>
        {Object.values(panelState).filter(Boolean).length}
      </span>
    </button>

    {showOverlays && (
      <div style={{
        marginTop:3,
        background:'rgba(9,16,22,0.97)',
        border:'1px solid #263843', borderLeft:'2px solid rgba(213,168,95,.58)',
        backdropFilter:'blur(10px)',
        width:200,
        boxShadow:'0 4px 20px rgba(0,0,0,0.7)',
        maxHeight: 360, overflowY: 'auto',
      }}>
        {LAYER_SECTIONS.map(section => (
          <div key={section.title}>
            <div style={{ padding:'5px 8px 3px', fontSize:7, fontWeight:700, letterSpacing:'.16em', color:'#647883', background:'rgba(255,255,255,.03)', borderBottom:'1px solid #1c2b35', position:'sticky', top:0, zIndex:1 }}>
              {section.title}
            </div>
            {section.keys.map(key => {
              const item = { key, ...OVERLAY_ITEMS[key] }
              const on = panelState[item.key]
          return (
            <button
              key={item.key}
              onClick={(e) => { e.stopPropagation(); onToggleLayer(item.key) }}
              style={{
                display:'flex', alignItems:'center', gap:6, width:'100%',
                padding:'5px 8px', fontSize:8, fontWeight:600,
                letterSpacing:'.08em', textAlign:'left',
                border:'none', borderBottom:'1px solid #1c2b35',
                background: on ? item.color + '0c' : 'transparent',
                color: on ? item.color : '#98aab4',
                cursor:'pointer', transition:'all .12s', fontFamily:'monospace',
              }}
              onMouseEnter={e => { if (!on) (e.currentTarget as HTMLButtonElement).style.color = '#e5ecef' }}
              onMouseLeave={e => { if (!on) (e.currentTarget as HTMLButtonElement).style.color = '#98aab4' }}
            >
              <span style={{ width:14, textAlign:'center', fontSize:9 }}>{item.icon}</span>
              <span style={{ flex:1 }}>{item.label}</span>
              <span style={{
                width:6, height:6, borderRadius:'50%',
                background: on ? item.color : '#263843',
                border: `1px solid ${on ? item.color + '88' : '#31434d'}`,
                transition:'all .15s',
              }} />
            </button>
          )
            })}
          </div>
        ))}
      </div>
    )}
  </div>
  )
}
