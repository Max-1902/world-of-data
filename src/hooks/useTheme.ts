import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'ws-theme'

/** The saved theme; dark (the original look) until the user picks one. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return 'dark'
}

/** Writes the theme onto <html data-theme> (index.css switches its tokens on it). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ffffff' : '#080e13')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme | undefined) ?? initialTheme())
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(KEY, theme) } catch {}
  }, [theme])
  const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}

/** The theme currently on <html data-theme>, read-only, for components that draw with literal colours (SVG charts). */
export function useActiveTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, readTheme, () => 'dark')
}
const readTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
function subscribeTheme(onChange: () => void) {
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}
