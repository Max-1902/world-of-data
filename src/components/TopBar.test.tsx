// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const watch = vi.hoisted(() => ({ alerts: [] as { read: boolean }[] }))
vi.mock('../hooks/useWatchlist', () => ({ useWatchlist: () => ({ countries: [], alerts: watch.alerts, notify: false }) }))
vi.mock('./SmartSearch', () => ({ default: () => null }))
vi.mock('./SourceHealth', () => ({ default: () => null }))

import TopBar from './TopBar'

const props = { viewMode: 'globe' as never, onViewMode: () => {}, searchQuery: '', onSearch: () => {}, onHome: () => {} }

describe('TopBar Saved shortcut', () => {
  beforeEach(() => { watch.alerts = [] })

  it('opens the same watchlist panel the sidebar’s Saved entry opens', () => {
    const onOpenPanel = vi.fn()
    render(<TopBar {...props} onOpenPanel={onOpenPanel} onToggleLayer={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Saved countries' }))
    expect(onOpenPanel).toHaveBeenCalledWith('watchlist')
  })

  it('shows the count of unread alerts, and is marked current while on the Saved page', () => {
    watch.alerts = [{ read: false }, { read: false }, { read: true }]
    render(<TopBar {...props} onOpenPanel={() => {}} onToggleLayer={() => {}} savedActive />)
    const btn = screen.getByRole('button', { name: 'Saved countries, 2 new alerts' })
    expect(btn.textContent).toBe('2')
    expect(btn.getAttribute('aria-current')).toBe('page')
  })
})
