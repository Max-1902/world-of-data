// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const entry = (country: string, trend: 'rising' | 'flat' = 'rising') => ({ country, recentScore: 5, priorScore: 1, delta: 4, trend, reason: `${country} reason` })
const m = vi.hoisted(() => ({ calls: [] as (string | null | undefined)[] }))
vi.mock('../utils/trajectory', () => ({
  isFlaggedUp: (e: { trend: string }) => e.trend === 'rising',
  computeTrajectories: (_c: unknown, o: { focusCountry?: string | null }) => {
    m.calls.push(o.focusCountry)
    return o.focusCountry ? [entry(o.focusCountry, 'flat')] : [entry('Sudan'), entry('Haiti'), entry('Myanmar')]
  },
}))
vi.mock('../hooks/useHistory', () => ({ useHistory: () => [], PREVIOUS_VISIT: null }))
vi.mock('../services/history', () => ({ changesSince: () => null, scoreByCountry: () => ({}) }))
vi.mock('./CountryBrief', () => ({ default: () => <div data-testid="country-brief" /> }))
vi.mock('./PlaceBrief', () => ({ default: () => <div data-testid="place-brief" /> }))

import OutlookCard from './OutlookCard'

const base = { crises: [], flights: [], articles: [], onSelectCountry: vi.fn(), onClose: vi.fn() }

describe('OutlookCard', () => {
  it('stays the regional outlook for a clicked country, with that country first and no country brief', () => {
    const { container } = render(<OutlookCard {...base} pinnedCountry="Ukraine" />)
    expect(screen.getByText('Regional outlook')).toBeTruthy()
    expect(screen.queryByTestId('country-brief')).toBeNull()
    const names = [...container.querySelectorAll('.outlook-entry-btn')].map(b => b.textContent ?? '')
    expect(names[0]).toContain('Ukraine')
    expect(names.length).toBe(3)
    expect(names.slice(1).join()).toContain('Sudan')
  })

  it('shows a clicked city as its own local brief, not the country data', () => {
    render(<OutlookCard {...base} pinnedCountry="Ukraine" selectedPlace={{ name: 'Lviv', country: 'Ukraine', lat: 49.8, lng: 24 }} />)
    expect(screen.getByTestId('place-brief')).toBeTruthy()
    expect(screen.queryByTestId('country-brief')).toBeNull()
  })
})
