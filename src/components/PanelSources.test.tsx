// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import PanelSources, { describeSource, providerName } from './PanelSources'
import { healthTracker, type SourceHealth } from '../services/sourceHealth'

const h = (o: Partial<SourceHealth>): SourceHealth => ({ id: 'worldbank', label: 'Economy (World Bank)', status: 'ok', lastOk: null, lastFail: null, lastError: null, okCount: 0, attempts: 0, ...o })

describe('describeSource', () => {
  it('names the provider, and says when a live feed last answered', () => {
    expect(providerName('Economy (World Bank)')).toBe('World Bank')
    expect(providerName('IMF World Economic Outlook')).toBe('IMF World Economic Outlook')
    const d = describeSource('worldbank', new Map([['worldbank', h({ lastOk: Date.UTC(2026, 9, 27, 12, 5) })]]))
    expect(d.name).toBe('World Bank')
    expect(d.when).toMatch(/^updated \d{1,2}:\d{2}/)
    expect(d.problem).toBeNull()
  })
  it('does not invent a time for a feed not yet asked or never answered', () => {
    expect(describeSource('worldbank', new Map()).when).toBe('not requested yet')
    expect(describeSource('worldbank', new Map([['worldbank', h({ status: 'down', lastFail: 1 })]])).when).toBe('no successful response yet')
  })
  it('states a static dataset\'s date, or that none is recorded', () => {
    expect(describeSource({ name: 'UN Comtrade', asOf: 'retrieved 2026-10-08' }, new Map()).when).toBe('retrieved 2026-10-08')
    expect(describeSource({ name: 'OFAC (curated)' }, new Map()).when).toBe('date not recorded')
  })
})

describe('PanelSources', () => {
  it('renders nothing for a panel without sources', () => {
    const { container } = render(<PanelSources sources={[]} />)
    expect(container.innerHTML).toBe('')
  })
  it('lists every source and adds a status line only for a failing feed', () => {
    render(<PanelSources sources={['imfweo', { name: 'UN Comtrade', asOf: 'retrieved 2026-10-08' }]} />)
    expect(screen.getByRole('contentinfo', { name: 'Data sources' }).textContent).toContain('Sources: IMF World Economic Outlook (not requested yet) · UN Comtrade (retrieved 2026-10-08)')
    expect(screen.queryByRole('alert')).toBeNull()
    act(() => { healthTracker.record({ id: 'imfweo', label: 'IMF World Economic Outlook' }, false, 'HTTP 502') })
    expect(screen.getByRole('alert').textContent).toContain('IMF World Economic Outlook is not responding (HTTP 502)')
  })
})
