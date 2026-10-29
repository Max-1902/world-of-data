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
  it('adds what the response held (newest observation, coverage) after the update time', () => {
    const notes = new Map([['worldbank', { asOf: 'data to 2024', coverage: '187 economies' }]])
    const d = describeSource('worldbank', new Map([['worldbank', h({ lastOk: Date.UTC(2026, 9, 27, 12, 5) })]]), notes)
    expect(d.when).toMatch(/^updated \d{1,2}:\d{2}.* · data to 2024 · 187 economies$/)
    expect(d.warn).toBeNull()
  })
  it('does not describe data it was never told about, and does not note a feed that never answered', () => {
    expect(describeSource('worldbank', new Map([['worldbank', h({ lastOk: 1 })]]), new Map()).when).toMatch(/^updated \d{1,2}:\d{2}[^·]*$/)
    expect(describeSource('worldbank', new Map(), new Map([['worldbank', { asOf: 'data to 2024' }]])).when).toBe('not requested yet')
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
  it('shows a caution about the data itself even when the feed is healthy', () => {
    render(<PanelSources sources={['acled']} />)
    act(() => {
      healthTracker.record({ id: 'acled', label: 'Conflict events (ACLED)' }, true)
      healthTracker.note('acled', { asOf: 'newest event 2025-10-20', warn: 'The newest event is 373 days old: this feed is behind the present.' })
    })
    const text = screen.getByRole('contentinfo', { name: 'Data sources' }).textContent!
    expect(text).toContain('newest event 2025-10-20')
    expect(text).toContain('ACLED: The newest event is 373 days old')
    expect(screen.queryByRole('alert')).toBeNull()
    act(() => { healthTracker.note('acled', null) })
  })
})
