// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./home/ForecastHome', () => ({ ForecastHome: () => null }))
vi.mock('../services/globalTrends', () => ({
  fetchGlobalTrend: (indicator: string) => Promise.resolve([{ year: 2022, value: 2 }, { year: 2023, value: 3 }].map(p => ({ ...p, value: p.value + indicator.length }))),
}))

const { default: HomeDashboard } = await import('./HomeDashboard')
const { countryAnalytics } = await import('../services/countryAnalytics')

const props = { map: null, onOpenMap: vi.fn(), onOpenCountry: vi.fn(), onOpenLibrary: vi.fn(), onColorCountries: vi.fn(), projectionMode: 'globe' as const, onProjectionMode: vi.fn() }

describe('The world so far', () => {
  beforeEach(() => vi.clearAllMocks())

  // Each card is the World Bank's world aggregate of one indicator; the click must keep that indicator, not land on a generic panel.
  it.each([
    ['Global GDP Growth', 'NY.GDP.MKTP.KD.ZG'],
    ['CO₂ Emissions', 'EN.GHG.CO2.MT.CE.AR5'],
    ['Renewable Energy', 'EG.FEC.RNEW.ZS'],
    ['Life Expectancy', 'SP.DYN.LE00.IN'],
  ])('%s opens Country Analytics on that indicator', async (label, indicator) => {
    const onOpenPanel = vi.fn()
    render(<HomeDashboard {...props} onOpenPanel={onOpenPanel} />)
    const card = (await screen.findByText(label)).closest('button')!
    await waitFor(() => expect(card.textContent).toContain('by country'))
    fireEvent.click(card)
    expect(onOpenPanel).toHaveBeenCalledWith('countryAnalytics')
    expect(countryAnalytics.getState().selection.y).toBe(indicator)
  })
})
