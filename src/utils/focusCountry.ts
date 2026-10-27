/**
 * Point a country-driven panel (Predictions, GDP Nowcast) at a country from elsewhere, e.g. the country page's
 * "open in Predictions". Stored for a panel that mounts later, and announced for one already on screen.
 */
export type FocusTarget = 'predictions' | 'nowcast'

const KEYS: Record<FocusTarget, string> = { predictions: 'country-lookup-iso2', nowcast: 'nowcast-geo' }
const EVENT = 'ws:focus-country'

export function focusCountry(target: FocusTarget, code: string): void {
  try { localStorage.setItem(KEYS[target], code) } catch { /* storage unavailable: the event still reaches a mounted panel */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { target, code } }))
}

export function storedFocus(target: FocusTarget): string | null {
  try { return localStorage.getItem(KEYS[target]) } catch { return null }
}

/** Calls `on(code)` whenever `focusCountry(target, …)` is called; returns the unsubscribe. */
export function onFocusCountry(target: FocusTarget, on: (code: string) => void): () => void {
  const h = (e: Event) => { const d = (e as CustomEvent<{ target: FocusTarget; code: string }>).detail; if (d?.target === target) on(d.code) }
  window.addEventListener(EVENT, h)
  return () => window.removeEventListener(EVENT, h)
}
