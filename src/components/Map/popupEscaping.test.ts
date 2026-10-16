// @vitest-environment jsdom
/**
 * Third-party text must never reach a popup as markup. AIS ship names, OSM names, GPPD plant names, hexdb aircraft
 * owners and OpenSky callsigns are free text other people control; before 2026-10-15 several popups interpolated
 * them raw into setHTML. Every click handler on a live-data layer is run here with a feature whose every string
 * property is an injection payload, and the HTML handed to the popup must contain it only escaped.
 */
import { describe, it, expect, vi } from 'vitest'

const html: string[] = []
vi.mock('mapbox-gl', () => {
  class Popup {
    setLngLat() { return this }
    setHTML(h: string) { html.push(h); return this }
    addTo() { return this }
    remove() { return this }
    on() { return this }
  }
  return { default: { Popup, Marker: class {} } }
})
vi.mock('./flightLayer', async (orig) => ({ ...(await orig<typeof import('./flightLayer')>()), addAirplaneImage: vi.fn() }))
vi.mock('./vesselImages', () => ({ addVesselImages: vi.fn() }))

import { buildFlightHTML } from './flightLayer'
import { addVesselLayers } from './layers/vessels'
import { addInfrastructureLayers } from './layers/infrastructure'
import { addDatacenterLayers } from './layers/datacenters'
import { addPipelineLayers } from './layers/pipelines'
import type { LayerCtx } from './layers/types'

const PAYLOAD = '<img src=x onerror=alert(1)>'
/** Style-only keys are computed by this app, never taken from a feed. */
const SAFE_KEYS = new Set(['color', 'icon', 'status', 'typeGuessed', 'vesselType'])
const hostile = new Proxy({}, { get: (_t, k) => (typeof k === 'string' && SAFE_KEYS.has(k) ? '#888888' : PAYLOAD) })

function run(add: (map: never, ctx: LayerCtx) => void) {
  const handlers: ((e: unknown) => void)[] = []
  const map = {
    addSource: vi.fn(), addLayer: vi.fn(), addImage: vi.fn(), hasImage: () => true, getLayer: () => undefined, getSource: () => undefined,
    getCanvas: () => ({ style: {} }), getZoom: () => 4,
    on: (event: string, a: unknown, b?: unknown) => { if (event === 'click' && typeof b === 'function') handlers.push(b as (e: unknown) => void) },
  }
  const ctx = { popupRef: { current: null }, flightDataRef: { current: [] }, militaryPersonnelRef: { current: [] }, infraIndicatorsRef: { current: [] },
    countryAnalyticsRef: { current: null }, onFlightClick: vi.fn(), onCountryClickRef: { current: undefined }, onPlaceClickRef: { current: undefined } } as unknown as LayerCtx
  add(map as never, ctx)
  expect(handlers.length).toBeGreaterThan(0)
  for (const h of handlers) h({ features: [{ properties: hostile, geometry: { type: 'Point', coordinates: [0, 0] } }], lngLat: { lng: 0, lat: 0 } })
}

describe('popup HTML escapes third-party text', () => {
  it.each([
    ['vessels (AIS name, destination)', addVesselLayers],
    ['power plants (WRI GPPD names)', addInfrastructureLayers],
    ['data centres (OSM names)', addDatacenterLayers],
    ['pipelines (OSM tags)', addPipelineLayers],
  ])('%s', (_name, add) => {
    html.length = 0
    run(add as (map: never, ctx: LayerCtx) => void)
    expect(html.length).toBeGreaterThan(0)
    for (const h of html) {
      expect(h).not.toContain(PAYLOAD)
      expect(h).not.toMatch(/<img src=x/)
      expect(h).toMatch(/&lt;img src=x|&#60;img src=x/) // the text is still shown, escaped
    }
  })

  it('flights (callsign, country, hexdb owner/type, photo URL)', () => {
    const meta = { type: PAYLOAD, icaoType: PAYLOAD, manufacturer: PAYLOAD, owner: PAYLOAD, registration: PAYLOAD, photoUrl: `"><script>x</script>`, photographer: PAYLOAD }
    const out = buildFlightHTML({ callsign: PAYLOAD, icao24: PAYLOAD, country: PAYLOAD, flightType: 'airline' }, meta as never)
    expect(out).not.toContain(PAYLOAD)
    expect(out).not.toContain('<script>')
  })
})
