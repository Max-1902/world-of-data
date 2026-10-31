// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const entry = (country: string, trend: 'rising' | 'flat' = 'rising') => ({ country, recentScore: 5, priorScore: 1, delta: 4, trend, reason: `${country} reason` })
const { LIVE, UCDP } = vi.hoisted(() => ({
  LIVE: { source: 'ACLED (live)', recent: '72h', prior: 'the prior week' },
  UCDP: { source: 'UCDP Candidate Events', recent: 'September 2026', prior: 'the 6 months before' },
}))
const m = vi.hoisted(() => ({ calls: [] as (string | null | undefined)[], empty: false, window: null as unknown }))
vi.mock('../utils/trajectory', () => ({
  isFlaggedUp: (e: { trend: string }) => e.trend === 'rising',
  LIVE_WINDOW: LIVE,
}))
vi.mock('../utils/monthlyTrajectory', () => ({
  UCDP_SNAPSHOT: { retrieved: '2026-10-30' },
  conflictWindow: () => m.window ?? LIVE,
  conflictTrajectories: (_c: unknown, _f: unknown, o: { focusCountry?: string | null }) => {
    m.calls.push(o.focusCountry)
    if (m.empty) return []
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
  it('stays the regional activity view for a clicked country, with that country first and no country brief', () => {
    const { container } = render(<OutlookCard {...base} pinnedCountry="Ukraine" />)
    expect(screen.getByText('Regional activity')).toBeTruthy()
    expect(screen.queryByTestId('country-brief')).toBeNull()
    const names = [...container.querySelectorAll('.outlook-entry-btn')].map(b => b.textContent ?? '')
    expect(names[0]).toContain('Ukraine')
    expect(names.length).toBe(3)
    expect(names.slice(1).join()).toContain('Sudan')
  })

  it('names its scope, and says why there is no trend when the conflict feed is empty', () => {
    m.empty = true
    render(<OutlookCard {...base} conflictFeed={{ events: [], capped: false }} />)
    m.empty = false
    expect(screen.getByText('Worldwide · conflict events, 72h vs prior week')).toBeTruthy()
    expect(screen.getByText(/no conflict events came back from ACLED.*not evidence that nothing happened/)).toBeTruthy()
  })

  it('says the feed is a year behind, not that the world is quiet, when last year\'s window came back instead', () => {
    m.empty = true
    render(<OutlookCard {...base} conflictFeed={{ events: [], capped: false }} conflictArchive={{ events: [], from: '2025-10-16', to: '2025-10-30' }} />)
    m.empty = false
    expect(screen.getByText(/stops about a year back \(the map shows 2025-10-16 to 2025-10-30 as history\)\. This is a gap in the feed, not a quiet world/)).toBeTruthy()
  })

  it('names UCDP\'s monthly window and says why when the live feed has nothing current', () => {
    m.window = UCDP
    render(<OutlookCard {...base} conflictFeed={{ events: [], capped: false }} />)
    m.window = null
    expect(screen.getByText('Worldwide · UCDP lethal violence, September 2026 vs the 6 months before')).toBeTruthy()
    expect(screen.getByText(/ACLED has no current events on this account, so this is UCDP’s monthly release/)).toBeTruthy()
    expect(screen.getByText(/retrieved 2026-10-30/)).toBeTruthy()
  })

  it('shows a clicked city as its own local brief, not the country data', () => {
    render(<OutlookCard {...base} pinnedCountry="Ukraine" selectedPlace={{ name: 'Lviv', country: 'Ukraine', lat: 49.8, lng: 24 }} />)
    expect(screen.getByTestId('place-brief')).toBeTruthy()
    expect(screen.queryByTestId('country-brief')).toBeNull()
  })
})
