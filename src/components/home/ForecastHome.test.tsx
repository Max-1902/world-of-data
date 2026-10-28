// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { Pt } from '../../utils/econAnalysis'
import type { ForecastRecord } from '../../utils/forecastRecord'

const pts = (n: number, x0: number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: x0 + i, y: 1.5 + Math.sin(i * 1.7) }))

const m = vi.hoisted(() => ({ fetchWeo: vi.fn(), fetchSeries: vi.fn(), fetchList: vi.fn(), remember: vi.fn() }))
vi.mock('../../services/countryLookup', async orig => ({ ...await orig<typeof import('../../services/countryLookup')>(), fetchCountryList: m.fetchList, fetchSeriesForCountries: m.fetchSeries }))
vi.mock('../../services/imfWeo', async orig => ({ ...await orig<typeof import('../../services/imfWeo')>(), fetchWeo: m.fetchWeo }))
vi.mock('../../services/forecastLog', () => ({ remember: m.remember, recordsFor: () => [] }))

const { ForecastHome } = await import('./ForecastHome')

const COUNTRIES = [
  { iso2: 'DE', iso3: 'DEU', name: 'Germany', region: 'Europe', incomeLevel: '', capital: '' },
  { iso2: 'IN', iso3: 'IND', name: 'India', region: 'South Asia', incomeLevel: '', capital: '' },
]
const weo = { indicator: 'NGDP_RPCH', label: 'Real GDP growth', unit: '%', vintage: 'World Economic Outlook (October 2026)', lastModified: '2026-10-08 14:43', values: { DEU: { '2026': 1.4, '2027': 1.5 }, IND: { '2026': 6.1, '2027': 6.4 } } }

describe('ForecastHome', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const f of Object.values(m)) f.mockReset()
    m.fetchList.mockResolvedValue(COUNTRIES)
    m.fetchSeries.mockImplementation(async (codes: string[]) => ({ [codes[0]]: { name: 'GDP growth', points: pts(31, 1995) } }))
    m.fetchWeo.mockResolvedValue(weo)
    m.remember.mockImplementation((r: ForecastRecord) => ({ previous: null, since: r.issued }))
  })

  it('answers what we expect, what changed, what it rests on and what could change it, for the chosen country', async () => {
    render(<ForecastHome onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/What it rests on/)).toBeTruthy())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Germany')
    expect(screen.getByText(/Projected real GDP growth/)).toBeTruthy()
    expect(screen.getByText(/First shown on this device/)).toBeTruthy()
    expect(screen.getByText(/What could change it/)).toBeTruthy()
    expect(screen.getByText(/does not change the number/)).toBeTruthy()
    expect(m.fetchSeries).toHaveBeenCalledWith(['DE'], 'NY.GDP.MKTP.KD.ZG')
  })

  it('offers the Spearman matrix under the forecast without fetching its indicators until asked', async () => {
    render(<ForecastHome onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/What it rests on/)).toBeTruthy())
    expect(screen.getByText('What moves together')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Compute \(loads \d+ indicators\)/ })).toBeTruthy()
    expect(m.fetchSeries).toHaveBeenCalledTimes(1)
  })

  it('shows the interval with the coverage it actually held, and the IMF figure beside it', async () => {
    render(<ForecastHome onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByLabelText('Germany forecast at a glance')).toBeTruthy())
    const glance = screen.getByLabelText('Germany forecast at a glance')
    expect(glance.textContent).toMatch(/held 93\.1% of outcomes in backtests since 2010/)
    expect(glance.textContent).toMatch(/IMF projection/)
    expect(glance.textContent).toMatch(/World Economic Outlook \(October 2026\)/)
  })

  it('records the forecast with the IMF vintage once the IMF request has settled', async () => {
    render(<ForecastHome onOpenPanel={() => {}} />)
    await waitFor(() => expect(m.remember).toHaveBeenCalled())
    const rec = m.remember.mock.calls[0][0] as ForecastRecord
    expect(rec.key).toBe('DE|NY.GDP.MKTP.KD.ZG')
    expect(rec.imf?.vintage).toContain('October 2026')
  })

  it('says so, and still shows the forecast, when the IMF request fails', async () => {
    m.fetchWeo.mockResolvedValue(null)
    render(<ForecastHome onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/IMF’s figures could not be loaded/)).toBeTruthy())
    expect(screen.getByText(/Projected real GDP growth/)).toBeTruthy()
    expect(screen.queryByText(/The G20 on the IMF/)).toBeNull()
    expect((m.remember.mock.calls[0][0] as ForecastRecord).imf).toBeUndefined()
  })

  it('states why there is no forecast when the history is too short', async () => {
    m.fetchSeries.mockImplementation(async (codes: string[]) => ({ [codes[0]]: { name: 'GDP growth', points: pts(8, 2015) } }))
    render(<ForecastHome onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/has 8 years of reported growth; a forecast needs at least 15/)).toBeTruthy())
    expect(screen.queryByText(/What it rests on/)).toBeNull()
    expect(m.remember).not.toHaveBeenCalled()
  })

  it('says the World Bank figures could not be loaded rather than staying on "loading"', async () => {
    m.fetchSeries.mockRejectedValue(new Error('HTTP 500'))
    render(<ForecastHome onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/World Bank’s figures could not be loaded/)).toBeTruthy())
  })

  it('switches country from the G20 table, and shares the choice with the Predictions panel', async () => {
    render(<ForecastHome onOpenPanel={() => {}} />)
    const india = await screen.findByRole('button', { name: 'India' })
    fireEvent.click(india)
    await waitFor(() => expect(m.fetchSeries).toHaveBeenCalledWith(['IN'], 'NY.GDP.MKTP.KD.ZG'))
    expect(localStorage.getItem('country-lookup-iso2')).toBe('IN')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('India'))
  })

  it('opens the full forecast and the shock-exposure panel', async () => {
    const open = vi.fn()
    render(<ForecastHome onOpenPanel={open} />)
    await screen.findByText(/What could change it/)
    fireEvent.click(screen.getByRole('button', { name: /Full forecast, backtest and IMF comparison/ }))
    fireEvent.click(screen.getByRole('button', { name: /Trace a shock/ }))
    expect(open.mock.calls.map(c => c[0])).toEqual(['predictions', 'exposure'])
  })
})
