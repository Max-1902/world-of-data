// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const m = vi.hoisted(() => ({ countries: [] as string[] }))
vi.mock('../../hooks/useWatchlist', () => ({ useWatchlist: () => ({ countries: m.countries, alerts: [], notify: false }) }))
vi.mock('../CountrySearchBox', () => ({ default: () => <div data-testid="search" /> }))

import CountriesLanding from './CountriesLanding'

describe('CountriesLanding', () => {
  it('offers the search and no followed list when nothing is followed', () => {
    m.countries = []
    render(<CountriesLanding onPick={vi.fn()} />)
    expect(screen.getByTestId('search')).toBeTruthy()
    expect(screen.queryByLabelText('Countries you follow')).toBeNull()
  })
  it('opens a followed country on click', () => {
    m.countries = ['Germany', 'Japan']
    const onPick = vi.fn()
    render(<CountriesLanding onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Japan' }))
    expect(onPick).toHaveBeenCalledWith('Japan')
  })
})
