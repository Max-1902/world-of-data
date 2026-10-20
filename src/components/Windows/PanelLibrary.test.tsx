// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import PanelLibrary from './PanelLibrary'
import { PANEL_MAP } from '../../panels/registry'

const PANELS = [...PANEL_MAP.values()]

function setup(openIds = new Set<string>()) {
  const props = { open: true, onClose: vi.fn(), openIds, onOpenWindow: vi.fn(), onShowInDock: vi.fn() }
  render(<PanelLibrary {...props} />)
  const search = (q: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Search panels' }), { target: { value: q } })
  return { ...props, search }
}

describe('panel library', () => {
  it('lists every panel, under its workspace, with what it shows', () => {
    setup()
    expect(screen.getAllByRole('option')).toHaveLength(PANELS.length)
    expect(screen.getByText('Weekly US crude, gasoline, distillate and natural-gas stocks', { exact: false })).toBeTruthy()
    expect(screen.getAllByText('SECURITY & DEFENSE').length).toBeGreaterThan(0)
  })

  it('finds panels by what you want to see, not just their titles', () => {
    const { search } = setup()
    const first = () => screen.getAllByRole('option')[0].textContent
    search('refugees'); expect(first()).toContain('Humanitarian')
    search('oil'); expect(first()).toContain('Energy Inventories')
    search('forecast'); expect(first()).toContain('Predictions')
    search('prediktions'); expect(first()).toContain('Predictions')
  })

  it('says so when nothing matches', () => {
    const { search } = setup()
    search('zzzzqqq')
    expect(screen.getByText(/No panel matches/)).toBeTruthy()
  })

  it('narrows to one workspace', () => {
    setup()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Workspaces' })).getByRole('button', { name: /^Economy/ }))
    const n = PANELS.filter(p => p.group === 'markets').length
    expect(screen.getAllByRole('option')).toHaveLength(n)
  })

  it('click opens a window; the dock button shows it in the dock', () => {
    const p = setup()
    fireEvent.click(screen.getAllByRole('option')[0])
    expect(p.onOpenWindow).toHaveBeenCalledWith(PANELS.find(x => x.group === 'overview')!.id)
    expect(p.onClose).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Show Risk Matrix in the dock' }))
    expect(p.onShowInDock).toHaveBeenCalledWith('risk')
  })

  it('keyboard: arrows move, Enter opens a window, Shift+Enter shows it in the dock, Esc closes', () => {
    const p = setup()
    p.search('sanctions')
    const box = screen.getByRole('dialog', { name: 'Panel library' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(p.onOpenWindow).toHaveBeenCalledWith('sanctions')
    p.search('nuclear')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(p.onShowInDock).toHaveBeenCalledWith(screen.getAllByRole('option')[1].getAttribute('data-panel-id'))
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(p.onClose).toHaveBeenCalled()
  })

  it('marks panels that are already open as windows', () => {
    setup(new Set(['markets']))
    const row = screen.getAllByRole('option').find(o => o.textContent?.includes('Consolidated financial data feed'))!
    expect(within(row).getByText('open')).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Show' })).toBeTruthy()
  })

  it('renders nothing while closed', () => {
    const { container } = render(<PanelLibrary open={false} onClose={() => {}} openIds={new Set()} onOpenWindow={() => {}} onShowInDock={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
