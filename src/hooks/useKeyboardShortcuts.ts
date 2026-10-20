import { useEffect } from 'react'
import type { MapViewMode, PanelState } from '../types'

interface ShortcutHandlers {
  onViewMode: (m: MapViewMode) => void
  onToggleLayer: (id: keyof PanelState) => void
  onSettingsOpen: () => void
  onCloseDrawer: () => void
  /** P: the panel library */
  onOpenLibrary?: () => void
}

const LAYER_KEYS: Record<string, keyof PanelState> = {
  '1': 'flights',
  '2': 'crises',
  '3': 'military',
  '4': 'nuclear',
  '5': 'sanctions',
  '6': 'vessels',
  '7': 'humanitarian',
  '8': 'ports',
  '9': 'chokepoints',
  '0': 'shippingDensity',
}

const VIEW_KEYS: Record<string, MapViewMode> = { g: 'earth', d: 'dark', s: 'satellite', n: 'nightvision' }

const HELP = [
  '1-0: Toggle layers (flights, crises, military, nuclear, sanctions, vessels, humanitarian, ports, chokepoints, shipping)',
  'G: Globe view | D: Dark | S: Satellite | N: Nightvision',
  'P: Find a panel | Alt+1-9: Switch screen',
  'ESC: Close panel | ,: Settings | ?: This help',
].join('\n')

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // leave browser and OS combos (Cmd+1, Ctrl+D, Cmd+G …) alone
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return

      if (e.key === 'Escape') { handlers.onCloseDrawer(); return }
      if (e.key === ',') { handlers.onSettingsOpen(); return }
      if (e.key.toLowerCase() === 'p' && handlers.onOpenLibrary) { e.preventDefault(); handlers.onOpenLibrary(); return }
      if (e.key === '?') {
        console.log('%c World of Data keyboard shortcuts', 'color:#d5a85f;font-weight:bold;font-size:14px', `\n\n${HELP}`)
        return
      }
      const view = VIEW_KEYS[e.key.toLowerCase()]
      if (view) { handlers.onViewMode(view); return }
      const layer = LAYER_KEYS[e.key]
      if (layer) handlers.onToggleLayer(layer)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}
