// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { GfwEvent, GfwResult } from '../../services/gfw'

const fetchGfwEvents = vi.fn<(kind: string, days: number) => Promise<GfwResult>>()
vi.mock('../../services/gfw', async (orig) => ({ ...(await orig<typeof import('../../services/gfw')>()), fetchGfwEvents: (k: string, d: number) => fetchGfwEvents(k, d) }))

const ev = (o: Partial<GfwEvent> = {}): GfwEvent => ({
  id: 'x', kind: 'gaps', start: Date.now() - 86_400_000, end: Date.now(), lat: -10.1, lon: -80, durationHours: 30,
  vessel: { name: 'SEA STAR', flag: 'CHN', type: 'fishing', ssvid: '1' }, other: null, gapDistanceKm: 300, onPosition: null,
  encounterType: '', potentialRisk: false, highSeas: true, distanceFromShoreKm: 400, ...o,
})
const ok = (events: GfwEvent[], o: Partial<Extract<GfwResult, { status: 'ok' }>> = {}): GfwResult =>
  ({ status: 'ok', events, capped: false, total: events.length, newest: events[0]?.start ?? null, ...o })

describe('DarkVesselsPanel', () => {
  beforeEach(() => { fetchGfwEvents.mockReset() })

  it('lists AIS-off events with flag, hours dark and the GFW attribution, and counts flags', async () => {
    fetchGfwEvents.mockResolvedValue(ok([ev(), ev({ id: 'y', vessel: { name: 'OCEAN', flag: 'CHN', type: '', ssvid: '' } }), ev({ id: 'z', vessel: { name: 'MAR', flag: 'PAN', type: '', ssvid: '' } })]))
    const { DarkVesselsPanel } = await import('./DarkVesselsPanel')
    render(<DarkVesselsPanel />)
    expect(screen.getByText(/QUERYING GLOBAL FISHING WATCH/)).toBeTruthy()
    expect(await screen.findByText('SEA STAR')).toBeTruthy()
    expect(screen.getAllByText('30 h')).toHaveLength(3)
    expect(screen.getByText(/Most common flags: CHN 2 · PAN 1/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Powered by Global Fishing Watch' }).getAttribute('href')).toBe('https://globalfishingwatch.org')
    expect(fetchGfwEvents).toHaveBeenCalledWith('gaps', 30)
  })

  it('the Flagged tab shows only encounters GFW marks as potential risk', async () => {
    fetchGfwEvents.mockImplementation(async (kind) => kind === 'gaps' ? ok([]) : ok([
      ev({ id: 'r', kind: 'encounters', potentialRisk: true, vessel: { name: 'RISKY', flag: 'TWN', type: '', ssvid: '' }, other: { name: 'REEFER', flag: 'PAN', type: 'carrier', ssvid: '' } }),
      ev({ id: 's', kind: 'encounters', vessel: { name: 'FINE', flag: 'ESP', type: '', ssvid: '' } }),
    ]))
    const { DarkVesselsPanel } = await import('./DarkVesselsPanel')
    render(<DarkVesselsPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'FLAGGED' }))
    expect(await screen.findByText('RISKY')).toBeTruthy()
    expect(screen.queryByText('FINE')).toBeNull()
    expect(screen.getByText('POTENTIAL RISK')).toBeTruthy()
    expect(fetchGfwEvents).toHaveBeenLastCalledWith('encounters', 30)
  })

  it('says the counts are a sample when GFW had more events than one page', async () => {
    fetchGfwEvents.mockResolvedValue(ok([ev()], { capped: true, total: 5000 }))
    const { DarkVesselsPanel } = await import('./DarkVesselsPanel')
    render(<DarkVesselsPanel />)
    expect(await screen.findByText(/of 5,000 events are loaded, so these counts are a sample/)).toBeTruthy()
  })

  it('refetches for a new window and flies to an event by coordinates', async () => {
    fetchGfwEvents.mockResolvedValue(ok([ev()]))
    const onGeoSearch = vi.fn()
    const { DarkVesselsPanel } = await import('./DarkVesselsPanel')
    render(<DarkVesselsPanel onGeoSearch={onGeoSearch} />)
    fireEvent.click(await screen.findByText('SEA STAR'))
    expect(onGeoSearch).toHaveBeenCalledWith('-10.1000, -80.0000')
    fireEvent.click(screen.getByRole('button', { name: '90d' }))
    await waitFor(() => expect(fetchGfwEvents).toHaveBeenLastCalledWith('gaps', 90))
  })

  it('explains a missing token and shows errors instead of an empty list', async () => {
    fetchGfwEvents.mockResolvedValue({ status: 'not_configured' })
    const { DarkVesselsPanel } = await import('./DarkVesselsPanel')
    const { unmount } = render(<DarkVesselsPanel />)
    expect(await screen.findByText(/GLOBAL FISHING WATCH NOT CONFIGURED/)).toBeTruthy()
    unmount()
    fetchGfwEvents.mockResolvedValue({ status: 'error', message: 'Global Fishing Watch returned HTTP 429' })
    render(<DarkVesselsPanel />)
    expect(await screen.findByText(/HTTP 429/)).toBeTruthy()
  })
})
