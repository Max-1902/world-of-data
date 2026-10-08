// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
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

describe('country drawer and outlook card', () => {
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
