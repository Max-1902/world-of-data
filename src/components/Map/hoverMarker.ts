import mapboxgl from 'mapbox-gl'
import { keyboardReachable } from './layers/crisisShape'

const CLOSE_DELAY_MS = 220

export interface HoverMarker { remove: () => void }

/**
 * A DOM marker whose card opens on hover and stays open while the pointer is over either the pin or the card,
 * so links inside the card are clickable. Clicking the pin pins the card open (click again, or ✕, to dismiss);
 * that is also what makes it usable on touch screens, where there is no hover.
 */
export function addHoverMarker(map: mapboxgl.Map, el: HTMLElement, lng: number, lat: number, html: string, maxWidth = '320px'): HoverMarker {
  const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, maxWidth, className: 'cy-popup geo-hover-popup', offset: 12 })
    .setHTML(html)
  const marker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)

  // a pin is a labelled tab stop: Enter or Space pins its card open like a click, Escape closes it
  keyboardReachable(el, el.getAttribute('aria-label') || el.textContent?.trim() || 'Map marker')
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { sticky = false; popup.remove() } })

  let timer: number | undefined
  let sticky = false
  const cancel = () => { if (timer !== undefined) { window.clearTimeout(timer); timer = undefined } }
  const scheduleClose = () => {
    cancel()
    if (sticky) return
    timer = window.setTimeout(() => popup.remove(), CLOSE_DELAY_MS)
  }
  const open = () => {
    cancel()
    if (popup.isOpen()) return
    popup.setLngLat([lng, lat]).addTo(map)
    const card = popup.getElement()
    card?.addEventListener('mouseenter', cancel)
    card?.addEventListener('mouseleave', scheduleClose)
  }

  popup.on('close', () => { sticky = false })
  el.addEventListener('mouseenter', open)
  el.addEventListener('mouseleave', scheduleClose)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    if (sticky) { sticky = false; popup.remove() } else { open(); sticky = true }
  })

  return { remove: () => { cancel(); popup.remove(); marker.remove() } }
}
