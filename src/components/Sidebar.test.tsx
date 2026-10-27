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
    const nav = screen.getByRole('navigation', { name: 'Explore' })
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
