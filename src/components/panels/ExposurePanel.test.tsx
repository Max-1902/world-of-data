// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PanelState } from '../../types'

const m = vi.hoisted(() => ({
  slice: { status: 'ready', rows: [] as { iso3: string; name: string; value: number; year: string }[], error: null as string | null },
  load: vi.fn(), showDerivedOnMap: vi.fn(),
}))
vi.mock('../../services/countryAnalytics', () => ({
  countryAnalytics: { subscribe: () => () => {}, getState: () => ({}), load: m.load },
  sliceOf: () => m.slice,
  showDerivedOnMap: m.showDerivedOnMap,
}))

import ExposurePanel from './ExposurePanel'

const GDP = [
  { iso3: 'DEU', name: 'Germany', value: 4.6e12, year: '2024' }, { iso3: 'KOR', name: 'South Korea', value: 1.7e12, year: '2024' },
  { iso3: 'JPN', name: 'Japan', value: 4.0e12, year: '2024' }, { iso3: 'SAU', name: 'Saudi Arabia', value: 1.1e12, year: '2024' },
  { iso3: 'IND', name: 'India', value: 3.9e12, year: '2024' },
]

describe('ExposurePanel', () => {
  beforeEach(() => { m.slice = { status: 'ready', rows: GDP, error: null }; m.load.mockReset(); m.showDerivedOnMap.mockReset() })

  it('loads GDP, ranks economies for the default demand shock, and labels the shared path', () => {
    render(<ExposurePanel />)
    expect(m.load).toHaveBeenCalledWith('NY.GDP.MKTP.CD')
    expect(screen.getByRole('heading', { name: /Who sells most to China/ })).toBeTruthy()
    expect(screen.getAllByText('Assumption').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('opens an economy to show its own path, with observed steps and their source', () => {
    render(<ExposurePanel />)
    fireEvent.click(screen.getByRole('rowheader', { name: /Germany/ }))
    expect(screen.getAllByText('Observed').length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText(/Source: UN Comtrade/).length).toBeGreaterThan(0)
  })

  it('switches to an oil chokepoint and shows importers and exporters on opposite sides', () => {
    render(<ExposurePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Oil chokepoint' }))
    expect(screen.getByRole('heading', { name: /higher oil price/ })).toBeTruthy()
    expect(screen.getByText('same for any oil chokepoint', { exact: false })).toBeTruthy()
    expect(screen.getAllByText('Net importer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Net exporter').length).toBeGreaterThan(0)
  })

  it('adds an assumed-shock effect only once a size is typed', () => {
    render(<ExposurePanel />)
    const effects = () => screen.getAllByRole('row').slice(1).map(r => r.lastElementChild?.textContent)
    expect(effects().every(t => t === '—')).toBe(true)
    fireEvent.change(screen.getByLabelText(/Assumed fall/), { target: { value: '10' } })
    expect(effects().some(t => t !== '—')).toBe(true)
  })

  it('puts the exposure on the map and turns the colouring layer on', () => {
    const onToggleLayer = vi.fn()
    render(<ExposurePanel panelState={{ countryAnalytics: false } as PanelState} onToggleLayer={onToggleLayer} />)
    fireEvent.click(screen.getByRole('button', { name: /Show on map/ }))
    const [meta, rows] = m.showDerivedOnMap.mock.calls[0]
    expect(meta.id).toBe('derived:exposure:demand:China')
    expect(rows.every((r: { iso3: string }) => /^[A-Z]{3}$/.test(r.iso3))).toBe(true)
    expect(onToggleLayer).toHaveBeenCalledWith('countryAnalytics')
  })

  it('says GDP is unavailable instead of ranking without it', () => {
    m.slice = { status: 'error', rows: [], error: 'HTTP 500' }
    render(<ExposurePanel />)
    expect(screen.getByRole('alert').textContent).toContain('HTTP 500')
    expect(screen.queryByRole('table')).toBeNull()
  })
})
