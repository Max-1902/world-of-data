// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

function setup() {
  const handlers = { onViewMode: vi.fn(), onToggleLayer: vi.fn(), onSettingsOpen: vi.fn(), onCloseDrawer: vi.fn() }
  renderHook(() => useKeyboardShortcuts(handlers))
  return handlers
}

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = window) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))

describe('useKeyboardShortcuts', () => {
  it('maps plain keys to layers, views, settings and close', () => {
    const h = setup()
    press('1'); press('0'); press('g'); press('S'); press(','); press('Escape')
    expect(h.onToggleLayer.mock.calls).toEqual([['flights'], ['shippingDensity']])
    expect(h.onViewMode.mock.calls).toEqual([['earth'], ['satellite']])
    expect(h.onSettingsOpen).toHaveBeenCalledOnce()
    expect(h.onCloseDrawer).toHaveBeenCalledOnce()
  })

  it.each([{ metaKey: true }, { ctrlKey: true }, { altKey: true }])('regression: ignores browser combos like %o + 1 / G', (mod) => {
    const h = setup()
    press('1', mod); press('g', mod)
    expect(h.onToggleLayer).not.toHaveBeenCalled()
    expect(h.onViewMode).not.toHaveBeenCalled()
  })

  it('ignores keys typed into fields, including contenteditable', () => {
    const h = setup()
    const input = document.body.appendChild(document.createElement('input'))
    const editable = document.body.appendChild(document.createElement('div'))
    editable.contentEditable = 'true'
    Object.defineProperty(editable, 'isContentEditable', { value: true }) // jsdom doesn't compute it
    press('1', {}, input); press('g', {}, editable)
    expect(h.onToggleLayer).not.toHaveBeenCalled()
    expect(h.onViewMode).not.toHaveBeenCalled()
  })
})
