// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

const m = vi.hoisted(() => ({ countries: [] as string[] }))
vi.mock('../../hooks/useWatchlist', () => ({ useWatchlist: () => ({ countries: m.countries, alerts: [], notify: false }) }))
vi.mock('../../services/countryLookup', () => ({ fetchCountryList: () => Promise.resolve([
  { iso2: 'DE', iso3: 'DEU', name: 'Germany', region: 'Europe & Central Asia', incomeLevel: 'High income', capital: '' },
  { iso2: 'FR', iso3: 'FRA', name: 'France', region: 'Europe & Central Asia', incomeLevel: 'High income', capital: '' },
  { iso2: 'IN', iso3: 'IND', name: 'India', region: 'South Asia', incomeLevel: 'Lower middle income', capital: '' },
]) }))
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
  it('lists every economy under its World Bank region and opens one on click', async () => {
    m.countries = []
    const onPick = vi.fn()
    render(<CountriesLanding onPick={onPick} />)
    const browse = await screen.findByLabelText('Browse by region')
    expect(within(browse).getByText(/Europe & Central Asia/).textContent).toContain('2')
    expect(within(browse).getByText(/South Asia/).textContent).toContain('1')
    fireEvent.click(within(browse).getByRole('button', { name: 'India' }))
    expect(onPick).toHaveBeenCalledWith('India')
    expect(within(browse).getByText(/World Bank country classification/)).toBeTruthy()
  })
})
