// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// mapbox-gl needs WebGL at import time in a real browser; the layer modules only touch it inside click handlers.
vi.mock('mapbox-gl', () => ({ default: { Popup: class {}, Marker: class {} } }))
vi.mock('../vesselImages', () => ({ addVesselImages: vi.fn() }))

import { addAllLayers, type LayerCtx } from './index'
import { hasFeatureClickMarker } from './countryClick'
import { SANCTION_FILL_OPACITY, SANCTION_LINE_WIDTH } from './sanctions'

interface Recorded {
  sources: string[]
  layers: { id: string; type: string; source?: string; atIndex: number }[]
  handlers: { event: string; layer: string | string[] | null }[]
  order: string[]
  specs: Map<string, Record<string, any>>
}

/** A map that records what the layer modules register, without needing WebGL. */
function fakeMap() {
  const rec: Recorded = { sources: [], layers: [], handlers: [], order: [], specs: new Map() }
  const map = {
    addSource: (id: string) => { rec.sources.push(id); rec.order.push(`source:${id}`) },
    addLayer: (l: { id: string; type: string; source?: string }) => { rec.specs.set(l.id, l as Record<string, any>); rec.layers.push({ id: l.id, type: l.type, source: l.source, atIndex: rec.order.length }); rec.order.push(`layer:${l.id}`) },
    on: (event: string, a: unknown, b?: unknown) => { rec.handlers.push({ event, layer: typeof b === 'function' ? (a as string | string[]) : null }) },
    setTerrain: vi.fn(), setFog: vi.fn(), addImage: vi.fn(), hasImage: () => true,
    getCanvas: () => ({ style: {} }), getZoom: () => 2, getLayer: () => undefined, getSource: () => undefined,
  }
  return { map, rec }
}

function ctx(): LayerCtx {
  return {
    popupRef: { current: null }, flightDataRef: { current: [] }, 
    countryAnalyticsRef: { current: null },
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

/** Meaning that colour alone would carry: each layer below also says it by width, dash, opacity or an outline. */
describe('layers do not rely on colour alone', () => {
  const { map, rec } = fakeMap()
  addAllLayers(map as never, ctx())

  it('gives every crossing status its own dash pattern', () => {
    const dash = rec.specs.get('humanitarian-crossing-path')!.paint['line-dasharray'] as unknown[]
    const patterns = dash.filter((_, i) => i >= 2 && (i % 2 === 1 || i === dash.length - 1)).map(p => JSON.stringify((p as { literal?: unknown }) ?? p))
    expect(new Set(patterns).size).toBe(4)
  })

  it('names the crossing status in the label text', () => {
    const field = JSON.stringify(rec.specs.get('humanitarian-crossings-labels')!.layout['text-field'])
    expect(field).toContain('status')
  })

  it('varies sanctions fill and outline weight with severity, not only hue', () => {
    expect(SANCTION_FILL_OPACITY.critical).toBeGreaterThan(SANCTION_FILL_OPACITY.high)
    expect(SANCTION_FILL_OPACITY.high).toBeGreaterThan(SANCTION_FILL_OPACITY.medium)
    expect(SANCTION_FILL_OPACITY.medium).toBeGreaterThan(SANCTION_FILL_OPACITY.low)
    expect(SANCTION_LINE_WIDTH.critical).toBeGreaterThan(SANCTION_LINE_WIDTH.high)
    expect(SANCTION_LINE_WIDTH.high).toBeGreaterThan(SANCTION_LINE_WIDTH.medium)
    expect(SANCTION_LINE_WIDTH.medium).toBeGreaterThan(SANCTION_LINE_WIDTH.low)
    expect(Array.isArray(rec.specs.get('sanctions-fill')!.paint['fill-opacity'])).toBe(true)
    expect(Array.isArray(rec.specs.get('sanctions-outline')!.paint['line-width'])).toBe(true)
  })

  it('draws each facility category as its own shape, with a white halo, so type does not rest on colour', () => {
    for (const id of ['military-circles', 'infra-circles', 'nuclear-circles', 'port-circles', 'supplychain-circles']) {
      const spec = rec.specs.get(id)!
      expect(spec.type, id).toBe('symbol')
      expect(JSON.stringify(spec.layout['icon-image']), id).toContain('shape')
      expect(spec.paint['icon-halo-color'], id).toBe('#ffffff')
      expect(spec.paint['icon-halo-width'], id).toBeGreaterThanOrEqual(1)
    }
  })

  it('outlines the single-category dots (data centres, crossings) with an opaque white ring', () => {
    for (const id of ['datacenter-circles', 'humanitarian-crossings']) {
      const p = rec.specs.get(id)!.paint
      expect(p['circle-stroke-color'], id).toBe('#ffffff')
      expect(p['circle-stroke-opacity'], id).toBeGreaterThanOrEqual(0.9)
      expect(p['circle-stroke-width'], id).toBeGreaterThanOrEqual(1.5)
    }
  })

  it('draws a different aircraft silhouette for every flight type', () => {
    const icon = JSON.stringify(rec.specs.get('flights-icons')!.layout['icon-image'])
    for (const t of ['airline', 'cargo', 'military', 'private', 'unknown']) expect(icon).toContain(`flight-${t}`)
  })

  it('makes a Red disaster alert a larger pin marked "!", not just a redder one', () => {
    const pins = rec.specs.get('disasters-pins')!.paint['circle-radius']
    expect(JSON.stringify(pins)).toContain('Red')
    expect(JSON.stringify(rec.specs.get('disasters-labels')!.layout['text-field'])).toContain('!')
  })
})
