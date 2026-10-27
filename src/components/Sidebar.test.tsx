// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Sidebar from './Sidebar'
import { GROUP_ORDER } from '../panels/registry'

const base = { activeGroup: 'overview' as const, onGroupChange: () => {}, poppedOut: new Set<string>() }

describe('Sidebar', () => {
  it('marks Home active on the home page and leaves it from any destination', () => {
    const onHome = vi.fn(), onGroupChange = vi.fn()
    render(<Sidebar {...base} isHome onHome={onHome} onGroupChange={onGroupChange} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('button', { name: /Home/ }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('button', { name: /Indicators/ }).getAttribute('aria-current')).toBeNull()
    fireEvent.click(within(nav).getByRole('button', { name: /Indicators/ }))
    expect(onGroupChange).toHaveBeenCalledWith('markets')
  })

  it('opens a preset as its workspace plus the panel it is about', () => {
    const onGroupChange = vi.fn(), onFocusPanel = vi.fn()
    render(<Sidebar {...base} onGroupChange={onGroupChange} onFocusPanel={onFocusPanel} />)
    fireEvent.click(screen.getByRole('button', { name: /Trade & Finance/ }))
    expect(onGroupChange).toHaveBeenCalledWith('markets')
    expect(onFocusPanel).toHaveBeenCalledWith('exposure')
  })

  it('lists every workspace under "More workspaces", switches on click and marks the active one', () => {
    const onGroupChange = vi.fn()
    render(<Sidebar {...base} activeGroup="analysis" onGroupChange={onGroupChange} />)
    expect(screen.queryByRole('button', { name: 'NEWS & MEDIA' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /More workspaces/ }))
    for (const g of GROUP_ORDER) expect(screen.getByRole('button', { name: g.label })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'FORECASTS & ANALYSIS' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'NEWS & MEDIA' }))
    expect(onGroupChange).toHaveBeenCalledWith('news')
  })

  it('opens the panel library from Datasets', () => {
    const onOpenLibrary = vi.fn()
    render(<Sidebar {...base} onOpenLibrary={onOpenLibrary} />)
    fireEvent.click(screen.getByRole('button', { name: /Datasets/ }))
    expect(onOpenLibrary).toHaveBeenCalledOnce()
  })
})

describe('Sidebar purpose-first navigation', () => {
  it('puts forecasting first and opens each tool in its workspace', () => {
    const onGroupChange = vi.fn(), onFocusPanel = vi.fn()
    render(<Sidebar {...base} onGroupChange={onGroupChange} onFocusPanel={onFocusPanel} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const labels = within(nav).getAllByRole('button').map(b => b.textContent)
    expect(labels.slice(0, 5)).toEqual(['Home', 'Forecasts', 'GDP nowcast', 'Shock exposure', 'AI analyst'])
    fireEvent.click(within(nav).getByRole('button', { name: /Forecasts/ }))
    expect(onGroupChange).toHaveBeenLastCalledWith('analysis')
    expect(onFocusPanel).toHaveBeenLastCalledWith('predictions')
    fireEvent.click(within(nav).getByRole('button', { name: /GDP nowcast/ }))
    expect(onFocusPanel).toHaveBeenLastCalledWith('nowcast')
  })
  it('lights a tool only while its own workspace is open', () => {
    const { rerender } = render(<Sidebar {...base} activeGroup="analysis" focusPanel={{ id: 'predictions', n: 1 }} />)
    expect(screen.getByRole('button', { name: /Forecasts/ }).getAttribute('aria-current')).toBe('page')
    rerender(<Sidebar {...base} activeGroup="country" focusPanel={{ id: 'predictions', n: 1 }} />)
    expect(screen.getByRole('button', { name: /Forecasts/ }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('button', { name: /Countries/ }).getAttribute('aria-current')).toBe('page')
  })
  it('opens the map from Map', () => {
    const onOpenMap = vi.fn()
    render(<Sidebar {...base} onOpenMap={onOpenMap} />)
    fireEvent.click(screen.getByRole('button', { name: /^Map/ }))
    expect(onOpenMap).toHaveBeenCalledOnce()
  })
})
