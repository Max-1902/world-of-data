import { describe, it, expect, vi, beforeEach } from 'vitest'
import { triggerGlobalReload, onGlobalReload } from './reloadBus'

describe('reloadBus', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget())
  })

  it('invokes every subscriber when a reload is triggered', () => {
    const a = vi.fn(), b = vi.fn()
    onGlobalReload(a)
    onGlobalReload(b)
    triggerGlobalReload()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('stops calling a handler after it unsubscribes, without affecting others', () => {
    const a = vi.fn(), b = vi.fn()
    const offA = onGlobalReload(a)
    onGlobalReload(b)
    offA()
    triggerGlobalReload()
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('does nothing when there are no subscribers', () => {
    expect(() => triggerGlobalReload()).not.toThrow()
  })
})
