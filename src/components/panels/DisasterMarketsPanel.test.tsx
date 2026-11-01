// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Reaction } from '../../services/disasterMarkets'
import { COUNTRY_FUNDS } from '../../services/countryFunds'

const JAPAN = COUNTRY_FUNDS.find(f => f.symbol === 'EWJ')!
const reaction = (o: { id: string; name: string; from: string; car: number; extremeShare: number }): Reaction => ({
  event: {
    id: o.id, eventKey: o.id, type: 'EQ', name: o.name, country: 'Japan', alert: 'Red', score: 1, latitude: 0, longitude: 0,
    from: o.from, to: o.from, reportUrl: '', severityText: 'Magnitude 7.1M', source: 'USGS', affectedCountries: ['Japan'], isCurrent: true,
  },
  country: 'Japan', fund: JAPAN, merged: [],
  study: {
    baseT: Date.UTC(2026, 9, 20) / 1000, alpha: 0, beta: 1.1, sigma: 0.01, estDays: 250,
    windows: { 1: { days: 1, car: o.car / 2, raw: o.car / 2, extremeShare: o.extremeShare }, 5: { days: 5, car: o.car, raw: o.car, extremeShare: o.extremeShare } },
  },
})

vi.mock('../../services/disasterMarkets', async (orig) => ({
  ...(await orig<typeof import('../../services/disasterMarkets')>()),
  loadRecentReactions: vi.fn(async () => ({
    reactions: [reaction({ id: 'EQ-9', name: 'Earthquake in Japan', from: '2026-10-20T03:00:00', car: -0.09, extremeShare: 0.004 })],
    unmatched: [{ event: { id: 'EQ-8', name: 'Earthquake in Nepal', from: '2026-10-18T00:00:00' }, reason: 'no US-listed single-country fund for the affected countries' }],
  })),
  loadHistoricalReactions: vi.fn(async () => ({
    reactions: Array.from({ length: 20 }, (_, i) => reaction({ id: `EQ-${i}`, name: `Quake ${i}`, from: `2015-01-${String(i + 1).padStart(2, '0')}T00:00:00`, car: (i - 10) / 1000, extremeShare: i === 0 ? 0.01 : 0.5 })),
    noFund: 30, noHistory: 2, folded: 4, fromYear: 2009,
  })),
}))

const { DisasterMarketsPanel } = await import('./DisasterMarketsPanel')

describe('DisasterMarketsPanel', () => {
  it('shows a recent alert\'s move against the world market, labelled, with its evidence path on demand', async () => {
    render(<DisasterMarketsPanel />)
    expect(await screen.findByText(/Earthquake in Japan/)).toBeTruthy()
    expect(screen.getByText('−9.0%')).toBeTruthy()
    expect(screen.getAllByText('Unusual').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(/Earthquake in Japan/))
    expect(screen.getByText(/stands in for Japan's stock market/)).toBeTruthy()
    expect(screen.getByText(/not that the disaster caused it/)).toBeTruthy()
    expect(screen.getByText(/Earlier Red earthquake alerts, 2009 to 30 days ago: 1 of 20/)).toBeTruthy()
  })

  it('says when past alerts were followed by unusual moves no more often than chance', async () => {
    render(<DisasterMarketsPanel />)
    expect(await screen.findByText(/1 of 20 followed by an unusual 5-day move; chance alone would give about 1.0 — no more than chance/)).toBeTruthy()
    expect(screen.getByText(/30 alerts where no affected country has a fund/)).toBeTruthy()
    expect(screen.getByText(/1 other recent alert not measured/)).toBeTruthy()
  })
})
