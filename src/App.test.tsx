// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// Stand-ins for the heavy pieces: the map just exposes a "click a country" button, the country page (now rendered
// in the right panel, not over the map) its two actions, and the outlook card reports which subject it shows.
vi.mock('./components/Map/MapView', () => ({
  default: ({ onCountryClick }: { onCountryClick: (c: string) => void }) => (
    <button onClick={() => onCountryClick('Ukraine')}>pick-country</button>
  ),
}))
vi.mock('./components/countryPage/CountryPage', () => ({
  default: ({ country, onClose, onShowMap }: { country: string; onClose: () => void; onShowMap: () => void }) => (
    <div data-testid="page">{country}<button onClick={onShowMap}>show-map</button><button onClick={onClose}>close-page</button></div>
  ),
}))
vi.mock('./components/OutlookCard', () => ({
  default: ({ selectedCountry, pinnedCountry, onClose }: { selectedCountry?: string | null; pinnedCountry?: string | null; onClose: () => void }) => (
    <section data-testid="card">{selectedCountry ?? 'REGIONAL OUTLOOK'}{pinnedCountry ? ` pinned:${pinnedCountry}` : ''}<button onClick={onClose}>close-card</button></section>
  ),
}))
vi.mock('./components/CountryDrawer', () => ({
  default: ({ country, only, onClose }: { country: string; only?: string; onClose: () => void }) => (
    <div data-testid="drawer">{country}{only ? ` only:${only}` : ' all-sections'}<button onClick={onClose}>close-drawer</button></div>
  ),
}))
vi.mock('./services/countryLookup', async orig => ({
  ...(await orig<typeof import('./services/countryLookup')>()),
  fetchCountryList: () => Promise.resolve([{ iso2: 'UA', iso3: 'UKR', name: 'Ukraine', region: 'Europe', incomeLevel: '', capital: '' }]),
}))

// App renders a "Mapbox token required" screen instead of the map without a token. A developer's .env has one, CI
// doesn't, so the test sets a placeholder (the map is mocked above; nothing is sent to Mapbox). In beforeEach because
// the config's unstubEnvs resets stubbed env vars before every test.
describe('picking a country', () => {
  beforeEach(() => { vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-placeholder') })

  async function pickCountry() {
    const { default: App } = await import('./App')
    render(<App />)
    fireEvent.click((await screen.findAllByText('pick-country'))[0])
    expect((await screen.findByTestId('page')).textContent).toContain('Ukraine')
  }

  it('opens the country data page in the right panel, and shows no outlook card outside the Map destination', async () => {
    await pickCountry()
    expect(screen.queryByTestId('card')).toBeNull()
  })

  it('"Show on map" closes the page in a workspace', async () => {
    await pickCountry()
    fireEvent.click(screen.getByText('show-map'))
    await waitFor(() => expect(screen.queryByTestId('page')).toBeNull())
    expect(screen.queryByTestId('card')).toBeNull()
  })

  it('closing the page returns to the workspace', async () => {
    await pickCountry()
    fireEvent.click(screen.getByText('close-page'))
    await waitFor(() => expect(screen.queryByTestId('page')).toBeNull())
  })
})

describe('the Map destination', () => {
  beforeEach(() => { vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-placeholder') })

  async function openMapPage() {
    const { default: App } = await import('./App')
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: /Map/ }))
    expect((await screen.findAllByText('pick-country'))[0]).toBeTruthy()
  }

  it('shows the regional outlook on the map', async () => {
    await openMapPage()
    expect(screen.getByTestId('card').textContent).toContain('REGIONAL OUTLOOK')
    expect(screen.queryByTestId('drawer')).toBeNull()
  })

  it('a clicked country keeps the regional outlook (that country first) and opens its full overview beside it', async () => {
    await openMapPage()
    fireEvent.click(screen.getAllByText('pick-country')[0])
    const drawer = await screen.findByTestId('drawer')
    expect(drawer.textContent).toContain('Ukraine')
    expect(drawer.textContent).toContain('all-sections')
    expect(screen.queryByTestId('page')).toBeNull()
    expect(screen.getByTestId('card').textContent).toContain('REGIONAL OUTLOOK pinned:Ukraine')
    fireEvent.click(screen.getByText('close-drawer'))
    await waitFor(() => expect(screen.queryByTestId('drawer')).toBeNull())
  })
})

describe('the analysis (forecasting) workspace', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-placeholder')
    window.location.hash = '#g=analysis'
  })

  it('never shows the map, and offers a way to search for a country', async () => {
    const { default: App } = await import('./App')
    render(<App />)
    expect(screen.queryByText('pick-country')).toBeNull()
    expect(await screen.findByLabelText('Search for a country')).toBeTruthy()
    expect(screen.queryByText('Hide map')).toBeNull()
  })

  it('"Open Map" goes to the Map destination, the one place the map lives', async () => {
    const { default: App } = await import('./App')
    render(<App />)
    fireEvent.click(await screen.findByText('Open Map'))
    expect(await screen.findByText('pick-country')).toBeTruthy()
    expect(screen.getByTestId('card').textContent).toContain('REGIONAL OUTLOOK')
  })
})
