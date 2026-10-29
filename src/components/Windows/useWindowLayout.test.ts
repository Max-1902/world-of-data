import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installLocalStorage } from '../../test/helpers'
import { MIN_H, MIN_W } from './geometry'
import { loadWindows } from './useWindowLayout'

describe('loadWindows', () => {
  let store: Map<string, string>
  beforeEach(() => { store = installLocalStorage().store })
  afterEach(() => vi.unstubAllGlobals())

  it('grows a saved window below the minimum size instead of dropping the panel', () => {
    store.set('ws-windows', JSON.stringify([{ id: 'risk', rect: { x: 10, y: 20, w: 110, h: 90 } }]))
    const [w] = loadWindows()
    expect(w.id).toBe('risk')
    expect(w.rect).toEqual({ x: 10, y: 20, w: MIN_W, h: MIN_H })
  })

  it('still drops unknown panels, duplicates and non-numeric rects', () => {
    store.set('ws-windows', JSON.stringify([
      { id: 'not-a-panel', rect: { x: 0, y: 0, w: 400, h: 300 } },
      { id: 'risk', rect: { x: 0, y: 0, w: 400, h: 300 } },
      { id: 'risk', rect: { x: 5, y: 5, w: 400, h: 300 } },
      { id: 'threat', rect: { x: 'a', y: 0, w: 400, h: 300 } },
    ]))
    expect(loadWindows().map(w => w.id)).toEqual(['risk'])
  })
})
