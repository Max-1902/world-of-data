import { useCallback, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { Earthquake } from '../../../services/earthquakes'
import { MARKET_HUBS } from '../../../services/stocks'
import { addHoverMarker, type HoverMarker } from '../hoverMarker'
import { NEWS_COLORS, esc, marketPinHTML, newsPinHTML } from '../geoPopups'
import type { MapHandle, MapViewProps } from '../types'

const CRISIS_COLORS: Record<string, string> = {
  war:'#ff1a2e', conflict:'#ff6600', terrorism:'#cc0033',
  protest:'#ffcc00', political:'#aa44ff', disaster:'#ff8800',
}

const SEV_SIZE: Record<string, number> = { critical: 16, high: 11, medium: 8, low: 5 }


/** Crisis / earthquake markers */
export function useCrisisMarkers({ mapRef, markersRef }: MapHandle, { crises, earthquakes, showCrises, onCrisisClick }: Pick<MapViewProps, 'crises' | 'earthquakes' | 'showCrises' | 'onCrisisClick'>) {
  // ── Crisis / earthquake markers ───────────────────────────────────────────
  const buildCrisisMarkers = useCallback(() => {
    const map = mapRef.current
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    if (!map || !showCrises) return

    const addMarker = (el: HTMLElement, lng: number, lat: number, popupHTML: string) => {
      const popup = new mapboxgl.Popup({ maxWidth: '260px', className: 'cy-popup', offset: 8 })
        .setHTML(popupHTML)
      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map)
      markersRef.current.push(m)
    }

    crises.forEach((c) => {
      const color = CRISIS_COLORS[c.type] || '#ff6600'
      const size  = SEV_SIZE[c.severity]  || 8
      const el    = document.createElement('div')
      // Archived (year-old) ACLED events: a dashed, faded ring with no glow, so they never read as live events.
      el.style.cssText = c.archived
        ? `width:${size}px;height:${size}px;border-radius:50%;background:${color}22;border:1.5px dashed ${color};opacity:.7;cursor:pointer;`
        : `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:1px solid rgba(255,255,255,0.3);cursor:pointer;box-shadow:0 0 ${size + 4}px ${color}66;`
      const popup = `<div style="padding:9px;font-family:'Inter',-apple-system,sans-serif;font-size:11px;color:#14161a;line-height:1.5;">
        ${c.archived ? `<span style="display:inline-block;margin-bottom:4px;padding:1px 6px;border-radius:4px;background:#f3f4f6;color:#4b5563;font-size:9px;font-weight:600;letter-spacing:.08em;">ARCHIVE · ABOUT 1 YEAR OLD</span><br>` : ''}
        <b style="color:${color};font-size:13px;">${esc(c.title)}</b><br>
        <span style="color:#6b7280;font-size:10px;letter-spacing:.1em;">${esc(c.country)} · ${new Date(c.date).toLocaleDateString()}</span>
        ${c.fatalities ? `<br><span style="color:#dc2626;">⚠ ${c.fatalities} fatalities</span>` : ''}
        ${c.description ? `<br><span style="opacity:.85;font-size:10px;">${esc(c.description.slice(0,140))}…</span>` : ''}
        <br><span style="color:#9ca3af;font-size:10px;">src: ${esc(c.source)}${c.archived ? ' (current events not available on this account)' : ''}</span></div>`
      el.addEventListener('click', () => onCrisisClick(c))
      addMarker(el, c.longitude, c.latitude, popup)
    })

    earthquakes.forEach((eq) => {
      const mag   = eq.magnitude
      const size  = Math.max(8, Math.min(26, mag * 3.3))
      const color = mag >= 7 ? '#ff0022' : mag >= 6 ? '#ff6600' : mag >= 5 ? '#ffcc00' : '#88aaff'
      const el    = document.createElement('div')
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${color};background:transparent;cursor:pointer;box-shadow:0 0 ${size}px ${color}44;`
      const popup = `<div style="padding:9px;font-family:'Inter',-apple-system,sans-serif;font-size:11px;color:#14161a;">
        <b style="color:${color};">M${mag.toFixed(1)} Earthquake</b><br>
        ${eq.place}<br>
        <span style="color:#6b7280;font-size:10px;">${new Date(eq.time).toLocaleString()} · Depth: ${eq.depth}km</span></div>`
      addMarker(el, eq.longitude, eq.latitude, popup)
    })
  }, [crises, earthquakes, showCrises, onCrisisClick])

  useEffect(() => { buildCrisisMarkers() }, [buildCrisisMarkers])
}

/** News pins: the most important stories, placed where they happened */
export function useNewsMarkers({ mapRef, mapReady }: MapHandle, { newsPins, showNews }: Pick<MapViewProps, 'newsPins' | 'showNews'>) {
  // ── News pins: the most important stories, placed where they happened ──────
  // Independent of the Crises layer — they used to be built inside the crisis-marker pass, which bailed out
  // whenever Crises was off, so neither news nor markets ever showed.
  const newsMarkersRef = useRef<HoverMarker[]>([])
  useEffect(() => {
    newsMarkersRef.current.forEach(m => m.remove())
    newsMarkersRef.current = []
    const map = mapRef.current
    if (!map || !mapReady || !showNews) return
    newsMarkersRef.current = newsPins.map((pin) => {
      const color = NEWS_COLORS[pin.items[0].category]
      const size = pin.items.length > 1 ? 20 : 14
      const el = document.createElement('div')
      el.setAttribute('aria-label', esc(pin.items[0].article.title))
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;` +
        `font:700 9px Inter,sans-serif;color:#fff;border:2px solid #fff;background:${color};`
      if (pin.items.length > 1) el.textContent = String(pin.items.length)
      return addHoverMarker(map, el, pin.lng, pin.lat, newsPinHTML(pin))
    })
    return () => { newsMarkersRef.current.forEach(m => m.remove()); newsMarkersRef.current = [] }
  }, [newsPins, showNews, mapReady])
}

/** Market hubs: exchange chips with the live day change */
export function useMarketMarkers({ mapRef, mapReady }: MapHandle, { stocks, showStocks }: Pick<MapViewProps, 'stocks' | 'showStocks'>) {
  // ── Market hubs: exchange chips with the live day change ──────────────────
  const marketMarkersRef = useRef<HoverMarker[]>([])
  useEffect(() => {
    marketMarkersRef.current.forEach(m => m.remove())
    marketMarkersRef.current = []
    const map = mapRef.current
    if (!map || !mapReady || !showStocks) return
    const bySymbol = new Map(stocks.map(s => [s.symbol, s]))
    marketMarkersRef.current = MARKET_HUBS.map((hub) => {
      const q = bySymbol.get(hub.symbol)
      const color = !q ? '#6b7280' : q.change >= 0 ? '#16a34a' : '#dc2626'
      const el = document.createElement('div')
      el.style.cssText = `padding:2px 7px;background:#fff;border:1.5px solid ${color};border-radius:999px;color:${color};` +
        `font:700 10px Inter,sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.25);`
      el.textContent = q ? `${hub.exchange} ${q.change >= 0 ? '▲' : '▼'}${Math.abs(q.changePercent).toFixed(1)}%` : hub.exchange
      return addHoverMarker(map, el, hub.lng, hub.lat, marketPinHTML(hub, q), '260px')
    })
    return () => { marketMarkersRef.current.forEach(m => m.remove()); marketMarkersRef.current = [] }
  }, [stocks, showStocks, mapReady])
}
