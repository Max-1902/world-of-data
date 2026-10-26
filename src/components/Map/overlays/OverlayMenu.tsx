import { useState } from 'react'
import { LAYER_SECTIONS, MAP_ONLY, MAP_ONLY_NOTE } from '../../../utils/layerSections'
import { PIPELINE_COLORS } from '../../../services/pipelines'
import type { PanelState } from '../../../types'

// `color` is the layer's own map colour (kept next to the layer as a literal, like the layer styles themselves)
const OVERLAY_ITEMS: Record<keyof PanelState, { label: string; icon: string; color: string }> = {
  outages: { label: 'Internet outages', icon: '◐', color: '#f59e0b' },
  disasters: { label: 'Disaster alerts', icon: '⚑', color: '#f97316' },
  resources: { label: 'Critical minerals', icon: '◭', color: '#d97706' },
  tradeStats: { label: 'Trade profiles', icon: '⇄', color: '#22d3ee' },
  flights: { label: 'Flights', icon: '✈', color: '#00ff88' },
  crises: { label: 'Conflict events', icon: '⚠', color: '#ff6600' },
  vessels: { label: 'Vessels (AIS)', icon: '⎈', color: '#00aaff' },
  wildfires: { label: 'Wildfires', icon: '✱', color: '#ff4400' },
  news: { label: 'News pins', icon: '◉', color: '#cccccc' },
  stocks: { label: 'Market hubs', icon: '$', color: '#00ff88' },
  military: { label: 'Military bases', icon: '⚔', color: '#ff2244' },
  nuclear: { label: 'Nuclear sites', icon: '☢', color: '#ffcc00' },
  sanctions: { label: 'Sanctions', icon: '⊗', color: '#ff3344' },
  cameras: { label: 'Webcams', icon: '◎', color: '#aa88ff' },
  infrastructure: { label: 'Power plants & infra', icon: '↯', color: '#ff8800' },
  airspace: { label: 'Low air traffic', icon: '◇', color: '#44aaff' },
  humanitarian: { label: 'Displacement', icon: '✚', color: '#ff6688' },
  oil: { label: 'Oil', icon: '▲', color: '#ff6600' },
  gas: { label: 'Gas', icon: '▲', color: '#00aaff' },
  ports: { label: 'Ports', icon: '⎈', color: '#00ccff' },
  pipelines: { label: 'Pipelines', icon: '═', color: PIPELINE_COLORS.gas },
  gpsjam: { label: 'GPS jamming', icon: '◌', color: '#ff3344' },
  chokepoints: { label: 'Chokepoints', icon: '⊘', color: '#ff4466' },
  supplychain: { label: 'Supply-chain sites', icon: '◆', color: '#00ccff' },
  shippingDensity: { label: 'Shipping lanes', icon: '≋', color: '#ff4466' },
  analyticsHex: { label: 'Hazard hexagons', icon: '⬢', color: '#3987e5' },
  countryAnalytics: { label: 'Colour countries by data', icon: '▦', color: '#3987e5' },
  datacenters: { label: 'Data centers', icon: '▤', color: '#a855f7' },
}

interface Props {
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  /** turns every overlay off at once; the "deselect all" button is hidden when omitted */
  onClearLayers?: () => void
  /** DeepState split view (a mirror of deepstatemap.live beside the map); the row is hidden when the toggle is omitted */
  deepstateMode?: boolean
  onToggleDeepstate?: () => void
  /** the layers the open workspace's panels draw, listed first; omitted or empty hides the section */
  suggested?: { workspace: string; layers: readonly (keyof PanelState)[] }
  /** distance from the top of the map; the menu sits below the flight filter when that is showing */
  top: number
}

const DEEPSTATE_COLOR = '#ff1a3e'

function Row({ id, on, onToggle }: { id: keyof PanelState; on: boolean; onToggle: () => void }) {
  const item = OVERLAY_ITEMS[id]
  const mapOnly = MAP_ONLY.has(id)
  return (
    <button className={`ov-row ${on ? 'on' : ''}`} aria-pressed={on} onClick={e => { e.stopPropagation(); onToggle() }}
      style={on ? { color: item.color } : undefined} title={mapOnly ? MAP_ONLY_NOTE : undefined}>
      <span className="ov-icon" aria-hidden>{item.icon}</span>
      <span className="ov-label">{item.label}</span>
      {mapOnly && <span className="ov-tag">map only</span>}
      <span className="ov-dot" style={on ? { background: item.color, borderColor: item.color } : undefined} />
    </button>
  )
}

export default function OverlayMenu({ panelState, onToggleLayer, onClearLayers, deepstateMode = false, onToggleDeepstate, suggested, top }: Props) {
  const [showOverlays, setShowOverlays] = useState(false)
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const activeCount = Object.values(panelState).filter(Boolean).length
  const suggestedOff = suggested?.layers.filter(k => !panelState[k]) ?? []
  const toggleFold = (title: string) => setFolded(prev => { const n = new Set(prev); if (n.has(title)) n.delete(title); else n.add(title); return n })

  return (
  <div className="ov-menu" style={{ top }} onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
    <button className={`ov-launch ${showOverlays ? 'open' : ''}`} aria-expanded={showOverlays} onClick={() => setShowOverlays(v => !v)}>
      ◈ Map layers <span className="ov-count">{activeCount}</span>
    </button>

    {showOverlays && (
      <div className="ov-panel">
        {onClearLayers && (
          <button className="ov-clear" onClick={e => { e.stopPropagation(); onClearLayers() }} disabled={activeCount === 0}>
            Turn all layers off
          </button>
        )}
        <div className="ov-scroll">
          {suggested && suggested.layers.length > 0 && (
            <div className="ov-section ov-suggested">
              <div className="ov-head ov-head-static">
                <span>For this workspace · {suggested.workspace}</span>
                {suggestedOff.length > 0 && (
                  <button className="ov-all" onClick={e => { e.stopPropagation(); suggestedOff.forEach(onToggleLayer) }}>Show all</button>
                )}
              </div>
              {suggested.layers.map(k => <Row key={k} id={k} on={!!panelState[k]} onToggle={() => onToggleLayer(k)} />)}
            </div>
          )}
          {onToggleDeepstate && (
            <div className="ov-section">
              <div className="ov-head ov-head-static"><span>War monitor</span></div>
              <button className={`ov-row ${deepstateMode ? 'on' : ''}`} aria-pressed={deepstateMode} title="Split the map and mirror deepstatemap.live beside it"
                onClick={e => { e.stopPropagation(); onToggleDeepstate() }} style={deepstateMode ? { color: DEEPSTATE_COLOR } : undefined}>
                <span className="ov-icon" aria-hidden>◆</span>
                <span className="ov-label">DeepState Ukraine</span>
                <span className="ov-dot" style={deepstateMode ? { background: DEEPSTATE_COLOR, borderColor: DEEPSTATE_COLOR } : undefined} />
              </button>
            </div>
          )}
          {LAYER_SECTIONS.map(section => {
            const open = !folded.has(section.title)
            const onHere = section.keys.filter(k => panelState[k]).length
            return (
              <div key={section.title} className="ov-section">
                <button className="ov-head" aria-expanded={open} onClick={e => { e.stopPropagation(); toggleFold(section.title) }}>
                  <span>{open ? '▾' : '▸'} {section.title}</span>
                  {onHere > 0 && <span className="ov-on">{onHere} on</span>}
                </button>
                {open && section.keys.map(k => <Row key={k} id={k} on={!!panelState[k]} onToggle={() => onToggleLayer(k)} />)}
              </div>
            )
          })}
        </div>
      </div>
    )}
  </div>
  )
}
