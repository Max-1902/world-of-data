// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

const m = vi.hoisted(() => ({ fetchWeo: vi.fn() }))
vi.mock('../../services/imfWeo', async orig => ({ ...await orig<typeof import('../../services/imfWeo')>(), fetchWeo: m.fetchWeo }))

const { WorldOutlook } = await import('./WorldOutlook')

const base = { label: '', unit: '%', vintage: 'World Economic Outlook (October 2026)', lastModified: '2026-10-08 14:43:32', values: {} }
const GDP = { ...base, indicator: 'NGDP_RPCH', groups: { WEOWORLD: { '2025': 3.5, '2026': 3.1, '2027': 3.4 }, ADVEC: { '2026': 2.1, '2027': 1.8 }, OEMDC: { '2026': 3.7, '2027': 4.4 } } }
const CPI = { ...base, indicator: 'PCPIPCH', groups: { WEOWORLD: { '2026': 4.7, '2027': 4.1 } } }

describe('WorldOutlook', () => {
  beforeEach(() => {
    m.fetchWeo.mockReset()
    m.fetchWeo.mockImplementation(async (ind: string) => ind === 'PCPIPCH' ? CPI : GDP)
  })

  it('answers where the world economy is heading with the IMF’s world figures, labelled as the IMF’s', async () => {
    render(<WorldOutlook />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Where is the world economy heading?')
    expect(await screen.findByText(/The IMF projects world real GDP growth of 3\.1% in 2026/)).toBeTruthy()
    expect(screen.getByText(/not this app’s forecast/)).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText('World economy at a glance').textContent).toContain('4.1'))
    const groups = screen.getByRole('region', { name: 'IMF real GDP growth by country group' })
    expect(within(groups).getByText('Advanced economies').closest('tr')!.textContent).toContain('1.8%')
    expect(screen.getAllByText(/Source: IMF, World Economic Outlook \(October 2026\)/).length).toBeGreaterThan(0)
  })

  it('gives the chart a table with the same values, projections marked', async () => {
    render(<WorldOutlook />)
    const card = (await screen.findAllByLabelText(/^World real GDP growth, 2000/)).find(e => e.tagName === 'SECTION')!
    fireEvent.click(within(card).getByRole('button', { name: 'Table' }))
    const row = within(card).getByRole('table').querySelector('tbody tr')!
    expect(row.textContent).toContain('2027')
    expect(row.textContent).toContain('IMF projection')
  })

  it('says when the IMF figures could not be loaded instead of showing numbers', async () => {
    m.fetchWeo.mockResolvedValue(null)
    render(<WorldOutlook />)
    expect(await screen.findByText(/could not be loaded/)).toBeTruthy()
    expect(screen.queryByText(/The IMF projects/)).toBeNull()
  })
})
