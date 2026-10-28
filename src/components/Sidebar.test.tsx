// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Sidebar, { navSection } from './Sidebar'

const base = { activeGroup: 'overview' as const, onGroupChange: () => {} }
const mainNav = () => screen.getByRole('navigation', { name: 'Main' })

describe('Sidebar', () => {
  it('has seven entries, in the order of what the dashboard is for', () => {
    render(<Sidebar {...base} />)
    expect(within(mainNav()).getAllByRole('button').map(b => b.textContent)).toEqual(['Outlook', 'Forecasts', 'Drivers', 'Countries', 'Map', 'Explore', 'Saved'])
  })

  it('no longer carries presets, a workspace list or a separate AI analyst entry', () => {
    render(<Sidebar {...base} />)
    expect(screen.queryByText('PRESETS')).toBeNull()
    expect(screen.queryByRole('button', { name: /Trade & Finance/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /More workspaces/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /AI analyst/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /nowcast/i })).toBeNull()
  })

  it('marks Outlook active on the home page and leaves it from any destination', () => {
    const onHome = vi.fn(), onGroupChange = vi.fn()
    render(<Sidebar {...base} isHome onHome={onHome} onGroupChange={onGroupChange} />)
    expect(within(mainNav()).getByRole('button', { name: /Outlook/ }).getAttribute('aria-current')).toBe('page')
    expect(within(mainNav()).getByRole('button', { name: /Explore/ }).getAttribute('aria-current')).toBeNull()
    fireEvent.click(within(mainNav()).getByRole('button', { name: /Countries/ }))
    expect(onGroupChange).toHaveBeenCalledWith('country')
    fireEvent.click(within(mainNav()).getByRole('button', { name: /Outlook/ }))
    expect(onHome).toHaveBeenCalledOnce()
  })

  it('opens each entry in its workspace, on the panel it is about', () => {
    const onGroupChange = vi.fn(), onFocusPanel = vi.fn()
    render(<Sidebar {...base} onGroupChange={onGroupChange} onFocusPanel={onFocusPanel} />)
    const click = (name: RegExp) => fireEvent.click(within(mainNav()).getByRole('button', { name }))
    click(/Forecasts/)
    expect([onGroupChange.mock.lastCall![0], onFocusPanel.mock.lastCall![0]]).toEqual(['analysis', 'predictions'])
    click(/Drivers/)
    expect([onGroupChange.mock.lastCall![0], onFocusPanel.mock.lastCall![0]]).toEqual(['markets', 'drivers'])
    click(/Explore/)
    expect([onGroupChange.mock.lastCall![0], onFocusPanel.mock.lastCall![0]]).toEqual(['markets', 'economy'])
    click(/Saved/)
    expect([onGroupChange.mock.lastCall![0], onFocusPanel.mock.lastCall![0]]).toEqual(['overview', 'watchlist'])
  })

  it('keeps Risk monitor, Security, Infrastructure and News folded under More until opened', () => {
    const onGroupChange = vi.fn()
    render(<Sidebar {...base} activeGroup="country" onGroupChange={onGroupChange} />)
    expect(screen.queryByRole('button', { name: /^News/ })).toBeNull()
    const more = screen.getByRole('button', { name: /More/ })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    for (const name of [/Risk monitor/, /Security & defence/, /Infrastructure & hazards/, /^News/]) expect(screen.getByRole('button', { name })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^News/ }))
    expect(onGroupChange).toHaveBeenCalledWith('news')
    fireEvent.click(screen.getByRole('button', { name: /Security & defence/ }))
    expect(onGroupChange).toHaveBeenLastCalledWith('security')
  })

  it('opens More by itself when you are standing in it, so the active entry is never hidden', () => {
    render(<Sidebar {...base} activeGroup="geo" />)
    expect(screen.getByRole('button', { name: /Infrastructure & hazards/ }).getAttribute('aria-current')).toBe('page')
  })

  it('shows the explore tools only while exploring, and opens the panel library from Datasets', () => {
    const onOpenLibrary = vi.fn(), onGroupChange = vi.fn(), onFocusPanel = vi.fn()
    const { rerender } = render(<Sidebar {...base} activeGroup="country" />)
    expect(screen.queryByRole('button', { name: /Datasets/ })).toBeNull()
    rerender(<Sidebar {...base} activeGroup="markets" focusPanel={{ id: 'economy', n: 1 }} onOpenLibrary={onOpenLibrary} onGroupChange={onGroupChange} onFocusPanel={onFocusPanel} />)
    fireEvent.click(screen.getByRole('button', { name: /Datasets/ }))
    expect(onOpenLibrary).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /Analysis/ }))
    expect([onGroupChange.mock.lastCall![0], onFocusPanel.mock.lastCall![0]]).toEqual(['analysis', 'countryAnalytics'])
  })
})

describe('navSection', () => {
  it('places every view under exactly one entry', () => {
    expect(navSection(true, 'markets')).toBe('outlook')
    expect(navSection(false, 'analysis', 'predictions')).toBe('forecasts')
    expect(navSection(false, 'analysis', 'nowcast')).toBe('forecasts')
    expect(navSection(false, 'analysis', 'analyst')).toBe('explore')
    expect(navSection(false, 'analysis', 'gasForecast')).toBe('explore')
    expect(navSection(false, 'analysis')).toBe('forecasts')
    expect(navSection(false, 'analysis', 'countryAnalytics')).toBe('explore')
    expect(navSection(false, 'markets', 'drivers')).toBe('drivers')
    expect(navSection(false, 'markets', 'exposure', true)).toBe('map')
    expect(navSection(true, 'markets', undefined, true)).toBe('outlook')
    expect(navSection(false, 'markets', 'exposure')).toBe('drivers')
    expect(navSection(false, 'markets', 'tradePartnersByCountry')).toBe('drivers')
    expect(navSection(false, 'markets', 'economy')).toBe('explore')
    expect(navSection(false, 'markets')).toBe('explore')
    expect(navSection(false, 'country')).toBe('countries')
    expect(navSection(false, 'overview', 'watchlist')).toBe('saved')
    expect(navSection(false, 'overview', 'threat')).toBe('risk')
    expect(navSection(false, 'security')).toBe('security')
    expect(navSection(false, 'geo')).toBe('infrastructure')
    expect(navSection(false, 'news')).toBe('news')
  })

  it('lights a tool only while its own workspace is open (the focused panel outlives a workspace switch)', () => {
    const { rerender } = render(<Sidebar {...base} activeGroup="analysis" focusPanel={{ id: 'predictions', n: 1 }} />)
    expect(screen.getByRole('button', { name: /Forecasts/ }).getAttribute('aria-current')).toBe('page')
    rerender(<Sidebar {...base} activeGroup="country" focusPanel={{ id: 'predictions', n: 1 }} />)
    expect(screen.getByRole('button', { name: /Forecasts/ }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('button', { name: /Countries/ }).getAttribute('aria-current')).toBe('page')
  })
})
