// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { OutageEvent } from '../../services/outages'

// ── OutagesPanel ──────────────────────────────────────────────────────────────
const fetchOutageEvents = vi.fn<(hours: number) => Promise<OutageEvent[]>>()
vi.mock('../../services/outages', async (orig) => ({ ...(await orig<typeof import('../../services/outages')>()), fetchOutageEvents: (h: number) => fetchOutageEvents(h) }))

const outage = (over: Partial<OutageEvent>): OutageEvent => ({
  id: 'x', entityType: 'country', entityName: 'Testland', entityCode: 'TL', start: 0, duration: 0, score: 10, overallScore: 100, level: 'warning', ...over,
})

describe('OutagesPanel', () => {
  beforeEach(() => { fetchOutageEvents.mockReset() })

  it('shows a loading line, then the events with severity labels', async () => {
    fetchOutageEvents.mockResolvedValue([
      outage({ id: '1', entityName: 'Iran', score: 800, level: 'critical' }),
      outage({ id: '2', entityName: 'AS1234', entityType: 'asn', score: 60 }),
    ])
    const { OutagesPanel } = await import('./OutagesPanel')
    render(<OutagesPanel />)
    expect(screen.getByText(/QUERYING IODA/)).toBeTruthy()
    expect(await screen.findByText('Iran')).toBeTruthy()
    expect(screen.getByText('CRITICAL')).toBeTruthy()
    expect(screen.getByText('MODERATE')).toBeTruthy()
    expect(fetchOutageEvents).toHaveBeenCalledWith(24)   // default look-back
  })

  it('filters by entity type and refetches when the look-back changes', async () => {
    fetchOutageEvents.mockResolvedValue([
      outage({ id: '1', entityName: 'Iran', entityType: 'country', score: 800 }),
      outage({ id: '2', entityName: 'AS1234', entityType: 'asn', score: 60 }),
    ])
    const { OutagesPanel } = await import('./OutagesPanel')
    render(<OutagesPanel />)
    await screen.findByText('Iran')

    fireEvent.click(screen.getByRole('button', { name: 'ASN' }))
    expect(screen.queryByText('Iran')).toBeNull()
    expect(screen.getByText('AS1234')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '6h' }))
    await waitFor(() => expect(fetchOutageEvents).toHaveBeenLastCalledWith(6))
  })

  it('says so when there are none, rather than showing a blank list', async () => {
    fetchOutageEvents.mockResolvedValue([])
    const { OutagesPanel } = await import('./OutagesPanel')
    render(<OutagesPanel />)
    expect(await screen.findByText(/NO OUTAGES DETECTED/)).toBeTruthy()
  })

  it('shows the error when the feed fails', async () => {
    fetchOutageEvents.mockRejectedValue(new Error('IODA 503'))
    const { OutagesPanel } = await import('./OutagesPanel')
    render(<OutagesPanel />)
    expect(await screen.findByText(/IODA 503/)).toBeTruthy()
  })

  it('clicking an event asks the map to fly there', async () => {
    fetchOutageEvents.mockResolvedValue([outage({ id: '1', entityName: 'Iran', score: 800 })])
    const onGeoSearch = vi.fn()
    const { OutagesPanel } = await import('./OutagesPanel')
    render(<OutagesPanel onGeoSearch={onGeoSearch} />)
    fireEvent.click(await screen.findByText('Iran'))
    expect(onGeoSearch).toHaveBeenCalledWith('Iran')
  })
})

// ── WatchlistPanel ────────────────────────────────────────────────────────────
describe('WatchlistPanel', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules() })

  it('adds a country to the watchlist, offers countries from live crises, and removes it again', async () => {
    const { WatchlistPanel } = await import('./WatchlistPanel')
    const crises = [{ id: '1', title: 't', type: 'war', severity: 'high', latitude: 0, longitude: 0, country: 'Sudan', date: '2026-10-01', description: '', source: 'ACLED' }] as never
    const onCountryClick = vi.fn()
    const { container } = render(<WatchlistPanel crises={crises} onCountryClick={onCountryClick} />)

    expect(screen.getByText(/Nothing watched yet/)).toBeTruthy()
    expect(container.querySelector('datalist option[value="Sudan"]')).toBeTruthy()

    const input = screen.getByLabelText('Country to watch')
    const watch = screen.getByRole('button', { name: 'Watch' })
    expect((watch as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'Sudan' } })
    fireEvent.click(watch)

    expect(await screen.findByRole('button', { name: 'Sudan' })).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Sudan' }))
    expect(onCountryClick).toHaveBeenCalledWith('Sudan')

    fireEvent.click(screen.getByRole('button', { name: 'Stop watching Sudan' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Sudan' })).toBeNull())
  })
})

// ── SourceHealth (top-bar popover) ────────────────────────────────────────────
describe('SourceHealth', () => {
  it('reports the number of failing sources and lists each with its last error', async () => {
    vi.resetModules()
    const { healthTracker } = await import('../../services/sourceHealth')
    const SourceHealth = (await import('../SourceHealth')).default
    render(<SourceHealth />)
    expect(screen.getByRole('button', { name: /Data/ })).toBeTruthy()   // nothing observed yet → neutral label

    act(() => {
      healthTracker.record({ id: 'usgs', label: 'Earthquakes (USGS)' }, true)
      healthTracker.record({ id: 'acled', label: 'Conflict events (ACLED)' }, false, 'HTTP 403')
    })
    const btn = screen.getByRole('button', { name: /1 issue$/ })
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'Data source health' })).toBeTruthy()
    expect(screen.getByText('Conflict events (ACLED)')).toBeTruthy()
    expect(screen.getByText(/HTTP 403/)).toBeTruthy()
    expect(screen.getByText(/DOWN 0\/1/)).toBeTruthy()
    expect(screen.getByText(/OK 1\/1/)).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
