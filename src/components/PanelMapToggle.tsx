import { Map as MapIcon } from 'lucide-react'
import type { PanelState } from '../types'
import type { PanelDef } from '../panels/types'
import { LAYER_IDS } from './layerCatalogue'
import { useOpenMap } from './OpenMapContext'

/**
 * The standard "Show on map" control in a panel's header, for every panel whose registry entry lists map layers.
 * On when all of those layers are on; clicking turns the missing ones on, or — when all are on — turns them all off.
 * The tooltip names the layers with their catalogue description, so it says exactly what will be drawn.
 */
export default function PanelMapToggle({ map, panelState, onToggleLayer }: {
  map: PanelDef['map']
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
}) {
  const openMap = useOpenMap()
  if (!Array.isArray(map) || map.length === 0) return null
  const active = map.every(id => panelState[id])
  const what = map.map(id => {
    const l = LAYER_IDS.find(x => x.id === id)
    return l ? `${l.label} (${l.desc})` : id
  }).join(', ')
  return (
    <button
      className={`cy-btn ${active ? 'active' : ''}`}
      aria-pressed={active}
      title={active ? `Hide from the map: ${what}` : `Show on the map (opens the Map): ${what}`}
      onClick={() => {
        for (const id of map) if (panelState[id] === active) onToggleLayer(id)
        if (!active) openMap()
      }}
      onMouseDown={e => e.stopPropagation()}
      draggable={false}
      style={{ flexShrink: 0, padding: '2px 7px', fontSize: 10 }}
    >
      <MapIcon size={11} /> {active ? 'On the map' : 'Show on map'}
    </button>
  )
}
