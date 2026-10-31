// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// Stand-ins for the heavy pieces: the map just exposes a "click a country" button, the country page (now rendered
// in the right panel, not over the map) its two actions, and the outlook card reports which subject it shows.
vi.mock('./components/Map/MapView', () => ({
  default: ({ onCountryClick, showCountryAnalytics, onToggleLayer }: { onCountryClick: (c: string) => void; showCountryAnalytics: boolean; onToggleLayer?: (l: string) => void }) => (
    <>
      <button onClick={() => onCountryClick('Ukraine')}>pick-country</button>
      <button data-testid="colouring" onClick={() => onToggleLayer?.('countryAnalytics')}>{showCountryAnalytics ? 'colouring-on' : 'colouring-off'}</button>
    </>
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

// jsdom has no scrollIntoView; the dock calls it on the frame after a sidebar click focuses a panel
Element.prototype.scrollIntoView = () => {}

// App renders a "Mapbox token required" screen instead of the map without a token. A developer's .env has one, CI
// doesn't, so the test sets a placeholder (the map is mocked above; nothing is sent to Mapbox). In beforeEach because
// the config's unstubEnvs resets stubbed env vars before every test.
describe('picking a country', () => {
  beforeEach(() => { vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-placeholder'); history.replaceState(null, '', '#') })

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

  it('"Show on map" on a country page opens the Map with that country\'s overview', async () => {
    await pickCountry()
    fireEvent.click(screen.getByText('show-map'))
    expect((await screen.findByTestId('drawer')).textContent).toContain('Ukraine')
    expect(screen.getByTestId('card').textContent).toContain('pinned:Ukraine')
  })

  it.each(['Forecasts', 'Drivers', 'Explore'])('choosing %s in the sidebar leaves the country page', async name => {
    await pickCountry()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: new RegExp(name) }))
    await waitFor(() => expect(screen.queryByTestId('page')).toBeNull())
  })

  it('closing the page returns to the workspace', async () => {
    await pickCountry()
    fireEvent.click(screen.getByText('close-page'))
    await waitFor(() => expect(screen.queryByTestId('page')).toBeNull())
  })
})

describe('the Map destination', () => {
  beforeEach(() => { vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-placeholder'); history.replaceState(null, '', '#') })

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

describe('the home map', () => {
  beforeEach(() => { vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-placeholder'); history.replaceState(null, '', '#') })

  it("closes its country colouring with the card's × and keeps it closed while the app re-renders", async () => {
    const { default: App } = await import('./App')
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: /Home|Outlook/ }))
    const toggle = await screen.findByTestId('colouring')
    expect(toggle.textContent).toBe('colouring-on')
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.getByTestId('colouring').textContent).toBe('colouring-off'))
    // a later render (live data arriving) must not switch it back on
    await new Promise(r => setTimeout(r, 50))
    expect(screen.getByTestId('colouring').textContent).toBe('colouring-off')
    fireEvent.click(screen.getByTestId('colouring'))
    await waitFor(() => expect(screen.getByTestId('colouring').textContent).toBe('colouring-on'))
  })
})
