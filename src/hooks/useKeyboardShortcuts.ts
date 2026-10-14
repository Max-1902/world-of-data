import { useEffect } from 'react'
import type { MapViewMode, PanelState } from '../types'

interface ShortcutHandlers {
  onViewMode: (m: MapViewMode) => void
  onToggleLayer: (id: keyof PanelState) => void
  onSettingsOpen: () => void
  onCloseDrawer: () => void
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

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // ESC — close panels/drawers
      if (e.key === 'Escape') { handlers.onCloseDrawer(); return }

      // G — toggle globe/earth view
      if (e.key === 'g' || e.key === 'G') { handlers.onViewMode('earth'); return }

      // D — dark mode
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey) { handlers.onViewMode('dark'); return }

      // S — satellite
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) { handlers.onViewMode('satellite'); return }

      // N — nightvision
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { handlers.onViewMode('nightvision'); return }

      // , — settings
      if (e.key === ',') { handlers.onSettingsOpen(); return }

      // ? — show shortcut help (console for now)
      if (e.key === '?') {
        console.log(
          '%c Macroeconomic Forecasting System Keyboard Shortcuts',
          'color:#00ff88;font-weight:bold;font-size:14px',
          '\n\n1-0: Toggle layers (flights, crises, military, nuclear, sanctions, vessels, humanitarian, ports, chokepoints, shipping)',
          '\nG: Globe view | D: Dark | S: Satellite | N: Nightvision',
          '\nESC: Close panel | ,: Settings | ?: This help',
        )
        return
      }

      // 1-9, 0 — toggle layers
      if (LAYER_KEYS[e.key]) {
        handlers.onToggleLayer(LAYER_KEYS[e.key])
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}
