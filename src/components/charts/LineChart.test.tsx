// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LineChart } from './LineChart'
import { XYChart } from './XYChart'

const pts = (ys: (number | null)[], x0 = 2000) => ys.flatMap((v, i) => (v === null ? [] : [{ t: x0 + i, v }]))

describe('LineChart', () => {
  it('draws one line per unbroken run and breaks at missing years instead of bridging them', () => {
    const { container } = render(<LineChart ariaLabel="x." xKind="year" fmtY={String} series={[{ key: 'a', label: 'A', color: 'red', points: pts([1, 2, 3, null, null, 4, 5]) }]} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })
  it('shows a legend only for two or more series, and reference lines with labels', () => {
    const one = render(<LineChart ariaLabel="x." xKind="year" fmtY={String} series={[{ key: 'a', label: 'Alpha', color: 'red', points: pts([1, 2]) }]} />)
    expect(one.container.querySelector('.viz-legend')).toBeNull()
    one.unmount()
    render(<LineChart ariaLabel="x." xKind="year" fmtY={String} refLines={[{ v: 2, label: 'ECB target 2%' }]}
      series={[{ key: 'a', label: 'Alpha', color: 'red', points: pts([1, 3]) }, { key: 'b', label: 'Beta', color: 'blue', points: pts([2, 2]) }]} />)
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('ECB target 2%')).toBeTruthy()
  })
  it('arrow keys read every series at a date, showing — where a series has no value', () => {
    render(<LineChart ariaLabel="Test chart." xKind="year" fmtY={v => `${v}%`}
      series={[{ key: 'a', label: 'Alpha', color: 'red', points: pts([1, 3, 5]) }, { key: 'b', label: 'Beta', color: 'blue', points: pts([2, null, 6]) }]} />)
    const svg = screen.getByRole('img', { name: /Test chart/ })
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    const tip = screen.getByRole('status')
    expect(tip.textContent).toContain('2001')
    expect(tip.textContent).toContain('3%')
    expect(tip.textContent).toContain('—')
  })
  it('marks every observation when asked, and reads a shaded interval in the tooltip', () => {
    const { container } = render(<LineChart ariaLabel="Fc." xKind="year" fmtY={v => `${v}%`}
      areas={[{ key: 'ci', label: '95% interval', color: 'red', points: [{ t: 2002, lo: 3, hi: 3 }, { t: 2003, lo: 1, hi: 7 }] }]}
      series={[{ key: 'a', label: 'Actual', color: 'blue', points: pts([1, 2, 3]), markers: true }, { key: 'f', label: 'Forecast', color: 'red', points: [{ t: 2002, v: 3 }, { t: 2003, v: 4 }], dashed: true }]} />)
    expect(container.querySelectorAll('circle[r="4"]')).toHaveLength(3)
    expect(container.querySelectorAll('polygon')).toHaveLength(1)
    expect(screen.getByText('95% interval')).toBeTruthy()
    const svg = screen.getByRole('img', { name: /Fc/ })
    for (let i = 0; i < 4; i++) fireEvent.keyDown(svg, { key: 'ArrowRight' })
    const tip = screen.getByRole('status')
    expect(tip.textContent).toContain('2003')
    expect(tip.textContent).toContain('1% to 7%')
  })
  it('says so when there is nothing to draw', () => {
    render(<LineChart ariaLabel="x." xKind="year" fmtY={String} series={[{ key: 'a', label: 'A', color: 'red', points: [] }]} />)
    expect(screen.getByText('No data for this period.')).toBeTruthy()
  })
})

describe('XYChart', () => {
  it('plots one dot per year, labels the latest, and draws the fit line', () => {
    const { container } = render(<XYChart ariaLabel="Okun." xLabel="Growth" yLabel="ΔU" fmtX={String} fmtY={String} fit={{ slope: -0.4, intercept: 0.8 }}
      points={[{ key: '2001', x: 1, y: 0.4, label: '2001' }, { key: '2002', x: 3, y: -0.4, label: '2002' }, { key: '2003', x: 2, y: 0, label: '2003' }]} />)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    expect(screen.getByText('2003')).toBeTruthy()
    expect(screen.getByText('Growth')).toBeTruthy()
  })
})
