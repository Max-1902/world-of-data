// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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
  default: ({ selectedCountry, onClose }: { selectedCountry?: string | null; onClose: () => void }) => (
    <section data-testid="card">{selectedCountry ?? 'REGIONAL OUTLOOK'}<button onClick={onClose}>close-card</button></section>
  ),
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

  it('opens the country data page in the right panel, map and outlook card stay visible', async () => {
    await pickCountry()
    expect(screen.getByTestId('card').textContent).toContain('REGIONAL OUTLOOK')
  })

  it('"Show on map" closes the page; the map and outlook card were visible underneath all along', async () => {
    await pickCountry()
    fireEvent.click(screen.getByText('show-map'))
    await waitFor(() => expect(screen.queryByTestId('page')).toBeNull())
    expect(screen.getByTestId('card').textContent).toContain('REGIONAL OUTLOOK')
  })

  it('closing the page returns to the map with the regional outlook', async () => {
    await pickCountry()
    fireEvent.click(screen.getByText('close-page'))
    await waitFor(() => expect(screen.queryByTestId('page')).toBeNull())
    expect(screen.getByTestId('card').textContent).toContain('REGIONAL OUTLOOK')
  })
})
