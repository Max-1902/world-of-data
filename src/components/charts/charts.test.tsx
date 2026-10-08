// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ChartFrame } from './ChartFrame'
import { BarsChart } from './BarsChart'
import { RankChart } from './RankChart'
import { CorrMatrixChart } from './CorrMatrixChart'
import { TimeSeriesChart } from './TimeSeriesChart'
import { HeatmapChart } from './HeatmapChart'
import { MagnitudeChart } from './MagnitudeChart'
import type { CorrMatrix } from '../../utils/countryStats'

describe('ChartFrame', () => {
  const table = { columns: ['Region', 'Count'], rows: [['Alpha', 3], ['Beta', 5]] }

  it('shows the chart first and swaps in a table carrying every value', () => {
    render(<ChartFrame title="Quakes by region" subtitle="last 7 days" table={table}><div data-testid="plot" /></ChartFrame>)
    expect(screen.getByRole('heading', { name: 'Quakes by region' })).toBeTruthy()
    expect(screen.getByText('last 7 days')).toBeTruthy()
    expect(screen.getByTestId('plot')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chart' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(screen.queryByTestId('plot')).toBeNull()
    const grid = screen.getByRole('table')
    expect(within(grid).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Region', 'Count'])
    expect(within(grid).getByRole('rowheader', { name: 'Beta' })).toBeTruthy()
    expect(within(grid).getByText('5')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Chart' }))
    expect(screen.getByTestId('plot')).toBeTruthy()
  })

  it('renders an optional footer', () => {
    render(<ChartFrame title="T" table={table} footer={<span>Source: USGS</span>}><i /></ChartFrame>)
    expect(screen.getByText('Source: USGS')).toBeTruthy()
  })
})

describe('BarsChart', () => {
  const items = [{ label: 'Mon', value: 4 }, { label: 'Tue', value: 0 }, { label: 'Wed', value: 12, detail: 'peak day' }]

  it('draws a labelled bar per non-zero value and an accessible name', () => {
    const { container } = render(<BarsChart items={items} ariaLabel="Fires per day" unit="fires" />)
    expect(screen.getByRole('img', { name: 'Fires per day' })).toBeTruthy()
    // a zero bar draws no path; the other two do
    expect(container.querySelectorAll('svg path')).toHaveLength(2)
    // few bars → the value sits on each cap, and every x label is shown
    expect(screen.getAllByText('Mon').length).toBeGreaterThan(0)
    // the cap label (bold) — the axis may also end on a '12' tick now that it hugs the data
    expect(screen.getAllByText('12').some(t => t.getAttribute('font-weight') === '600')).toBe(true)
  })

  it('shows a hover readout with the value, unit and detail', () => {
    const { container } = render(<BarsChart items={items} ariaLabel="Fires per day" unit="fires" />)
    const groups = container.querySelectorAll('svg g > rect[fill="transparent"]')
    fireEvent.pointerMove(groups[2].parentElement!, { clientX: 100, clientY: 40 })
    const tip = screen.getByRole('status')
    expect(tip.textContent).toContain('Wed')
    expect(tip.textContent).toContain('12')
    expect(tip.textContent).toContain('fires')
    expect(tip.textContent).toContain('peak day')
    fireEvent.pointerLeave(groups[2].parentElement!)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('thins x labels with tickEvery', () => {
    const many = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, value: i + 1 }))
    const { container } = render(<BarsChart items={many} ariaLabel="By hour" unit="x" tickEvery={6} />)
    const labels = [...container.querySelectorAll('text')].map(t => t.textContent)
    expect(labels).toContain('0h'); expect(labels).toContain('6h'); expect(labels).toContain('18h')
    expect(labels).not.toContain('5h')
  })

  it('does not crash with no data', () => {
    expect(() => render(<BarsChart items={[]} ariaLabel="empty" unit="x" />)).not.toThrow()
  })
})

describe('RankChart', () => {
  const items = [
    { key: 'a', label: 'Japan', value: 10, text: '10.0' },
    { key: 'b', label: 'A very long country name indeed', value: 5, text: '5.0', detail: 'est. 2022' },
  ]

  it('reports which row was clicked and truncates long labels', () => {
    const onSelect = vi.fn()
    render(<RankChart items={items} ariaLabel="Top countries" onSelect={onSelect} />)
    expect(screen.getByRole('img', { name: 'Top countries' })).toBeTruthy()
    fireEvent.click(screen.getByText('Japan'))
    expect(onSelect).toHaveBeenCalledWith('a')
    expect(screen.getByText(/^A very long .*…$/)).toBeTruthy()
  })

  it('shows the detail line on hover', () => {
    render(<RankChart items={items} ariaLabel="Top countries" />)
    fireEvent.pointerMove(screen.getByText('5.0').parentElement!, { clientX: 60, clientY: 30 })
    expect(screen.getByRole('status').textContent).toContain('est. 2022')
  })
})

describe('RankChart sizeWith', () => {
  const above = [{ key: 'a', label: 'Japan', value: 3, text: '+3.0 σ' }]
  const below = [{ key: 'b', label: 'Central African Republic', value: 1.5, text: '−1.5 σ' }]
  const bar = (c: HTMLElement) => c.querySelector('svg path')!.getAttribute('d')!
  const startX = (d: string) => Number(d.slice(1).split(',')[0])
  const endX = (d: string) => Math.max(...[...d.matchAll(/H([\d.]+)/g)].map(m => Number(m[1])))

  it('stacked charts share one label column and one bar scale', () => {
    const all = [...above, ...below]
    const a = render(<RankChart items={above} sizeWith={all} ariaLabel="above" />).container
    const b = render(<RankChart items={below} sizeWith={all} ariaLabel="below" />).container
    expect(startX(bar(a))).toBe(startX(bar(b)))                 // bars start at the same x
    const lenA = endX(bar(a)) - startX(bar(a)), lenB = endX(bar(b)) - startX(bar(b))
    expect(lenB / lenA).toBeCloseTo(0.5, 1)                     // 1.5σ draws half as long as 3σ
  })
})

describe('CorrMatrixChart', () => {
  const matrix: CorrMatrix = {
    ids: ['gdp', 'life'],
    rho: [[1, 0.82], [0.82, 1]],
    n: [[150, 140], [140, 150]],
  } as unknown as CorrMatrix

  it('prints each coefficient and lets a cell be picked', () => {
    const onPick = vi.fn()
    const { container } = render(<CorrMatrixChart matrix={matrix} labels={['GDP', 'Life']} names={['GDP', 'Life expectancy']} onPick={onPick} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('2 country indicators')
    expect(container.textContent).toContain('.82')   // coefficients print without a leading zero
    const cells = [...container.querySelectorAll('svg g')].filter(g => (g as SVGGElement).style.cursor === 'pointer')
    expect(cells.length).toBeGreaterThan(0)
    fireEvent.click(cells[0])
    expect(onPick).toHaveBeenCalledTimes(1)
    const [i, j] = onPick.mock.calls[0]
    expect(i).not.toBe(j)   // the diagonal is not pickable
  })
})

describe('TimeSeriesChart', () => {
  const t0 = Date.UTC(2026, 9, 1)
  const points = Array.from({ length: 6 }, (_, i) => ({ t: t0 + i * 3_600_000, value: i * 2, avg: i >= 2 ? i : null }))
  const props = {
    points, valueLabel: 'Detections', avgLabel: '3h avg', ariaLabel: 'Detections per hour.',
    fmtTick: (t: number) => `${new Date(t).getUTCHours()}h`, fmtTitle: (t: number) => `at ${new Date(t).getUTCHours()}:00`,
  }

  it('renders a labelled chart with a legend and first/middle/last ticks', () => {
    const { container } = render(<TimeSeriesChart {...props} />)
    expect(screen.getByRole('img', { name: /Detections per hour\./ })).toBeTruthy()
    expect(screen.getByText('3h avg')).toBeTruthy()
    const ticks = [...container.querySelectorAll('svg text')].map(t => t.textContent)
    expect(ticks).toEqual(expect.arrayContaining(['0h', '2h', '5h']))
  })

  it('can be read with the keyboard: arrows move the readout, Escape clears it', () => {
    render(<TimeSeriesChart {...props} />)
    const svg = screen.getByRole('img')
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).toContain('at 0:00')
    fireEvent.keyDown(svg, { key: 'ArrowRight' }); fireEvent.keyDown(svg, { key: 'ArrowRight' })
    const tip = screen.getByRole('status').textContent!
    expect(tip).toContain('at 2:00')
    expect(tip).toContain('4')          // the bar's value
    expect(tip).toContain('2.0')        // the 3h average at that point
    fireEvent.keyDown(svg, { key: 'Escape' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not stop at either end of the series', () => {
    render(<TimeSeriesChart {...props} />)
    const svg = screen.getByRole('img')
    fireEvent.keyDown(svg, { key: 'ArrowLeft' })
    expect(screen.getByRole('status').textContent).toContain('at 5:00')   // wraps in from the right when nothing is active
    for (let i = 0; i < 10; i++) fireEvent.keyDown(svg, { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).toContain('at 5:00')
  })
})

describe('HeatmapChart', () => {
  it('renders without throwing for a small matrix and exposes its label', () => {
    const matrix = { rows: ['Asia', 'Europe'], cols: [1, 2, 3], cells: [[1, 0, 2], [0, 4, 1]], max: 4 }
    expect(() => render(
      <HeatmapChart matrix={matrix as never} unit="quakes" fmtCol={t => `d${t}`} ariaLabel="Region by day" onRowClick={() => {}} />,
    )).not.toThrow()
    expect(screen.getByRole('img', { name: 'Region by day' })).toBeTruthy()
  })
})

describe('MagnitudeChart', () => {
  it('explains itself instead of drawing a curve through fewer than two points', () => {
    render(<MagnitudeChart gr={{ points: [] } as never} />)
    expect(screen.getByText(/Too few earthquakes/)).toBeTruthy()
  })
})
