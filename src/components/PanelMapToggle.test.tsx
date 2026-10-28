// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PanelState } from '../types'
import { LAYER_IDS } from './layerCatalogue'
import PanelMapToggle from './PanelMapToggle'
import { OpenMapContext } from './OpenMapContext'

const allOff = Object.fromEntries(LAYER_IDS.map(l => [l.id, false])) as unknown as PanelState
const state = (on: (keyof PanelState)[]) => ({ ...allOff, ...Object.fromEntries(on.map(id => [id, true])) }) as PanelState

describe('PanelMapToggle', () => {
  it('renders nothing for panels without map layers', () => {
    const { container: a } = render(<PanelMapToggle map="none" panelState={allOff} onToggleLayer={vi.fn()} />)
    expect(a.innerHTML).toBe('')
    const { container: b } = render(<PanelMapToggle map="inline" panelState={allOff} onToggleLayer={vi.fn()} />)
    expect(b.innerHTML).toBe('')
  })

  it('turns on only the layers that are still off', () => {
    const toggle = vi.fn()
    render(<PanelMapToggle map={['military', 'nuclear']} panelState={state(['nuclear'])} onToggleLayer={toggle} />)
    const btn = screen.getByRole('button', { name: /show on map/i })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    expect(toggle.mock.calls).toEqual([['military']])
  })

  it('is on when every layer is on, and then turns them all off', () => {
    const toggle = vi.fn()
    render(<PanelMapToggle map={['military', 'nuclear']} panelState={state(['military', 'nuclear'])} onToggleLayer={toggle} />)
    const btn = screen.getByRole('button', { name: /on the map/i })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(btn)
    expect(toggle.mock.calls).toEqual([['military'], ['nuclear']])
  })

  it('names what will be drawn, from the layer catalogue', () => {
    render(<PanelMapToggle map={['sanctions']} panelState={allOff} onToggleLayer={vi.fn()} />)
    expect(screen.getByRole('button').getAttribute('title')).toContain('Sanctioned countries')
  })

  it('opens the Map when it turns layers on, and not when it turns them off', () => {
    const openMap = vi.fn()
    const { unmount } = render(<OpenMapContext.Provider value={openMap}><PanelMapToggle map={['sanctions']} panelState={allOff} onToggleLayer={vi.fn()} /></OpenMapContext.Provider>)
    fireEvent.click(screen.getByRole('button'))
    expect(openMap).toHaveBeenCalledOnce()
    unmount()
    render(<OpenMapContext.Provider value={openMap}><PanelMapToggle map={['sanctions']} panelState={state(['sanctions'])} onToggleLayer={vi.fn()} /></OpenMapContext.Provider>)
    fireEvent.click(screen.getByRole('button'))
    expect(openMap).toHaveBeenCalledOnce()
  })
})
