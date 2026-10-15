// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EiaResult } from '../../services/eia'

const DAY = 86_400_000
const start = Date.UTC(2019, 0, 4)
const weekly = (n: number, f: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => { const t = start + i * 7 * DAY; return { t, period: new Date(t).toISOString().slice(0, 10), value: f(i) } })

let impl: (id: string) => EiaResult
vi.mock('../../services/eia', async orig => ({
  ...(await orig<typeof import('../../services/eia')>()),
  fetchEiaSeries: (id: string) => Promise.resolve(impl(id)),
}))
const { InventoriesPanel } = await import('./InventoriesPanel')

describe('InventoriesPanel', () => {
  beforeEach(() => { impl = () => ({ status: 'ok', points: weekly(52 * 6 + 10, i => 400000 + i * 10), unit: 'MBBL' }) })

  it('says the data is not measured, and how to fix it, when no key is configured', async () => {
    impl = () => ({ status: 'not_configured' })
    render(<InventoriesPanel />)
    expect(await screen.findByText(/Not measured: no EIA API key/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /eia\.gov\/opendata\/register\.php/ }).getAttribute('href')).toBe('https://www.eia.gov/opendata/register.php')
    expect(screen.queryByText('Latest')).toBeNull()
  })

  it('shows each series with its latest level in million barrels, weekly change and 5-year comparison', async () => {
    render(<InventoriesPanel />)
    const card = await screen.findByRole('region', { name: 'Commercial crude oil (excl. SPR)' })
    // last value 400000 + 321*10 thousand barrels = 403.2 million barrels
    expect(card.textContent).toContain('403.2 M bbl')
    expect(card.textContent).toContain('+0.01 M bbl') // +10 thousand barrels week on week
    expect(card.textContent).toContain('build')
    expect(card.textContent).toMatch(/vs 5-yr average[+−]\d/)
    expect(card.querySelector('polygon')).toBeTruthy() // 5-yr range band
  })

  it('lists every shown week in the table view, and the range switch changes how many', async () => {
    render(<InventoriesPanel />)
    const card = await screen.findByRole('region', { name: 'Total motor gasoline' })
    fireEvent.click(card.querySelector('.viz-toggle button:nth-child(2)')!)
    const oneYear = card.querySelectorAll('tbody tr').length
    expect(oneYear).toBeGreaterThanOrEqual(52)
    expect(oneYear).toBeLessThanOrEqual(53)
    fireEvent.click(screen.getByRole('button', { name: '2 years' }))
    expect(card.querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(104)
  })

  it('shows an error per series with a retry, without hiding the others', async () => {
    impl = id => id === 'PET.WGTSTUS1.W' ? { status: 'error', message: 'EIA returned HTTP 404: Series not found' } : { status: 'ok', points: weekly(20, i => i), unit: 'BCF' }
    render(<InventoriesPanel />)
    expect(await screen.findByText(/Total motor gasoline: EIA returned HTTP 404/)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Distillate fuel oil' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Retry/ })).toHaveLength(1)
  })
})
