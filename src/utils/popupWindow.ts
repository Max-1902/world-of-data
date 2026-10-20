/**
 * Separate browser windows (e.g. for a second monitor) that React renders into with a portal: the content
 * stays part of the dashboard's React tree, so it keeps its state and live data.
 */

/** Make a blank pop-up look like the dashboard: same stylesheets, same root attributes. */
export function prepareWindow(w: Window, title: string, bodyClass = 'ai-window-body') {
  const d = w.document
  d.head.replaceChildren()
  d.body.replaceChildren()
  const meta = d.createElement('meta')
  meta.setAttribute('charset', 'utf-8')
  d.head.append(meta)
  d.title = title
  for (const el of document.querySelectorAll('link[rel="stylesheet"], style')) {
    if (el instanceof HTMLLinkElement) {
      const l = d.createElement('link')
      l.rel = 'stylesheet'
      l.href = el.href // absolute: the pop-up's base URL is not guaranteed to match
      d.head.append(l)
    } else d.head.append(d.importNode(el, true))
  }
  d.documentElement.className = document.documentElement.className
  for (const a of Array.from(document.documentElement.attributes)) if (a.name.startsWith('data-')) d.documentElement.setAttribute(a.name, a.value)
  d.body.className = bodyClass
}

/**
 * Watch a pop-up: `onClosed` runs when the user closes it; the pop-up is closed when the dashboard unloads.
 * Returns the cleanup, which also closes the pop-up.
 */
export function watchPopup(win: Window, onClosed: () => void): () => void {
  const poll = window.setInterval(() => { if (win.closed) onClosed() }, 700)
  const closeWin = () => win.close()
  win.addEventListener('pagehide', onClosed)
  window.addEventListener('pagehide', closeWin)
  return () => {
    window.clearInterval(poll)
    win.removeEventListener('pagehide', onClosed)
    window.removeEventListener('pagehide', closeWin)
    if (!win.closed) win.close()
  }
}
