// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const m = vi.hoisted(() => ({ selectForMap: vi.fn() }))
vi.mock('../../../services/countryAnalytics', () => ({ selectForMap: m.selectForMap }))

import CountryColorControl from './CountryColorControl'
import { IndicatorPicker, matchIndicators } from './IndicatorPicker'
import { INDICATOR_BY_ID, INDICATORS } from '../../../services/countryIndicators'
import { fillPaint, NO_DATA_FILL, type Shading } from '../layers/countryAnalytics'

const ready = { status: 'ready' as const, rows: [], error: null }
function data(mode: 'value' | 'trend' = 'value', over: Record<string, unknown> = {}) {
  return {
    state: { selection: { x: 'NY.GDP.PCAP.CD', y: 'FP.CPI.TOTL.ZG' }, mapMode: mode, slices: {} },
    xMeta: INDICATOR_BY_ID.get('NY.GDP.PCAP.CD')!, yMeta: INDICATOR_BY_ID.get('FP.CPI.TOTL.ZG')!,
    xSlice: ready, ySlice: ready, setMapMode: vi.fn(), setSelection: vi.fn(),
    ...over,
  } as never
}
const shading: Shading = {
  shaded: 150, noData: ['AAA', 'BBB'], stale: new Set(['CCC']),
  cover: { n: 150, missing: [], minYear: 2015, maxYear: 2024, typicalYear: 2023, stale: ['CCC'] },
}
const colors = { mode: 'value' as const, colors: {}, lo: 0, hi: 20 }

describe('CountryColorControl', () => {
  beforeEach(() => m.selectForMap.mockReset())

  it('is a single launch button while colouring is off', () => {
    const onToggle = vi.fn()
    render(<CountryColorControl on={false} onToggle={onToggle} countryData={data()} countryShading={colors} shading={shading} raised={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Colour countries by data/ }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('labels raw values as observed and states coverage, the no-data count and dated values', () => {
    render(<CountryColorControl on onToggle={vi.fn()} countryData={data()} countryShading={colors} shading={shading} raised={false} />)
    expect(screen.getByText('Observed')).toBeTruthy()
    const region = screen.getByRole('region', { name: 'Colour countries by data' }).textContent!
    expect(region).toContain('150 countries shaded')
    expect(region).toMatch(/2 of \d+ World Bank economies have no value/)
    expect(region).toContain('Years 2015–2024, most often 2023')
    expect(region).toContain('Faded: 1 country with data from 2020 or earlier')
    expect(region).toContain('Source: World Bank')
  })

  it('labels the vs-trend view as a statistical relationship, not a cause', () => {
    render(<CountryColorControl on onToggle={vi.fn()} countryData={data('trend')} countryShading={{ ...colors, mode: 'trend' }} shading={shading} raised={false} />)
    expect(screen.getByText('Statistical')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Colour countries by data' }).textContent).toContain('not a cause')
  })

  it('says loading or unavailable instead of showing coverage it does not have', () => {
    const { rerender } = render(<CountryColorControl on onToggle={vi.fn()} countryData={data('value', { ySlice: { status: 'loading', rows: [], error: null } })} countryShading={colors} shading={shading} raised={false} />)
    expect(screen.getByRole('status').textContent).toContain('Loading')
    rerender(<CountryColorControl on onToggle={vi.fn()} countryData={data('value', { ySlice: { status: 'error', rows: [], error: 'HTTP 500' } })} countryShading={colors} shading={shading} raised={false} />)
    expect(screen.getByRole('alert').textContent).toContain('HTTP 500')
    expect(screen.queryByText(/countries shaded/)).toBeNull()
  })

  it('picks a new indicator from the searchable list', () => {
    render(<CountryColorControl on onToggle={vi.fn()} countryData={data()} countryShading={colors} shading={shading} raised={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Inflation, consumer prices/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search indicators' }), { target: { value: 'oil rents' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search indicators' }), { key: 'Enter' })
    expect(m.selectForMap).toHaveBeenCalledWith('NY.GDP.PETR.RT.ZS')
  })
})

describe('CountryColorControl with computed data', () => {
  it('says the numbers are computed, not as reported, and dates them by reporting year', () => {
    const meta = { ...INDICATOR_BY_ID.get('FP.CPI.TOTL.ZG')!, id: 'derived:x', label: 'Sales to China (% of GDP)', source: 'UN Comtrade and World Bank (computed)' }
    render(<CountryColorControl on onToggle={vi.fn()} countryData={data('value', { yMeta: meta })} countryShading={colors} shading={shading} raised={false} />)
    const text = screen.getByRole('region', { name: 'Colour countries by data' }).textContent!
    expect(text).toContain('Computed from reported figures')
    expect(text).not.toContain('As reported')
    expect(text).toContain("each country's own reporting year")
  })
})

describe('IndicatorPicker', () => {
  it('matches every word against label, theme and source', () => {
    expect(matchIndicators('').length).toBe(INDICATORS.length)
    expect(matchIndicators('ember coal').map(i => i.id)).toEqual(['ember:coal'])
    expect(matchIndicators('zzz')).toEqual([])
  })
  it('leaves out the excluded indicator and says when nothing matches', () => {
    render(<IndicatorPicker value="SP.POP.TOTL" exclude="SP.POP.GROW" onPick={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('option', { name: /Population growth/ })).toBeNull()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'qwerty' } })
    expect(screen.getByText(/No indicator matches/)).toBeTruthy()
  })
})

describe('fillPaint', () => {
  it('greys economies without data and fades dated values, leaving the rest at full strength', () => {
    const p = fillPaint({ DEU: '#111', FRA: '#222' }, ['AAA'], new Set(['FRA', 'ZZZ']))
    expect(p.color).toEqual(['match', ['get', 'iso_3166_1_alpha_3'], 'DEU', '#111', 'FRA', '#222', 'AAA', NO_DATA_FILL, 'rgba(0,0,0,0)'])
    const op = p.opacity as unknown[]
    expect(op.slice(2, 6)).toEqual(['FRA', 0.32, 'AAA', 0.55]) // ZZZ isn't shaded, so isn't listed
    expect(op[op.length - 1]).toBe(0.78)
  })
  it('falls back to plain values when there is nothing to match (Mapbox rejects an empty match)', () => {
    expect(fillPaint({}, [], new Set())).toEqual({ color: 'rgba(0,0,0,0)', opacity: 0.78 })
  })
})
