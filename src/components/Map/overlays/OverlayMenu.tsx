import { useState } from 'react'
import { Layers, Crosshair, WifiOff, Siren, Gem, ArrowLeftRight, Plane, TriangleAlert, Ship, Flame, Newspaper, Landmark, Swords, Radiation, Ban, Video, Zap, Radar, Tent, Droplet, Fuel, Anchor, Cable, SatelliteDish, Hourglass, Factory, Waves, Hexagon, Palette, Server, type LucideIcon } from 'lucide-react'
import { LAYER_SECTIONS, MAP_ONLY, MAP_ONLY_NOTE } from '../../../utils/layerSections'
import { PIPELINE_COLORS } from '../../../services/pipelines'
import type { PanelState } from '../../../types'

// `color` is the layer's own map colour (kept next to the layer as a literal, like the layer styles themselves)
const OVERLAY_ITEMS: Record<keyof PanelState, { label: string; icon: LucideIcon; color: string }> = {
  outages: { label: 'Internet outages', icon: WifiOff, color: '#f59e0b' },
  disasters: { label: 'Disaster alerts', icon: Siren, color: '#f97316' },
  resources: { label: 'Critical minerals', icon: Gem, color: '#d97706' },
  tradeStats: { label: 'Trade profiles', icon: ArrowLeftRight, color: '#22d3ee' },
  flights: { label: 'Flights', icon: Plane, color: '#00c8ff' },
  crises: { label: 'Conflict events', icon: TriangleAlert, color: '#ff6600' },
  vessels: { label: 'Vessels (AIS)', icon: Ship, color: '#00aaff' },
  wildfires: { label: 'Wildfires', icon: Flame, color: '#ff4400' },
  news: { label: 'News pins', icon: Newspaper, color: '#cccccc' },
  stocks: { label: 'Market hubs', icon: Landmark, color: '#6da7ec' },
  military: { label: 'Military bases', icon: Swords, color: '#ff2244' },
  nuclear: { label: 'Nuclear sites', icon: Radiation, color: '#ffcc00' },
  sanctions: { label: 'Sanctions', icon: Ban, color: '#ff3344' },
  cameras: { label: 'Webcams', icon: Video, color: '#aa88ff' },
  infrastructure: { label: 'Power plants & infra', icon: Zap, color: '#ff8800' },
  airspace: { label: 'Low air traffic', icon: Radar, color: '#44aaff' },
  humanitarian: { label: 'Displacement', icon: Tent, color: '#ff6688' },
  oil: { label: 'Oil', icon: Droplet, color: '#ff6600' },
  gas: { label: 'Gas', icon: Fuel, color: '#00aaff' },
  ports: { label: 'Ports', icon: Anchor, color: '#00ccff' },
  pipelines: { label: 'Pipelines', icon: Cable, color: PIPELINE_COLORS.gas },
  gpsjam: { label: 'GPS jamming', icon: SatelliteDish, color: '#ff3344' },
  chokepoints: { label: 'Chokepoints', icon: Hourglass, color: '#ff4466' },
  supplychain: { label: 'Supply-chain sites', icon: Factory, color: '#00ccff' },
  shippingDensity: { label: 'Shipping lanes', icon: Waves, color: '#ff4466' },
  analyticsHex: { label: 'Hazard hexagons', icon: Hexagon, color: '#3987e5' },
  countryAnalytics: { label: 'Colour countries by data', icon: Palette, color: '#3987e5' },
  datacenters: { label: 'Data centers', icon: Server, color: '#a855f7' },
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
  const Icon = item.icon
  const mapOnly = MAP_ONLY.has(id)
  return (
    <button className={`ov-row ${on ? 'on' : ''}`} aria-pressed={on} onClick={e => { e.stopPropagation(); onToggle() }}
      style={on ? { color: item.color } : undefined} title={mapOnly ? MAP_ONLY_NOTE : undefined}>
      <span className="ov-icon" aria-hidden><Icon size={14} strokeWidth={1.8} /></span>
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
      <Layers size={14} strokeWidth={1.8} aria-hidden /> Map layers <span className="ov-count">{activeCount}</span>
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
                <span className="ov-icon" aria-hidden><Crosshair size={14} strokeWidth={1.8} /></span>
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
