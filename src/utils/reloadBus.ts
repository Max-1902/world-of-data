const RELOAD_EVENT = 'ws:reload-all'

export function triggerGlobalReload() {
  window.dispatchEvent(new Event(RELOAD_EVENT))
}

export function onGlobalReload(handler: () => void): () => void {
  window.addEventListener(RELOAD_EVENT, handler)
  return () => window.removeEventListener(RELOAD_EVENT, handler)
}
