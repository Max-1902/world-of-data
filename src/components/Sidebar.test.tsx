// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Sidebar from './Sidebar'

describe('Sidebar', () => {
  it('groups workspaces under section headings, in order', () => {
    render(<Sidebar activeGroup="overview" onGroupChange={() => {}} poppedOut={new Set()} />)
    const sections = screen.getAllByRole('group')
    expect(sections.map(s => s.getAttribute('aria-label'))).toEqual(['START', 'ECONOMY & FORECASTING', 'CONTEXT', 'SOURCES'])
    expect(within(sections[1]).getAllByRole('button').map(b => b.textContent?.replace(/\d+$/, ''))).toEqual(['ECONOMY', 'FORECASTS & ANALYSIS', 'COUNTRY LOOKUP'])
  })

  it('switches workspace on click and marks the active one', () => {
    const onGroupChange = vi.fn()
    render(<Sidebar activeGroup="analysis" onGroupChange={onGroupChange} poppedOut={new Set()} />)
    expect(screen.getByRole('button', { name: /FORECASTS & ANALYSIS/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /NEWS & MEDIA/ }))
    expect(onGroupChange).toHaveBeenCalledWith('news')
  })
})
