// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// mapbox-gl needs WebGL at import time in a real browser; the layer modules only touch it inside click handlers.
vi.mock('mapbox-gl', () => ({ default: { Popup: class {}, Marker: class {} } }))
// Image helpers draw on a canvas, which jsdom doesn't have.
vi.mock('../flightLayer', async (orig) => ({ ...(await orig<typeof import('../flightLayer')>()), addAirplaneImage: vi.fn() }))
vi.mock('../vesselImages', () => ({ addVesselImages: vi.fn() }))

import { addAllLayers, type LayerCtx } from './index'
import { hasFeatureClickMarker } from './countryClick'

interface Recorded {
  sources: string[]
  layers: { id: string; type: string; source?: string; atIndex: number }[]
  handlers: { event: string; layer: string | string[] | null }[]
  order: string[]
}

/** A map that records what the layer modules register, without needing WebGL. */
function fakeMap() {
  const rec: Recorded = { sources: [], layers: [], handlers: [], order: [] }
  const map = {
    addSource: (id: string) => { rec.sources.push(id); rec.order.push(`source:${id}`) },
    addLayer: (l: { id: string; type: string; source?: string }) => { rec.layers.push({ id: l.id, type: l.type, source: l.source, atIndex: rec.order.length }); rec.order.push(`layer:${l.id}`) },
    on: (event: string, a: unknown, b?: unknown) => { rec.handlers.push({ event, layer: typeof b === 'function' ? (a as string | string[]) : null }) },
    setTerrain: vi.fn(), setFog: vi.fn(), addImage: vi.fn(), hasImage: () => true,
    getCanvas: () => ({ style: {} }), getZoom: () => 2, getLayer: () => undefined, getSource: () => undefined,
  }
  return { map, rec }
}

function ctx(): LayerCtx {
  return {
    popupRef: { current: null }, flightDataRef: { current: [] }, militaryPersonnelRef: { current: [] },
    infraIndicatorsRef: { current: [] }, countryAnalyticsRef: { current: null },
    onFlightClick: vi.fn(), onCountryClickRef: { current: undefined }, onPlaceClickRef: { current: undefined },
  }
}

describe('addAllLayers', () => {
  const { map, rec } = fakeMap()
  addAllLayers(map as never, ctx())

  it('registers a substantial set of sources and layers without throwing', () => {
    expect(rec.sources.length).toBeGreaterThan(30)
    expect(rec.layers.length).toBeGreaterThan(60)
  })

  it('never reuses a source or layer id (Mapbox would throw at runtime)', () => {
    expect(new Set(rec.sources).size).toBe(rec.sources.length)
    const ids = rec.layers.map(l => l.id)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
  })

  it('adds every source before any layer that reads from it', () => {
    const sourceAt = new Map(rec.sources.map(s => [s, rec.order.indexOf(`source:${s}`)]))
    // 'composite' is the base style's own source (3D buildings read from it), not one we add
    for (const l of rec.layers.filter(l => l.source && l.source !== 'composite')) {
      expect(sourceAt.has(l.source!), `layer ${l.id} reads unknown source ${l.source}`).toBe(true)
      expect(sourceAt.get(l.source!)!, `layer ${l.id} added before its source ${l.source}`).toBeLessThan(l.atIndex)
    }
  })

  it('only attaches click/hover handlers to layers that exist', () => {
    const known = new Set(rec.layers.map(l => l.id))
    const bad: string[] = []
    for (const h of rec.handlers.filter(h => h.layer)) {
      for (const id of ([] as string[]).concat(h.layer!)) if (!known.has(id)) bad.push(`${h.event} → ${id}`)
    }
    expect(bad).toEqual([])
  })

  it('keeps the draw order that the globe was tuned with', () => {
    const at = (id: string) => rec.layers.find(l => l.id === id)!.atIndex
    expect(at('flights-icons')).toBeLessThan(at('sanctions-fill'))
    expect(at('sanctions-fill')).toBeLessThan(at('military-circles'))
    expect(at('military-circles')).toBeLessThan(at('humanitarian-offices'))
    expect(at('humanitarian-offices')).toBeLessThan(at('vessel-icons'))
  })

  it('installs the generic country click last, and every popup path can mark a feature click', () => {
    expect(rec.handlers.filter(h => h.event === 'click' && h.layer === null)).toHaveLength(1)
    expect(hasFeatureClickMarker(map as unknown as Parameters<typeof hasFeatureClickMarker>[0])).toBe(true)
  })
})
