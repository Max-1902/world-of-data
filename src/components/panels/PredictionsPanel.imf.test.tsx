// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { Pt } from '../../utils/econAnalysis'
import type { ForecastRecord } from '../../utils/forecastRecord'

const pts = (n: number, x0: number, f: (i: number) => number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: x0 + i, y: f(i) }))
const data = { iso2: 'DE', name: 'Germany', series: {
  'NY.GDP.MKTP.KD.ZG': { points: pts(30, 1995, i => 1.5 + Math.sin(i * 1.7)) },
  'FP.CPI.TOTL.ZG': { points: pts(30, 1995, i => 2 + Math.cos(i * 1.3) * 0.5) },
  'SL.UEM.TOTL.ZS': { points: pts(30, 1995, i => 7 + Math.sin(i * 0.9)) },
} }
vi.mock('../../hooks/useCountryLookup', () => ({
  useCountryLookup: () => ({ iso2: 'DE', setIso2: () => {}, countries: [{ iso2: 'DE', iso3: 'DEU', name: 'Germany', region: 'Europe' }], listError: null, data, status: 'ready', error: null, europe: null, europeStatus: 'idle', retry: () => {} }),
}))

const m = vi.hoisted(() => ({ fetchWeo: vi.fn(), remember: vi.fn(), recordsFor: vi.fn() }))
vi.mock('../../services/imfWeo', async orig => ({ ...await orig<typeof import('../../services/imfWeo')>(), fetchWeo: m.fetchWeo }))
vi.mock('../../services/forecastLog', () => ({ remember: m.remember, recordsFor: m.recordsFor }))

const { PredictionsPanel } = await import('./PredictionsPanel')

const weo = (ind: string) => ({ indicator: ind, label: 'Real GDP growth', unit: '%', vintage: 'World Economic Outlook (October 2026)', lastModified: '2026-10-08 14:43', values: { DEU: { '2024': 5.0, '2025': 1.3, '2026': 1.4, '2027': 1.5 } } })

describe('PredictionsPanel with the IMF benchmark and forecast memory', () => {
  beforeEach(() => {
    m.fetchWeo.mockReset(); m.remember.mockReset(); m.recordsFor.mockReset()
    m.fetchWeo.mockImplementation(async (ind: string) => weo(ind))
    m.remember.mockImplementation((r: ForecastRecord) => ({ previous: null, since: r.issued }))
    m.recordsFor.mockReturnValue([])
  })

  it("shows the IMF's projections beside ours, labelled by edition and evidence kind", async () => {
    render(<PredictionsPanel />)
    await waitFor(() => expect(screen.getAllByText(/IMF benchmark/i).length).toBe(3))
    expect(screen.getAllByText(/IMF 1\.3% \(IMF estimate or projection\)/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/IMF 1\.4% \(projection\)/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Source: IMF, World Economic Outlook \(October 2026\)/).length).toBe(3)
  })

  it('warns when the IMF and World Bank levels disagree for the latest year', async () => {
    render(<PredictionsPanel />)
    await waitFor(() => expect(screen.getAllByText(/the two sources' definitions or data vintages differ/).length).toBeGreaterThan(0))
  })

  it('records each forecast once the IMF request settles, and says it is the first one on this device', async () => {
    render(<PredictionsPanel />)
    await waitFor(() => expect(m.remember).toHaveBeenCalledTimes(3))
    const rec = m.remember.mock.calls[0][0] as ForecastRecord
    expect(rec.key).toBe('DE|NY.GDP.MKTP.KD.ZG')
    expect(rec.imf?.vintage).toContain('October 2026')
    expect(screen.getAllByText(/First shown on this device/).length).toBe(3)
    expect(screen.getAllByText(/has reached its year yet/).length).toBe(3)
  })

  it('says the benchmark is unavailable rather than hiding it when the IMF request fails', async () => {
    m.fetchWeo.mockResolvedValue(null)
    render(<PredictionsPanel />)
    await waitFor(() => expect(screen.getAllByText(/IMF's figures could not be loaded/).length).toBe(3))
    expect((m.remember.mock.calls[0][0] as ForecastRecord).imf).toBeUndefined()
  })
})
