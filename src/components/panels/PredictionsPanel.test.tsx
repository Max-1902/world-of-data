// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Pt } from '../../utils/econAnalysis'

/** Seeded PRNG (mulberry32), centred: deterministic noise that is not itself an AR process (a sine wave would be). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5 }
}
const r = rng(7)
const noise = (_i: number) => 1.6 * r()
const pts = (ys: number[], x0: number): Pt[] => ys.map((y, i) => ({ x: x0 + i, y }))
// stationary around 2 with persistence: AR(2) fits a settling model
const gdp: number[] = [2, 2.5]
for (let i = 2; i < 40; i++) gdp.push(0.8 + 0.5 * gdp[i - 1] + 0.1 * gdp[i - 2] + noise(i))
// explosive: y_t = 1.2 y_{t-1} + noise, so the AR(2) fit is non-stationary
const unemp: number[] = [1, 1.3]
for (let i = 2; i < 25; i++) unemp.push(1.2 * unemp[i - 1] + noise(i))

const data = { iso2: 'DE', name: 'Germany', series: {
  'NY.GDP.MKTP.KD.ZG': { points: pts(gdp, 1986) },
  'FP.CPI.TOTL.ZG': { points: pts([1, 2, 3], 2023) },
  'SL.UEM.TOTL.ZS': { points: pts(unemp, 2001) },
} }
vi.mock('../../hooks/useCountryLookup', () => ({
  useCountryLookup: () => ({ iso2: 'DE', setIso2: () => {}, countries: [], listError: null, data, status: 'ready', error: null, europe: null, europeStatus: 'idle', retry: () => {} }),
}))

const { PredictionsPanel, significance } = await import('./PredictionsPanel')

describe('PredictionsPanel', () => {
  it('states the forecast direction with start and end values, and whether "no change" is inside the interval', () => {
    render(<PredictionsPanel />)
    const gdpCard = screen.getByRole('region', { name: 'Real GDP growth' })
    expect(gdpCard.textContent).toMatch(/Forecast direction\s*(Rising|Falling|Flat)/)
    expect(gdpCard.textContent).toMatch(/\(2025\) → .*\(2028\)/)
    expect(gdpCard.textContent).toMatch(/95% interval .* (includes|excludes) the 2025 value/)
    expect(gdpCard.textContent).toContain('Recent trend')
  })

  it('puts a marker on every shown actual year and every forecast step, and the period switch changes how many years are shown', () => {
    render(<PredictionsPanel />)
    const card = screen.getByRole('region', { name: 'Real GDP growth' })
    // default "Since 2000": 26 actual years (2000–2025) + forecast anchor + 3 forecast years
    expect(card.querySelectorAll('svg circle[r="4"]').length).toBe(26 + 4)
    fireEvent.click(screen.getByRole('button', { name: 'All years' }))
    expect(card.querySelectorAll('svg circle[r="4"]').length).toBe(40 + 4)
  })

  it('lists every actual year and every forecast year in the table view', () => {
    render(<PredictionsPanel />)
    const card = screen.getByRole('region', { name: 'Real GDP growth' })
    fireEvent.click(card.querySelector('.viz-toggle button:nth-child(2)')!)
    expect(card.querySelectorAll('tbody tr')).toHaveLength(40 + 3)
  })

  it('warns when the fitted model is non-stationary, and does not claim a long-run level', () => {
    render(<PredictionsPanel />)
    const card = screen.getByRole('region', { name: 'Unemployment' })
    expect(card.textContent).toContain('Unstable fit.')
    expect(card.textContent).not.toContain('converges toward')
    expect(screen.getByRole('region', { name: 'Real GDP growth' }).textContent).not.toContain('Unstable fit.')
  })

  it('declines to forecast a series that is too short', () => {
    render(<PredictionsPanel />)
    expect(screen.getByText(/Inflation \(CPI\): fewer than 15 years of data/)).toBeTruthy()
  })
})

describe('significance sentence', () => {
  it('never lets "lower MAE" stand alone: it says whether the gap could be chance', () => {
    expect(significance({ stat: -0.6, p: 0.56, n: 51 })).toMatch(/not statistically significant .* p = 0\.56, 51 folds/)
    expect(significance({ stat: -4, p: 0.0002, n: 51 })).toMatch(/is statistically significant .* p < 0\.001/)
    expect(significance(null)).toMatch(/Too few folds/)
  })
})
