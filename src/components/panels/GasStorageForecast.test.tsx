// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EiaResult } from '../../services/eia'

const DAY = 86_400_000

/** 16 years of weekly levels: a seasonal swing plus a persistent departure, so the model has something to find. */
function gasLevels() {
  let level = 3000, dep = 0, seed = 1
  const noise = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5 }
  const start = Date.UTC(2010, 0, 1)
  return Array.from({ length: 52 * 16 }, (_, i) => {
    const t = start + i * 7 * DAY
    dep = 0.6 * dep + 60 * noise()
    level += -100 * Math.cos(2 * Math.PI * i / 52.18) + dep
    return { t, period: new Date(t).toISOString().slice(0, 10), value: Math.round(level) }
  })
}

let impl: (id: string) => EiaResult
const calls: string[] = []
vi.mock('../../services/eia', async orig => ({
  ...(await orig<typeof import('../../services/eia')>()),
  fetchEiaSeries: (id: string) => { calls.push(id); return Promise.resolve(impl(id)) },
}))
const { GasStorageForecastPanel } = await import('./GasStorageForecast')

describe('GasStorageForecastPanel', () => {
  beforeEach(() => { calls.length = 0; impl = () => ({ status: 'ok', points: gasLevels(), unit: 'BCF' }) })

  it('loads only the gas storage series and shows the forecast with its backtest verdict', async () => {
    render(<GasStorageForecastPanel />)
    const card = await screen.findByRole('region', { name: "Next week's natural-gas storage change" })
    expect(calls).toEqual(['NG.NW2_EPG0_SWO_R48_BCF.W'])
    expect(card.textContent).toMatch(/Forecast \((model|seasonal norm)\)[+−]\d+ Bcf/)
    expect(card.textContent).toMatch(/80% range[+−]\d+ Bcf to [+−]\d+ Bcf/)
    expect(card.textContent).toMatch(/weekly forecasts made in time order/)
    expect(card.textContent).toMatch(/the 80% range held the reported change in \d+\.\d% of \d+ backtest weeks/)
  })

  it('says it is not measured, and how to fix it, without a key', async () => {
    impl = () => ({ status: 'not_configured' })
    render(<GasStorageForecastPanel />)
    expect(await screen.findByText(/Not measured: no EIA API key/)).toBeTruthy()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('shows an error with a retry that refetches', async () => {
    impl = () => ({ status: 'error', message: 'EIA returned HTTP 500' })
    render(<GasStorageForecastPanel />)
    expect(await screen.findByText(/EIA returned HTTP 500/)).toBeTruthy()
    impl = () => ({ status: 'ok', points: gasLevels(), unit: 'BCF' })
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(await screen.findByRole('region', { name: "Next week's natural-gas storage change" })).toBeTruthy()
    expect(calls).toHaveLength(2)
  })

  it('says so when the history is too short to backtest', async () => {
    impl = () => ({ status: 'ok', points: gasLevels().slice(0, 52 * 4), unit: 'BCF' })
    render(<GasStorageForecastPanel />)
    expect(await screen.findByText(/not enough history to forecast and backtest/)).toBeTruthy()
  })
})
