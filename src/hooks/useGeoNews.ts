import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyEvent } from '../utils/keyEvents'
import type { GeoPlace } from '../services/geocode'
import { geocodePlace } from '../services/geocode'
import { buildPins, locateArticle, type GeoNewsPin } from '../utils/geoNews'

/** Only the newest important stories get pinned — each one costs up to a few geocoding lookups on a cold cache. */
const MAX_PINNED_EVENTS = 40

/**
 * Pins the most important news (the key-event classifier's picks) at the place each story happened.
 * Pins appear progressively as locations resolve; resolved stories are remembered for the session.
 */
export function useGeoNews(events: KeyEvent[], enabled: boolean): GeoNewsPin[] {
  const [resolved, setResolved] = useState<Map<string, GeoPlace | null>>(new Map())
  const requested = useRef(new Set<string>())
  const top = useMemo(() => events.slice(0, MAX_PINNED_EVENTS), [events])

  useEffect(() => {
    if (!enabled) return
    for (const { article } of top) {
      if (requested.current.has(article.url)) continue
      requested.current.add(article.url)
      void locateArticle(article, geocodePlace).then(place => {
        setResolved(prev => new Map(prev).set(article.url, place))
      })
    }
  }, [top, enabled])

  return useMemo(() => {
    if (!enabled) return []
    const located = top.flatMap(event => {
      const place = resolved.get(event.article.url)
      return place ? [{ event, place }] : []
    })
    return buildPins(located)
  }, [top, resolved, enabled])
}
