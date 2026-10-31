// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
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
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/What it rests on/)).toBeTruthy())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Germany')
    expect(screen.getByText(/Projected real GDP growth/)).toBeTruthy()
    // the "since" card fills in on the render after the basis card, so wait for it rather than reading it synchronously
    expect(await screen.findByText(/First shown on this device/)).toBeTruthy()
    expect(screen.getByText(/What could change it/)).toBeTruthy()
    expect(screen.getByText(/does not change the number/)).toBeTruthy()
    expect(m.fetchSeries).toHaveBeenCalledWith(['DE'], 'NY.GDP.MKTP.KD.ZG')
  })

  it('states the model, and the predictor test result with a way to the full rule', async () => {
    const onOpenPanel = vi.fn()
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={onOpenPanel} />)
    await waitFor(() => expect(screen.getByLabelText('Germany forecast at a glance')).toBeTruthy())
    expect(screen.getByLabelText('Germany forecast at a glance').textContent).toMatch(/Model: AR\(2\)|Model: “no change”/)
    expect(screen.getByText(/What has been tested as a predictor/)).toBeTruthy()
    expect(screen.getByText(/candidate indicators improved/).textContent).toMatch(/\d+ of \d+/)
    fireEvent.click(screen.getByRole('button', { name: /Full test rule and results/ }))
    expect(onOpenPanel).toHaveBeenCalledWith('drivers')
    expect(screen.getByText('Co-movement across countries')).toBeTruthy()
  })

  it('gives the forecast chart a table with the same values', async () => {
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByLabelText('Germany forecast at a glance')).toBeTruthy())
    const card = (await screen.findAllByLabelText(/^Germany: real GDP growth, next/)).find(e => e.tagName === 'SECTION')!
    fireEvent.click(within(card).getByRole('button', { name: 'Table' }))
    const table = within(card).getByRole('table')
    expect(table.textContent).toMatch(/Range \(/)
    expect(table.textContent).toMatch(/IMF/)
  })

  it('offers the Spearman matrix under the forecast without fetching its indicators until asked', async () => {
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/What it rests on/)).toBeTruthy())
    expect(screen.getByText('What moves together')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Compute \(loads \d+ indicators\)/ })).toBeTruthy()
    expect(m.fetchSeries).toHaveBeenCalledTimes(1)
  })

  it('shows the interval with the coverage it actually held, and the IMF figure beside it', async () => {
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByLabelText('Germany forecast at a glance')).toBeTruthy())
    const glance = screen.getByLabelText('Germany forecast at a glance')
    expect(glance.textContent).toMatch(/held 93\.1% of outcomes in backtests since 2010/)
    expect(glance.textContent).toMatch(/IMF projection/)
    expect(glance.textContent).toMatch(/World Economic Outlook \(October 2026\)/)
  })

  it('records the forecast with the IMF vintage once the IMF request has settled', async () => {
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    await waitFor(() => expect(m.remember).toHaveBeenCalled())
    const rec = m.remember.mock.calls[0][0] as ForecastRecord
    expect(rec.key).toBe('DE|NY.GDP.MKTP.KD.ZG')
    expect(rec.imf?.vintage).toContain('October 2026')
  })

  it('says so, and still shows the forecast, when the IMF request fails', async () => {
    m.fetchWeo.mockResolvedValue(null)
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/IMF’s figures could not be loaded/)).toBeTruthy())
    expect(screen.getByText(/Projected real GDP growth/)).toBeTruthy()
    expect(screen.queryByText(/The G20 on the IMF/)).toBeNull()
    expect((m.remember.mock.calls[0][0] as ForecastRecord).imf).toBeUndefined()
  })

  it('states why there is no forecast when the history is too short', async () => {
    m.fetchSeries.mockImplementation(async (codes: string[]) => ({ [codes[0]]: { name: 'GDP growth', points: pts(8, 2015) } }))
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/has 8 years of reported growth; a forecast needs at least 15/)).toBeTruthy())
    expect(screen.queryByText(/What it rests on/)).toBeNull()
    expect(m.remember).not.toHaveBeenCalled()
  })

  it('says the World Bank figures could not be loaded rather than staying on "loading"', async () => {
    m.fetchSeries.mockRejectedValue(new Error('HTTP 500'))
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    await waitFor(() => expect(screen.getByText(/World Bank’s figures could not be loaded/)).toBeTruthy())
  })

  it('switches country from the G20 table, and shares the choice with the Predictions panel', async () => {
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={() => {}} />)
    const india = await screen.findByRole('button', { name: 'India' })
    fireEvent.click(india)
    await waitFor(() => expect(m.fetchSeries).toHaveBeenCalledWith(['IN'], 'NY.GDP.MKTP.KD.ZG'))
    expect(localStorage.getItem('country-lookup-iso2')).toBe('IN')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('India'))
  })

  it('expands a G20 row into the country’s key figures and opens its full page from below the table', async () => {
    const cpi = { ...weo, indicator: 'PCPIPCH', label: 'Inflation', values: { IND: { '2025': 2.9, '2026': 4.1, '2027': 4.0 } } }
    const lur = { ...weo, indicator: 'LUR', label: 'Unemployment', values: {} }
    m.fetchWeo.mockImplementation(async (ind: string) => ind === 'PCPIPCH' ? cpi : ind === 'LUR' ? lur : weo)
    const onOpenCountry = vi.fn()
    render(<ForecastHome onOpenPanel={() => {}} onOpenCountry={onOpenCountry} />)
    const india = await screen.findByRole('button', { name: 'India' })
    expect(india.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(india)
    expect(india.getAttribute('aria-expanded')).toBe('true')
    const detail = document.getElementById('fh-detail-IND')!
    expect(detail.textContent).toContain('South Asia')
    await waitFor(() => expect(detail.textContent).toContain('4.1%'))
    expect(within(detail).getByText('Unemployment rate').closest('tr')!.textContent).toBe('Unemployment rate———')
    expect(m.fetchWeo).toHaveBeenCalledWith('LUR')
    fireEvent.click(screen.getByRole('button', { name: /India: full country page/ }))
    expect(onOpenCountry).toHaveBeenCalledWith('India')
    fireEvent.click(india)
    expect(document.getElementById('fh-detail-IND')).toBeNull()
  })

  it('opens the full forecast and the shock-exposure panel', async () => {
    const open = vi.fn()
    render(<ForecastHome onOpenCountry={() => {}} onOpenPanel={open} />)
    await screen.findByText(/What could change it/)
    fireEvent.click(screen.getByRole('button', { name: /Full forecast, backtest and IMF comparison/ }))
    fireEvent.click(screen.getByRole('button', { name: /Trace a shock/ }))
    expect(open.mock.calls.map(c => c[0])).toEqual(['predictions', 'exposure'])
  })
})
