// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const m = vi.hoisted(() => ({
  econ: { econData: null as unknown, econLoading: false },
  fetchWeo: vi.fn(), fetchNowcast: vi.fn(), gdp: { status: 'ready', rows: [] as unknown[], error: null },
  drawerOnly: [] as string[],
}))
vi.mock('../countryDrawer/useCountryDrawerData', () => ({ useCountryLiveData: () => m.econ }))
vi.mock('../CountryDrawer', () => ({ default: ({ only }: { only: string }) => { m.drawerOnly.push(only); return <div data-testid="drawer">{only}</div> } }))
vi.mock('../CountryBrief', () => ({ default: ({ country }: { country: string }) => <div data-testid="brief">{country} news</div> }))
vi.mock('../WatchButton', () => ({ default: () => null }))
vi.mock('../panels/PredictionsPanel', () => ({ PredictionsPanel: ({ iso2 }: { iso2?: string }) => <div data-testid="our-forecast">our forecast for {iso2}</div> }))
vi.mock('../../services/imfWeo', async orig => ({ ...await orig<typeof import('../../services/imfWeo')>(), fetchWeo: m.fetchWeo }))
vi.mock('../../services/eurostatNowcast', async orig => ({ ...await orig<typeof import('../../services/eurostatNowcast')>(), fetchNowcastData: m.fetchNowcast }))
vi.mock('../../services/countryAnalytics', () => ({ countryAnalytics: { subscribe: () => () => {}, getState: () => ({}), load: vi.fn() }, sliceOf: () => m.gdp }))

import CountryPage from './CountryPage'

const ind = (id: string, label: string, value: number, year = '2025') => ({ id, label, value, year })
const props = { country: 'Germany', crises: [], flights: [], articles: [], onClose: vi.fn(), onShowMap: vi.fn(), onOpenPanel: vi.fn() }

describe('CountryPage', () => {
  beforeEach(() => {
    m.drawerOnly = []
    m.econ = { econLoading: false, econData: { iso2: 'DE', iso3: 'DEU', countryName: 'Germany', fetchedAt: 0, indicators: [
      ind('NY.GDP.MKTP.CD', 'GDP (current US$)', 5.05e12), ind('NY.GDP.MKTP.KD.ZG', 'GDP growth (%)', -0.2),
      ind('FP.CPI.TOTL.ZG', 'Inflation, CPI (%)', 2.1), ind('SL.UEM.TOTL.ZS', 'Unemployment (%)', 3.4, '2019'),
    ] } }
    m.fetchWeo.mockResolvedValue({ indicator: 'NGDP_RPCH', label: 'x', unit: '%', vintage: 'World Economic Outlook (October 2026)', lastModified: null, values: { DEU: { '2026': 1.3, '2027': 1.4 } } })
    m.fetchNowcast.mockRejectedValue(new Error('offline'))
    m.gdp = { status: 'ready', rows: [{ iso3: 'DEU', name: 'Germany', value: 4.6e12, year: '2024' }], error: null }
  })

  it('leads with the economy: four headline figures, each observed, with its year, flagging a dated one', () => {
    render(<CountryPage {...props} />)
    const t = document.body.textContent!
    expect(screen.getAllByText('Observed').length).toBeGreaterThanOrEqual(4)
    expect(t).toContain('World Bank, 2025')
    expect(t).toMatch(/World Bank, 2019 · ⚠/)
    expect(screen.getByRole('tab', { name: 'Economy' }).getAttribute('aria-selected')).toBe('true')
  })

  it('shows the map on request and closes', () => {
    render(<CountryPage {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Show on map/ }))
    expect(props.onShowMap).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close Germany' }))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('renders each context tab from the shared country sections, one tab at a time', async () => {
    render(<CountryPage {...props} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Risk & security' }))
    expect((await screen.findByTestId('drawer')).textContent).toBe('risk')
    fireEvent.click(screen.getByRole('tab', { name: 'Infrastructure' }))
    expect((await screen.findByTestId('drawer')).textContent).toBe('infrastructure')
    fireEvent.click(screen.getByRole('tab', { name: 'News' }))
    expect(screen.getByTestId('brief').textContent).toContain('Germany')
  })

  it('forecasts tab: the IMF projection labelled as such, and a nowcast outage stated, not hidden', async () => {
    render(<CountryPage {...props} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Forecasts' }))
    expect((await screen.findAllByText(/the IMF's projection, not a measurement/)).length).toBe(3)
    expect(await screen.findByText(/Eurostat could not be reached/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Open Germany in Predictions/ }))
    expect(props.onOpenPanel).toHaveBeenCalledWith('predictions')
  })

  it('forecasts tab: our own forecast for this country is shown on the tab, not only linked to', async () => {
    render(<CountryPage {...props} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Forecasts' }))
    expect((await screen.findByTestId('our-forecast')).textContent).toBe('our forecast for DE')
  })

  it("trade tab: the country's own exposure figures, scaled to its GDP, then the trade sections", async () => {
    render(<CountryPage {...props} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Trade & exposure' }))
    expect(screen.getByText(/its top buyer/)).toBeTruthy()
    expect(screen.getByText('Net fuel trade')).toBeTruthy()
    expect((await screen.findByTestId('drawer')).textContent).toBe('trade')
  })
})
