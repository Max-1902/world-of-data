// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SmartSearch from './SmartSearch'

function setup(searchQuery = '') {
  const props = { searchQuery, onSearch: vi.fn(), onOpenPanel: vi.fn(), onToggleLayer: vi.fn(), onViewMode: vi.fn() }
  render(<SmartSearch {...props} />)
  fireEvent.click(screen.getByRole('button', { name: /search/i }))
  return { props, input: screen.getByRole('combobox') }
}

const labels = () => screen.getAllByRole('option').map(o => o.textContent)

describe('SmartSearch', () => {
  it('suggests panels before anything is typed', () => {
    setup()
    expect(labels().some(l => l?.includes('Analyst chat'))).toBe(true)
    expect(labels().some(l => l?.includes('Predictions'))).toBe(true)
  })

  it('does not geocode while typing; Enter on a place commits it to the map', () => {
    const { props, input } = setup()
    fireEvent.change(input, { target: { value: 'Paris' } })
    expect(props.onSearch).not.toHaveBeenCalled()
    expect(labels()[0]).toContain('Fly to “Paris”')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onSearch).toHaveBeenCalledWith('Paris')
  })

  it('opens the AI analyst panel', () => {
    const { props, input } = setup()
    fireEvent.change(input, { target: { value: 'ai analyst' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onOpenPanel).toHaveBeenCalledWith('analyst')
    expect(props.onSearch).not.toHaveBeenCalled()
  })

  it('tolerates a typo for Predictions and keeps the place fallback reachable', () => {
    const { props, input } = setup()
    fireEvent.change(input, { target: { value: 'prection' } })
    expect(labels()[0]).toContain('Predictions')
    expect(labels().some(l => l?.includes('Fly to “prection”'))).toBe(true)
    fireEvent.click(screen.getAllByRole('option')[0])
    expect(props.onOpenPanel).toHaveBeenCalledWith('predictions')
  })

  it('arrow keys move the selection; Escape closes without searching', () => {
    const { props, input } = setup()
    fireEvent.change(input, { target: { value: 'prediction' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(props.onSearch).not.toHaveBeenCalled()
  })
})
