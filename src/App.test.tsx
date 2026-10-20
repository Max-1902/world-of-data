// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Stand-ins for the heavy pieces: the map just exposes a "click a country" button,
// the drawer just exposes its close button, the cards report which subject they show.
vi.mock('./components/Map/MapView', () => ({
  default: ({ onCountryClick }: { onCountryClick: (c: string) => void }) => (
    <button onClick={() => onCountryClick('Ukraine')}>pick-country</button>
  ),
}))
vi.mock('./components/CountryDrawer', () => ({
  default: ({ country, onClose }: { country: string; onClose: () => void }) => (
    <div data-testid="drawer">{country}<button onClick={onClose}>close-drawer</button></div>
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
describe('country drawer and outlook card', () => {
  beforeEach(() => { vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-placeholder') })

  async function pickCountry() {
    const { default: App } = await import('./App')
    render(<App />)
    fireEvent.click(await screen.findByText('pick-country'))
    expect(await screen.findByTestId('drawer')).toBeTruthy()
    expect(screen.getByTestId('card').textContent).toContain('Ukraine')
  }

  it('closing the drawer leaves the card open on the same country', async () => {
    await pickCountry()
    fireEvent.click(screen.getByText('close-drawer'))
    await waitFor(() => expect(screen.queryByTestId('drawer')).toBeNull())
    expect(screen.getByTestId('card').textContent).toContain('Ukraine')
  })

  it('closing the card leaves the drawer open', async () => {
    await pickCountry()
    fireEvent.click(screen.getByText('close-card'))
    await waitFor(() => expect(screen.queryByTestId('card')).toBeNull())
    expect(screen.getByTestId('drawer')).toBeTruthy()
  })
})
