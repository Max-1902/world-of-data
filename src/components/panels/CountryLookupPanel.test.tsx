// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { installLocalStorage } from '../../test/helpers'
import type { CountryDataset, WbCountry } from '../../services/countryLookup'
import type { EuropeData } from '../../services/europeMacro'

const fetchCountryList = vi.fn<() => Promise<WbCountry[]>>()
const fetchCountryDataset = vi.fn<(iso2: string) => Promise<CountryDataset>>()
const fetchEuropeData = vi.fn<(iso2: string) => Promise<EuropeData>>()
vi.mock('../../services/countryLookup', async orig => ({ ...(await orig<typeof import('../../services/countryLookup')>()), fetchCountryList: () => fetchCountryList(), fetchCountryDataset: (i: string) => fetchCountryDataset(i) }))
vi.mock('../../services/europeMacro', async orig => ({ ...(await orig<typeof import('../../services/europeMacro')>()), fetchEuropeData: (i: string) => fetchEuropeData(i) }))

const COUNTRIES: WbCountry[] = [
  { iso2: 'DE', iso3: 'DEU', name: 'Germany', region: 'Europe & Central Asia', incomeLevel: 'High income', capital: 'Berlin' },
  { iso2: 'BR', iso3: 'BRA', name: 'Brazil', region: 'Latin America & Caribbean', incomeLevel: 'Upper middle income', capital: 'Brasilia' },
]

/** Test fixture only: smooth synthetic series so every analysis has enough years to run. */
function dataset(iso2: string, name: string): CountryDataset {
  const yrs = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => ({ x: 1991 + i, y: f(i) }))
  const g = (i: number) => 2 + Math.sin(i / 2) * 2 - (i === 18 ? 6 : 0)
  let lvl = 1e12
  const real = yrs(35, i => (lvl *= 1 + g(i) / 100))
  const series: CountryDataset['series'] = {
    'SP.DYN.LE00.IN': { name: 'Life expectancy at birth, total (years)', points: yrs(34, i => 75 + 0.2 * i) },
    'NY.GDP.MKTP.KD.ZG': { name: 'GDP growth (annual %)', points: yrs(35, g) },
    'NY.GDP.MKTP.KD': { name: 'GDP (constant 2015 US$)', points: real },
    'SL.UEM.TOTL.ZS': { name: 'Unemployment', points: yrs(35, i => 7 - 0.4 * (g(i) - 2) + 0.01 * i) },
    'FP.CPI.TOTL.ZG': { name: 'Inflation, consumer prices (annual %)', points: yrs(35, i => 2 + Math.cos(i / 3)) },
    'BN.CAB.XOKA.GD.ZS': { name: 'Current account balance (% of GDP)', points: yrs(20, i => 3 + i / 10) },
    'GC.NLD.TOTL.GD.ZS': { name: 'Net lending', points: yrs(20, i => -1 - Math.sin(i)) },
    'SP.POP.GROW': { name: 'Population growth (annual %)', points: yrs(35, () => 0.3) },
  }
  return { iso2, name, series, failedBatches: 0, totalBatches: 5, lastUpdated: ['2026-07-13'], fetchedAt: 0 }
}

const EUROPE: EuropeData = {
  iso2: 'DE', euroMember: true, euroSince: 1999, currency: 'EUR',
  series: {
    hicp: { label: 'HICP inflation', unit: '% y/y', source: 'Eurostat', ref: 'prc_hicp_minr · TOTAL · RCH_A', points: [{ period: '2026-08', t: Date.UTC(2026, 7, 15), value: 2.1 }], ea: [{ period: '2026-08', t: Date.UTC(2026, 7, 15), value: 2.0 }] },
  },
  annual: { balance: [], interest: [], debt: [], nominalGdp: [] }, errors: 0, fetchedAt: 0,
}

beforeEach(() => {
  installLocalStorage()
  fetchCountryList.mockReset().mockResolvedValue(COUNTRIES)
  fetchCountryDataset.mockReset().mockImplementation(async iso => dataset(iso, iso === 'DE' ? 'Germany' : 'Brazil'))
  fetchEuropeData.mockReset().mockResolvedValue(EUROPE)
})

describe('CountryLookupPanel', () => {
  it('shows one box per World Bank category, with values, years and "No data available" for missing indicators', async () => {
    const { CountryLookupPanel } = await import('./CountryLookupPanel')
    render(<CountryLookupPanel />)
    expect(screen.getByText(/Loading .* since 1960/)).toBeTruthy()
    const social = await screen.findByRole('region', { name: 'Social' })
    expect(within(social).getByText('Life expectancy (years)')).toBeTruthy()
    expect(within(social).getAllByText('No data available').length).toBeGreaterThan(0)   // e.g. poverty not in fixture
    for (const t of ['Economic', 'Environment', 'Institutions', 'Governance', 'Money & finance']) expect(screen.getByRole('region', { name: t })).toBeTruthy()
    expect(fetchCountryDataset).toHaveBeenCalledWith('DE')
  })

  it('charts another indicator on click and offers the full history as a table', async () => {
    const { CountryLookupPanel } = await import('./CountryLookupPanel')
    render(<CountryLookupPanel />)
    const econ = await screen.findByRole('region', { name: 'Economic' })
    fireEvent.click(within(econ).getByRole('button', { name: /Unemployment/ }))
    expect(within(econ).getByRole('button', { name: /Unemployment/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(econ).getByRole('button', { name: 'Table' }))
    expect(within(econ).getByRole('rowheader', { name: '2025' })).toBeTruthy()
  })

  it('shows the ECB / Eurostat section for a European country and the analysis below it', async () => {
    const { CountryLookupPanel } = await import('./CountryLookupPanel')
    render(<CountryLookupPanel />)
    expect(await screen.findByText(/Euro area member since 1999/)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Prices' })).toBeTruthy()
    expect(screen.getByText(/Economic analysis · Germany/)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Which indicators are trending' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Growth and the business cycle' })).toBeTruthy()
    expect(screen.getByRole('region', { name: "Jobs and growth (Okun's law)" })).toBeTruthy()
    // the only debt source is Eurostat; with no annual fiscal rows it says why it isn't run
    expect(screen.getByText(/Debt dynamics need general-government interest/)).toBeTruthy()
  })

  it('searching switches country, skips Europe for non-European ones, and remembers the choice', async () => {
    const { CountryLookupPanel } = await import('./CountryLookupPanel')
    render(<CountryLookupPanel />)
    await screen.findByRole('region', { name: 'Social' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search for a country' }), { target: { value: 'bra' } })
    fireEvent.click(await screen.findByRole('option', { name: /Brazil/ }))
    await waitFor(() => expect(fetchCountryDataset).toHaveBeenLastCalledWith('BR'))
    expect(await screen.findByRole('heading', { name: 'Brazil' })).toBeTruthy()
    expect(screen.queryByText(/ECB & Eurostat/)).toBeNull()
    expect(fetchEuropeData).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('country-lookup-iso2')).toBe('BR')
  })

  it('reports a World Bank failure with a retry instead of a blank page', async () => {
    fetchCountryDataset.mockRejectedValueOnce(new Error('World Bank unreachable'))
    const { CountryLookupPanel } = await import('./CountryLookupPanel')
    render(<CountryLookupPanel />)
    expect(await screen.findByText(/Could not reach the World Bank \(World Bank unreachable\)/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /Retry/ })[0])
    expect(await screen.findByRole('region', { name: 'Social' })).toBeTruthy()
  })
})
