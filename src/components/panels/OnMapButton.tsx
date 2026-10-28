import { useSyncExternalStore } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { countryAnalytics, selectForMap } from '../../services/countryAnalytics'
import type { PanelState } from '../../types'
import { useOpenMap } from '../OpenMapContext'

/**
 * "On the map" for a country-data panel: shades the globe by `indicatorId` through the Country Analytics layer (the same
 * layer, legend and click popup the Country Analytics panel drives). Pass null when the panel's current chart has no
 * country-level equivalent; the button then explains why it is off.
 */
export function OnMapButton({ indicatorId, panelState, onToggleLayer }: {
  indicatorId: string | null
  panelState?: PanelState
  onToggleLayer?: (id: keyof PanelState) => void
}) {
  const selection = useSyncExternalStore(countryAnalytics.subscribe, () => countryAnalytics.getState().selection)
  const openMap = useOpenMap()
  if (!panelState || !onToggleLayer) return null
  const active = panelState.countryAnalytics && indicatorId !== null && selection.y === indicatorId
  return (
    <button
      className={`cy-btn ${active ? 'active' : ''}`}
      aria-pressed={active}
      disabled={indicatorId === null}
      title={indicatorId === null ? 'This chart has no country-level version to draw on the map' : active ? 'Hide this from the map' : 'Shade the countries on the map by this data'}
      onClick={() => {
        if (active) { onToggleLayer('countryAnalytics'); return }
        selectForMap(indicatorId!)
        if (!panelState.countryAnalytics) onToggleLayer('countryAnalytics')
        openMap()
      }}
      style={{ flexShrink: 0 }}
    >
      <MapIcon size={11} /> {active ? 'On the map' : 'Show on map'}
    </button>
  )
}
