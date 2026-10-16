import { describe, it, expect } from 'vitest'
import { encodeHash, decodeHash, layersToPanelState, enabledLayers, isDemoMode } from './urlState'
import type { PanelState } from '../types'

const LAYERS = ['flights', 'crises', 'military', 'vessels']
const GROUPS = ['overview', 'security', 'markets']

describe('urlState', () => {
  it('round-trips view, layers, group and country', () => {
    const hash = encodeHash({ viewMode: 'dark', layers: ['flights', 'military'] as never, group: 'security', country: 'Côte d\'Ivoire' })
    expect(decodeHash(hash, LAYERS, GROUPS)).toEqual({
      viewMode: 'dark', layers: ['flights', 'military'], group: 'security', country: 'Côte d\'Ivoire',
    })
  })

  it('distinguishes "no layers enabled" (l=) from "link says nothing about layers"', () => {
    expect(decodeHash('#l=', LAYERS, GROUPS).layers).toEqual([])
    expect(decodeHash('#v=dark', LAYERS, GROUPS).layers).toBeUndefined()
  })

  it('drops unknown values instead of passing them into app state', () => {
    const d = decodeHash('#v=rainbow&l=flights,__proto__,nope,flights&g=evil&c=' + 'x'.repeat(200), LAYERS, GROUPS)
    expect(d).toEqual({ layers: ['flights'] })
  })

  it('does not treat Object.prototype keys as valid view modes', () => {
    expect(decodeHash('#v=toString', LAYERS, GROUPS).viewMode).toBeUndefined()
  })

  it('handles an empty or junk hash', () => {
    expect(decodeHash('', LAYERS, GROUPS)).toEqual({})
    expect(decodeHash('#%%%', LAYERS, GROUPS)).toEqual({})
  })

  it('layersToPanelState turns listed layers on and everything else off', () => {
    const base = { flights: true, crises: true, military: false, vessels: false } as unknown as PanelState
    const next = layersToPanelState(base, ['military'])
    expect(next).toEqual({ flights: false, crises: false, military: true, vessels: false })
    expect(enabledLayers(next)).toEqual(['military'])
  })
})

describe('isDemoMode', () => {
  it('is on for ?demo=1 or ?screenshot, off otherwise', () => {
    expect(isDemoMode('?demo=1')).toBe(true)
    expect(isDemoMode('?screenshot')).toBe(true)
    expect(isDemoMode('?demo=0')).toBe(false)
    expect(isDemoMode('?demo=false')).toBe(false)
    expect(isDemoMode('')).toBe(false)
  })
})
